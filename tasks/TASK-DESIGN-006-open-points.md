# TASK-DESIGN-006 — open points

Data components: Table, Grid, List, ListItem, Pagination, CursorPagination, FilterBar, SearchInput,
SavedViewPicker, plus the two placeholders they share their frame with. All three acceptance
criteria have tests behind them. What follows is what those tests cannot reach, and the decisions
taken without asking.

## Not testable in this repo

### Zero CLS is asserted structurally, never measured

**This is the criterion's real gap and it is worth being plain about it.** The requirement names a
number — zero cumulative layout shift on the leads list and lead detail — and jsdom has no layout
engine, so nothing here produces a number at all. What is tested instead is the cause: the
placeholder and the loaded table are the same component given the same columns, and
`data-skeleton-parity.test.tsx` compares whole rendered structures — the `<colgroup>` widths, every
header cell's classes, the body row classes, and the tag and class of every cell in the first row —
between `TableSkeleton` and each of `Table` and `Grid`, and between `ListSkeleton` and `List`.

A structural match is strong evidence and not the measurement. A shift can still arrive from outside
the frame: an ancestor that sizes itself to its content, a font swap, an image above the table, a
sticky header whose offset the rows do not account for.

**Closes with:** a Playwright pass on `/leads` with a `PerformanceObserver` on `layout-shift`,
asserting a score of 0 across the transition from placeholder to rows, and the same on the lead
detail route. Both routes are unbuilt, so this cannot be written yet.

### The responsive column hiding is a class name, not a rendered breakpoint

`hideBelow` resolves to `max-sm:hidden` / `max-md:hidden` / `max-lg:hidden`, and the compiled
stylesheet was checked to contain all three. Whether a table with two columns hidden at 375px is
still readable, and whether the hidden columns leave the remaining widths summing to 100%, is a
question about a viewport.

**Closes with:** the same Playwright pass, at three widths.

### The sticky header is asserted by its classes

`sticky top-0 z-10 bg-surface-raised` is on the `<thead>` when asked for, and the background is
tested because without it the rows are read through the header as they scroll under it. Nothing here
confirms the header actually sticks — that depends on the scroll container the screen puts around
the table, which does not exist yet — or that it does not cover the first row.

**Closes with:** a Playwright scroll test once a list screen exists.

### Nothing here renders enough rows to know whether it needs virtualising

The table renders every row it is handed. At the page sizes the list URL state allows — up to 200 —
that is the right trade: virtualisation costs the browser's own find-in-page, the scrollbar's
meaning, and printing. At a few thousand it would not be.

**Closes with:** a decision once a screen asks for a page size above 200, which today nothing does.
Not a defect; recorded so the absence is deliberate rather than forgotten.

## Decided without asking

### `LoadingState` gained a `skeleton`

The six-state surface previously rendered a stack of grey bars for every loading state. A stack of
bars is a different shape to the table that lands on top of it, so the generic loading state
*guaranteed* the layout shift the skeleton requirement forbids. `LoadingState` now takes an optional
`skeleton` and renders it in place of the bars; a surface whose content has no shape worth mirroring
still gets the bars. This is an addition to the layer built in TASK-DESIGN-005, made here because
this is the first task with a shape to hand it. Recorded as ADR-0041.

### The row height is fixed and cells truncate

`h-48`, not `min-h-48`, and `truncate` rather than wrapping. A cell that grows to fit is a row whose
height depends on what arrived, which no placeholder can be the height of in advance. The cost is
that a long lead name is cut off rather than wrapped; the alternative is a list that moves under the
thumb as it loads.

### Sorting has three states and the table sorts nothing

Ascending, descending, and off. Two states leave no way back to the order the server sent, so a
column sorted by a mis-click stays sorted. The rows are never reordered by the table: they arrive
ordered and the sort is handed back through `onSortChange` for the URL to carry, because a table
that sorted the page it holds would disagree with page two.

### Additive sorting is shift-click, and it is not discoverable on touch

The contract takes an ordered array of sort keys, so more than one is expected. Shift or meta held
during the press adds a key; a plain press replaces. There is no touch equivalent — a phone has no
modifier — so on a phone the sort is single-column. That is the honest state of it rather than a
gesture invented here.

**Closes with:** a column menu, if a screen turns out to need multi-sort on a phone.

### There is no select-all checkbox

`onSelectionChange` reports one row at a time, which is what makes ticking a box re-render that row
rather than the page. A header select-all would have to call it once per row, which is the same
render storm through a different door. A screen wanting select-all owns the loop and the count.

### `SearchInput` is a form

The contract has an `onSubmit` and no `onKeyDown`, and `Input` publishes no key handler either. A
`<form role="search">` with a screen-reader-only submit button is what makes Enter mean submit
without adding a key handler to a control that does not want one, and it gives the search a real
submit affordance for anyone not using a keyboard.

### The date-range filter's two inputs are uncontrolled between renders

A controlled `input[type=date]` fed a half-typed value on every keystroke fights the segments the
browser is filling in. Each end is uncontrolled and remounted by `key` when the value arrives from
elsewhere, so a filter restored from the URL still displays.

### The grid's cell inputs are keyed by the last committed value

A rollback from a rejected optimistic write puts the old text back rather than leaving the rejected
edit sitting in the cell looking saved. This depends on the caller passing rows from the query cache
that `useOptimisticMutation` rolls back — which is the wiring the contract already describes, and
which nothing in this task can exercise because there is no endpoint behind it yet.

**Closes with:** the first screen that mounts a `Grid` against a real mutation.

### `InputProps` gained `onKeyDown`

The search box was first built as its own `<form role="search">`, because that is what makes Enter
mean submit without a key handler. That was wrong at the altitude: a control carrying its own form
cannot be dropped inside a screen's form, and two of them on a page are two search landmarks with
the same name. `InputProps` now publishes `onKeyDown` — Enter in a search box and Escape out of an
edit are keys a text field gives meaning to itself, and a wrapper cannot see them before the browser
acts. This is an addition to the D-02 contracts from TASK-DESIGN-002, the second after `Describable`.

### `ClearButton` takes its positioning from the caller

It was written absolute, because in a date picker it overlays the control it empties. Handed to
`Input`'s `suffix` slot — which is itself absolutely positioned — that put two nested absolute boxes
in the layout and the glyph somewhere neither of them meant. The position is now a parameter with
the old value as its default, so the two pickers are untouched and the search box passes nothing.

### The page-size ladder moved to one file

`Pagination` offered 25/50/100/200 and `useListUrlState` capped at 200; they agreed by coincidence,
and a size added to the picker but not the cap would have been clamped back in a way that reads as
the choice not sticking. Both now read `src/lib/design-system/page-size.ts`.

### `Pagination` has no live region

It had `aria-live="polite"` on the page counter. A list screen renders pagination above the rows and
below them, so that is the same page announced twice on every change. Saying the result count once
is the screen's job. The two `<nav>` landmarks still share the name "Pagination", which the contract
gives no prop to fix.

**Closes with:** a `label` prop on `PaginationProps`, if a screen renders two.

### The table's row is memoised, and that depends on the caller

`onSelectionChange` reports one row so that ticking a box re-renders that row rather than the page.
That was only true of the callback's shape, not of the render: the whole `rows.map` re-ran on every
new `selectedKeys` Set, including every column's `render`. The row is now a memoised component. It
holds only while the caller's `columns` array keeps its identity — an array built inline in a
screen's body defeats it, and nothing here can detect that.

**Closes with:** a lint rule, or a screen-level review habit, once there are screens.

### `loadingRowCount` on `TableProps` and `GridProps` is now dead

The contract declares it, and the comment beside it says the table draws its own placeholders. It
does not: the placeholder is `TableSkeleton`, which the screen renders through the six-state surface
and gives its own `rowCount`. The contract prop was left alone rather than edited, because it is
published from TASK-DESIGN-002 and nothing reads it either way.

**Closes with:** deleting it from the two contracts, if nothing has claimed it by the time the leads
list ships.

### There is still no sort serializer

`nextSort` hands back `SortState[]`; `useListUrlState` stores `sort` as a single string. Nothing
converts between them, so the first screen to wire a sortable table will invent a format and the
second will invent a different one. `parseSort` / `formatSort` belong beside `nextSort`. They are not
written here because no acceptance criterion reaches them and untested code is worse than absent
code.

**Closes with:** the first screen that puts a sort in the URL.

### Reuse deliberately left alone

`Grid` imports `InlineMutationError` from `src/components/feedback/` — the only import in the design
system that reaches into another concern. Rendering its own error line instead would be a second
implementation of a component whose whole point is one consistent inline failure, so the import
stays. `DegradedNotice` was again not inlined into `DataSurface`: it is a one-caller wrapper over
`Banner`, but a test imports and renders it directly as one of the six states reachable standalone.

### The debounce test runs on real timers

`vi.useFakeTimers()` plus `userEvent` hung the suite: React's scheduler does not run on the clock
vitest winds forward. The test types, asserts nothing has been reported, then waits out a one-second
debounce for real. It costs a second of suite time and it tests the thing.
