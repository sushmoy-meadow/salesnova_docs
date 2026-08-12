# ADR-0062 — Bulk records retain source evidence and tenant-linked ownership

Accepted · 2026-08-11 · @sakib

## Context

Imports need to produce a corrected CSV containing only failed rows after the
original upload has finished. Exports need an auditable record of who requested
the data and which filter produced it. These records are asynchronous and their
links have shorter lifetimes than the records themselves.

## Decision

Import rows retain the original source data, mapped data, status, and field-level
errors as JSONB, and reference their batch through a tenant-matching composite
foreign key. Import batches receive a seven-day undo deadline. Export jobs retain
the filter, requester, row count, signed URL, and a 24-hour expiry. Saved views
store their definitions as JSONB, while member grid columns remain inside the
existing preferences document.

## Consequences

Failed-row downloads can be regenerated without the source file. Tenant joins
cannot cross organizations through an import row. Cleanup workers can use the
explicit deadlines, and export audit code has the requester and selection data
at the job boundary. JSONB keeps these variable documents intact but requires
the future endpoint layer to validate their shapes.

## Alternatives

Storing only normalized lead data was rejected because it cannot recreate the
user's corrected CSV. Separate grid-column and saved-view tables were rejected
because the existing member preference document and saved-filter definition are
already the owning persistence boundaries.
