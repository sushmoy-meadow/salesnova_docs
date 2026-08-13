# ADR-0069 — Sub-team scope keeps UUIDs in JSONB

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

The team schema needs a tenant-scoped `accessible_subteam_ids` scope and a PostgreSQL GIN index
for filtering it. The column already exists in the permissions migration as JSONB, and sub-team
identifiers follow the repository-wide UUID key convention. A PostgreSQL `integer[]` conversion
would make existing UUID values impossible to read or write and would disagree with the reserved
UUID sub-team references already present in content sharing.

## Decision

Keep `accessible_subteam_ids` as JSONB containing UUID strings and add the PostgreSQL GIN index to
that existing column. SQLite keeps the same JSONB-compatible fallback and uses a normal index for
its test driver.

## Consequences

The scope representation remains compatible with existing membership data, UUID sub-team models,
and the future content-sharing reference. PostgreSQL gets index support for containment queries.
The application must use JSON/array casts rather than PostgreSQL integer-array operators.

## Alternatives

An `integer[]` column was rejected because it cannot represent the UUID identifiers already used by
the application. Replacing UUID keys with integer sub-team identifiers would widen this schema task
into every existing sub-team reference and violate the established tenant-key convention.
