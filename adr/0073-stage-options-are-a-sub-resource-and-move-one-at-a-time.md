# ADR-0073 — Stage options are a sub-resource, and move one at a time

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

SN-FIELD-008 requires that reordering be conflict-free: two managers reordering stages at the same
moment must not silently overwrite each other. SN-FIELD-020 makes a stage option a small record in
its own right — `order`, `color_id`, `is_terminal`, and an `outcome` of `WON` or `LOST` — and
TASK-FIELD-005 is the slice that has to make both true and put an editor in front of them.

Stage options are not rows. They live in the jsonb `options` column of the `LEAD_STAGE`
`custom_field_definitions` record, decided when the schema was built. So "reorder the stages" is a
read-modify-write of one column, which is the shape in which a lost update is easiest to write and
hardest to see.

The obvious home for the write is the generic custom-field CRUD, which owns the definition record.
That work is TASK-FIELD-003: `pending`, blocked behind TASK-FUP-003, and present in the codebase as
501 stubs with a route contract and nothing behind it.

That left three options.

**Implement the definition-update endpoint here.** It is the endpoint that already exists on paper,
and stages are a definition. But its contract takes a definition — including its whole options array
— and the slice would have to decide the semantics of every other field on that record to serve one
of them. TASK-FIELD-003 would then inherit a contract chosen by a task that never read its
requirements, and the first thing it would have to do is decide whether to keep it.

**Accept a posted options array on a stage endpoint.** Simplest to write, and wrong for the stated
reason: a client that sends the full list sends its own copy of everything it did not change. Two
managers each send a complete array a few seconds apart and the second erases the first's edit
completely — no conflict, no error, no trace. That is precisely the failure SN-FIELD-008 exists to
prevent, reintroduced at the seam by the request shape.

**Give stages their own sub-resource, addressed one option at a time.** More surface, and a second
place that writes the same column.

## Decision

**Stage options get a sub-resource under the custom-fields prefix, and every write names exactly one
option.**

```
GET   /v1/custom-fields/stages
PATCH /v1/custom-fields/stages/{value}
POST  /v1/custom-fields/stages/{value}/move
```

A move states an intent rather than a result: `{"move": "UP"}`, `{"move": "DOWN"}`, or
`{"position": "AFTER", "relative_to": "<value>"}`. Nothing about the positions of the options the
caller did not name is in the request, so nothing about them can be overwritten by it. Two managers
moving two different stages both land; two managers moving the *same* stage produce the two moves in
the order they arrived, which is a coherent outcome rather than a lost one. A `PATCH` carries only
the keys it changes, and the option's other fields survive it.

The reordering itself is one primitive, `App\Support\RelativeMove`, applied to a list of keys. It
serves both the option order inside the jsonb column and the field order across `display_order`
rows — the same requirement in two storage shapes, and it would have been two implementations of one
rule if the field-level move had been written where it is used.

`{value}` is constrained to `[A-Za-z0-9_-]{1,64}` and the `stages` prefix is registered ahead of
`{customField}`, which is uuid-constrained and so could not have matched anyway.

The response is the whole stage configuration, not the changed option: the editor's next render
depends on every option's `order`, and a move changes at least two of them.

## Consequences

Two endpoints now write `custom_field_definitions.options` — this one and, eventually,
TASK-FIELD-003's definition update. That is the cost. It is bounded by the fact that this one writes
a strictly narrower thing: it can move an option and change four of its fields, and it cannot create
one, delete one, or touch anything else on the definition. If TASK-FIELD-003 ships an options array
on its update endpoint, the two will disagree about concurrency, and the resolution is already
implied here — the array is the shape SN-FIELD-008 rules out, and it should not ship.

The editor is more chatty. Dragging a stage three places is three requests rather than one save. In
exchange each of them is individually safe to retry, and a half-applied reorder is a stage in a
defensible position rather than a list in an arbitrary one.

`outcome` is bound to `is_terminal` at the request boundary — required when the flag is set, cleared
when it is unset — rather than left to the caller to keep consistent. A stage nobody can close in
carrying a `WON` is a filter that silently matches, and conversion reporting is the surface that
would read it wrong, unbuilt and therefore untestable today.

Nothing here changes how the web app types the response. It hand-writes a Zod schema against the
published contract and imports nothing from the API's checkout, per
[ADR-0068](0068-the-web-app-reads-the-contract-at-runtime-and-never-imports-it.md).
