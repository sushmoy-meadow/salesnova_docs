# TASK-LEAD-015 — open points / resume

Slice: **CSV import engine and import wizard UI** (fullstack, size L). **Status: `in_progress`.**

Demo criterion (verbatim):

> A CSV with deliberate bad rows is imported through the wizard, per-row errors are shown in the UI,
> and the batch is undone within the 7-day window.

This is a two-repo slice too large for one build. **Both halves are now built, tested and
gate-green** (`composer gate` and `npm run check`). What remains before close is **the live browser
demo (`/build-slice §6`) and the four-agent simplify pass** — the slice cannot be closed until the
demo above runs against both live servers. Do **not** mark it `done` before then.

## What is built (frontend, `salesnova_frontend/`)

- `src/lib/auth/api-envelope.ts` gained `postMultipartEnvelope` — the JSON helpers cannot send a
  file; it leaves content-type unset so fetch derives the multipart boundary.
- `src/lib/leads/imports.ts` — the seam: `uploadImport` (multipart → preview), `commitImport`
  (JSON → result), `undoImport`. Server-invoked, so **paths carry no `/v1`** (base already does).
  Zod schemas hand-written to the wire and camel-cased, following the `bulk-operations.ts`
  precedent. Tests: `imports.test.ts` (4).
- `src/app/(app)/leads/import/import-actions.ts` — `"use server"` actions resolving the session and
  forwarding to the seam.
- `src/components/leads/import-wizard.tsx` — client wizard: upload → map (a `Select` per column,
  seeded from `suggested_mapping`) → import → result. **Import is disabled until a "I have checked
  the column mapping" checkbox is ticked** (AC 4). The result shows `successful/failed` counts and
  the per-row failures from `failed_rows_detail`, and an **Undo import** button. Tests:
  `import-wizard.test.tsx` (3) — the mapping gate, the per-row error display, the undo.
- `src/app/(app)/leads/import/page.tsx` — the route, wiring the wizard to the actions.

## Backend change made while building the frontend

The commit `202` response (`LeadImport`) gained **`failed_rows_detail: [{row_number, errors[]}]`** —
without it the wizard had no structured source for "per-row errors shown in the UI" (the failed-rows
CSV is a download, not a UI list). `LeadImportDTO`, `ImportBatchPresenter` and `ImportCommitService`
were updated, the Pest test asserts it, and the contract was regenerated. Backend gate still green.

## What is built (backend, `salesnova_backend/`)

The three 501 stub controllers are wired to a native (no `league/csv`) inline pipeline. The data
model was already scaffolded (`import_batches`, `import_batch_rows`, enums, DTO, policies).

Seam, all under `/api/v1`:

- `POST leads/import/upload` (multipart `file`) → **201** `LeadImportPreview`
  `{import_batch_id, filename, total_rows, headers[], sample_rows[≤10], suggested_mapping{}}`.
  Creates the batch `PENDING` and stores every row as an `import_batch_row` (`PENDING`,
  `source_data`). No lead is created here.
- `POST leads/import` (base, commit) `{import_batch_id, mapping{header→field}, configuration{}}` →
  **202** `LeadImport` DTO. Maps + validates + writes each pending row inline; a row that cannot
  become a lead is recorded `FAILED` with `error_details.errors[]` and the batch keeps going.
  Sets `status=COMPLETED` and opens the 7-day undo window from completion.
- `POST leads/import/{batch}/undo` → **202** `LeadImport`. Soft-deletes exactly the leads the batch
  created, within the window; reports `non_reverted_rows` for any lead already gone. `410 GONE`
  once the window closes; `INVALID_STATE_TRANSITION` if already undone / not completed.
- `GET leads/import/{batch}/failed-rows` → **200** streamed CSV: the original columns of the failed
  rows plus one `error` column. Re-uploading it runs straight back through `upload` (the extra
  column carries no mapping and is ignored).

Files: `app/Services/Leads/Import/{CsvReader, ColumnMapper, ImportRowValidator, ImportUploadService,
ImportCommitService, ImportUndoService, FailedRowsCsvService, ImportBatchPresenter}.php`;
`app/DTOs/Leads/LeadImportPreviewDTO.php`; the three controllers; `LeadImportRequest` gained `file`;
`ImportBatchPolicy::create` gates `LEADS_CREATE`; `lang/en/errors.php` gained an `import` group; the
contract was regenerated (`contracts/openapi.json`, `api-types.ts`). Tests:
`tests/Feature/Leads/LeadImportEngineTest.php` (6, all green) — upload preview, commit with per-row
errors, commit refused without a mapping, failed-rows CSV, undo within window, undo refused after it.

## What remains

1. **Browser demo (`/build-slice §6`)** against both live servers, then close (`§7`). Fixture: a CSV
   with deliberate bad rows (one missing name, one with no contact). Sign in (real OTP flow, as on
   the LEAD-014 demo), go to `/leads/import`, upload the CSV, confirm the mapping, import, **read the
   per-row errors on screen**, then **Undo import** and confirm in the DB that the batch's leads are
   soft-deleted. Record it in `TASK-LEAD-015-demo.md`. This is the one criterion with no open-point
   exemption; if it cannot run, leave `in_progress` and say why.
2. **Four-agent read-only simplify pass** over both halves' diffs before closing.
3. **Failed-rows CSV download button (AC 2)** is not yet wired in the UI. The backend endpoint
   exists (`GET leads/import/{batch}/failed-rows`, streamed CSV) and the demo (AC 1) does not need
   it — the per-row errors come from `failed_rows_detail`. A `fetchFailedRowsCsv` seam + a download
   control is a small follow-on; the download needs the bearer token, so it goes through a server
   action returning the CSV text (a bare `<a href>` to the API origin would not carry auth).
4. **Duplicate-policy / assignee / groups / tags configure step** — the backend still accepts a
   `configuration` object on commit, but no longer acts on it. The `duplicate_policy: skip` path that
   `ImportCommitService` carried was removed in the simplify pass: nothing sent it (the wizard sends
   `{}`, no test exercised it), it matched only on email, and it reimplemented duplicate detection
   instead of routing through `LeadDuplicateDetector` / the `DuplicatePolicy` enum / `LeadDuplicateResolver`.
   When the configure step is built, import duplicate handling should go through those, not a private
   email-only check. Add the configure UI when its inputs (member picker, group list) have a client
   source.

## Decisions taken (backend), each deferred piece and why

- **Inline execution under 202, no queue** — the same pattern the bulk slice took (LEAD-014). The
  contract says "accepted for processing"; the service runs synchronously and returns a `COMPLETED`
  batch. A genuine async runner (progress polling, a Horizon job) is a later task; the 202 is kept
  so the contract does not churn when it lands. For a 10k-row cap this is acceptable; note the row
  loop creates rows one Eloquent `create` at a time (fine for the sizes a wizard uploads, a chunked
  bulk-insert is the optimisation if a much larger cap is ever wanted).
- **Direct multipart upload, presigned S3 deferred.** `upload_id` / `file_size` stay in
  `LeadImportRequest` for a future presigned flow, but the built path accepts the file directly on
  the `upload` step. No S3 in the sandbox; revisit when object storage is wired.
- **`map` / `preview` / `configure` steps answer `NOT_IMPLEMENTED`.** They are wizard steps the
  client drives from the `upload` response (headers + sample + suggested mapping are enough to map,
  preview and configure without a round trip). Only the two steps that touch data — `upload` and the
  base commit — are server-backed. If a server-side dry-run preview is later wanted, `preview` is
  where it goes.
- **Duplicate policy: not implemented.** An early `skip`-by-email branch was removed in the simplify
  pass (see remaining item 4) — it was dead, email-only, and bypassed the platform's duplicate seam.
  Import always creates today; real dedupe belongs to the configure step and `LeadDuplicateResolver`.
- **Undo marks the batch `UNDONE` and soft-deletes the leads; row status is left `IMPORTED`.**
  There is no `UNDONE` row status, and overloading `SKIPPED` would lose the history that the row was
  imported. "Which rows reverted" is derivable (an `IMPORTED` row whose lead is now trashed).
- **`non_reverted_rows` only covers leads already deleted before undo.** A lead edited or converted
  after import is still deleted by undo — "remove exactly the batch's leads" was read as the
  stronger guarantee. If the product wants undo to *skip* leads a rep has since touched, that rule
  goes in `ImportUndoService` and extends `non_reverted_rows`.
- **Column mapping is by normalised-header synonym** (name/email/phone/whatsapp/notes/display_name).
  A header it does not recognise is left unmapped for the rep to set. The mapped target set is the
  writable lead fields only.

## Contract note

`LeadImportPreview` is a new schema (upload response); `LeadImport` (the batch-state DTO) was already
declared. Both are in the regenerated `contracts/`. The frontend types come from `api-types.ts` —
derive Zod/response types from there, do not hand-write the wire shape.
