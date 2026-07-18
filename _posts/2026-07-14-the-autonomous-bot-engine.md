---
layout: post
title: "🤖 Building a propose-then-approve bot engine"
date: 2026-07-14 14:00:00 +0100
mood: speechless
description: How I built a small engine that detects recurring work cheaply, persists a proposal, and waits for a human before deterministic execution — using race weekend admin as the worked example.
tags:
  - ai
  - agents
  - go
  - postgresql
  - gotchas
---

<figure class="aligncenter">
  <img src="{{ "images/autonomous-bot-engine.png" | absolute_url }}" alt="A robot moving work through detect, propose, human approval, and execute stages" />
</figure>

After every race weekend on [apexclub.live](https://apexclub.live){:target="_blank"} I used to do the same three things by hand: enter the starting grid, enter the final classifications, and trigger the scoring calculation. Every step was a few clicks and a few minutes. The annoying part wasn't the time — it was the *kind* of work. It's detectable, it's repetitive, and getting it wrong silently corrupts a season's standings. So I wanted it gone, but only on my terms.

I wanted something autonomous enough that I didn't have to remember, deterministic enough that I could trust it, and small enough that I could still explain every line.

<!--more-->

> TL;DR: A recurring worker tick runs a cheap `Detect` query for each registered use case. If there's nothing to do, no LLM runs. If there's a candidate, the engine builds a proposal, persists it, sends me a Telegram message with Approve / Reject buttons, and only on my tap calls a typed executor to apply the change. The LLM proposes; the database and the human approve; the executor writes.

## The shape of the problem

The original setup wasn't bad. Race results came from analytics on Monday. The application had a Telegram bot I already trusted for one-off commands. I had a database I could read and write to. The only thing missing was glue.

A naive first attempt was to let the existing chat bot propose mutations during a conversation. Press a button, the model picks a tool, the tool runs. I tried it and closed it. The problem wasn't Telegram — it was mixing recurring operations with a conversational tool loop. Most ticks have nothing to do: the race hasn't finished, analytics hasn't synced, results already exist, scores are already published. Paying for an LLM call to discover that "nothing is ready" is wasteful, and worse, "the model decided to call this tool" is not an audit record I want to publish against a league's standings.

I wanted a concrete payload, a visible proposal, a named human decision, and a deterministic function that could be retried safely. So I split the work in two:

- a **detect** step that is just SQL — cheap, idempotent, easy to reason about;
- a **propose** step that builds a structured payload and a human-readable summary;
- a **persist** step that stores the proposal before anything is sent anywhere;
- a **human decision** delivered through a channel I already trust (Telegram, in my case);
- a **typed executor** that applies an approved proposal and is required to be idempotent.

Each piece is small. The interesting bit is the contract between them.

## The contract

A use case is anything that can detect a candidate, propose a payload, and apply it. The shape, in Go, is roughly:

```go
type UseCase interface {
    Kind() string
    Schedule() string
    Detect(ctx context.Context) ([]Candidate, error)
    Propose(ctx context.Context, c Candidate) (*Proposal, error)
    Execute(ctx context.Context, a *Action) (summary string, err error)
}
```

The four methods divide responsibility cleanly:

- `Detect` is a cheap precondition. Usually a single `SELECT`.
- `Propose` turns one candidate into a structured payload and an admin-facing summary.
- `Execute` applies an approved action. **Idempotency is required.**
- `Kind` is the dispatch and dedup key.
- `Schedule` lives on the use case, not in central wiring.

The engine has three pieces that move a use case through that contract:

- A **runner** that ticks on schedule, calls `Detect`, and for each candidate checks whether an action already exists for the same `kind` + subject reference. If not, it asks `Propose` to build a proposal and hands it to the coordinator.
- A **coordinator** that owns persistence and decisions: stores the proposal, sends the notification, atomically claims an approval, dispatches the executor, records the outcome.
- A **registry** that maps a kind such as `insert_race_results` to its executor. Registering the same kind twice panics at startup, which is the right moment to discover a wiring mistake.

The lifecycle of a persisted action is small enough to draw in text:

```text
pending -> executing -> executed
                     -> failed
pending -> rejected
```

A partial unique index allows only one open action per `(kind, subject_ref)`. That single index is what makes the runner safe to call every 30 seconds across multiple application instances, and what makes a second admin press of "Approve" a no-op instead of a duplicate write.

The approval transport can be anything with two buttons. Telegram was the obvious choice because I was already living there for one-off commands. A web page could work just as well — it just has to call back into the same coordinator.

## The flow, end to end

Here is the whole path of one piece of work, written the way the code actually runs it:

```text
worker tick (every 30s)
  -> for each registered use case:
       Detect() with SQL
       -> zero candidates: stop
       -> candidate: is there already an action for (kind, subject)?
            yes: stop
            no:  Propose(candidate) -> Proposal
                 Coordinator.Submit(proposal)
                 -> persist action with status=pending
                 -> send approval message with action UID
  -> Telegram button press
       -> Coordinator.Approve(uid)   (atomic: pending -> executing)
       -> Registry.Dispatch(kind).Execute(action)
       -> mark action executed or failed
```

The decision to put deterministic work first is the entire insight. The LLM only runs after SQL has already said "there is something to do here", and only to convert that "something" into a payload a human can review.

## Why this set of qualities

A few properties fall out of the shape, not from extra effort:

- **Cheap idle ticks.** When nothing needs doing, the worker runs only `SELECT` queries. No model call, no proposal, no notification.
- **Auditability.** Every action is a row: `kind`, subject reference, JSONB payload, the human-readable summary, the Telegram message identifiers, who decided it, when, and the final outcome. That's a complete answer to "why did the standings change on Sunday at 23:14?".
- **Idempotent execution.** The executor contract is `Execute(ctx, *Action)`. Rerunning it with the same action must converge to the same outcome. That requirement is what makes a button-mash, a network retry, or a panic mid-flight all safe — the row in `pending` / `executing` is the source of truth, and the executor decides whether to insert, update, or do nothing.
- **No autonomous flag.** The system is "on" whenever the worker is running with a configured approval channel. There is no global switch labelled "AI: on". The absence of an admin to approve is the absence of writes.
- **Independent failure modes.** Each use case has its own schedule and its own advisory lock. A broken results matcher doesn't prevent scores from being checked.

The cheap-tick property is the one I underestimated before I built it. Most ticks *are* idle. Saving a model call on every idle tick is the difference between a system I forget exists and a system I worry about.

## Two use cases, end to end

The same engine runs two unrelated capabilities on apexclub.live. They're not hardcoded into the engine — they're ordinary use cases that happen to be the first ones I needed.

### Insert race results

The use case owns kind `insert_race_results` and schedule `*/30 * * * *`.

Its `Detect` query is "active-season races in the past with no row in `results` yet". When that returns nothing, no LLM runs.

When it returns a candidate, the use case:

1. matches the main race to a row in an analytics calendar (the LLM only picks from offered candidates — it can't author the mapping);
2. pulls qualifying pole and classified finishers from the analytics tables;
3. resolves driver names to the application's own grid entries (again, the LLM only picks from offered IDs);
4. assembles a structured result plus the P1–P22 finishing order;
5. refuses incomplete mappings and surfaces them as a manual-entry notice instead of a proposal;
6. persists the payload for approval.

On approval, `Execute` checks for an existing result before inserting and only writes final positions when none are already recorded. A retry after a partial failure converges without overwriting manual data.

### Publish scores

The second use case owns kind `publish_scores`, also scheduled every 30 minutes. Its `Detect` query is "an active-season race with a results row, not yet finalized, no scores row, and at least one real starting position recorded". Same shape — a `SELECT` that asks "is the next step's preconditions met?".

The proposal payload is just a race identifier. On approval, the executor runs the existing scoring code and flips a finalized flag. Re-running the executor upserts and sets the same boolean, which converges safely.

There is no direct call between these two use cases. The database state is the hand-off: the results executor creates the data that makes scoring eligible on a later tick. Independent schedules, independent advisory locks, independent failure handling.

## The traps, in order

Building the engine was less work than fixing the things I got wrong the first time. A few worth naming:

**Approval state can stick.** The first version moved an action from `pending` to `executing` before calling the executor, which prevented two button presses from racing. But if the executor panicked, the action stayed in `executing`, and because `executing` counted as open, the runner could never propose it again without a manual database update. The fix was to move the lifecycle into the coordinator: a panic is converted into an error, and `Approve` is the only transition that marks an action `failed`. Atomic claiming was only half the story — every transition needs a recovery path.

**Source identities are fuzzy.** The first attempt matched races by season and round number. Real data proved that wrong — for one British Grand Prix, the main calendar said round 11 while analytics said round 9, and analytics round 11 was a different race with no results yet. The LLM's job in this system is to resolve exactly the kind of ambiguity that round numbers and slightly different race names cause. The authority stays narrow: the model picks from offered source rows, never authors them. Deterministic code then checks whether the chosen mapping is safe enough to propose.

**The approval message is part of the safety boundary.** A Telegram message that shows only the top three drivers is not a complete proposal if the scoring system needs the full finishing order. Anything required for approval belongs in deterministic presentation, not in prose the model is free to shorten. The pattern that worked: build the visible fields from the assembled payload in code, and append the model-generated summary as commentary. The fields are guaranteed; the commentary is colour.

**Preconditions encode data completeness.** Scoring requires both a result and a starting grid. A result without a grid produces a plausible-looking but silently-wrong score. The `Detect` query for scoring was the right place to encode that requirement. The engine should refuse a valid-looking operation when its inputs would produce an incorrect result.

These weren't architectural mistakes — they were the price of admitting the second iteration. The contract didn't have to change; the implementations got better at honouring it.

## Tradeoffs and limits

A few honest costs:

- **Latency is human-shaped.** A use case that detects at 30 seconds and a human who approves five minutes later means a five-minute gap between readiness and execution. For race weekend admin that's fine. For anything time-sensitive, propose-then-approve is the wrong shape.
- **Approval delivery is one channel.** Today the only way to approve is Telegram. If the notification fails to send, the action is persisted in `pending` and stays there until a human notices or a redelivery job is added. Persistence beats loss, but it's not the same as a guaranteed delivery.
- **One primary approver.** Notifications go to the first ID in the allowlist. Every allowlisted user can press the buttons, but only one gets the message. A real multi-admin workflow needs a delivery and decision policy, not just an allowlist.
- **Rejected actions don't auto-retry.** The repository layer suppresses future proposals for a rejected `(kind, subject_ref)` to avoid nagging. There is no "retry this one" operation that doesn't also require a policy or data change. For one-shot work that's the right default; for evolving inputs it can feel stubborn.
- **Fuzzy matching is bounded.** The model can only pick from offered candidates. That's a strong guardrail and also a real ceiling — when the input source gets a new spelling or a new driver, the matcher will refuse rather than guess. Human review remains mandatory.

## Where I'd take it next

The next changes I'd make are unglamorous:

- A redelivery job for `pending` actions whose Telegram message failed.
- A web approval page that calls the same coordinator (it doesn't need to replace Telegram; it just needs to be a second transport).
- An explicit retry / reopen transition for rejected subjects, gated by policy rather than by data manipulation.
- More use cases. The shape proved out on results and scoring. The next two I'm eyeing are joker-round announcements and end-of-season standings exports — both are detectable, both are one-shot, both have a payload I want to review before they go out.

The thing I would *not* change is the order. Cheap detect, deterministic propose, human approve, typed execute. Each piece is replaceable; the order is the engine.

---

The engine is small because it refuses to solve every agent problem. It works for recurring, detectable, one-shot changes with a payload that can be reviewed before it's applied. "Autonomous" here means the system notices and prepares work by itself; authority to change league results still belongs to a person.

What kind of recurring work would you trust it to propose, but not to approve?
