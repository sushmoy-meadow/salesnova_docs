# TASK-LEAD-016 — open points

Slice: lead **export engine and export request UI** (fullstack, size M). **Status: `done`** — the
demo (`TASK-LEAD-016-demo.md`) ran end to end against both live servers and every acceptance
criterion has a test. The items below are deliberately-deferred scope, each with what would close it.

## Acceptance criteria — all covered

- **AC 1 (demo):** a user requests an export from the UI and downloads the file, scoping visibly
  applied. Covered by the live demo and by `LeadExportEngineTest` *"exports only the leads the
  requester may see and serves them from the signed link"* (asserts the CSV contains `Rep Lead` and
  not `Owner Lead`).
- **AC 2:** exactly one audit entry per export recording requester, filter and row count. Covered by
  *"writes exactly one audit entry recording requester, filter and row count"* and re-verified live.
- **AC 3:** the download link expires and fails after 24 hours. Covered by *"refuses the signed link
  once the 24-hour window has passed"* (`travel(25)->hours()` → 403).

## Deferred scope

1. **XLSX export.** `format: xlsx` is accepted by the request but returns **501 Not Implemented**
   (`ExportRequestService::produce`, test *"does not yet support the xlsx format"*). Only CSV is
   produced today. Wiring XLSX needs a spreadsheet writer (e.g. a streamed `openspout`/`phpspreadsheet`
   path) and a column-format decision; the seam and the `format` field already carry it, so it is an
   additive service branch, not a contract change.

2. **Plan-tiered row limits.** The export is bounded by a flat `config('leads.exports.max_rows',
   50000)` cap (`LEADS_EXPORT_MAX_ROWS`), refused with 422 over the cap (test *"refuses an export
   larger than the row cap"*). The real per-plan limit was not wired because
   `FailClosedPlanLimitResolver::withinLimit()` always returns false — using it would refuse every
   export. When real plan tiers land, the cap should come from the plan resolver, not a flat config
   value.

3. **Export from a grid-filter selection.** The UI exports the whole visible set
   (`{mode: "FILTER", filter: {operator: "AND", conditions: []}}`, "All leads you can access"). The
   engine already accepts any `BulkSelection` — `{mode: "IDS", ids}` or a populated filter — and
   scopes it through `BulkSelectionResolver`, so wiring the leads grid's active filter / row
   selection into the export page is a frontend-only follow-on (pass `selection` and `filterSummary`
   into `<ExportRequest>`, which already take them as props).

4. **Inline production under 202, no queue.** `ExportRequestService::produce` builds the CSV
   synchronously and returns a `READY` job in the 202 — the same pattern the import and bulk slices
   took. A genuine async runner (a queued job, `PENDING → PROCESSING → READY`, progress polling) is a
   later task; the status enum already carries those states and the 202 is kept so the contract does
   not churn when it lands. Acceptable for the `max_rows` cap (≈a few MB); see ISS-037 for the
   in-memory-buffer note.

## Decisions taken, and why

- **Signed public download, no auth header.** The download is a `temporarySignedRoute` on the public
  route group with the `signed` middleware, so the link works from a bare `<a href download>` with no
  bearer token. It has no tenant context, so the controller loads the job `withoutGlobalScopes` and
  the file is served by streaming the stored disk object. First use of signed routes in the codebase.
- **Row cap enforced at request time**, before the file is built — an over-cap export is refused 422,
  never half-produced.
- **Filter and row count live in the audit `after` payload.** `audit_log` has no metadata column, so
  `after = {filter, row_count, format}`; `before` is empty (an export creates, it does not mutate).
- **Preview throttle split from export throttle** (see demo record). Preview counting is a cheap read
  on `throttle:bulk-operations`; only the 1/hour `throttle:exports` guards the actual generation.

## Related issues

- **ISS-037** — the CSV is assembled into a bounded in-memory string and duplicates the import CSV
  idiom; both deferred.
- **ISS-038** — `APP_URL` without a port breaks signed download links under local `artisan serve`.
