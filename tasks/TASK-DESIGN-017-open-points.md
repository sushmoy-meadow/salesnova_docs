# TASK-DESIGN-017 — open points

Both acceptance criteria are tested and green. What follows is what the tests in this repo cannot
reach, and what would close each one.

## 1. Nobody has looked at the Storybook in a browser

`npm run check` proves the forty stories index, build and carry their prose. It does not prove the
pages *render* — a component that throws on mount produces a broken story inside a successful build.

**Closes it:** a Storybook test-runner or Playwright pass that visits every entry in `index.json`
and fails on a console error or an empty root. Worth a follow-up ticket; it is a test-infrastructure
job rather than a documentation one.

## 2. The six states are forced by selector, and nothing asserts the selector matched

`sixStates()` hands the pseudo-state addon `#state-hover`, `#state-focus-visible` and
`#state-active`. The test asserts the story was built through the helper — not that the addon
actually applied the styles. A component whose hover style lives on a child of the element carrying
the id would render six identical frames and pass.

**Closes it:** the same visual pass as point 1, with a screenshot diff across the six frames, or an
image snapshot per interactive component.

## 3. The prose is a claim nothing holds to the implementation

Every accessibility note was written by reading the component, and six were corrected during this
task after asserting behaviour that did not exist (an `inert` background, an `aria-current`, a live
region, an announced end-of-list, a hidden decorative rule, the wrong element called decorative).
That correction was a human read, not a test. A component that loses its focus trap keeps a story
saying it has one.

**Closes it:** `@storybook/addon-a11y` plus an axe run in CI would mechanically check a subset —
roles, names, contrast. The half that says *what the caller still owes* stays a prose claim.

## 4. The props tables are docgen output, and their coverage is not asserted

`Table` and `Grid` are generic components. They now declare `component:` like the other thirty-eight,
but react-docgen's handling of a generic prop type is not something this repo tests, so those two
may show a thinner props table than the rest.

**Closes it:** an assertion over the built `index.json` or the docgen output that every documented
component yields a non-empty `argTypes`. Deferred because it tests Storybook's docgen more than it
tests this design system.

## 5. Dependency advisories, none of them introduced here

Recorded because the install is part of this diff and the numbers will be read as its doing.

- **Production surface: 1 high, pre-existing.** `nanoid@3.3.16` (`GHSA-2v37-7h3g-55p8`), reached
  through `next` → `postcss`. It was at this exact version before this task and is fixable
  non-breaking. **It deserves its own ticket** — bumping a production transitive dependency inside a
  documentation task is the wrong place for it.
- **Dev-only: 4 high, no fix available.** `image-size` (two advisories), `vite-plugin-storybook-nextjs`
  and `@storybook/nextjs-vite`, all `fixAvailable: false`. They are build-time image and manifest
  parsers, run against files in this repo, and are not reachable from anything the product ships.
  `js-yaml@4.3.0` was already present at this version before Storybook.

**Closes it:** the nanoid ticket, and a recheck of the Storybook chain when upstream publishes fixes.
