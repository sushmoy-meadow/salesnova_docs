# ADR-0009 — Shared-schema multi-tenancy

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Engineering

## Context

Three models were available: a database per tenant, a schema per tenant, or a shared schema with a
tenant discriminator. Target scale is 10,000 organisations
([`10`](../10-nfr-security-compliance.md) §SN-NFR-004).

## Decision

**Shared schema. `organization_id` on every tenant-scoped table, leading every composite index,
applied by a global Eloquent scope.**

## Consequences

- Migrations run once. At 10,000 tenants, a schema-per-tenant migration is an hours-long operation
  with partial-failure states, and it happens on every release.
- Connection pooling, caching and query planning all behave normally.
- Cross-tenant analytics for our own operations are a query, not a fan-out.
- **We accept that isolation is now enforced by code rather than by the database.** A query that
  forgets the tenant is a data breach. This is the single highest-severity bug class in the product
  and is treated as such: four enforcement layers, a blocking CI isolation suite, a static-analysis
  rule against raw queries in domain code, and query-log sampling in staging
  ([`09`](../09-technical-architecture.md) §SN-ARCH-020).
- **Every cache key includes `organization_id`.** A colliding cache key is the most likely route to
  a cross-tenant leak, because it bypasses the query layer entirely.
- A cross-tenant reference returns `404`, never `403` — `403` confirms the record exists.
- Per-tenant restore is harder. Mitigated by the full account export
  ([`F20`](../features/F20-import-export.md)) and by PITR to a scratch environment.

## Alternatives

**Database per tenant.** Strongest isolation, and the operational cost at 10,000 tenants is
prohibitive — provisioning, migrations, backups, connection limits and monitoring all multiply.

**Schema per tenant.** A middle ground that inherits the migration problem without the isolation
guarantee of separate databases. Postgres also degrades with very large schema counts.

**Row-level security in Postgres.** Genuinely attractive as a fifth enforcement layer and worth
revisiting. Not adopted in V1 because it interacts awkwardly with connection pooling under Octane,
and a bypassed RLS policy fails silently open. Reconsider once the application-layer controls are
proven.
