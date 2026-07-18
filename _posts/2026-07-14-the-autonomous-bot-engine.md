---
layout: post
title: "🤖 Building a propose-then-approve bot engine"
date: 2026-07-14 14:00:00 +0100
mood: speechless
description: How I built a small autonomous engine that detects work cheaply, persists proposals, and waits for a human before deterministic execution.
tags:
  - ai
  - agents
  - go
  - postgresql
---

<figure class="aligncenter">
  <img src="{{ "images/autonomous-bot-engine.png" | absolute_url }}" alt="A robot moving work through detect, propose, human approval, and execute stages" />
</figure>

The autonomous bot engine in `internal/admin/bot/agent` is a small Go package for recurring work that is easy to detect but risky to apply. A use case finds a candidate, builds a proposal, waits for an admin decision in Telegram, and only then runs a typed executor.

I built it for race weekend administration on [apexclub.live](https://apexclub.live){:target="\_blank"}. The engine itself knows nothing about Formula 1. Results, starting grids, and scoring are use cases plugged into it.

<!--more-->

> TL;DR: The first durable propose-then-approve foundation landed on **July 13, 2026** in PR [#30](https://github.com/flavio1110/f1bet/pull/30){:target="\_blank"}. On **July 14**, PR [#35](https://github.com/flavio1110/f1bet/pull/35){:target="\_blank"} turned it into the current `UseCase` + `Runner` engine, which is the date of this post. A cheap `Detect` query runs before any LLM call, `adminbot.agent_actions` stores the proposed payload and decision, and an allowlisted human approves before an idempotent executor writes anything.

## What it is

The contract in `internal/admin/bot/agent/runner.go` is short:

```go
type UseCase interface {
    Kind() string
    Schedule() string
    Detect(ctx context.Context) ([]Candidate, error)
    Propose(ctx context.Context, c Candidate) (*Proposal, error)
    Execute(ctx context.Context, a *Action) (summary string, err error)
}
```

The methods divide responsibility quite clearly:

- `Detect` is a cheap precondition, usually one `SELECT`.
- `Propose` turns one candidate into a structured payload and an admin-facing summary.
- `Execute` applies an approved action and must be idempotent.
- `Kind` is the dispatch and dedup key.
- `Schedule` belongs to the use case, not to central wiring.

Three engine pieces move a use case through that contract.

`Runner` calls `Detect`, checks for an existing action with the same `kind` and `subject_ref`, then calls `Propose` and `Coordinator.Submit`. Each candidate is isolated: one error is logged and the runner keeps going.

`Coordinator` owns persistence and decisions. It stores the proposal, sends the notification, atomically claims an approval, dispatches the executor, and records the outcome.

`Registry` maps a kind such as `insert_race_results` to its executor. Registering the same kind twice panics at startup, which is the right moment to discover a wiring mistake.

The durable state lives in `adminbot.agent_actions`, created by migration `000029_create_agent_actions.up.sql`. Its lifecycle is:

```text
pending -> executing -> executed
                     -> failed
pending -> rejected
```

The row includes `kind`, `subject_ref`, a JSONB `payload`, the human-readable `summary`, Telegram message identifiers, who decided it, timestamps, and an error. A partial unique index allows only one non-rejected/non-failed action for each `(kind, subject_ref)`.

The approval transport is Telegram. `internal/infra/telegram/proposal_notifier.go` sends inline Approve and Reject buttons whose callback data contains the action UID. `internal/infra/telegram/handler.go` checks the same allowlist used for bot messages, then calls `Coordinator.Approve` or `Coordinator.Reject`. Separately, `internal/admin/page_handler.go` serves `/manage/agent-actions` as an audit and manual-trigger page, but decisions still happen in Telegram.

There is no separate autonomous flag anymore. `cmd/f1bet/wire.go` only builds the runner when `TELEGRAM_ALLOWED_USER_IDS` contains at least one admin. An empty allowlist is the off switch.

## The problem it solves

Before the engine, entering results and publishing scores were manual admin jobs. The first rejected approach, PR [#29](https://github.com/flavio1110/f1bet/pull/29){:target="\_blank"}, added mutating tools to the interactive admin bot behind asynchronous Telegram approval. I closed it with "moving to a different workflow."

The problem with that shape was not Telegram. It was putting recurring operations inside a conversational tool loop.

Most ticks have nothing to do. A race has not finished, analytics has not synced, results already exist, or scores are already published. Paying for an LLM call to discover any of those facts is unnecessary.

More importantly, the write needs to be explainable. "The model decided to call this tool" is not a good audit record for publishing a league's scores. I wanted a concrete payload, a visible proposal, a named human decision, and a deterministic function that could be retried safely.

The engine therefore starts with data, not an LLM:

```text
worker tick
  -> Detect with SQL
  -> zero candidates: stop
  -> candidate: check for an existing action
  -> Propose
  -> persist pending action
  -> human approves or rejects
  -> typed executor
```

`Runner.Jobs()` exposes one background job per use case. `cmd/f1bet/main.go` registers those jobs with the regular worker. The worker checks schedules every 30 seconds, launches due jobs concurrently, and uses a PostgreSQL advisory lock derived from each job name to avoid overlapping the same job across application instances.

The job names are `autonomous_<kind>`, so results and scoring have independent locks and failures.

## Implementation gotchas

### The approval state machine could get stuck

The first PR moved an action from `pending` to `executing` before calling the executor. That atomic claim prevented two button presses from applying the same payload.

However, the Telegram handler recovered an executor panic by logging it and returning. The action stayed in `executing`. Because `executing` counted as open, the race could never be proposed again without a manual database update.

The PR [#30 review](https://github.com/flavio1110/f1bet/pull/30#discussion_r3573817479){:target="\_blank"} caught it. The fix moved the lifecycle into `Coordinator`, where `execute` converts a panic into an error and `Approve` marks the action `failed`. `MarkFailed` also gained `WHERE status = 'executing'`, so it cannot overwrite an already executed action.

Atomic claiming was only half the concurrency story. Every transition needs a recovery path.

### Matching races by round was wrong

The first results mapper paired the main race and `analytics.races` by season and round number. Real data proved the assumption false.

For the British GP in the bug report, the main calendar said round 11 while analytics said round 9. Analytics round 11 was the Hungarian GP, which had no results yet, so the bot logged that analytics was not ready and skipped work that was clearly ready.

PR [#32](https://github.com/flavio1110/f1bet/pull/32){:target="\_blank"} added `internal/f1/bot-jobs/matcher.go`. It gives the LLM the main race and the candidate analytics calendar, asks it to match the Grand Prix identity, and validates the returned ID against the offered candidates.

This is where an LLM earns its place. Round numbers and names such as "Barcelona-Catalunya Grand Prix" versus "Barcelona Grand Prix" are fuzzy. The authority is still narrow: the model can select one offered source row or no row. It cannot author the result payload or write it.

### Name normalization became an alias maintenance job

The original result mapper folded accents and kept constructor aliases. It handled cases such as Pérez/Perez and Red Bull/Red Bull Racing, until the next spelling drift arrived.

PR [#35](https://github.com/flavio1110/f1bet/pull/35){:target="\_blank"} replaced that table with `internal/f1/bot-jobs/drivermap.go`. The model receives analytics names plus the actual `race_entries` grid and can only choose offered driver IDs.

The code then validates:

- the name was requested;
- the ID was offered;
- one ID was not assigned to multiple names;
- `resultmap.Assemble` confirms the ID belongs to this race's grid.

An unusable answer becomes an incomplete mapping and a manual-entry notice. The model resolves ambiguity; deterministic code decides whether the mapping is safe enough to propose.

### A proposal has to show what the executor will apply

The first Telegram result proposal displayed only the top three drivers. The admin results page requires race pole plus P1–P10, sprint pole plus P1–P3 on sprint weekends, and the full P1–P22 finishing order is needed for joker scoring.

PR [#33](https://github.com/flavio1110/f1bet/pull/33){:target="\_blank"} moved the field list out of the LLM summary. `results_usecase.go` now builds it deterministically from the assembled details and appends every driver field verbatim. Team lines are excluded because the backend calculates them from finishing order.

Then the model omitted the race name from the intro. PR [#34](https://github.com/flavio1110/f1bet/pull/34){:target="\_blank"} put the race name in a structural header instead.

That was a good reminder: anything required for approval belongs in deterministic presentation, not in prose the model is free to shorten.

### Results without a grid made joker scores silently wrong

The results executor originally inserted the scored result fields but did not write the full finishing order into `driver_starting_positions`. The joker calculation compares final position with the starting grid, so bot-inserted results could make joker points silently become zero.

PR [#37](https://github.com/flavio1110/f1bet/pull/37){:target="\_blank"} fixed both sides. Results now record P1–P22 final positions, and the new `fill_starting_grid` use case populates starting positions from analytics. `publish_scores.Detect` requires at least one real grid slot before it proposes scoring.

The important part is not that grid became a third use case. It is that the scoring precondition now encodes data completeness. The engine should refuse a valid-looking operation when its inputs would produce a wrong result.

## Two concrete use cases

### Insert race results

`internal/f1/bot-jobs/results_usecase.go` owns kind `insert_race_results` and schedule `*/30 * * * *`.

Its `Detect` query selects active-season races in the past with no row in `results`. If the query returns nothing, no LLM runs.

For a candidate, it:

1. matches the main race to an offered `analytics.races` row;
2. extracts qualifying pole and classified finishers from `analytics.qualifying_results`, `analytics.race_results`, and, when needed, `analytics.sprint_results`;
3. maps analytics driver names to offered `race_entries` IDs;
4. assembles a `models.ResultCreate` plus the P1–P22 finishing order;
5. refuses incomplete proposals and sends a manual-entry notice;
6. persists a complete payload for approval.

On approval, `Execute` checks for an existing result before creating one and only writes final positions when none are already recorded. A retry after a partial failure converges without replacing manual data.

One detail is intentionally approximate: sprint pole comes from `analytics.sprint_results.grid = 1` because the analytics schema has no separate sprint-shootout table. A late grid penalty can therefore make it differ from the actual shootout winner. The admin review is still necessary.

### Publish scores

`internal/f1/bot-jobs/scoring_usecase.go` owns kind `publish_scores`, also scheduled with `*/30 * * * *`.

Its `Detect` query requires:

- an active-season race with a `results` row;
- `results_finalized = false`;
- no existing row in `scores` for that race;
- a real starting position in `driver_starting_positions`.

The result executor creates the data that makes scoring eligible on a later tick. There is no direct call from one use case to the next; the database state is the hand-off.

The proposal payload contains only `race_id`. On approval, the shared `scoring.Publisher` calculates and upserts scores, then the use case sets `results_finalized=true`. The existing results-published job can then email predictors. Re-running the score upserts and setting the same boolean converge safely.

These use cases read the `analytics.*` schema through the main application DB handle because they must map analytics rows to `race_entries` and write main-domain records. This is different from customer-facing F1 Geek, which is given a separately configured read-only analytics connection and is disabled if that connection is unavailable.

## What I learned

The strongest lesson is to put deterministic work before probabilistic work. `Detect` keeps idle ticks cheap. Validation narrows model output to offered IDs. The payload and executor stay in Go. The human sees the exact fields that matter.

The second lesson is that idempotency is part of the interface, not an implementation detail. `UseCase.Execute` explicitly requires it. Atomic approval prevents duplicate execution in the common path; idempotency protects retries and partial failures after that.

The third lesson is that database state can coordinate independent use cases better than a hardcoded chain. Results, grid, and scoring all run every 30 minutes and can overlap. Their preconditions decide what is ready. PR [#36](https://github.com/flavio1110/f1bet/pull/36){:target="\_blank"} moved schedules into the use cases and made due jobs concurrent precisely so one failure does not prevent another capability from checking its own work.

I also learned that the approval message is part of the safety boundary. If it omits the race, P11–P22, or an input used by scoring, the human approval is weaker even when the payload is correct.

Finally, "autonomous" does not have to mean "unattended". Here it means the system notices and prepares work by itself. Authority to change league results still belongs to a person.

## Limitations & improvements

Telegram is currently the only approval transport. The `/manage/agent-actions` page added in PR [#31](https://github.com/flavio1110/f1bet/pull/31){:target="\_blank"} shows history and can manually trigger kinds, but it does not approve pending actions. Adding web approval would require the same authorization and decision semantics, not a shortcut around `Coordinator`.

Proposals go to the first ID in `TELEGRAM_ALLOWED_USER_IDS`, even though every allowlisted user is authorized to press callbacks. A real multi-admin workflow needs delivery and decision policy rather than treating index zero as the primary admin.

A Telegram delivery failure leaves the action persisted in `pending`, which is better than losing it, but I found no automatic redelivery job. The admin page provides audit visibility, not transport recovery.

Rejected actions suppress future proposals at the repository layer. That avoids repeatedly asking after an admin says no, but there is no explicit "retry this rejected subject" operation. Today that requires a policy or data change outside the normal flow.

The two datasets still need fuzzy identity matching. The LLM matchers are constrained, but a wrong offered choice can produce a plausible-looking proposal. Human review remains mandatory, and stronger stable source identifiers would be better than smarter prompts.

The result workflow also carries the sprint-pole approximation mentioned above. If the analytics source gains sprint-shootout results, that query should move to the authoritative session instead of `grid = 1`.

I would add automatic redelivery, web approval, and an explicit retry/reopen transition before giving the engine more high-impact use cases. An undo executor is also tempting, but reversals need their own proposal and domain rules; replaying the old JSON backwards is not enough.

---

The engine is small because it refuses to solve every agent problem. It works for recurring, detectable, one-shot changes with a payload that can be reviewed before it is applied.

What kind of recurring work would you trust it to propose, but not to approve?
