---
layout: post
title: "🏎️ F1 Geek AI: data before the prediction"
date: 2026-03-01 14:00:00 +0100
mood: speechless
description: How I built the customer-facing F1 data chat on apexclub.live, the bugs behind the smooth panel, and where it still falls short.
tags:
  - ai
  - go
  - postgresql
  - gotchas
---

<figure class="aligncenter">
  <img src="{{ "images/f1-geek-ai.jpg" | absolute_url }}" alt="An F1 analytics dashboard with a chat bubble in the middle" />
</figure>

[F1 Geek AI](https://apexclub.live){:target="\_blank"} is the customer-facing chat inside apexclub.live. It lets someone ask things like "How has Verstappen done at Monaco since 2022?" before locking a prediction, without learning the analytics schema or writing SQL.

It sounds like a chat panel. Most of the work was making sure the answer came from F1 data, the conversation survived a slow request, and a user changing chats didn't see another response arrive in the wrong place.

<!--more-->

> TL;DR: F1 Geek turns a user's question into read-only `SELECT` queries over the `analytics` schema, feeds the rows back to the model, and streams the final answer to the browser with Server-Sent Events. The first complete version landed on **March 1, 2026** in commit [`1b8119d`](https://github.com/flavio1110/f1bet/commit/1b8119dc1ddb0acc07eb02de54297651651d0ca1){:target="\_blank"}. The difficult bits came immediately after: empty model responses, SQL validation, disconnected browsers, rate limits, and conversation isolation.

## What it is

The entry points are regular customer routes, not the admin bot. `internal/f1/routes.go` registers conversation endpoints plus `POST /f1geek/guest/ask`, and `internal/f1/geek/handler.go` owns the HTTP and SSE parts.

An authenticated user gets saved conversations. A guest gets a single-turn conversation, limited by IP, so they can try the feature before creating an account. The guest handler still persists that turn for processing and audit, then the cleanup job removes guest conversations after 24 hours.

The path for one question is roughly:

```text
browser
  -> F1 Geek handler
  -> conversation history + system prompt
  -> LLM tool call: execute_sql
  -> read-only analytics database
  -> rows back to the LLM
  -> final answer over SSE
```

`internal/f1/geek/prompt.go` embeds two schema guides: `skills/analytics-results.md` and `skills/analytics-standings.md`. They describe data from 1950 onwards, including:

- `analytics.races`, `analytics.circuits`, `analytics.drivers`, and `analytics.constructors`;
- `analytics.race_results`, `qualifying_results`, and `sprint_results`;
- per-race and season-final driver/constructor standings;
- pit stops and lap times, added on March 6 in [`9b8a4df`](https://github.com/flavio1110/f1bet/commit/9b8a4df411d219d696d37d19e90ea9002d808acc){:target="\_blank"}.

That prompt is what turns "Who gained the most positions?" into a query using `race_results.grid` and `race_results.position`, rather than an answer from the model's memory.

`internal/f1/geek/service.go` then runs a bounded tool loop. The only tool is `execute_sql`. The model can query more than once for a comparison, but each call goes through the shared SQL executor.

The chat metadata lives separately in `f1geek.conversations`, `f1geek.messages`, `f1geek.query_log`, and `f1geek.token_usage`. The analytical rows come from a separately configured read-only connection. `cmd/f1bet/main.go` treats that connection as optional: if it is unavailable, the application stays up and F1 Geek is disabled.

## The problem it solves

Making an F1 prediction is more fun when there is some evidence behind it. The evidence was already in apexclub, but it was stored for machines: seasons, rounds, driver IDs, result positions, standings snapshots, lap times.

A member should not have to know whether "champion by year" belongs in `season_driver_standings` or whether "places gained" needs grid minus finish position. The useful interface is the question they already have while choosing a podium.

This is also why I made the answers short. The current prompt says "post-race debrief, not lecture" and asks for totals plus a one-liner unless the user requests a breakdown. The chat sits next to prediction work; it is not trying to become a Formula 1 encyclopedia.

The feature became easier to discover later. PR [#25](https://github.com/flavio1110/f1bet/pull/25){:target="\_blank"} added an Ask F1 Geek field to the homepage and race-specific suggestions on the prediction page. The implementation date for this post is still March 1, when the customer chat itself landed, not April 7 when those extra entry points were merged.

## Implementation gotchas

### The model answered, then the code asked again

The first service loop inspected non-streaming tool calls. When the model finally returned text, the code broke out of the loop and started a second streaming completion to get the visible answer.

That redundant call often returned empty content.

Commit [`9a8d1b0`](https://github.com/flavio1110/f1bet/commit/9a8d1b0a263ad388b8a32d8bef3aab8a081c9549){:target="\_blank"} fixed it by keeping the final text already returned by the tool loop. F1 Geek now emits that text as an SSE `token` event and only falls back to a streaming call when the loop has no content. The fallback retries empty streams twice.

The obvious architecture — one call for tools and one for streaming — was also the unreliable one. Reusing the answer already paid for was simpler and fixed the radio silence.

### Read-only needed more than a sentence in the prompt

The prompt tells the model to generate only `SELECT` queries, but `internal/infra/chat/sql_executor.go` enforces the rule again.

It requires a query to start with `SELECT` or `WITH`, blocks mutation keywords and semicolons, rejects recursive CTEs, adds an outer `LIMIT` when needed, and runs with a timeout. Migration `000017_create_f1geek_schema.up.sql` also creates the `f1geek_readonly` role with `SELECT` privileges on `analytics`.

The validator itself had gotchas. Models sometimes put a `-- comment` before a query, so commit [`af5b75f`](https://github.com/flavio1110/f1bet/commit/af5b75fdbea78003fd4caccba2733501d8057894){:target="\_blank"} had to strip comments before checking the first keyword. Then [`5a8c50b`](https://github.com/flavio1110/f1bet/commit/5a8c50bed93b81ecd3d1ba155f4e64bca01a243e){:target="\_blank"} stopped words inside string literals from causing false positives and fixed `LIMIT` detection when subqueries had their own limit.

Prompt rules are useful guidance. Permissions, validation, row caps, and timeouts are the boundary.

### Streaming outlived the browser

An LLM request can still be running when someone closes the panel, changes page, or loses the connection. If the request context cancels at that moment, the assistant answer is lost from the saved conversation.

[`af5b75f`](https://github.com/flavio1110/f1bet/commit/af5b75fdbea78003fd4caccba2733501d8057894){:target="\_blank"} detached processing from the HTTP request with `context.WithoutCancel`, then put a five-minute timeout around it. The stream may disappear, but the result can still be stored and loaded when the conversation opens again.

The browser had the opposite problem. It could switch conversations while an old stream was still delivering events. Commit [`11f538d`](https://github.com/flavio1110/f1bet/commit/11f538ddcf7be19e9aa78b652d2d15cb2ff90ab0){:target="\_blank"} scoped each stream to the conversation that started it. Thinking and token events are ignored if the user has moved to another chat.

The request and the UI needed separate lifetimes. I had treated them as one at first.

### Guest access turned IP handling into product logic

Guest mode landed in [`459f50d`](https://github.com/flavio1110/f1bet/commit/459f50dfd72dd882856eebddc1ff866cfbff61d6){:target="\_blank"}. `f1geek.conversations.user_id` became nullable, `client_ip` was added, and guest conversations got a cleanup index. `internal/f1/geek/cleanup_job.go` deletes guest conversations older than 24 hours.

A day later the rate limiter needed hardening. [`ee83550`](https://github.com/flavio1110/f1bet/commit/ee835509cf9c7b75dd530821b40a91ea714b725d){:target="\_blank"} changed `X-Forwarded-For` handling to use the rightmost address, stopped continuing when the rate-limit query failed, and made message persistence errors fail the request instead of leaving a broken history.

A free question is a small feature. It still touches privacy, abuse limits, proxy assumptions, cleanup, and consistency.

## What I learned

The first lesson is that grounding is a complete path, not a prompt. Schema documentation helps the model choose a query, but the answer becomes trustworthy because the query runs against the analytics data and the result comes back through the tool loop.

The second lesson is that chat state is distributed state. There is a row in PostgreSQL, a stream on the server, an active conversation in the browser, and a person who may navigate at any time. Conversation isolation mattered as much as the model choice.

The third lesson is to build graceful failure into optional AI features. If the analytics connection is down, apexclub should still accept predictions. If a query fails, the model gets a useful error and can correct it. If the model returns nothing, retry a limited number of times and show a clear failure rather than an endless spinner.

Finally, I learned to inspect the generated workload. `f1geek.query_log` records the query, duration, row count, and error; `f1geek.token_usage` records model usage; migration `000020_add_analytics_read_indexes.up.sql` adds indexes for the query shapes the chat actually generates. An AI feature still needs regular database work.

## Limitations & improvements

F1 Geek can only answer what exists in the documented analytics schema. The March version knew race results, qualifying, sprints, and standings. Pit stops and lap times arrived on March 6. Weather and incident tables arrived later in PR [#28](https://github.com/flavio1110/f1bet/pull/28){:target="\_blank"}. When the source has a gap, the right answer is "I don't have it", not a creative guess.

Long-conversation summaries are only half-built. The schema and repository support `f1geek.context_summaries`, and `buildContext` will use the latest summary, but I found no production path that creates one. Today, conversation history can keep growing.

The SQL validator is deliberately small and conservative. It is not a complete PostgreSQL parser. The separate read-only role is therefore important, and I'd keep tightening both the role and statement timeout rather than treating regex validation as perfect.

There is also an accuracy-versus-freshness trade-off. F1 Geek reads synced analytics data, so a question about a race that just ended may be ahead of the sync. Surfacing the data timestamp in answers would make that limitation clearer.

The next improvement I'd like is feedback tied to the query log: which answers helped a prediction, which returned no data, and which question shapes repeatedly needed correction. That would be more useful than tuning the personality blindly.

---

F1 Geek is still a chat panel, but the useful part is underneath it: real F1 data, a narrow read-only tool, saved conversations, and enough failure handling that it does not get in the way of race day.

What would you ask before locking your next podium?
