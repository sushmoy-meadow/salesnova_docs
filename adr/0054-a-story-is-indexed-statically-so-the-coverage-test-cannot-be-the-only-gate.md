# 0054 — A story is indexed statically, so the coverage test cannot be the only gate

- **Status:** Accepted
- **Date:** 2026-08-10
- **Task:** TASK-DESIGN-017
- **Relates to:** `SN-DS-030` (the inventory), `SN-DS-031` (six states), `SN-DS-082` (documented in
  Storybook), ADR-0037 (the contract registry is a compile error), ADR-0039 (the platform is the
  headless primitive)

## Context

"A component that is not in Storybook does not exist" is a rule that decays the moment somebody adds
the forty-first component. The usual outcome is a Storybook that documents the first cohort
faithfully and then falls a year behind, which is worse than none: a feature team trusts it, builds
against a control that has since changed, and finds out at review.

So the deliverable is not forty stories. It is forty stories **and the thing that fails when the
forty-first is missing**.

## Decision

**The inventory is the source of truth and a test reads it.** `stories.test.ts` imports every
`*.stories.tsx` through `import.meta.glob` and compares what it finds against `COMPONENT_INVENTORY`
in both directions — a component with no story fails, and a story for something not in the inventory
fails too. Adding a component to the registry without documenting it breaks the suite.

**Usage and accessibility notes are typed fields that are also rendered.** They go through
`documented()` and land in two places: `parameters.salesnova`, where the test reads them back, and
the docs description, where `@storybook/addon-docs` and a preview-wide `autodocs` tag turn them into
a page. Typed-and-unread was the first cut of this and it was the wrong half — the fields passed the
test while rendering nowhere, which is a documentation task that documents nothing. A story that
renders the component and says nothing tells a feature team what it looks like and nothing about
when to reach for it, and the second half is the one they came for.

**The six states are one story per interactive component, built by a shared helper.** Hover,
focus-visible and active are conditions of the pointer and the keyboard with no prop behind them, so
they are forced by selector through the pseudo-state addon rather than described in a caption.
Rendering all six in one frame is the point: it is how a missing focus ring gets noticed, and the
focus ring is the state most often left out. The test asserts the story was built through the helper,
so the six cannot quietly become four.

**Non-interactive components are not padded out to six.** The inventory already records which
components a pointer can reach. A modal has no hover state; the buttons inside it do. The test fails
a `States` story on a component that cannot have one, in the same breath as it requires one on a
component that can.

**`storybook build` runs in `check`.** This is the load-bearing decision, and it was learned the
hard way. Storybook's CSF indexer **statically parses** the default export: `const meta =
documented({…}); export default meta` type-checked, passed eslint, passed `next build`, and passed
the coverage test — which evaluates the module at runtime — while indexing **zero** of the forty
stories. Every gate was green against a Storybook that contained nothing. Each meta is now
`const meta = { ...documented({…}) }`, an object literal the indexer can read, and the build runs on
every check so the next static-analysis failure is caught by the thing that does static analysis.

**The sidebar title is a literal in each story, and a test holds it to the inventory.** The same
lesson, found a second time: a title computed inside `documented()` is behind the spread, so the
indexer never sees it and every component filed itself under a path-derived group instead. A
function cannot name a story. So the forty titles are typed out, and because forty hand-typed
strings are forty chances to disagree with the registry, the coverage test compares each one against
the group the inventory records. Static where the tool reads, checked where a test can.

## Consequences

- `npm run check` gained a Storybook production build. It is the only gate that can prove the
  stories exist, because it is the only one that reads them the way Storybook does.
- The spread in every story meta looks like noise and is not. A future tidy that collapses
  `{ ...documented({…}) }` back to `documented({…})` will pass every other gate and empty the
  Storybook.
- Story files default-export their meta, against this repo's no-default-export rule. CSF has no
  named-export form; the rule's purpose — that an export is greppable by name — is served here by
  the file name and the indexer instead.
- Anything a story meta needs the sidebar or the indexer to know has to be written literally in the
  file. Twice now a helper has computed something correct that reached nothing, and both times every
  other gate stayed green. Treat "the helper returns it" as unproven until the build shows it.
- Five devDependencies and a set of transitive advisories came with Storybook. All are dev-only
  build-time parsers and none is reachable from anything the product ships.
- The usage and accessibility prose is now a claim the repo makes about its own components. It is
  written from the implementations, but nothing mechanically holds it to them — a component that
  loses its focus trap will keep a story saying it has one.

## Alternatives

- **A coverage test alone.** This is what was built first, and it certified an empty Storybook.
  Runtime evaluation and static indexing are different readings of the same file, and only one of
  them is how the tool loads it.
- **MDX docs pages per component.** More expressive, and a second artefact to keep in step with the
  props. Typed fields on the meta are less to write and can be read back by a test.
- **A separate `stories/` tree.** Rejected for the same reason the tests are colocated: a component
  and its documentation in different directories drift, and the drift is invisible until somebody
  opens the story.
