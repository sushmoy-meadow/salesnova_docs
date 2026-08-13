# TASK-LEAD-014 — demo record

Slice: bulk operations engine and bulk action UI. Demo exercised 2026-08-14 against both live
servers (`salesnova_backend` on :8000, `salesnova_frontend` on :3000).

## Demo criterion (verbatim)

> A bulk action over a mixed-eligibility selection shows a live preview, executes with partial
> success, and reports per-record outcomes in the UI.

And the slice's second criterion:

> A bulk operation with some ineligible records shows the succeeded/skipped breakdown rather than an
> all-or-nothing failure.

## Fixture

A non-owner member (`csimonis@example.com`) with capabilities `leads.view_own`, `leads.view_others`
and `leads.delete` but **not** `leads.edit_others` — the combination that makes a mixed selection
partially eligible. Fully onboarded. Five leads: three assigned to the member (eligible to delete),
two assigned to the org owner (ineligible — assigned to someone else). Signed in via the real OTP
flow.

## What was exercised

On `/leads/grid`, a mixed selection of all five leads was ticked. The bulk action bar showed
`5 selected · Delete · Clear`.

1. **Live preview** (`Delete` → `POST /leads/bulk/delete/preview`, via the server action): the modal
   showed **"3 of 5 selected will be affected. 2 skipped — Assigned to someone else"**. The eligible
   count and the skip breakdown are the backend's own partition, not a client guess.
2. **Partial-success execute** (`Delete` confirm → `POST /leads/bulk/delete`): the modal showed
   **"3 done, 2 skipped. 2 skipped — Assigned to someone else"** — a succeeded/skipped breakdown,
   not an all-or-nothing failure.
3. **Backend verified**: the three member-owned leads are soft-deleted (`deleted_at` set); the two
   owner-owned leads are untouched. The per-record outcome the UI reported matches what the database
   did.

Screenshots: `lead014-01-selection.png`, `lead014-02-preview.png`, `lead014-03-result.png` (in the
frontend `.playwright-mcp/` run directory).

## A real bug the demo caught

The bulk seam (`src/lib/leads/bulk-operations.ts`) prefixed every path with `/v1`. It is invoked
only from a server action, where the base URL already carries `/api/v1`, so the first preview 404'd
on `/api/v1/v1/leads/bulk/delete/preview`. Fixed by dropping the `/v1` from `BULK_ROOT` (matching the
convention already documented in `src/lib/fields/stages.ts`, another server-invoked seam), and the
three URL assertions in `bulk-operations.test.ts` were updated to match. Logged as ISS-034.

## Demo harness (not product code)

The lead grid's list load is broken independently of this slice (ISS-035): its client-side fetch
sends no auth and a request body the query endpoint rejects, so no rows render in a browser. To get
selectable rows without editing another task's code, the five real seeded rows were written into the
grid's React Query cache directly, and a browser `fetch` shim supplied a bearer token for the list
call. Neither touches the repository. The bulk preview and execute — the actual subject of this
slice — ran through the real server actions against the live backend, unshimmed.
