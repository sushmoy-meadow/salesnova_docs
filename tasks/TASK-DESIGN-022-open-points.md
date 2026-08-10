# TASK-DESIGN-022 — open points

Two of the three acceptance criteria are half-closed. The half that could be tested here is
tested; the other half needs a thing that does not exist in this repo yet, and is recorded rather
than rounded up.

## 1. "documented in Storybook with theme-aware (light/dark) rendering"

**Storybook is not installed.** TASK-DESIGN-017 owns standing it up, and adding it here would make
this task the one that chose the harness for every component in the library.

Tested instead: theme-awareness at its source. `charts.test.tsx` scans every chart source and fails
on a hex, an `rgb(` or an `hsl(` — a chart that states no colour of its own follows whatever the
theme resolves `--color-chart-*` to. `globals.test.ts` proves the four tokens resolve through one
indirection, so a dark block redefines values and no chart changes.

**What would close it:** a `*.stories.tsx` per chart once Storybook lands, rendered under both
themes with the a11y addon.

## 2. "at least one consumer domain (ANL) integrates the chart components"

**There is no ANL route.** The app has `/`, `/signup` and `/invite/[token]`. The ANL overview
dashboard is a later gate, and inventing a route to satisfy the criterion would leave a screen
nobody specified.

Tested instead: the negative half, which is the part that actually protects the consumer domains —
no charting dependency was added. The charts are SVG the components draw themselves; `package.json`
gained nothing. A domain that reaches for its own chart library later is visible as a diff to
`package.json`, not as a silent import.

**What would close it:** the ANL overview task rendering `BarChart`/`LineChart`/`FunnelChart` from
`@/components/design-system`, with a screen test asserting the sr-only table carries the same
numbers as the API returned.

## Not an open point

The palette is measured rather than asserted: `globals.test.ts` simulates a protanope and a
deuteranope with Viénot's single-matrix model in linear light and fails if any pair of series falls
below 1.3 separation, or if any series falls below 3:1 against either surface. Four colours is what
that measurement allows; it is not a taste decision, and a fifth would have to clear the same bar.
