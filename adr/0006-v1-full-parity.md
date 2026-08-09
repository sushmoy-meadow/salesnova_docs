# ADR-0006 — V1 ships full web parity with Privyr

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Founders (overriding an initial
recommendation to ship core parity with deferrals)

## Context

An initial recommendation proposed shipping the core loop plus the WhatsApp wedge, deferring
sequences, campaigns, agency and parts of analytics to V1.5 — the conventional advice for a
challenger.

The founders chose full parity.

## Decision

**V1 matches Privyr's web feature set completely, plus Coexistence.**

## Consequences

- **The switching argument becomes clean.** A prospect evaluating us never finds a feature they
  currently rely on missing. In a market where the incumbent is well known and directly comparable,
  a single missing feature ends the evaluation regardless of how good the wedge is.
- Scope is large. This is acceptable because team size is not the binding constraint — dependency
  order is, which is what [`12-roadmap.md`](../12-roadmap.md) sequences.
- **Parity is not imitation.** Roughly eighteen documented defects in Privyr's implementation are
  specified as fixed rather than reproduced — the tracking beacon chain
  ([`F07`](../features/F07-sharing-and-tracking.md) §3), duplicate detection on ingest rather than
  on open ([`F02`](../features/F02-leads.md)), median rather than mean response time
  ([`F14`](../features/F14-team-and-subteams.md)), atomic lead-form creation
  ([`F11`](../features/F11-lead-forms.md)), and the rest. Parity in capability, not in bugs.
- Risk: the wedge could be diluted by breadth. Mitigated by gate ordering —
  **G3 outranks every G4 feature** ([`12`](../12-roadmap.md) §10). If something slips, it slips from
  G4, never from G3.
- Risk: a long build before customer contact. Mitigated by the two-stage beta and by gates that exit
  on demonstration rather than status.

## Alternatives

**Core parity plus the wedge, deferring the rest.** Faster to market and the conventional choice.
Rejected by the founders: against a known incumbent, an incomplete product invites a
feature-by-feature comparison we would lose on rows that have nothing to do with why we are better.
The recommendation was made and overruled; recorded here so the trade-off is visible rather than
forgotten.
