# TASK-LEAD-018 — open points

Built: `/leads/grid`, a column-configurable spreadsheet whose cells write independently, and the
guard that sends anything under `lg` to the table view with a one-time notice. What follows is what
could not be closed inside `salesnova_frontend`, and what would close it.

## 1. Every inline-edit route answers 501

`routes/splits/customer.php` registers the six PATCH routes — `assignee`, `stage`, `groups`,
`follow-up`, `notes`, `custom-fields/{field}` — and `LeadCellUpdateController` returns
`NOT_IMPLEMENTED` for all of them. `src/lib/leads/lead-cell-update.ts` is built against the wire
contract they publish (`LeadCellUpdateRequest` takes a single `value` key, the response is a
`LeadDTO`) and is unit-tested with a stub fetcher, path by path.

AC-LEAD-014.1 — three cells edited, the second refused, cells one and three surviving — is proved in
`src/components/leads/lead-grid.test.tsx` against a sender the test controls, including the harder
case of two cells of the *same* lead where a whole-row rollback would have discarded the survivor.
What is unproved is that a real refusal arrives shaped the way the test shapes it.

**Closes when** the cell-update assembly is implemented and one refusal is watched failing against
the running API.

## 2. `LeadDTO` carries none of the columns the grid edits

The DTO publishes `id`, `name`, `display_name`, `email`, `phone_e164`, `whatsapp_e164`,
`phone_country`, `notes`, `source`, `assigned_membership_id`, `is_new`, `created_at`, `updated_at`.
The grid needs `stage`, `group_ids`, `follow_up_at` and `custom_fields` as well — SN-LEAD-014 names
all four as editable.

`leadRowSchema` reads them with defaults rather than as required fields, so a row still parses today
and those cells simply render empty. A required field would have taken the whole page down over a
column nobody had configured.

**Closes when** `LeadDTO` gains the four, at which point the cells fill themselves with no client
change.

## 3. No response publishes a per-row ETag, and the writes require one

`EnsureOptimisticConcurrency` is on all six PATCH routes and rejects a request with no `If-Match`.
The tag is server-computed (`$this->tagger->for($record)`), so a client cannot derive it, and neither
`POST /v1/leads/query` nor `LeadDTO` carries one.

`leadRowSchema` reads an optional `etag` and `updateLeadCell` sends `If-Match` when the row has one
and omits the header when it does not — so every inline edit is refused for a missing precondition
until the tag is published. This is the one open point that stops the grid working end to end even
after point 1 lands.

**Closes when** the lead query response carries the same tag the middleware computes, per row. One
field on the DTO.

## 4. Column configuration does not persist server-side

SN-LEAD-013 says grid column order and visibility persist in `membership.preferences.grid_columns`.
`Membership` casts a `preferences` JSON column, but no route reads or writes it — there is no
`GET`/`PATCH` for a member's own preferences anywhere in `routes/splits/`.

`src/stores/lead-grid-columns-store.ts` holds the arrangement in `localStorage`, keyed by membership
id so two people on one laptop and one person's two organisations do not share a layout. The shape
it stores is exactly `{ order, hidden }`, zod-validated on read and dropped if unreadable.

**Closes when** a member-preferences endpoint exists. The swap is that one module: the store's
`byMembership` entry becomes a query, and `setPreference` becomes an optimistic write.

## 5. The redirect target does not exist yet

AC-LEAD-010.1 sends a narrow viewport to `/leads/table`. That route is TASK-LEAD-017, which is
`pending` and blocked on TASK-DESIGN-007, so the redirect currently lands on the not-found page. It
was not stubbed here: a placeholder at that path would read as the table view being built.

`GridRedirectNotice` — the one-time explanation the AC asks for — is built and tested in
`src/components/leads/grid-width-guard.tsx`, but nothing mounts it, because the page that should is
the one that does not exist.

**Closes when** TASK-LEAD-017 builds `/leads/table` and mounts `<GridRedirectNotice />` at the top of
it.

## 6. Nothing publishes the signed-in member or the organisation's vocabulary

`/leads/grid` passes `currentMembershipId=""` and an empty `LeadFilterVocabulary`, so the assignee,
stage, group and custom-field cells render with nothing to pick from. There is no bootstrap or
session module in this repo yet — the same gap TASK-LEAD-019 recorded for `canShareWithOrganisation`.

**Closes when** whatever publishes the session — TASK-LEAD-025's integration, or the bootstrap
endpoint behind it — fills those two props. Nothing else in the grid changes.
