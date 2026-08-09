# ADR-0013 — Public surfaces deploy separately

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Engineering + Product

## Context

Two surfaces are opened by people who are not our users: the **share viewer**
([`F07`](../features/F07-sharing-and-tracking.md)) and **public lead forms**
([`F11`](../features/F11-lead-forms.md)). They are unauthenticated, linked from WhatsApp and SMS,
indexed, and opened on unknown devices.

They are also the first impression a prospect has of our customer's business.

The recon found Privyr loading **eight third-party trackers** on these surfaces and leaking globally
sequential identifiers — `hitcountPK` 6,749,871, `hit_id` 3,829,825 — to every recipient.

## Decision

**A separate Next.js deployment carrying no CRM code, no authentication code, no third-party
scripts, its own strict CSP, its own rate limits, and its own performance budgets. Enforced in CI:
the public build may not import from the CRM bundle.**

## Consequences

- **A vulnerability in the CRM bundle is not reachable from an unauthenticated origin.** This is the
  security argument and it is sufficient on its own.
- Budgets that are actually achievable: 50 KB gzipped for the viewer, 40 KB for the form, **zero
  bytes of web fonts** ([`10`](../10-nfr-security-compliance.md) §SN-NFR-002). Sharing the CRM
  bundle would make these impossible.
- Higher availability target (99.95%) because the failure is invisible and unrecoverable — a broken
  lead form loses a customer we never learn existed.
- **Zero third-party trackers.** A prospect's browsing is not sold to eight vendors because our
  customer shared a brochure. Meta CAPI is offered as the honest, server-side, consented substitute
  ([`F06`](../features/F06-content.md)).
- Identifiers are opaque and tenant-scoped, never sequential.
- We accept: a second deployment pipeline, and shared components must be published through a
  common package rather than imported directly. Both are modest and both are the point — the
  friction is what keeps the CRM bundle out.

## Alternatives

**Serve public routes from the main app.** One deployment, one pipeline. Rejected: it puts
authenticated application code on an unauthenticated origin, makes the performance budgets
unreachable, and means every CRM dependency is in the attack surface of a page anyone can open.

**A static site generator for the viewer.** Insufficient — the viewer is personalised at render
time, owner-aware, and instrumented.
