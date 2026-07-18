---
layout: post
title: "🏎️ The F1 Geek AI, sitting beside apexclub.live"
date: 2026-03-01 14:00:00 +0100
mood: speechless
description: I built a chat assistant that talks to the F1 results database in plain English, with SSE streaming, guest access, and a personality that refuses to write anything except SELECTs.
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

It's been on [apexclub.live](https://apexclub.live){:target="\_blank"} for a few months now, but I never wrote down the story. The short version: there's a chat box on the F1 side of the site where you can ask things like _"who leads the constructors' championship after race 7?"_ and the answer comes back streaming, in Portuguese or English, grounded in real data. I built it. It's delightful, and it's also where most of the work happened.

<!--more-->

> TL;DR: A tool-using LLM loop with a single `execute_sql` tool, a SELECT-only prompt, and a fair number of follow-up patches to keep the model from leaking SQL or running off into hallucinated standings. Code under [`internal/f1/geek/`](https://github.com/flavio1110/f1bet/tree/main/internal/f1/geek) in the f1bet repo.

## What it actually is

A small Go service under [`internal/f1/geek/`](https://github.com/flavio1110/f1bet/tree/main/internal/f1/geek) in [f1bet](https://github.com/flavio1110/f1bet){:target="\_blank"}:

- `handler.go` — HTTP endpoints (`ListConversations`, `CreateConversation`, `GetConversation`, `DeleteConversation`, `SendMessage`, plus the unauthenticated [`GuestAsk`](https://github.com/flavio1110/f1bet/blob/main/internal/f1/geek/handler.go)).
- `service.go` — `Service.ProcessMessage`, the OpenRouter-backed tool-use loop.
- `prompt.go` — the system prompt + the embedded SQL skill docs.
- `access.go` — the `ReasoningEmails` allowlist and per-conversation rate limits.
- `cleanup_job.go` — the 24-hour sweeper for guest conversations.

The data lives in five tables in the `f1geek` schema: `conversations`, `messages`, `query_log`, `token_usage`, and `context_summaries`. That last one was the first surprise I had to design around.

Six HTTP routes — five behind login, one open to guests — wired up in [`internal/f1/routes.go`](https://github.com/flavio1110/f1bet/blob/main/internal/f1/routes.go) around lines 120–125 as `/f1geek/conversations[...]` and `/f1geek/guest/ask`. Tokens stream back to the browser via Server-Sent Events; the chat is plain HTMX on the frontend, no React, no nothing.

## Why it had to exist

Before the chat, the only way to ask "who's leading the constructors after race 7" was to open the standings page, scroll to a tab, mentally project standings forward… or DM me. Both were bad. I wanted a thing where fans could ask in their own words and get an answer pulled from the live database — not from a model pretending to remember 2023 results.

The subtext: the analytics data already exists, in good shape, sync-ed from Jolpica every Monday. Most "F1 trivia" answers are three joins away. So the only missing piece was a polite SQL interface.

## The traps, in order

I shipped the first version in commit [`1b8119d`](https://github.com/flavio1110/f1bet/commit/1b8119d) — a complete chat, SSE streaming, end-to-end tests, all on a single weekend. Then the follow-ups started teaching me things, one per week.

### 1. The personality leak (`5a8c50b`)

First week, a user asked "which tables do you have access to?" and the model cheerfully replied with the full schema, then wrote SQL on a different turn. The fix landed in [`5a8c50b`](https://github.com/flavio1110/f1bet/commit/5a8c50b): the prompt in `prompt.go` got a hard rule — _never reveal schemas, tool names, or SQL_, and the loop also stopped emitting the raw tool output back to the user when the tool was just an internal SQL probe. That alone took "this is a security concern" off my mental list.

### 2. Empty responses (`9a8d1b0`)

Then came the empty-response bug. Some OpenRouter models occasionally return zero content after a tool call — no error, just an empty `assistant` message, then the loop ends. The user sees nothing. The fix in [`9a8d1b0`](https://github.com/flavio1110/f1bet/commit/9a8d1b0) added two retries before giving up, plus a personality tightening that nudges the model to summarise instead of going silent. Capturing the final content rather than streaming a redundant second pass went into the same commit — a small efficiency, but it cut the average TTFB in half.

### 3. Context summarisation

Ten-message conversations were fine. Thirty-message conversations blow past the context window for any non-trivial SQL plan. [`buildContext`](https://github.com/flavio1110/f1bet/blob/main/internal/f1/geek/service.go) rehydrates from the latest `context_summaries` row + every message strictly after `SummarizedUpToMessageID`. Old turns get summarised in the background; new turns ride on top. It's not clever — it's just a wall of SELECTs and one UPDATE — but it lets long investigations stay coherent without anyone paying for a 100k-token prompt.

### 4. The "current season" anchor (`2219515`)

In February 2026 the model kept answering questions about 2025 with confidence. Commit [`2219515`](https://github.com/flavio1110/f1bet/commit/2219515) pinned `current season = 2026` into the system prompt at boot. It feels obvious in writing; in practice you only notice the bug three months too late, when someone asks about a driver who retired last year and the model invents a 2026 seat for them.

### 5. Guest access (`459f50d`)

The product question was: do you have to log in to ask a question? My answer was no, but with limits. [`access.go`](https://github.com/flavio1110/f1bet/blob/main/internal/f1/geek/access.go) keeps a `ReasoningEmails` allowlist (a `*` grants everything) for the full-fat experience. The `GuestAsk` endpoint is its own thing — short conversations, throttled, and [`cleanup_job.go`](https://github.com/flavio1110/f1bet/blob/main/internal/f1/geek/cleanup_job.go) sweeps them every 24 hours. The hard isolation between guest and user conversations is what made me willing to ship this without auth at all.

### 6. The access flag (`b9e5060`)

The last commit to land was a boring one — [`b9e5060`](https://github.com/flavio1110/f1bet/commit/b9e5060) finalised the `ReasoningEmails` flag for the rollout. Boring commits are the ones you remember most.

## What I actually learned

Three things that outlive the project:

1. **A tool-use loop with one tool is a sweet spot.** Two tools and the model gets clever. Zero tools and the model gets hallucinatory. One tool, well-scoped, with the schema embedded in the prompt — that's a thing the model can carry reliably across providers.
2. **Capturing the final content is fine.** I was anxious about streaming-then-also-emitting-content, but it turned into redundant double work. The current loop streams tool calls, then streams the final answer. Once.
3. **Prompts are code.** Each of the six follow-ups above was a tiny patch to `prompt.go`. Treating the prompt as a first-class artifact — committed, tested, reviewable — saved me from the usual "we should rewrite the prompt" cycle. There is no _rewrite the prompt_ in this codebase. There are diffs.

There's also a quieter lesson. The thing I didn't have to build is the more interesting one. I didn't need a vector store, an embeddings pipeline, an orchestrator, a multi-agent anything. I needed SELECT access to my own database and a model that's polite about it. Sometimes the boring architecture is the right one.

## Where it's still rough

A few things I would change if I were rewriting today:

- **No structured eval harness.** I tested by hand and ran e2e tests for happy paths. There is no regression test that says "the answer to race-7 standings should mention Verstappen." A prompt regression suite is on my list.
- **The summariser is dumb.** It summarises; it doesn't _re-rank_ or _forget_. A real long-conversation system would do both. Mine is fine for ~80 turns, which is more than enough for fan trivia, less than enough for serious power users.
- **No real streaming backpressure.** If the model goes fast, the SSE channel can outrun the network. Right now I trust the server runtime to buffer; on a long cell tower it occasionally stutters. A heartbeat every N tokens would fix it.

None of these are blockers. The thing works, fans use it, and it has survived a full season of increasingly weird trivia questions already. I'll probably patch the eval harness next, then ignore the rest for another year.

The full code is in [`flavio1110/f1bet`](https://github.com/flavio1110/f1bet){:target="\_blank"} under [`internal/f1/geek/`](https://github.com/flavio1110/f1bet/tree/main/internal/f1/geek). If you want a tour through the early prototype and the SSE wiring, the [testcontainers post I wrote in 2023]({% post_url 2023-04-17-test-db-integrations-with-testcontainers %}) is still mostly relevant — the integration test pattern hasn't changed. What about you — would you ship a tool-use loop behind an unauthenticated endpoint, or is that a hard no for your threat model?
