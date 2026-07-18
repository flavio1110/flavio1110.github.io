---
layout: post
title: "🤖 Building an autonomous bot engine — and why the LLM loop is the last thing I reach for"
date: 2026-07-16 14:00:00 +0100
mood: speechless
description: A small Go engine for long-running bots that detect work, propose a change, and only apply it after a human approves. The LLM is a parser, not an authority.
tags:
  - ai
  - agents
  - go
  - architecture
  - automation
---

<figure class="aligncenter">
  <img src="{{ "images/autonomous-engine-loop.png" | absolute_url }}" alt="Three boxes labelled Detect, Propose, Apply connected by arrows, with a human approval step in the middle" />
</figure>

I have a few long-lived bots running on apexclub.live: one syncs the F1 analytics database, one wakes up every race weekend to check whether results are in, one watches the prediction cut-off for the next race and emails anyone who hasn't submitted. They all share the same shape — *check if there's work, do the work, log what happened* — and until recently, I had written that shape three times in three slightly different ways.

This post is the engine I extracted out of them, the design rule I keep coming back to, and the trade-offs I'd want you to spot before you copy the pattern.

<!--more-->

> TL;DR: I built a small Go package, `internal/admin/bot/agent`, with three pieces: a `Coordinator` that persists proposals and hands them to a human, a `Runner` that ticks use cases on cron schedules, and a `Registry` that maps action kinds to deterministic executors. Every use case implements four methods — `Detect`, `Propose`, `Execute`, plus a `Kind()` and a `Schedule()`. The LLM only runs when `Detect` finds actual work; it only writes text; it never decides what to do.

### The problem with "autonomous" agents

Most of the agent tutorials I read in the last year have the same shape:

1. User gives the agent a goal.
2. Agent spins up an LLM loop with tools.
3. Loop calls tools until it thinks it's done.

That works for one-shot tasks. It falls apart for me because most of what I want bots to do is **boring, recurring, and high-stakes when wrong**:

- "Every five minutes, check whether the next race has a starting grid published yet. If yes, file a proposal to copy it into the main DB. Don't touch the main DB yet."
- "After results are entered, compute scores for every league. Don't email anyone until a human approves the score table."
- "Every hour, find prediction-cut-off reminders that need to go out. Send one batch per day, not per race."

The LLM loop is overkill for all three. Worse, it's the wrong default for two reasons:

- **It's expensive when there's nothing to do.** An empty tick should be a `SELECT` returning zero rows and a `return`. Most ticks are empty. Calling an LLM 200 times a day to be told "nothing happened" is a waste of money and a source of noise.
- **It's unauditable when something goes wrong.** If the LLM writes a bad SQL, you find out at runtime. If the LLM decides to call a tool you didn't expect, you have to read the chat log to figure out what happened.

So the rule I keep coming back to:

> Don't invoke the LLM loop when a deterministic pre-check can answer "no work to do". Filter with SQL/code first; only spin up the agent when there's actual work.

That's the design rule the whole engine is built around.

### The shape

A use case in this engine implements four methods plus an identifier and a schedule:

```go
type UseCase interface {
    Kind() string
    Schedule() string
    Detect(ctx context.Context) ([]Candidate, error)
    Propose(ctx context.Context, c Candidate) (*Proposal, error)
    Execute(ctx context.Context, a *Action) (summary string, err error)
}
```

Each method does one thing:

- **`Detect`** is a cheap precondition. It's almost always a single SELECT. If it returns no candidates, nothing else runs. The runner keeps ticking on the cron schedule regardless.
- **`Propose`** turns one candidate into a structured `Proposal{Payload, Summary}`. The payload is JSON-serialisable; the summary is what the admin will read in Telegram.
- **`Execute`** is a registered Go function. It takes the persisted action and applies it. It is **deterministic**, **idempotent**, and **never sees LLM output** — the payload was built by `Propose` and persisted in the action row.
- **`Kind`** is a string identifier. The runner uses it to dedupe open actions and to dispatch the right executor at approval time.

The whole loop looks like this:

```text
cron tick ──► use_case.Detect() ──► []Candidate
                                       │
                          (empty) ────┴────────► no-op, log idle tick
                                       │
                          (non-empty) ▼
                               use_case.Propose(c)
                                       │
                                       ▼
                            Coordinator.Submit(kind, subjectRef, payload, summary)
                                       │
                       dedupe ◄───────┴────────► HasOpen? skip
                                       │
                                       ▼
                       INSERT agent_actions (status=pending)
                                       │
                                       ▼
                              Telegram proposal message
                                       │
                            ┌──────────┴──────────┐
                            ▼                     ▼
                       /approve                 /reject
                            │                     │
                            ▼                     ▼
                  ClaimForExecution          status=rejected
                            │
                            ▼
                   Registry.Execute(a)
                            │
                            ▼
                  status=executed (or failed)
```

Two things to notice:

- **The engine doesn't know anything about F1.** `agent` has no notion of races, drivers, predictions, scores. The use case does. Adding a new autonomous capability means one new file that implements `UseCase` and one `Register` call. Nothing in the engine changes.
- **The LLM, if any, is inside `Propose`.** It runs once per candidate, produces a payload + a summary, and exits. The engine never loops an LLM. It also never gives the LLM tools that mutate anything; the LLM's only outputs are text and a structured payload it has no authority to apply.

### Why a Coordinator and not just a function

The first version I wrote was a cron worker that called use cases directly and pushed results to Telegram inline. It had two problems:

- **Double-firing.** If the worker restarted mid-tick, the same race got proposed twice. Telegram deduped visually but the action table had two rows in `pending`. I had to add `HasOpen` to filter. That filter was the seed of the `Coordinator`.
- **Approval was a side channel.** "Approve" was a regex on Telegram messages, matched against an action id I'd put in the message text. It worked, but it tied the worker to the Telegram transport and made it impossible to add another approval source (an admin button in the web UI, say) without rewriting the worker.

So I split it. The Coordinator owns the action row, the dedup, and the approval handshake. The Runner owns the cron loop. The Notifier (a separate interface, currently implemented by Telegram) owns the transport.

```go
type Submitter interface {
    HasOpen(ctx context.Context, kind, subjectRef string) (bool, error)
    Submit(ctx context.Context, kind, subjectRef string, payload any, summary string) (bool, error)
}
```

The Runner drives the Runner-of-use-cases through `Submitter`. The Notifier is the only thing that knows there's a Telegram. When the bot has no admin user allowlisted, the Runner is nil and the whole thing is off — no flag to forget to set, no env var to leave true in staging.

### What "Detect is cheap" looks like

Here's the Detect query for the "publish scores" use case, verbatim from the codebase. It's a join across two tables to find races whose results are entered but whose scores aren't published yet:

```sql
SELECT r.id, r.name, COUNT(p.id) AS prediction_count
FROM races r
JOIN results res ON res.race_id = r.id
LEFT JOIN scores s ON s.race_id = r.id
LEFT JOIN predictions p ON p.race_id = r.id
WHERE s.id IS NULL
GROUP BY r.id, r.name
```

That query runs on a 30-second cron. It hits an index on `scores.race_id`. It's three round trips to PostgreSQL per minute, total, across every use case. The LLM is not in this loop. It will only ever run if this query returns a row — which, on most ticks, it does not.

The runner also has a per-use-case PostgreSQL advisory lock. Two instances of the bot ticking at the same instant can't both submit a proposal for the same candidate; one wins, the other sleeps and tries again on the next tick. That's what makes "always-on" safe to run in more than one place.

### Where I compromised

Three places where the design isn't as clean as the diagram suggests:

- **Proposals need a JSON payload.** A use case that has to "remember" multi-step state across runs would not fit this shape. The engine is built for one-shot proposals whose payload is fully specified up-front. If a use case needs to ask the admin a follow-up question, that's a different kind of action — out of scope for now.
- **The LLM in Propose is still a moving part.** I rate-limit per use case per minute, and I cap the number of candidates a single tick can process (default 5). Otherwise a flapping analytics DB could trigger 200 proposals in a minute and bury me in Telegram messages.
- **The Notifier is a single point of failure for delivery.** If Telegram is down for an hour, proposals are still persisted in `pending`; they aren't lost. But they aren't visible either. The admin UI surfaces them via the same repo, so I can recover from a Telegram outage by approving in the web. That part took a whole extra PR to wire up and I should have done it on day one.

### How I write a new use case

Adding a use case today is roughly:

1. Create a new file under `internal/<domain>/bot-jobs/`. Implement the `UseCase` interface.
2. Define a `Kind` constant and an executor function in the same file.
3. Register the executor with the `Registry` at startup.
4. Register the use case with the `Runner` at startup.
5. That's it.

The package doc on the bot-jobs package spells out the contract:

> Each use case is self-contained in one file — its kind, precondition query, proposal logic, prompts, payload, and executor — and is installed with a single `agent.Runner.Register` call during wiring. Adding another autonomous capability means one new file implementing `agent.UseCase` plus one `Register` call — no changes to the engine or to existing use cases.

I want to see that sentence stay true as the engine grows.

---

If you want to see the engine in action, the previous post walks through the f1geek agent, which is exactly one of these use cases (plus a sibling that fires when the first one's executor finishes). The two together are about 600 lines of Go and one Telegram handler. The engine underneath them is about 350 lines and changes slowly.

What about you — do you run long-lived bots with cron-shaped work? How do you decide when an LLM earns its place in the loop?

_Till next time o/_