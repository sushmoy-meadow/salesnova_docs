# ADR-0010 — `event` is separate from `timeline_event`

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Engineering + Product

## Context

The product needs two records of what happened, and they look similar enough that merging them is
proposed on every project of this kind.

- **`timeline_event`** is what a rep reads on a lead: curated, human-phrased, filterable, with
  manual entries that can be edited, backdated, pinned and deleted.
- **`event`** is the machine record: every state change, complete, immutable, with
  `correlation_id` and `causation_id` so causality can be reconstructed.

## Decision

**Two tables. They must not be merged.**

## Consequences

- `timeline_event` can be edited and deleted by users without destroying the analytical record —
  which is what makes manual logging safe to offer with minimum friction
  ([`F05`](../features/F05-timeline-and-activity.md) §3).
- `event` can be complete without flooding the rep's view with noise. A rep does not want to read
  forty rows because a bulk operation touched a field.
- `event` carries causality. Reconstructing **that this message caused that reply which caused that
  stage change** is what makes the AI substrate more than a pile of timestamped facts
  ([`11`](../11-ai-substrate.md) §SN-AI-010).
- Both are partitioned monthly ([`09`](../09-technical-architecture.md) §SN-ARCH-021), with
  different retention: `timeline_event` for the life of the account, `event` likewise but
  independently tunable.
- We accept the write amplification: most state changes write both rows. This is cheap, and it is
  the price of having a curated view and a complete record at the same time.

## Alternatives

**One table with a visibility flag.** The merge that gets proposed. It fails because the two have
opposite requirements: one must be editable and deletable by users, the other must be immutable and
complete. A single table has to pick one, and picking "editable" silently destroys the substrate
while looking like a simplification.

**Event sourcing as the write model.** Rebuild state by replaying events. Rejected: significant
complexity in projections, versioning and replay, for benefits we obtain from an append-only log
alongside a conventional write model ([`09`](../09-technical-architecture.md) §10).
