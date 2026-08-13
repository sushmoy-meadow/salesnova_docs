# TASK-LEAD-016 — demo record

Slice: lead **export engine and export request UI** (fullstack, size M). Demo exercised 2026-08-14
against both live servers (`salesnova_backend` on :8000, `salesnova_frontend` on :3000), signed in
through the real OTP flow.

## Demo criterion (verbatim)

> A user requests an export from the UI and downloads the produced file, with permission scoping
> visibly applied to the exported rows.

## Fixture

One organisation with two members owning distinct leads, so scoping is observable in the export:

- **Rep** (`cole.floyd@example.com`) — capabilities `leads.export` + `leads.view_own`, onboarding
  completed. Owns **Rep Lead Alpha**, **Rep Lead Bravo**.
- **Owner** — owns **Owner Lead Charlie**, **Owner Lead Delta**.

Signed in as the rep. With `leads.view_own` only, the rep may see their own two leads and none of
the owner's, so a correct export contains exactly Alpha and Bravo.

## What was exercised

On `/leads/export`, against the real server actions and live API, signed in as the rep:

1. **Preview on load** (`POST /leads/export/preview`): the page rendered **"2 leads will be
   exported."** — the rep's own two, not all four in the org. Permission scoping is visible before
   the export is even requested.
2. **Request** (`POST /leads/export`, with an `Idempotency-Key`): the **"Export ready"** banner
   appeared with a **Download CSV** link to the signed URL
   `http://localhost:8000/api/v1/public/v1/leads/export/{id}/download?expires=…&signature=…`.
3. **Download** (`GET` the signed URL): **200 `text/csv`**, body —

   ```
   name,display_name,email,phone_e164,whatsapp_e164,source,created_at
   "Rep Lead Alpha",,alpha@rep.example,+91…,+91…,MANUAL,"2026-08-13 21:40:28"
   "Rep Lead Bravo",,bravo@rep.example,+91…,+91…,MANUAL,"2026-08-13 21:40:28"
   ```

   Only the rep's two leads. **Owner Lead Charlie and Owner Lead Delta are absent** — scoping is
   applied to the produced rows, not just the count.

4. **Audit (AC 2), verified in the DB**: exactly **one** `DATA_EXPORTED` entry, `actor_membership_id`
   = the rep's membership, resource `lead_export#{id}`, `after = {filter, row_count: 2, format:
   "csv"}`. One export, one entry, recording requester, filter and row count.
5. **Expiry (AC 3)**: the signed link's `expires` is **23.99 h** out (≈24 h). A request with a
   tampered signature returns **403**, confirming the `signed` middleware is enforcing the link; the
   25-hours-later 403 is proven by `LeadExportEngineTest` (`this->travel(25)->hours()`), which the
   browser cannot wait out.

## Seam

- `POST /api/v1/leads/export/preview` `{selection}` → 200 `ExportPreview` `{affected_count, warnings[]}`
- `POST /api/v1/leads/export` `{selection, format?}` + `Idempotency-Key` → 202 `ExportResult`
  `{export_job_id, status, download_url, expires_at}`
- `GET /api/v1/public/v1/leads/export/{exportJob}/download?expires&signature` → 200 streamed CSV
  (public, `signed` middleware — no tenant context, so the job is loaded `withoutGlobalScopes`)

Typed off hand-written Zod schemas matching the wire (the `bulk-operations.ts` precedent), invoked
only from `src/app/(app)/leads/export/export-actions.ts` server actions, so the seam paths carry no
`/v1` (the base URL already does). The export POST mints its `Idempotency-Key` in the seam.

## Fixes made during the demo

- **Preview shared the 1/hour export throttle.** Both `leads/export/preview` and `leads/export` sat
  under `throttle:exports` (`Limit::perHour(1)` per membership). The preview fires on page load — and
  twice under React's dev strict-mode double-effect — so it consumed the single hourly hit and the
  actual export was then blocked; the first page load showed "Too Many Attempts". Moved the preview
  onto `throttle:bulk-operations` (10/hour, where every other preview endpoint lives) and left only
  the export generation on `throttle:exports`. Regression test added: *"lets a requester preview and
  then export within the same window"*. `routes/splits/customer.php`.
- **`APP_URL` had no port**, so `temporarySignedRoute` minted download links to `http://localhost`
  (port 80) which do not resolve against `artisan serve` on :8000. Set the local `.env` `APP_URL` to
  `http://localhost:8000` for the demo. This is a local-dev-only caveat (production `APP_URL` is the
  real domain); logged as ISS-038.

## Not covered (see open-points)

XLSX export (returns 501 by design), plan-tiered row limits (a flat `leads.exports.max_rows` cap
stands in), and driving the export from an actual leads-grid filter selection (the UI exports the
whole visible set today). All recorded in `TASK-LEAD-016-open-points.md`.
