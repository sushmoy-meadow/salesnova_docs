# TASK-DESIGN-002 — open points

All three acceptance criteria are tested. Two of them are enforced by `tsc` rather than by Vitest —
`ContractCoverage`, `SixStateCoverage` and `StaticSurfaceCoverage` in
`salesnova_frontend/src/components/design-system/contracts.ts` resolve to the offending component's
name instead of `true` when a contract is missing, so the assignments in `contracts.test.ts` stop
compiling. All three were watched failing. `npm run check` is the gate; a Vitest-only run is not.

What follows is what this task could not close.

## 1. "Primary exactly one per screen" and "danger always confirmed" have no mechanism

SN-DS-032 constrains how many of a variant may appear on one screen, and requires a confirmation step
before any destructive action. Neither is expressible in a prop type — nothing in a component's own
props can count its siblings or know whether a dialog preceded the click. The variants are published
as data (`SINGLETON_VARIANTS` in `src/lib/design-system/button.ts`) so the rule has something to
reference, but nothing enforces it today.

**What would close it:** `TASK-DESIGN-016` (tokens-only lint) is the natural home for the count rule —
one JSX-scope check per route file. The confirmation half is harder and probably belongs in review,
or in a `Button` implementation that refuses to render `variant="danger"` without an `onConfirm`.
Note this is a second job for `TASK-DESIGN-016` beyond the arbitrary-value rule already recorded
against it in `TASK-DESIGN-001-open-points.md`.

## 2. The SN-DS-040 six-state data surface is deliberately not published here

An earlier draft of this task gave `Table` and `Grid` a shared `DataSurfaceProps` base carrying
`empty` and `error` slots. It was wrong in three ways at once: one `empty` slot cannot distinguish
empty-first-run from empty-filtered, which is the distinction that makes the requirement worth
having; there was no permission-denied slot at all; and the control-level `loading` from SN-DS-031
was silently standing in for the data-level skeleton of SN-DS-042. Two requirements, one boolean,
inherited by five downstream tasks.

It was removed rather than half-fixed. `Table` and `Grid` now carry only what SN-DS-030 names for
them, plus `isStale`, `loadingRowCount` and per-column `width` so a skeleton can match the loaded
table and hit the zero-CLS requirement.

**What would close it:** `TASK-DESIGN-005`, which already owns "the mandatory six-state data-surface
pattern and shared cross-cutting state primitives". It should publish one surface type modelling all
six states explicitly, and `Table`/`Grid` should compose it. The `EmptyStateProps` and
`ErrorStateProps` contracts published here are the copy shapes it will need.

## 3. Skeleton dimensions sit outside the token layer, by necessity

`SkeletonProps` takes free-form `width` and `height`, and `TableColumn` takes a free-form `width`.
Everything else in the design system is confined to the spacing scale (ADR-0036), and these are the
deliberate exception: a placeholder's only job is to be the exact size of the content that replaces
it, and that size is the content's rather than the scale's. The alternative — callers wrapping every
skeleton in a sized div — puts the layout-shift-critical dimension outside the component, outside the
contract and outside anything a test can assert.

**What would close it:** nothing needs to. Recorded so the tokens-only lint rule does not later flag
these two props as a violation and get them removed.

## 4. Not verified against a real implementation

Nothing implements these contracts yet, so "the shape is right" rests on review rather than use. The
review did catch four real problems this way — form controls that `register()` could not be spread
onto, required function props that would have locked `EmptyState`, `ErrorState` and `Table` out of
Server Components, a `hasPrevious` the cursor API cannot answer, and a touch-target padding of 6px
that the spacing scale cannot express — but the first implementation task will find more.

**What would close it:** `TASK-DESIGN-003` and `TASK-DESIGN-004`. A contract change they force is
expected and cheap right now; it stops being cheap once the domain-component tasks start.
