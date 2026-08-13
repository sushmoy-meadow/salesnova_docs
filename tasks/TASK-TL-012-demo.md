# TASK-TL-012 — demo record

Task: **Integrate manual timeline and activity feed end-to-end** (qa, L). **Status: `done` — the
demo criterion was exercised in a browser against both live servers, and every other criterion has
a test.**

## The demo criterion (AC1), verbatim

> A manual note logged in the UI appears in the lead timeline immediately and is present in the event
> log with the same id.

## What "same id" means here

The slice writes into two append-only stores: `timeline_event` (what the timeline and the feed read)
and `event` (the audit log). They carry **distinct** ordered UUIDs by design — the audit row links
the timeline entry through `payload.timeline_event_id`, it does not share a primary key with it. So
"the same id" is read as *the event log carries the timeline entry's id*, which is exactly the link
asserted below. This is a reading of the criterion, not a shared-column claim.

## What was exercised — and the result

**AC1 passes.** With both servers live (`:8000` API, `:3000` web), signed in through the real OTP
flow as the org owner (`fernando.dietrich@example.org`):

1. Opened `/leads/{lead}/timeline` for **Demo Alpha** (`019ffd5b-8334-…`, that owner's org). The
   composer rendered over an empty stream.
2. Typed a note in the composer and pressed **Log activity**. The write returned, and the entry
   appeared under **Today** as `Note · Gunnar Beer · 05:03` with the body — **no manual refresh**.
3. Read the two stores directly. The newest `event` row is the `NOTE`, `occurred_at`
   `23:33:19.105530`, actor the owner's membership. Its `payload.timeline_event_id` resolves to a
   real `timeline_event` row of type `NOTE`, **same body, same actor membership, same `occurred_at`
   to the microsecond**. The audit log carries the timeline entry's id, and the timeline showed it
   the instant it was logged.

A first navigation to a *different-org* Demo Alpha returned "The timeline could not be loaded — No
query results for model Lead". That is correct cross-tenant behaviour (404, not 403), not a fault:
that lead belongs to another organisation. The owner's own Demo Alpha loaded and logged fine.

## The other four criteria — each has a test

Backend composition tests live in
`salesnova_backend/tests/Feature/Timeline/TimelineCompositionTest.php` unless noted.

- **AC1** (also mechanised) — *lands a manual note in the timeline and the event log at once, linked
  by id*: posts a `NOTE`, asserts the `timeline_event` id is in the timeline read and that an
  `event` row carries it in `payload.timeline_event_id`, same actor and `occurred_at`.
- **AC2** (three same-instant events, stable documented order identical on reload) — *renders a
  same-instant burst in a stable, id-ordered sequence identical on reload*: three `timeline_event`
  rows share one microsecond `occurred_at`; the read is asserted equal to the ids sorted
  **descending**, and the second read equal to the first. **Documented order:** newest
  `occurred_at` first, ties broken by `id` descending. `id` is an ordered UUID (monotonic with
  insertion, lexically sortable), so the tie-break is total and stable across reloads — which is the
  risk TASK-TL-001 flagged, that `id` alone is not an *ordering* key but is a sound *tiebreaker*.
- **AC3** (no scope → not in feed, and not by direct URL) — the direct-URL half is *closes a lead
  timeline to a member who has no scope for it*: a same-tenant rep with `LEADS_VIEW_OWN` only is
  denied a direct `GET /leads/{othersLead}/timeline` (403/404). The feed half is already covered by
  `tests/Feature/Timeline/ActivityFeedTest.php`, where a `LEADS_VIEW_OWN` rep does not receive
  another member's lead events in `GET /insights/activity`.
- **AC4** (1,000 events, no repeat or skip across boundaries) — *pages a thousand events through the
  feed with no repeat and no gap*: 1,000 `timeline_event` rows on a visible lead, paged through
  `GET /insights/activity?limit=200` following `next_cursor` to exhaustion; the union is asserted to
  be exactly the 1,000 ids, each once.
- **AC5** (a user-initiated system action carries the user, not the system) — covered by
  `tests/Feature/Leads/AssignmentAgreesAcrossRecordsTest.php`: an assignment writes both an `event`
  and a `timeline_event`, and both carry the acting **member** (`actor_type = MEMBER`), not `SYSTEM`.

## Gate

`composer gate` is green (1425 passed, 16 skipped — the skips are SQLite table-partition tests that
cannot run on the test driver). No frontend change was needed: the timeline screen already reads and
writes through server actions with the org header, and the path carries no `/v1` doubling.
