# 0042 — A chart is SVG we draw, and a table nobody can skip

- **Status:** Accepted
- **Date:** 2026-08-10
- **Task:** TASK-DESIGN-022
- **Relates to:** `SN-DS-030` (shared dataviz set), `SN-DS-040` (six states), the accessibility bar
  the rest of the component library is held to

## Context

Six domains — ANL, RULE, SEQ, TEAM, CAMP and the WhatsApp dashboards — are specified against a
shared chart set. The default move is to reach for a charting library, and the acceptance criteria
push the other way: *"without any domain-specific charting library."* That phrasing is usually read
as "pick one library for everybody", but the cost it is guarding against is not six libraries. It is
that a chart library owns its own DOM, so the accessible half — the numbers, in a form a screen
reader and a printout can carry — becomes something you bolt onto a canvas it drew, if you can
reach it at all.

The charts these dashboards need are a bar chart, a line chart, a funnel and a two-period
comparison. None of them pans, zooms, brushes, or has a tooltip that follows a cursor. What they
need is a shape, an axis and the numbers.

## Decision

**Every chart is SVG this repo draws, inside one frame, and the frame always renders the table.**

- `ChartFrame` owns the `<figure>`, its accessible name, the legend and an `sr-only` `<table>` of
  the same values. The drawing is `aria-hidden`. A reader who cannot see the picture gets the data,
  not a caption apologising for it — and the same table is what makes a chart work in a printout,
  in a text browser and in an email digest.
- No `"use client"` anywhere in the set. Nothing here is operated, so a dashboard of six charts
  that hydrated would be paying for interaction none of them has.
- The geometry lives in `src/lib/design-system/chart-scale.ts` as pure functions — the axis
  ceiling, the bands, the path, the drop-off — so it is checked against arithmetic rather than
  against a rendered picture.
- No dependency was added. The whole set is a few hundred lines, and the alternative is a library
  whose upgrade path we would own for six domains.

**The palette is four colours, and four is measured rather than chosen.** Okabe-Ito hues, re-lit for
a light surface so each series clears 3:1 against it — a bar is a graphical object, so
WCAG 1.4.11 applies to it exactly as it does to a focus ring. Every pair is then simulated through
Viénot's single-matrix protanope and deuteranope models in linear light and has to stay apart. A
fifth colour drops the worst pair below where two series can be told apart at all. Each hue also
sits at its own lightness, because two colours of equal lightness in confusable hues are one colour
to eight percent of men.

**Colour is never the only channel.** Line series carry a dash pattern as well as a hue, which
survives greyscale, a projector and a printout. Where a chart says something directional — the
comparison chart — it says it in words: *"Up 50% on Last week."*

## Consequences

- `ChartSkeleton` draws the same 5:3 box the plot occupies, for the reason
  ADR-0041 gives about tables: the generic placeholder is a stack of text bars,
  and a plot landing on top of them moves every card below it down the page.
- A domain that needs a chart this set does not draw adds it here, to the shared set, where it
  inherits the frame and the table. That is the intended pressure.
- Five series is not available. `seriesIndex` wraps rather than rendering an invisible fifth line,
  and a chart of five categories was already past reading — the honest fix is a table, which the
  frame is rendering anyway.
- Interaction — a tooltip, a brush, a zoom — would be a new decision, not an extension of this one.
  The moment a chart needs a pointer, the argument for a library gets its strongest form back, and
  it should be made then rather than assumed now.
- The 3:1 floor and the pairwise separation are unit tests over `globals.css`, so a palette change
  that breaks either fails the suite rather than a design review.
