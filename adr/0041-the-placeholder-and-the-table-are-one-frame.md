# 0041 — The placeholder and the table are one frame

- **Status:** Accepted
- **Date:** 2026-08-09
- **Task:** TASK-DESIGN-006
- **Relates to:** `SN-DS-042` (skeletons match the final layout), `SN-DS-040` (six states)

## Context

`SN-DS-042` asks for **zero** cumulative layout shift on the leads list and lead detail, and calls
it a hard requirement rather than a target. Zero is not a number a review can eyeball, and it is not
a number a unit test in jsdom can measure — jsdom has no layout at all.

The usual way to build this is a skeleton component that *mirrors* the real one: a placeholder
table beside the table, written to look like it. That version is correct on the day it is written
and wrong on the first day somebody adds a column. Nothing fails when the two drift, because the
placeholder is only ever seen for a few hundred milliseconds and the shift it causes is exactly the
thing nobody notices while developing on a fast connection.

The generic alternative already in the repo — `LoadingState`, a stack of grey bars — is a different
shape to everything it stands in for, so it *guarantees* a shift rather than risking one.

## Decision

**There is one frame, and both the placeholder and the loaded table render through it.**

`TableFrame` owns the caption, the `<colgroup>` widths, the header row and the cell classes.
`Table`, `Grid` and `TableSkeleton` supply only a `<tbody>`. They are handed the same
`TableColumn[]` the screen already has, so the placeholder's column count, declared widths,
alignment, responsive hiding and row height are not *kept in step* with the table's — they are the
same values read once.

Two supporting decisions fall out of it:

- **The row height is fixed and the cells truncate.** `h-48`, not `min-h-48`. A cell that grows to
  fit its content makes the row's height a property of what arrived, and no placeholder can be that
  height in advance.
- **`LoadingState` takes a `skeleton`.** A surface whose content has a shape hands its own
  placeholder to the six-state switch; one whose content is a paragraph still gets the bars. Without
  this the loading state of every table in the product is the shift the requirement forbids.

`table-frame.tsx` carries no `"use client"`, so it inherits the layer of whoever imports it. The
placeholder is the first thing a list route paints and it renders on the server; the live table,
which needs handlers, does not.

## Consequences

The parity is a property of there being one implementation, so the test that guards it compares
whole rendered structures — column widths, header cells, row classes, the tag and class of every
cell in the first row — rather than counting columns. Adding a column to one side and not the other
is not possible; changing the frame in a way that only suits the loaded table fails the comparison.

What this does **not** buy is the number `SN-DS-042` actually names. A structural match is the cause
of zero CLS, not a measurement of it, and a real layout shift can still come from something outside
the frame — an ancestor that sizes itself to its content, a font swap, an image above the table.
That measurement needs a browser, and it is recorded as an open point against this task.

The cost is that a screen must tell the placeholder how many rows to draw and whether the table will
be selectable. Both are things the screen knows — the page size it asked for, and whether it passed
`onSelectionChange` — and a wrong answer to either is a visible shift, which is the honest failure
mode.
