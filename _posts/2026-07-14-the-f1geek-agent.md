---
layout: post
title: "🏎️ The f1geek agent: an autonomous sidekick for race weekends"
date: 2026-07-14 14:00:00 +0100
mood: speechless
description: How I built an LLM-backed agent that proposes race results on apexclub.live — and why it never applies a change without my approval.
tags:
  - ai
  - agents
  - go
  - postgresql
  - apexclub
---

<figure class="aligncenter">
  <img src="{{ "images/f1geek-agent.png" | absolute_url }}" alt="Telegram chat showing a proposal from the f1geek agent for a Grand Prix result" />
</figure>

Every race weekend on [apexclub.live](https://apexclub.live){:target="\_blank"}, somebody has to enter the official finishing order into the database so the predictions get scored and the leagues update their standings. That somebody has been me, every Sunday night, for two seasons. It is exactly the kind of work that is repetitive enough to be tedious and important enough to be risky.

This post is about the agent I built to do that job for me — and, more importantly, about all the guard rails I put around it so it can never silently break a season.

<!--more-->

> TL;DR: I built an autonomous agent on top of the [F1 Geek AI](https://apexclub.live/f1geek){:target="\_blank"} chat stack that proposes race results from the analytics database into the main platform DB. It only **proposes** — it never applies a change without an explicit `/approve` from me in Telegram. Scores are only calculated **after approval**, against the version of the results I signed off on. The agent is one tiny use case on top of a generic `propose → approve → apply` engine I'll write about in the next post.

### The job, restated

apexclub is a small F1 prediction platform I run as a side project. Users create private leagues, lock in predictions before lights out, and compete on points. The flow after a race is:

1. Enter the official P1–P22 finishing order for the race.
2. Mark the race as results-finalised.
3. Run the scoring calculator, which fills the `scores` table and updates every league's standings.

Steps 2 and 3 are pure SQL — they already ran on a cron for me. Step 1 is the one that needed a human, because the canonical source of "what actually happened on Sunday" was always outside the database: a timing screen, an FIA classification PDF, the Wikipedia edit that lands five minutes after the chequered flag.

I wanted a way to bring the data in faster without trusting an LLM to write directly into the main DB. That tension is the whole post.

### Where the data comes from

apexclub keeps two databases that don't share a schema:

- **The main DB.** Users, leagues, predictions, scores, race metadata. This is the source of truth for the platform. Anything that mutates state here is sensitive.
- **The analytics DB.** An Ergast / Jolpica mirror that I keep in sync with the public Formula 1 data, enriched with weather and a few incident flags. It is rebuilt from public data and is safe to read freely.

The f1geek agent sits between them. Its single job, per race, is:

1. Find the matching weekend in the analytics DB (round name + race date).
2. Pull the grid (P1–P22 finishing order).
3. Resolve the analytics driver names to main-DB driver IDs — for the drivers we don't know about (e.g., a mid-season reserve), surface them for me to map manually.
4. Build a structured payload describing the proposed finishing order and any grid entries that need to be filled in.
5. Hand the payload to the proposal engine.

> The agent is **read-only on the analytics DB** and **write-only through the proposal flow**. It has no path to issue an arbitrary `UPDATE` against the main DB — that's the whole point.

### Why an LLM at all

The strict version of this problem is a deterministic mapper: take the weekend's session key, query the classifications table, look up driver IDs by full name, done. I started there. It broke in three predictable ways:

- **Name spellings.** F1 driver names in the analytics feed have historical variants (e.g., mid-season renames, accents stripped, junior drivers appearing as their father's entry).
- **Cross-season mappings.** The analytics DB carries every season since 1950. A driver named "Carlos Sainz" in the main DB can resolve to two different analytics IDs depending on which season you're matching.
- **Missing drivers.** New reserves and replacement drivers don't have a row in the main DB yet, and there's no deterministic way to know whether an unknown name is a typo or a brand-new person who needs a new row.

These are exactly the cases where you want a flexible parser and **don't** want a flexible writer. So the LLM is allowed to do two things, and only two:

- **Propose a mapping** between an analytics driver name and a main-DB driver id, with a confidence-style summary ("Carlos Sainz Jr. → driver id 83, current season, no ambiguity").
- **Suggest a payload** for a candidate race when the deterministic code is uncertain.

The payload itself — the actual `INSERT INTO results (...) VALUES (...)` arguments — is built by Go code, not by the model. The LLM only chooses between well-defined options and writes text.

### Guard rails

The agent runs as a Telegram bot, on top of the same `internal/admin/bot/agent` engine I'll cover next post. The whole design hinges on a few rules:

- **The agent proposes, never applies.** Every state-changing action is persisted as a row in `adminbot.agent_actions` with status `pending`. The proposal message in Telegram has two inline buttons: *Approve* and *Reject*. Until I tap one, nothing in the main DB moves.
- **Proposals are idempotent and deduplicated.** The engine checks for an open action with the same `kind` and `subject_ref` (the race ID) before creating a new one. If I re-trigger the use case while a proposal is still open, it short-circuits and does nothing — no spam, no double-notification.
- **The executor is deterministic.** The "Apply" step is a small registered Go function per action kind. There is no `UPDATE results SET ...` generated by the model; there is a function `func applyInsertRaceResults(ctx, action) error` that deserialises the payload I approved and runs the SQL. Re-running it on an already-applied row is a safe no-op.
- **Scoring only runs after approval.** Score calculation is its own use case (`publish_scores`) with its own `kind`. Its `Detect` query only returns candidates whose race has results entered *and* a corresponding `agent_actions` row in status `executed`. So a manually-entered result also gets scored by the same path — no special-case branch.
- **The kill switch is empty.** When `TELEGRAM_ALLOWED_USER_IDS` is empty, the autonomous runner is nil and the Telegram stack degrades to a chat-only bot. I can turn the whole agent off by removing my user ID from the env var. There is no global on/off flag — the absence of an admin is the off switch.

```text
cron tick ──► Detect (cheap SELECT) ──► Propose (LLM, optional)
                                            │
                                            ▼
                                  agent_actions (pending)
                                            │
                            ┌───────────────┴───────────────┐
                            ▼                               ▼
                       /approve                         /reject
                            │                               │
                            ▼                               ▼
                  ClaimForExecution                  status=rejected
                            │
                            ▼
                Executor (deterministic, idempotent)
                            │
                            ▼
                  status=executed  ──► next tick: scoring use case fires
```

### What it looks like in practice

A normal weekend:

1. Sunday race ends. ~10 minutes later, I get a Telegram message:

   > 🏁 **Monaco GP — proposed results**
   > P1 Piastri · P2 Leclerc · P3 Sainz · P4 Norris · P5 Verstappen · …
   > 1 driver unmatched: `K. Antonelli` (analytics only).
   > [Approve] [Reject]

2. Antonelli is already in our main DB but his entry in this season's `drivers` table isn't there yet. I open the admin panel, add him, tap *Approve*. The payload still has the unresolved entry; the executor logs a warning and skips it (the rows for the 20 known drivers are inserted, the 21st waits for me to fix the mapping and re-trigger).

3. A second message lands a few seconds later:

   > 🧮 **Monaco GP — scoring ready to publish**
   > 87 predictions across 6 leagues.
   > [Approve] [Reject]

4. I tap *Approve*. Scores are written, league standings update, the email job runs.

Total human time on a race weekend: maybe 60 seconds, mostly for the "a reserve driver joined" case which I expect to keep being a thing.

### What it can't do

I want this list to be exhaustive, because every item here is a rule the engine enforces, not a guideline I try to follow:

- It can't `INSERT`, `UPDATE`, or `DELETE` anything in the main DB outside the registered executors.
- It can't approve its own proposal. `/approve` is checked against the Telegram user ID allowlist at the handler level; even if a proposal message leaked into a public channel, the buttons would no-op for any other user.
- It can't run if the cron worker can't acquire its advisory lock. Multiple instances of the bot would race on the same lock; the loser sleeps and tries again next tick. The lock is per use case.
- It can't trigger scoring before results are applied. The scoring use case's `Detect` query joins on `agent_actions.status = 'executed'`, not on the main DB's `results_finalized` flag.
- It can't summarise, paraphrase, or "interpret" the result payload in any way before writing. The `Summarize` step in the engine is for the human-facing message only; the SQL the executor runs is byte-for-byte the JSON in the action row.

### What I'd do differently next time

- I'd start with the proposal/approval engine, not the LLM. The LLM bits are 10% of the code and 90% of the failure modes I had to think through.
- I'd register a fake notifier in CI. The acceptance test for the end-to-end flow exists but it spins up a real Telegram handler with a stub transport; a no-op `Notifier` would have caught a regression I shipped to staging first.
- I'd add an `/undo`. Right now an approved action is irreversible — re-running the executor is a no-op, but if I noticed I'd approved the wrong race, the only recovery is a manual SQL fix. The proposal engine already has the data; a small `reverse` executor per kind would be enough.

---

That's the f1geek agent. The whole thing — runner, coordinator, registry, executors, the Telegram notifier, the F1 use cases — is one PR series on top of the generic engine. Which is the topic of the next post.

_Till next time o/_