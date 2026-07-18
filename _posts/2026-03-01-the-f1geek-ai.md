---
layout: post
title: "🏎️ The F1 Geek AI, sitting beside apexclub.live"
date: 2026-03-01 14:00:00 +0100
mood: speechless
description: I built a chat assistant that talks to the F1 results database in plain English. Single tool, SELECT-only prompt, SSE streaming, guest access, and a personality that refuses to do anything else.
tags:
  - go
  - ai
  - postgresql
  - f1
  - gotchas
---

<figure class="aligncenter">
  <img src="{{ "images/f1geek_ai.png" | absolute_url }}" alt="a chat window answering an F1 trivia question" />
</figure>

It's been on [apexclub.live](https://apexclub.live){:target="_blank"} for a few months now, but I never wrote down the story. The short version: there's a chat box on the F1 side of the site where you can ask things like _"who leads the constructors' championship after race 7?"_ and the answer comes back streaming, in Portuguese or English, grounded in real data. I built it. It's delightful, and it's also where most of the work happened.

<!--more-->

> TL;DR: A tool-using LLM loop with a single `execute_sql` tool, a SELECT-only prompt, a read-only PostgreSQL role dedicated to the chat, and a fair number of follow-up patches to keep the model from leaking SQL, fabricating standings, or going silent.

## What it actually is

A small Go service. The public surface is a chat endpoint. The user types a question. The model writes SQL. The SQL runs against a read-only database role. The result is summarised back into natural language. Tokens stream to the browser as the model produces them.

The interesting constraint is what the model *can* do. It has exactly one tool, and the tool is bolted shut to read-only queries. The system prompt carries the database schema, the rules for translating user questions into SQL, and the personality rules for how to talk about the result. There's no vector store, no embeddings pipeline, no orchestrator, no multi-agent anything. Just a chat loop, one well-scoped tool, and a database that's polite about which questions it answers.

Behind login, conversations are persistent and tied to the user. Without login, anyone can ask a question through a guest endpoint: short conversations, throttled, and swept every 24 hours. The hard isolation between guest and user data is what made me willing to ship the unauthenticated path at all.

The transport is Server-Sent Events. Tokens stream back to the browser as they're generated. The chat UI is plain HTMX on the frontend, no React, no nothing. Streaming is what makes the thing feel alive.

## Why it had to exist

Before the chat, the only way to answer "who's leading the constructors after race 7" was to open the standings page, scroll to a tab, mentally project standings forward, or DM me. Both options were bad. I wanted a thing where fans could ask in their own words and get an answer pulled from the live database, not from a model pretending to remember 2023 results.

The subtext is the interesting part. The analytics data already existed, in good shape, synced from a public F1 data source every Monday. Most "F1 trivia" questions are three joins away from the live tables. The schema is well-defined and the data is reliable. The only missing piece was a polite SQL interface that knew which questions to translate and which to refuse.

The product question, _do you have to log in to ask a question?_, got an answer of "no, with limits". Most fans will never make an account. A guest endpoint with rate limits and a hard cleanup job is the difference between a feature that exists and a feature anyone uses.

## The idea

A tool-use loop with one tool is a sweet spot. Two tools and the model gets clever. Zero tools and the model gets hallucinatory. One tool, well-scoped, with the schema embedded in the prompt, is a thing the model can carry reliably across providers.

The shape, in Go:

```go
type ChatService struct {
    model    ModelClient        // OpenRouter or compatible
    executor *SQLExecutor       // SELECT-only, with timeout and row cap
    repo     ConversationRepo   // persistence
}

func (s *ChatService) ProcessMessage(ctx context.Context, convID int, userMsg string) (<-chan StreamEvent, error) {
    // Build the prompt from system instructions + schema docs + prior turns.
    // Loop: send prompt -> if model returns a tool call -> validate + execute -> feed result back -> continue.
    // If the model returns a final answer, stream it token-by-token to the channel.
}
```

The loop is the entire brain of the system. Everything else is plumbing.

Three properties fall out of the shape, not from extra effort:

The tool surface is exactly one verb, `execute_sql(query: string) -> json`. The model can ask the database a question. It cannot ask the database to do anything. Schema discovery, retrieval, ranking, all of it happens through the same verb.

The prompt carries the contract. The system message has the schema, the rules for translating questions, the rules for refusing to answer, and the personality. Treating the prompt as a first-class artifact, versioned, tested, reviewable, is what kept the system from drifting.

The database is the trust boundary. The model can never write. The read-only role guarantees it at the infrastructure layer. If the prompt were ever bypassed, if the validator were ever bypassed, the database would still refuse.

## Implementation, in the relevant bits

Five pieces matter. Each is small enough to walk through.

### The tool itself

One tool definition, registered with the model:

```go
var executeSQLTool = Tool{
    Name: "execute_sql",
    Description: "Run a single read-only SQL query against the F1 analytics " +
        "database. Returns JSON rows. Never use this for anything except SELECTs.",
    Parameters: schema.Object{
        "query": schema.String("A single read-only SQL query."),
    },
}
```

The description is half the contract. The model reads it before deciding whether to call the tool. Phrasing it as "never use this for anything except SELECTs" sets the default. The validator catches the rest.

### The validator

A separate `SQLExecutor` runs the query. Before any execution, it validates:

```go
func (e *SQLExecutor) validate(query string) error {
    // Strip leading SQL comments so a query that opens with "-- description"
    // is still seen as starting with the real statement keyword.
    stripped := stripSQLComments(query)

    // Must start with SELECT or WITH.
    upper := strings.ToUpper(strings.TrimSpace(stripped))
    if !strings.HasPrefix(upper, "SELECT") && !strings.HasPrefix(upper, "WITH") {
        return errors.New("only SELECT queries are allowed")
    }

    // WITH RECURSIVE is rejected up front — potential infinite-loop DoS.
    if strings.HasPrefix(upper, "WITH") && strings.Contains(upper, "RECURSIVE") {
        return errors.New("recursive CTEs are not allowed")
    }

    // Block mutation keywords, but only outside string literals — otherwise
    // "SELECT 'DELETE FROM x' AS note" trips a false positive.
    noStrings := stripStringLiterals(stripped)
    if mutationKeywords.MatchString(noStrings) {
        return errors.New("query contains disallowed keywords")
    }

    // No semicolons — single-statement only, no multi-statement injection.
    if strings.Contains(query, ";") {
        return errors.New("multi-statement queries are not allowed")
    }
    return nil
}
```

After validation, the executor auto-appends a `LIMIT` to the outer query if one is missing, runs it under a per-query timeout, and caps the row count. The LLM can't accidentally produce a Cartesian product that takes down the database. It can't run a `DELETE`. It can't inject a second statement.

### The read-only role

The chat connects to the database as a dedicated PostgreSQL role whose grants are `SELECT` only:

```sql
CREATE ROLE f1geek_readonly LOGIN PASSWORD '...';
GRANT USAGE ON SCHEMA analytics TO f1geek_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO f1geek_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics
  GRANT SELECT ON TABLES TO f1geek_readonly;
```

If the prompt were ever bypassed, if the validator were ever bypassed, the database would still refuse. The chat's database connection is also a separate connection from the application's main pool. When the readonly database is unavailable, the chat endpoint disables itself rather than borrowing the application's write-capable credentials.

### The streaming

Tokens stream back to the browser as the model produces them. The HTTP handler upgrades the response to an SSE channel. Each chunk is one event. The connection stays open until the model returns a final answer or the user closes the tab.

The one detail that matters: processing is detached from the HTTP request. The handler wraps the request context with `context.WithoutCancel(...)` and a five-minute timeout before kicking off the LLM call. A user closing their browser doesn't cancel the work. The answer is persisted to the conversation, and the next page load sees the full reply.

```go
// Detached from the request so a disconnecting browser doesn't lose
// the persisted answer.
processCtx, cancel := context.WithTimeout(
    context.WithoutCancel(r.Context()),
    5*time.Minute,
)
defer cancel()
```

### The isolation

Each browser tab is bound to one conversation at a time. The SSE stream that the chat opens for a turn is scoped to the conversation that started it. Switching conversations mid-stream (clicking on a different chat in the sidebar) ignores thinking events and token events from the old stream. The guard is small:

```go
func (s *ChatService) isActive(conversationID int) bool {
    return s.activeConversationID.Load() == conversationID
}
```

Before each event is emitted to the browser, the service checks `isActive`. If the user has moved on, the event is dropped on the floor rather than dumped into the wrong conversation.

## The traps, in order

Most of the build was fixing the things I got wrong the first time. Five worth naming.

**The personality leak.** First week, a user asked "which tables do you have access to?" and the model cheerfully replied with the full schema, then wrote SQL on a different turn. The fix: the prompt got a hard rule, _never reveal schemas, tool names, or SQL_, and the loop stopped emitting raw tool output back to the user when the tool was just an internal SQL probe. That alone took "this is a security concern" off my mental list.

**Empty responses.** Some model providers occasionally return zero content after a tool call. No error, just an empty `assistant` message, then the loop ends. The user sees nothing. Two fixes, layered: the loop retries the same call up to twice before giving up, and the system prompt nudges the model to summarise instead of going silent. The same pass also stopped streaming a redundant second copy of the final content. Capturing the final answer rather than re-emitting it cut the average time-to-first-byte roughly in half.

**Context summarisation.** Ten-message conversations were fine. Thirty-message conversations blew past the context window for any non-trivial SQL plan. The fix is unglamorous: a `context_summaries` table holds a running summary. On each turn the service rehydrates from the latest summary plus every message strictly after the summarised message. Old turns get summarised in the background. New turns ride on top. It's not clever. It's a wall of `SELECT`s and one `UPDATE`. It lets long investigations stay coherent without anyone paying for a 100k-token prompt.

**The "current season" anchor.** In February 2026 the model kept answering questions about 2025 with confidence. A driver who retired last year got an invented 2026 seat. The fix was to pin `current season = 2026` into the system prompt at boot. Obvious in writing. In practice you only notice the bug three months too late, when someone asks about a driver who retired last year and the model fills in a plausible-but-wrong roster.

**Guest access as a product question.** The product question was: do you have to log in to ask a question? My answer was no, but with limits. Guest conversations are short, throttled, and swept every 24 hours by a background job. They share no storage with logged-in conversations. The hard isolation (different table partitioning, separate cleanup, no shared context) is what made me willing to ship an unauthenticated endpoint at all.

## What I actually learned

Three things that outlive the project.

One tool is a sweet spot. Two tools and the model gets clever. Zero tools and the model gets hallucinatory. One tool, well-scoped, with the schema embedded in the prompt, is a thing the model can carry reliably across providers.

The prompt is code. Each of the follow-ups above was a tiny patch to the prompt. Treating the prompt as a first-class artifact, committed, tested, reviewable, saved me from the usual "we should rewrite the prompt" cycle. There is no _rewrite the prompt_ in this codebase. There are diffs.

The boring architecture is the right one. I didn't need a vector store, an embeddings pipeline, an orchestrator, or a multi-agent anything. I needed `SELECT` access to my own database and a model that's polite about it. The thing I didn't have to build is the more interesting one.

## Where it's still rough

A few things I would change if I were rewriting today.

I tested by hand and ran end-to-end tests for happy paths. There is no structured eval harness. There is no regression test that says "the answer to race-7 standings should mention Verstappen." A prompt regression suite is on my list.

The summariser is dumb. It summarises. It doesn't re-rank or forget. A real long-conversation system would do both. Mine is fine for ~80 turns, more than enough for fan trivia, less than enough for serious power users.

There is no real streaming backpressure. If the model goes fast, the SSE channel can outrun the network. Right now I trust the server runtime to buffer. On a long cell tower it occasionally stutters. A heartbeat every N tokens would fix it.

The query-log feedback loop is half-built. A `query_log` table records what the model ran. A `token_usage` table records what each turn cost. The data is there. The dashboard isn't. Indexes tuned for the generated queries already exist. A view that surfaces "questions the model got wrong" would let me focus prompt work where it pays off.

None of these are blockers. The thing works, fans use it, and it has survived a full season of increasingly weird trivia questions already. I'll probably patch the eval harness next, then ignore the rest for another year.

---

The full source lives in a private repo, so the linked code paths aren't public, but the shape is generalisable: one tool, one read-only role, one system prompt, one streaming loop, and the discipline to keep each of them boring. If you want a tour through the early prototype and the SSE wiring, the [testcontainers post I wrote in 2023]({% post_url 2023-04-17-test-db-integrations-with-testcontainers %}) is still mostly relevant. The integration test pattern hasn't changed.

What about you — would you ship a tool-use loop behind an unauthenticated endpoint, or is that a hard no for your threat model?
