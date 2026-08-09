# ADR-0028 — The model-call log is telemetry, guarded in PHP, and outlives the tenant it belongs to

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`llm_call_log` is the fourth append-only table in the tree, after `audit_log`
([ADR-0021](0021-audit-log-is-not-the-activity-log.md),
[ADR-0022](0022-audit-log-immutability-by-trigger.md)), `activity_log` and the partitioned event
log ([ADR-0025](0025-event-log-partitions-and-identity.md)). Each of the three already made a
different choice about immutability and retention, so a fourth arriving without saying which of
them it follows is the ambiguity those ADRs exist to remove.

It also holds money — what a provider charged us per call — which the other three do not.

## Decision

**Append-only in the model, not by a database trigger.** `audit_log` carries a trigger because it
is evidence: somebody with database access has a motive to alter it, and the guard has to sit below
every interface that can reach the table. Nobody has a motive to rewrite telemetry. What the guard
here is for is the accident, and the model catches that.

**Kept when the organisation is deleted.** The foreign key restricts. What the table holds is our
spend, not the customer's data — no prompt, no input, no identifier — so erasure never requires its
removal, and an invoice covering these calls can arrive after the account has closed.

**Cost is an integer count of millionths of a US dollar, and the currency is in the column name.**
A per-call price is smaller than a cent, so a float loses money a fraction at a time across
millions of rows. A separate currency column was written and removed: it made every `sum()` in the
table quietly wrong across a mixed-currency period while giving no correct way to ask the question.
A provider that bills in something else is converted before the row is written, and where that rate
comes from is a decision for whoever adds the provider.

**No partitions and no retention sweep.** Both siblings have one. This table gets neither yet.

## Consequences

The PHP-only guard means a direct `DB::table('llm_call_log')->update(...)` succeeds. That is
accepted: the same statement against `audit_log` is refused, and the difference between the two
tables is exactly the difference between evidence and instrumentation.

Restricting the delete means an organisation cannot be removed while it has call history, the same
position `audit_log` and four other tenant tables already take. The eventual sweep that makes tenant
deletion possible has to cover this table too.

Deferring partitions is cheap now and not later: adding them past roughly ten million rows is a
full table rewrite and a primary-key change to include `occurred_at`. The trigger to revisit is
volume, and nothing measures it yet.

The single index leads with the tenant and then the clock, because every question the table exists
to answer is asked about a period. Model-over-time — "did quality change when the provider moved a
version under a stable alias" — is deliberately cross-tenant and has no index at all: a composite
serving it would have to lead with the tenant it does not have, and a bare index on the model alone
pays a write on every row for a query Postgres would not choose it for. It scans until the volume
justifies a rollup, and a rollup is the right answer to it rather than an index.
