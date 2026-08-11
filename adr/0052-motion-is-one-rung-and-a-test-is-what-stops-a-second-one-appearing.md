# 0052 — Motion is one rung, and a test is what stops a second one appearing

- **Status:** Accepted
- **Date:** 2026-08-10
- **Task:** TASK-DESIGN-012
- **Relates to:** `SN-DS-050` (duration ladder and ceiling), `SN-DS-051` (only communicative motion),
  `SN-DS-052` (reduced motion), ADR-0036 (the token layer deletes what it does not want),
  ADR-0040 (a class name is never computed)

## Context

The motion budget is small on purpose: this product is read on a mid-range Android held at arm's
length, and every frame spent moving something is a frame not spent scrolling a list. The design
system names three speeds, a ceiling and one easing, and forbids list entrances, parallax,
decorative loops and staggered reveals.

The way that gets broken is not a designer picking 400ms. It is `transition` — Tailwind's own
utility, one keystroke shorter than ours, carrying its own duration, its own easing and **no
reduced-motion guard at all**. Nine call sites had already reached for it, in pages written after the
design system existed, by people who had it available. A rule that lives in a document loses to a
class name that is shorter to type.

## Decision

**One duration token, one utility, and nothing declared ahead of its caller.** `--motion-micro` is
the only speed in the stylesheet. A sheet's 200ms and a route change's 250ms are recorded in prose
beside it and added the day a utility spends them — Tailwind drops an unreferenced `@theme`
variable from the build, so a token declared early would be a number that exists in the source file
and not in the browser. Discovering that is what settled it: the token layer cannot hold a promise
it has no consumer for.

**Motion is asked for by what it communicates, never by a duration.** There is exactly one purpose
in the set — hover, press and selection. A list entrance, a parallax and a staggered reveal have no
purpose to be filed under, so there is nothing to reach for. This is what turns the forbidden list
from a rule somebody has to remember at review into a thing that cannot be expressed.

**The utility names the properties the interaction states actually change, including the
awkward two.** A button hovers by dimming (`filter`) and disables by fading (`opacity`), so a
property list that stopped at colour would be a hover transition that does not cover the hover —
which is what shipped, unnoticed, until this task measured it. Tailwind's blanket `transition`
covers twenty-three properties; naming five means an incidental style change cannot ride along at
the motion budget's expense, and no element carries twenty transition entries that never fire.

**Deleting the values is the better guard, and it only reaches the easing.** `--ease-*` is cleared,
so Tailwind's four easings stop generating and `ease-standard` is the only one that exists — the
same mechanism the palette and the spacing scale already use. It does not extend to the rest:
`duration-200` and `delay-150` are bare-value utilities read from the class name rather than from a
namespace, and they generate whatever the theme says. That was measured, not assumed, and it is the
reason the test below is the primary guard rather than a backstop.

**The guard is a test, because a rule that cannot fail is a preference.** `src/app/motion.test.ts`
reads the stylesheet and scans the string literals of every source file, and fails on: a raw
`transition`, `duration-*`, `ease-*` or `delay-*` class anywhere; an `animate-*` without
`motion-reduce:animate-none` in the same string; a duration written as a literal instead of the
token; a second motion utility; any delay declaration; any keyframes of our own; a second
stylesheet.

**The ceiling lives in the test, not in the token layer.** 300ms is a rule *about* the durations
rather than one of them, and a `--motion-ceiling` nothing may consume would be furniture.

**The ceiling is a transition ceiling, and the two indeterminate loaders are not held to it.** A
spinner has no end state to be late for. What binds them is the reduced-motion guard, and both
carry it.

## Consequences

- Adding the sheet rung is a deliberate three-line change — token, utility with its own guard, test
  expectation — and reaching for `duration-200` instead fails the suite. That friction is the
  feature; it is the difference between a speed that was chosen and one that was typed.
- Every design-system button now actually animates its hover and its press. That is a visible
  change across the whole product, arriving from a task that intended only to write a number down
  once — the utility had been in place since the token foundation and had never covered them.
- The guard reads string literals under `src/`. A class name arriving from data, or motion shipped
  inside a dependency's own stylesheet, is invisible to it.
- The reduced-motion promise is asserted against the stylesheet rather than a rendered element.
  Nothing here runs a browser, so "the reader sees no travel" is verified as far as the CSS and no
  further.

## Alternatives

- **An eslint rule.** It would catch the raw classes at edit time, which is earlier and better. It
  cannot read `globals.css`, so the ceiling, the easing and the per-utility guard would need a
  second home, and the two would drift. Worth adding *beside* this test later, not instead of it.
- **Shipping all three rungs now.** Two utilities with no call site, no test exercising them, and a
  standing invitation to copy 200ms onto the first thing that moves without asking whether 200ms was
  right for it.
- **Reviewing for it.** This is what was already in place, and the nine call sites are what it
  produced.
