# ADR-0008 — Modular monolith, not microservices

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Engineering

## Context

Privyr runs 14 backend services behind an `/api/{service}/api/{version}/` gateway. The recon
documents the cost clearly: the same resource versioned at v1, v2 and v3 simultaneously; follow-ups
in a different service from the leads they belong to; sub-teams living in the content service
because that is where they happened to start; two statistics endpoints keyed on opposite ids.

None of that is inherent to microservices. It is what happens when service boundaries are drawn
before the domain is understood.

## Decision

**One Laravel application, internally partitioned into eleven domain modules with enforced
boundaries** ([`09`](../09-technical-architecture.md) §SN-ARCH-002).

Cross-module communication is through published domain events or an explicit public service
interface — never by reaching into another module's models. Enforced by static analysis in CI.

## Consequences

- Transactional consistency where the domain needs it. A lead, its custom field values, its timeline
  event and its audit entry commit together, which in a distributed design would be a saga.
- One deployment, one migration path, one trace. Debugging an ingestion-to-notification path is
  reading one log stream.
- Refactoring across a boundary is a rename, not a coordinated release.
- We accept: the whole application scales as a unit; a memory leak in one module affects all of
  them; and module discipline depends on enforcement rather than on process isolation — which is why
  the CI rule exists rather than a convention document.
- **Extraction stays available.** Enforced module boundaries are exactly the precondition for
  extracting a service later, when a specific measured need appears — most plausibly webhook
  ingestion, if its scaling profile diverges sharply from the rest.
- **A module is the second namespace segment, not a top-level directory.** "Eleven domain modules"
  above reads as `app/Domains/Leads/`, and that is not what shipped. The top level is
  responsibility-first per the company architecture bible §1 — `Models/`, `Services/`, `Http/`,
  `Events/` — and the module is the subdirectory inside each: `App\Models\Leads\Lead`,
  `App\Services\Leads\LeadService`, `App\Events\Leads\LeadAssigned`. A module's code is
  everything under its segment across every responsibility directory.
- **Boundary enforcement resolves a module from that segment.** The rules live in
  `tests/Unit/ArchitectureTest.php` and run in CI with the rest of the suite. Each scopes a boundary
  by the module's path fragment rather than by a list of blessed files — the timeline rule permits
  `/Timeline/` and fails anything else that reaches the event log or its model, so the module's next
  class is inside the boundary without anyone remembering to add it. This is a rule per boundary
  rather than one generic layer check: a new boundary costs a new rule, and in exchange each rule
  states precisely what its own published interface is.

See ADR-0057 for why the bible's own Section 4 worked example, which imports an Eloquent model
across domains, is not followed here.

## Alternatives

**Microservices from the start.** Distributed transactions, network failure modes and deployment
coordination — paid immediately, for scaling flexibility needed at a size we have not reached and
along boundaries we cannot yet identify correctly.

**An unstructured monolith.** Faster for six weeks. Then every module reaches into every other one,
and by the time extraction is genuinely needed it is impossible.
