# ADR-0003 — Laravel 13 · PostgreSQL · Next.js 16

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Founders (overriding an initial engineering
recommendation)

## Context

The stack had to support: high-volume webhook ingestion with a sub-200ms acknowledgement, background
job processing with per-queue isolation, real-time delivery, a rich SPA, and rapid iteration by an
AI-assisted team.

An initial recommendation proposed Spring Boot. The founders selected Laravel.

## Decision

**Laravel 13 with Octane · PostgreSQL 16 · Next.js 16 · Redis · S3-compatible storage.**

## Consequences

- **Horizon** gives us code-defined, version-controlled queue supervisors — directly serving the
  per-queue isolation in [`09`](../09-technical-architecture.md) §SN-ARCH-011, where a large export
  must not delay a lead notification.
- **Octane** provides the throughput headroom. The cost is that application state persists between
  requests; static properties and request-scoped singletons become bugs, and this must be an
  explicit review item.
- Laravel 13's `#[Connection]` / `#[Queue]` attributes keep queue routing on the job class beside
  its logic.
- Postgres gives us partial indexes (the one-pending-follow-up constraint), jsonb (`source_payload`,
  `capabilities`, `payload`), range partitioning (§SN-ARCH-021), and full-text search good enough to
  defer Elasticsearch indefinitely.
- Next.js App Router serves both the authenticated SPA and the server-rendered public surface
  ([ADR-0013](0013-separate-public-surface.md)) from one toolchain and one component library.
- Hiring in India for Laravel and Next.js is materially easier than for the alternative.
- **Types are generated, never hand-written** ([`09`](../09-technical-architecture.md)
  §SN-ARCH-032) — this is how we get end-to-end type safety across a PHP/TypeScript boundary.

## Alternatives

**Spring Boot + Java.** Stronger static typing and a more mature concurrency story. Rejected:
slower iteration for this team, a heavier toolchain, and a smaller regional hiring pool. The
recommendation was made and overruled; the reasoning is recorded here so a future reader knows it
was considered rather than overlooked.

**Node/NestJS end-to-end.** One language throughout. Rejected: Laravel's queue, scheduling and
job-management ecosystem is more complete than anything equivalent, and Horizon in particular has no
close analogue.
