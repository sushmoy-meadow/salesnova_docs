# TASK-AI-006 — open points

Both acceptance criteria are covered by tests in `tests/Feature/Ai/LlmCallLogTest.php`. The decisions
that shaped the table are in [ADR-0028](../adr/0028-the-call-log-is-telemetry-not-evidence.md). What
follows is what is owed, and what the review pass raised and did not get.

## 1. Owed to a later task

**The rate that produced the price is not recorded.** `cost_micros_usd` is derived from tokens and a
price list, and nothing on the row says which price list. A period computed from a stale rate card
can neither be identified nor recomputed. `prompt_version` exists for exactly this reason on the
behaviour side and the price gets no equivalent. The column naming a rate-card version belongs with
the pricing table that produces the figure — TASK-AI-008 — because inventing a rate-card concept
here would fix its shape before anything reads it.

**No retention sweep.** `audit_log` has a configured window, a floor and a prune command; this has
nothing. Deferred deliberately (ADR-0028), but the sweep that eventually makes tenant deletion
possible has to cover this table, since the foreign key now restricts.

**Nothing writes rows yet.** The adapter that records a call is TASK-AI-008. The table, the model
and the factory are what this task promised.

**The privacy retention table does not list this data class.** `docs/10` §SN-PRIV-004 enumerates
what is kept and for how long; spend history is now a class it does not mention. That document is
edited by the task that sets the retention window, not by the one that creates the table.

## 2. Findings taken from the review pass

- `cascadeOnDelete` deleted a tenant's spend history with the tenant while the model refused a single
  `delete()` — a contradiction, and the wrong side of it. Now restricts, like every other tenant table.
- `cost_currency` admitted a mixed-currency state that no query in the tree handled correctly. Dropped;
  the unit is in the column name.
- `LlmCallOutcome::REFUSED` and `FinishReason::FILTERED` were one event named twice at two altitudes,
  and every combination of the two was storable. `outcome` now answers only whether a response came
  back; a refusal is a finish reason.
- `finish_reason` was the only one of three enum-backed columns with no value rule. It has one.
- The index was `[organization_id, capability, occurred_at]`, whose justification assumed a btree skip
  scan that arrived in Postgres 18; CI pins 16. Reordered to put the clock second.
- The enum-CHECK and SQLite-trigger machinery was about to become its third hand-written copy. Extracted
  to `App\Support\Database\ValueRule`.

## 3. Declined

**Index `['model', 'occurred_at']` for regression detection.** It is the index the query wants, and a
composite on a tenant-scoped table has to lead with `organization_id` — which this question
deliberately does not have. Taking the efficiency finding the tenancy rule allows meant dropping the
bare `model` index instead of widening it: it would have paid a write on every row for a query
Postgres would not have chosen it for. Scans until a rollup is worth building.

**`unsignedInteger` for the cost, saving four bytes a row.** Declined; a money column is the wrong
place to trade headroom for 3% of a row.

**Consolidating the other two copies of the value-rule machinery.** `2026_08_03_100500_create_leads_table.php`
and `2026_08_05_100000_create_event_table.php` still carry their own. Mechanical, and it belongs to
whoever is already touching those migrations rather than to this task.
