# ADR-0063 — Lead merge winners are explicit field/lead pairs

Superseded in part · 2026-08-11 · @sakib

> **Superseded 2026-08-13 by
> [0072](0072-the-built-endpoint-decides-its-contract-where-it-differs-from-the-stub.md)** in the
> request shape below. The shipped endpoint takes `duplicate_lead_id` and a `field_winners` map, and
> takes the survivor from the route. The undo route and its thirty-day window still stand. The body
> of this record is left as written.

## Context

The lead merge screen must let a user choose which source lead wins each
conflicting field. The field set includes organization-defined custom fields,
so the contract cannot enumerate every possible field name.

## Decision

`POST /leads/{lead}/merge` accepts `survivor_lead_id` and a non-empty
`winner_selections` array. Each entry contains `field` and `lead_id`, making
the selected source explicit for both standard and custom fields. Duplicate
review is exposed through the organization queue and lead detail routes, and
merge reversal is `POST /leads/{lead}/merge/undo` within the existing 30-day
undo window.

## Consequences

The generated OpenAPI contract can describe arbitrary custom-field choices
without pretending that a wildcard JSON object has fixed properties. The
future merge engine must validate that each selected lead belongs to the
duplicate set and that the survivor is one of the merge participants.

## Alternatives

A map from field name to lead UUID was rejected because the project's request
contract generator exposes wildcard Laravel arrays as list schemas, making the
map shape either inaccurate or undocumented. Fixed fields were rejected
because custom fields are part of the merge surface.
