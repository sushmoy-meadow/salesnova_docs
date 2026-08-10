# ADR-0037 — The contract registry is a compile error, and the pointer states are not props

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-DS-030` names 36 Foundations, Layout and Data components. `SN-DS-031` says every interactive one
ships six states — default, hover, focus-visible, active, disabled, loading — and that
`focus-visible` is not optional. `TASK-DESIGN-002` publishes the prop-API contract for all 36 so that
five implementation tasks and four domain-component tasks build against a stable shape in parallel.

Two things about that are awkward.

The first is that a published contract is only worth what enforces it. 193 tasks sit downstream of
the design system, and a component whose contract quietly went missing would not be noticed until
somebody tried to implement it. Types vanish at runtime, so a test cannot iterate the contracts and
check them.

The second is that four of the six states are not props and cannot be. `hover`, `focus-visible` and
`active` are conditions of the pointer and the keyboard; `disabled` and `loading` are the only two a
caller sets. A contract that took `hovered` as a prop would be one every implementation had to lie
about. But a contract that simply omitted four of six would leave each of five teams to decide
independently what happens when a control is hovered *and* focused *and* mid-request.

## Decision

**The registry is a type, and a gap in it fails `tsc`.**

`COMPONENT_INVENTORY` is a runtime manifest of the 36 names, their group, and whether each renders a
control. `ComponentContracts` maps every name to its props type. Three conditional aliases compare
the two and resolve to `true` when they agree and to *the offending component's name* when they do
not — so `const ok: ContractCoverage = true` stops compiling with `Type 'true' is not assignable to
type '"Chip"'`. The three gates are: every component has a contract, every interactive contract
carries `disabled` and `loading`, and no static surface claims either.

`npm run check` runs `tsc --noEmit` over the test tree, so this is enforced on every run. It is not a
lint rule anyone can turn off and not a review anyone can skim.

**The four pointer states are published as a precedence function, not as props.**

`resolveInteractiveState` takes the signals and returns the one winning state:

```
loading > disabled > active > focus-visible > hover > default
```

`loading` beats `disabled` because a control mid-submit is nearly always both, and greying it out
without the spinner says broken rather than busy. `focus-visible` beats `hover` because keyboard
focus is how the grid gets worked and a stray pointer must never hide it. Implementations expose the
result as `data-state`, which also makes all six assertable in a test without simulating a pointer.

**Interactive means "renders a focusable control".** An overlay is a surface: a modal has no hover
state, the buttons inside it do. Tabs and Accordion are interactive because their triggers are, and a
disabled container disables every item in it whatever the item says.

## Consequences

- An unpublished component is a compile error naming itself. The cost is roughly twenty lines of
  conditional and mapped types, measured at +1,051 types and +1,189 instantiations across the tree,
  with `tsc` check time inside run-to-run noise.
- The contracts are deliberately written so the common surfaces stay server-renderable. `EmptyState`
  and `ErrorState` take a `SurfaceAction` that is a link *or* a callback, and `TableColumn` takes a
  `field` name as well as a `render` function, because a required function prop cannot cross the
  server boundary and would have pushed `"use client"` to the top of every list screen. `ErrorState`
  makes its retry optional: a revoked invitation has nothing to try again, and offering the button
  anyway teaches the user to distrust it.
- Form controls take `onBlur` and `ref` so `register()` can be spread straight onto them. Without
  those two, every field would have to go through `Controller`, which re-renders on each keystroke
  where the uncontrolled path re-renders nothing.
- Cursor pagination is forward-only — `hasMore` and `onLoadMore`. The API returns an opaque
  `next_cursor` and nothing to go back with, so a `hasPrevious` prop would have been a dead button.
- The six-state *data surface* of `SN-DS-040` is deliberately **not** published here. An earlier
  draft had a `DataSurfaceProps` base carrying `empty` and `error`, which collapsed empty-first-run
  into empty-filtered, had no permission-denied, and let the control's `loading` stand in for the
  skeleton. Two different requirements through one boolean, inherited by five tasks. It belongs to
  `TASK-DESIGN-005`, whole.
- "Primary exactly one per screen" and "danger always confirmed" are published as data
  (`SINGLETON_VARIANTS`) rather than enforced. No prop type can count siblings.

## Alternatives

**A test that iterates the contracts.** Rejected: types do not exist at runtime. An earlier draft
parsed the TypeScript source with regexes and grew a fixed-point set of base-type names — about
fifty-five lines of machinery that re-proved what the compiler already knew, and that silently
truncated any declaration containing a nested object literal.

**A `state` prop taking all six.** Rejected: it contradicts `disabled` and `loading` as a second
source of truth, and no component can honestly accept `hover` from its caller.

**Leave the precedence to each component's CSS.** Rejected: pseudo-classes resolve by source order
per element and give no way to express how `[aria-disabled]` and `[data-loading]` interact without
every component re-deciding it. Five teams would have decided it five ways.

**Publish the contracts as a separate package or generated `.d.ts`.** Rejected for V1: one
application consumes them, and a build step between writing a contract and using it buys nothing
until a second consumer exists.
