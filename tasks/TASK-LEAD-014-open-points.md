# TASK-LEAD-014 — open points

Slice: bulk operations engine and bulk action UI. **Status: `done`** — both halves built, both gates
green, demo exercised against live servers and verified in the database. The demo is recorded in
`TASK-LEAD-014-demo.md`. This file now holds only what was deliberately left out of scope.

## What shipped

- Backend (`salesnova_backend/`): `BulkSelectionResolver`, `BulkEligibility`, `BulkOperationService`,
  `BulkDeleteService`, `BulkActionAuthorizer`; the four bulk controllers wired off their 501 stubs;
  `BulkOperationEngineTest` and `BulkDeleteGuardTest`.
- Frontend (`salesnova_frontend/`): the `bulk-operations` seam, server actions in
  `app/(app)/leads/grid/bulk-actions.ts`, row selection + `BulkActionPanel` (preview → execute →
  per-record outcome), with tests.
- The bulk `delete` path is demonstrated end-to-end. The `assign` path's seam, server actions and
  tests exist but its UI is deferred (see below).

## Deferred within this slice (not this slice's to close)

- **Assign has no UI yet.** `previewBulkAssign` / `executeBulkAssign`, their server actions and unit
  tests are built and green, but no bulk-assign control is wired into the grid: the member picker it
  needs has no source, because the organisation's members are not published to the client yet. When
  that lands, the bulk bar gains an "Assign to…" action over the existing seam.
- **Four bulk actions remain 501:** `add-to-group`, `remove-from-group`, `set-field`,
  `enroll-sequence`, `export`. Their target domains (groups, custom-field bulk-set, sequences, export)
  are not all built; wiring them is each its own task. `BulkOperationService::requireSupported` is the
  single place that gates this, and `MISSING_CAPABILITY` is reserved for when they arrive.
- **Execution is inline, not queued.** The contract documents 202 "accepted for processing"; the
  services run synchronously and return a `COMPLETED` operation under that 202. Correct for the sizes a
  browser selects; a genuinely async job runner (progress, `operation_id` polling) is a later task.
  Kept the 202 so the published contract does not churn when that lands.
- **`leads.bulk_operations` capability is unused.** The authorizer gates on the per-action capability
  (`leads.assign` / `leads.delete`). If the product wants a blanket "may use bulk UI at all" gate,
  `BulkActionAuthorizer` is the one place to add it.
- **The >50 guard matches the eligible count, not the raw selection size.** The number a rep types is
  the number that will actually be deleted (after skips), which is what the preview shows as
  `eligible_count`. If the product wants the confirmation to echo the total selected instead, it is a
  one-line change in `BulkDeleteService::guardConfirmation`.
