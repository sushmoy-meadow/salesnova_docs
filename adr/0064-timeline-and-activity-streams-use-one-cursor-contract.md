# ADR-0064 — Timeline and activity streams use one cursor contract

Accepted · 2026-08-11 · @sakib

## Context

Lead timelines and organization-wide activity feeds are append-heavy streams.
New events can arrive while a reader is paging, so offset or page-number
pagination can skip or repeat events. Both surfaces also need the same stable
ordering and cursor metadata.

## Decision

Both GET streams expose an opaque `cursor` and optional `limit` with a default
of 50. The lead timeline additionally accepts a category filter; the activity
feed accepts member, event type, date-range, and lead-group filters. Neither
contract exposes `page`, `per_page`, or `offset`. Mutations remain on explicit
timeline event routes, while manual creation keeps the existing interactions
surface for client compatibility.

## Consequences

Clients can share one cursor-pagination reader and cannot accidentally use an
unstable offset strategy. Future query implementations must order by
`occurred_at` and `id` descending and apply permission scoping before returning
the page. The route contracts can ship before the read and write engines.

## Alternatives

Offset pagination was rejected because concurrent event arrival shifts a page
boundary. Separate pagination shapes were rejected because they would make two
append-heavy streams drift in client behavior without buying a domain
difference.
