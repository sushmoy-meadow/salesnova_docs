# TASK-LEAD-025 — demo record

Task: **Integrate lead list/detail/assignment/contacted-state end-to-end** (qa, L). **Status:
`done` — the demo was exercised in a browser against both live servers.**

## The demo criterion (AC1), verbatim

> The same lead edited inline in the grid shows the new value in the table and on the detail screen
> without a manual refresh.

## What was set up

- Seeded a coherent org: an owner `Membership` (`fernando.dietrich@example.org`) with three leads
  (Demo Alpha / Bravo / Charlie) in its organisation.
- Signed in through the real OTP flow (email → `queue:work` → code from the mail log → verify).
- Completed the real onboarding sequence in the browser: workspace name, **Real Estate** industry,
  team size "Just me", skipped lead source and WhatsApp. Landed on `/welcome`, then `/leads/grid`.

## What was exercised — and the result

**AC1 passes.** With both servers live (`:8000` API, `:3000` web):

1. `/leads/grid` loaded all three rows and the four column families.
2. Edited **Notes** on Demo Alpha inline in the grid ("Seam verified across grid table detail").
   The write returned `200 PATCH /api/v1/leads/{lead}/notes`.
3. Navigated to the **detail** screen for Demo Alpha — the note showed, no manual refresh.
4. Edited **Stage** on Demo Alpha in the grid (New → Contacted). The write returned
   `200 PATCH /api/v1/leads/{lead}/stage`.
5. Navigated to the **table** (`/leads/table`) — Demo Alpha carried the `contacted` badge and a live
   "8 seconds" time-in-stage, while Bravo and Charlie stayed `New`. No manual refresh.

Notes is the field the detail screen renders; stage is the field the table renders. Between the two,
a grid edit is shown propagating to both other projections without a browser reload — the criterion
end to end.

## What blocked it before, and what fixed it (ISS-035)

The lead list read ran in client code, where the API base URL and the bearer token are both
`undefined`, so no request ever left the browser. Fixing that surfaced two more faults on the same
seam. All three are closed:

1. **Read and write now run server-side.** New `"use server"` actions
   (`src/app/(app)/leads/lead-actions.ts`: `leadQueryAction`, `updateLeadCellAction`) resolve the
   session with `requireOrganizationSession()` and inject the bearer token. Both the grid and table
   screens read through `leadQueryAction`; the grid's inline edit writes through
   `updateLeadCellAction`.
2. **Doubled `/v1` prefix.** The envelope root already ends in `/api/v1`, but `QUERY_PATH` and
   `leadCellPath` prefixed their paths with `/v1`, so every request 404'd on `/api/v1/v1/leads/…`.
   Both now use `/leads/…`, matching the sibling lib files that already carried the warning.
3. **Bearer token clobbered on writes.** `updateLeadCell` spread the caller's options and then
   replaced `headers` wholesale with an `If-Match`-only object, dropping the `authorization` header
   (401). The two are now merged.
4. **The default "All leads" view is now a valid request.** `ComplexQueryRequest` made `filters`
   optional (`sometimes`, with `operator`/`conditions` `required_with`), so the view-only list no
   longer 422s. Covered by a new case in `LeadQueryEngineTest`.

## Built while here (kept, gate-green)

AC4's integration gap was real and is fixed: `LeadFirstResponseService` had no production caller, so
a real response never stamped `first_response_at`. `LeadInteractionService` now stamps the first
response — once, idempotently — from the first outbound-contact interaction (`CALL`, `MESSAGE`),
never from a `NOTE`/dwell view, with the acting member as actor. Covered by
`tests/Feature/Leads/FirstResponseFromInteractionTest.php`.

`composer gate` and `npm run check` both pass. AC6 (saved-view scoping) is an open point — see
`TASK-LEAD-025-open-points.md`.
