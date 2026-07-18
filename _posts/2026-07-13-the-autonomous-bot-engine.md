---
layout: post
title: "🤖 The autonomous bot engine, propose-then-approve"
date: 2026-07-13 14:00:00 +0100
mood: speechless
description: I built a small engine that lets time-driven F1 jobs propose writes to the database, then waits for me to approve them on Telegram before anything happens. No LLM touches the executor.
tags:
  - go
  - postgresql
  - architecture
  - f1
  - gotchas
---

<figure class="aligncenter">
  <img src="{{ "images/autonomous_bot_engine.png" | absolute_url }}" alt="a blueprint sketch of a bot proposing actions and a human pressing approve" />
</figure>

I have a Telegram bot that pings me on Sunday evenings with a proposed action — _"race results for the Belgian GP are out, here is the proposed grid, approve to insert"_ — and a button that, when tapped, writes to the database. The interesting bit is what runs between the proposal and the write. There is a small state machine, an idempotency check, and a strict rule that no LLM output ever reaches the executor. That's the engine.

<!--more-->

> TL;DR: A propose-then-approve engine in Go under [`internal/admin/bot/agent/`](https://github.com/flavio1110/f1bet/tree/main/internal/admin/bot/agent). Use cases detect candidates, the engine stores proposals, and I (the admin) approve them via Telegram before the deterministic executor runs. The executor is never the LLM.

## The shape of it

There are four pieces in [`internal/admin/bot/agent/`](https://github.com/flavio1110/f1bet/tree/main/internal/admin/bot/agent):

- [`action.go`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/action.go) — the `Action` model and its state machine.
- [`coordinator.go`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/coordinator.go) — the API the rest of the system calls into (`Submit`, `Approve`, `Reject`, `HasOpen`).
- [`registry.go`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/registry.go) — the `(kind → executor)` map. Executors are plain `func`s registered at startup.
- [`runner.go`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/runner.go) — the cron-driven scheduler that calls `Detect` on each registered use case and forwards candidates to `Coordinator.Submit`.

A use case implements [`UseCase`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/runner.go#L33) — `Kind()`, `Schedule()`, `Detect()`, `Propose()`, `Execute()`. The cron tick hits `Detect`, gets a list of candidates (usually empty), and for each one calls `Propose` to build a `Payload` and a `Summary`. The `Payload` is JSON-marshaled into an `Action`. The `Summary` is what I read on Telegram.

If `Detect` finds nothing, the tick is a single SELECT and we're done. No LLM work, no DB writes, low cost. That property mattered more than I expected.

## What problem this actually solves

Before this engine, every background job was either fully autonomous (sync-ing from Jolpica) or fully manual (me, on a Sunday, copying grid positions out of a screenshot). The middle ground — "the bot knows race results are out, but I want to sanity-check the grid before it lands in the production table" — was stuck.

There were three things wrong with the manual path:

1. It was Sunday. I was tired. I made mistakes.
2. The bot's _detection_ step ("race results are published") is a thing the bot is genuinely good at. The _transcription_ step ("translate this grid into our schema") is the part I don't want to do.
3. The most dangerous failure mode — a bot silently writing a wrong grid — was not prevented by any tool I had. Every safeguard I added was around the autonomous path, not the manual one.

So I built the engine: the bot does the part it's good at, formats the result as an `Action`, and waits for me to press "approve." If I'm asleep, nothing happens. The system stays consistent. If I'm awake and curious, I get to check the grid before it lands.

## The traps during the build

### The state machine (and why it's a state machine)

The model in [`action.go`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/action.go) has five states: `pending`, `executing`, `executed`, `failed`, `rejected`. Transitions are `pending → executing → executed | failed`, or `pending → rejected`. Once an action leaves `pending`, it's decided — [`ErrActionAlreadyDecided`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/action.go) is the only error code anyone needs to remember. I started with bool flags. I ended up with the state machine after the second time a concurrent approval and a timeout racing produced two writes to the same row.

The `Approve` path in [`coordinator.go`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/coordinator.go) atomically claims the action via `ClaimForExecution` before dispatching. If two admins approve the same action in the same second, only one wins. The other gets `ErrActionAlreadyDecided` and a polite Telegram reply.

### Idempotency, twice

`Coordinator.Submit` re-checks `HasOpenAction(kind, subjectRef)` before inserting. The race between "detect" and "insert" is closed that way. **And** there's a partial unique index in the database backing the same property. Belt, suspenders, and one of them is going to be wrong, so I want both. The first version had only the in-Go check, and it lied on Postgres restarts.

### The "no LLM output ever reaches here" rule

This is the line in [`registry.go`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/registry.go)'s docstring that I am most attached to. It says, in capital letters, that an executor is a deterministic `func` registered by kind, and that the executor must be idempotent.

Determinism here means: given the same `Action` payload, the executor must produce the same result. The model output _cannot_ flow into the executor. It's pinned to the action's stored `Payload`, which is JSON, which is bytes, which is comparable. Any other design would let a non-deterministic thing write to my production table the first time I was asleep and slightly hallucinating.

### Panic recovery on the executor

`Approve` wraps the executor in a `defer recover`. Without it, one bad executor would take down the whole approval pipeline, and my Sunday evenings would involve rebooting the bot instead of watching the race. With it, a panicking executor logs a stack trace and the action lands in `failed`. I still get paged (correctly), but the recovery is automatic.

### Advisory locks for the runner

The runner — the cron ticker in [`runner.go`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/runner.go) — runs as a schedulable job through the existing worker pool. The worker pool uses Postgres advisory locks so only one runner tick is in flight at a time across processes. That's a property of [`internal/worker/`](https://github.com/flavio1110/f1bet/tree/main/internal/worker), not something I built for the engine, but the engine assumes it. Single-leader scheduling is _way_ easier than per-tick coordination, and I was happy to inherit it.

## A real walkthrough: weekend results

The first use case I wrote was [`results_usecase.go`](https://github.com/flavio1110/f1bet/blob/main/internal/f1/bot-jobs/results_usecase.go) under [`internal/f1/bot-jobs/`](https://github.com/flavio1110/f1bet/tree/main/internal/f1/bot-jobs) — `KindInsertRaceResults`.

Sunday evening tick:

1. `Detect` runs a SELECT against the analytics schema. If the latest completed Grand Prix has no matching `models.Result` in the main DB, it returns one candidate — `{ID, Name}` for the race.
2. `Propose` matches the analytics race to a grid race (small model call, deterministic enough to verify by hand), extracts grid + weekend into a `resultmap.Extraction`, maps driver names through [`LLMDriverMapper`](https://github.com/flavio1110/f1bet/blob/main/internal/f1/bot-jobs/drivermap.go) (advisory only — names it can't map surface as `Unmatched`), and packages the proposal as a `resultmap.ResultMap` JSON payload + a human-friendly summary.
3. `Coordinator.Submit` checks `HasOpenAction("insert_race_results", raceID)`, sees no, inserts the action with status `pending`, and the [`Notifier`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/notifier.go) sends a message to my Telegram with the proposed grid.
4. I read it. Either I tap **approve** (Telegram callback → `Approve` → `ClaimForExecution` → `Execute`) or I don't.

Note step 3 also enforces `TELEGRAM_ALLOWED_USER_IDS` in [`notifier.go`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/notifier.go). Only my user id sees the messages. Only my user id can press the buttons.

If I approve, the deterministic executor — `UseCase.Execute` — writes the result and the P1–P22 finishing positions, then marks the action `executed`. The scoring job picks it up on the next run; standings recompute; predictions settle. None of that involves a model.

This pattern is now used by [`scoring_usecase.go`](https://github.com/flavio1110/f1bet/blob/main/internal/f1/bot-jobs/scoring_usecase.go) and [`grid_usecase.go`](https://github.com/flavio1110/f1bet/blob/main/internal/f1/bot-jobs/grid_usecase.go) too. Same shape, different kinds, different executors.

## Things I'd do differently

- **Embed the runner, don't share one across kinds.** I started with one runner-loop that iterates all use cases on one tick. That made cross-kind ordering easier to reason about, but it also meant a slow `Detect` on one kind blocked another. Each use case is now its own cron entry via [`UseCaseJob`](https://github.com/flavio1110/f1bet/blob/main/internal/admin/bot/agent/runner.go#L79), one tick per kind, no cross-talk.
- **Versioned payloads from day one.** I had to add a `schema_version` field to one action kind after I changed the proposal shape and broke pending actions in flight. Adding it from the start would have been one extra column.
- **A "snooze this candidate until after race N" knob.** During triple-headers I get three proposals in three weeks. I'd like one button that says "not yet, ask me again on Tuesday." Today the only options are approve or reject.

## Known blind spots

- **No multi-admin quorum.** It's just me. Two-admin or N-of-M approvals would be a small change, but I'm the only one who approves bot actions, and YAGNI.
- **The action store is the system of record, not append-only.** A `failed` action is fine to keep, but I'd like a separate audit table for forensics if a write goes sideways. Not there yet.
- **Payload size cap is implicit.** I rely on `pgx` row size limits; I should make the cap explicit so a bad proposal doesn't blow up the JSONB column.

The code is all in [`flavio1110/f1bet`](https://github.com/flavio1110/f1bet){:target="\_blank"} under [`internal/admin/bot/agent/`](https://github.com/flavio1110/f1bet/tree/main/internal/admin/bot/agent), with use cases in [`internal/f1/bot-jobs/`](https://github.com/flavio1110/f1bet/tree/main/internal/f1/bot-jobs). The companion post — [_The F1 Geek AI_]({% post_url 2026-03-01-the-f1geek-ai %}) — is the customer-facing side of the same project: this engine runs nothing user-facing, the chat runs the data the engine never touches.

What about you — would you let a bot propose a write to your production table, or is the cognitive overhead of "approve or not" every Sunday a worse trade than the Sunday-evening grind itself? I've been doing this since commit [`123c99d1`](https://github.com/flavio1110/f1bet/commit/123c99d1) and I sleep better, but I might be alone in that.
