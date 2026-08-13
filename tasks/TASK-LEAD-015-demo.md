# TASK-LEAD-015 — demo record

Slice: CSV import engine and import wizard UI. Demo exercised 2026-08-14 against both live servers
(`salesnova_backend` on :8000, `salesnova_frontend` on :3000), signed in through the real OTP flow.

## Demo criterion (verbatim)

> A CSV with deliberate bad rows is imported through the wizard, per-row errors are shown in the UI,
> and the batch is undone within the 7-day window.

## Fixture

A fully-onboarded member (`ehaley@example.com`) with `leads.create`, `leads.view_own` and
`leads.view_others`. A four-row CSV built to fail two rows deliberately:

```
name,email,phone
Ada Lovelace,ada@example.com,      ← imports
,orphan@example.com,               ← fails: no name
Grace Hopper,,                     ← fails: no contact method
Alan Turing,alan@example.com,      ← imports
```

## What was exercised

On `/leads/import`, through the wizard, against the real server actions and live API:

1. **Upload** (`POST /leads/import/upload`, multipart): the map step rendered "4 rows in
   lead015-demo.csv" with the three columns auto-matched from the server's suggested mapping
   (name→Name, email→Email, phone→Phone).
2. **Mapping gate** (AC 4): the **"Import 4 rows" button was disabled** until the "I have checked the
   column mapping" checkbox was ticked — the wizard blocks import until the mapping is confirmed.
3. **Import** (`POST /leads/import`): the result showed **"2 imported, 2 failed · 4 rows processed"**
   and, under "Rows that could not be imported", the **per-row errors on screen**:
   - "Row 2: A name is required."
   - "Row 3: At least one of email, phone or WhatsApp is required."
4. **Backend verified after import**: 2 live leads for the org; the batch `COMPLETED` with
   `successful_rows=2`, `failed_rows=2`, `undoable_until` 2026-08-20 (seven days out).
5. **Undo within the window** (`POST /leads/import/{batch}/undo`): the wizard showed **"Import
   undone — The leads this import created have been removed."** and the Undo button disappeared.
6. **Backend verified after undo**: 0 live leads, 2 soft-deleted (`deleted_at` set), batch `UNDONE`.
   The undo removed exactly the two leads the batch created and nothing else.

Screenshot: `lead015-04-undone.png` (in the frontend `.playwright-mcp/` run directory).

## Seam

- `POST /api/v1/leads/import/upload` (multipart `file`) → 201 `LeadImportPreview`
- `POST /api/v1/leads/import` `{import_batch_id, mapping, configuration}` → 202 `LeadImport`, whose
  `failed_rows_detail[{row_number, errors[]}]` is what the UI lists as the per-row errors
- `POST /api/v1/leads/import/{batch}/undo` → 202 `LeadImport` (`status: UNDONE`)

Typed off hand-written Zod schemas matching the wire (the `bulk-operations.ts` precedent), invoked
only from `src/app/(app)/leads/import/import-actions.ts` server actions, so the seam paths carry no
`/v1` (the base URL already does).

## Not covered (see open-points)

The failed-rows CSV **download** button (AC 2) is not yet wired in the UI — the backend endpoint
exists and the demo's per-row errors come from `failed_rows_detail`, not the download. The
duplicate-policy/assignee/groups/tags configure step sends `{}` today. Both are recorded in
`TASK-LEAD-015-open-points.md`.
