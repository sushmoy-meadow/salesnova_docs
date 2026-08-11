# 0040 — The touch target is a pseudo-element, and a class name is never computed

- **Status:** Accepted
- **Date:** 2026-08-09
- **Task:** TASK-DESIGN-004
- **Relates to:** `SN-DS-032` (button variants, sizes and the 44×44 minimum), `SN-DS-031` (six states)

## Context

`SN-DS-032` says two things at once about a button:

> Sizes: `sm 32` · `md 40` · `lg 48`. **Minimum touch target 44×44 px** regardless of visual size —
> padding makes up the difference.

Taken literally, padding cannot do it. Padding on a filled button grows the painted box, so a small
button padded to 44px is a 44px button — and the size that was meant to be small is now the same
height as the large one. Two of the three sizes are below the floor, so this is not an edge case.

## Decision

**The hit area is a transparent inset pseudo-element, not padding.**

```
sm  h-32  before:-inset-y-8   →  32 + 16 = 48
md  h-40  before:-inset-y-4   →  40 +  8 = 48
lg  h-48  (nothing)           →  48
```

The visual box stays 32, 40 and 48. The `::before` extends the pointer target past it without
painting anything. An icon button is short across as well as down, so it insets on both axes.

The same technique was already used for checkbox and radio marks in TASK-DESIGN-003, for the same
reason: the mark is 24px and nobody wants a 48px checkbox.

Per-side padding comes from `touchTargetPaddingFor()` in `src/lib/design-system/button.ts`, which
rounds up to the spacing scale — a step off it generates no CSS at all.

**The second decision, which the first forced:** class names are never assembled from a value.

Writing `` `h-${BUTTON_SIZE_PX[size]}` `` looks like the DRY version and produces a button with no
height. Tailwind reads source files for whole class names; it never sees `h-32`, generates no rule,
and the component renders unstyled — with every unit test still green, because a test reads the
string the function returned rather than the stylesheet that was not written.

So the size tables are written out literally and `button-classes.test.ts` holds them against
`BUTTON_SIZE_PX` and `touchTargetPaddingFor()`. The numbers are still stated once. They are checked
against the table rather than substituted into it.

`generated-classes.test.ts` enforces this across the whole design system: a sizing or spacing
utility immediately followed by an interpolation fails the suite. The list is the utilities that
take a number from the scale, so `` `${id}-option-${index}` `` is still read as the element id it is.

## Consequences

- Two overlapping buttons 8px apart would have overlapping hit areas. This is the trade for keeping
  the visual scale, and the layout that puts them there is the thing to fix. `gap-8` between two
  small buttons is the minimum that keeps their targets disjoint.
- A whole class arriving through an interpolation (`${SIZE_CLASSES[size]}`) is fine and is how every
  table here is consumed. Only the prefix-then-hole shape is banned.
- `Describable` was added to `ButtonProps`, `IconButtonProps` and `ChipProps`. A tooltip's
  description has to land on the trigger itself — `aria-describedby` on a wrapper describes the
  wrapper, and a screen reader on the button hears nothing. `Tooltip` clones its child to attach it,
  which only works if the child forwards the attribute.
- `ActionControl` renders a `Link` for an `href` action and a `Button` for an `onSelect` one, sharing
  the appearance and nothing else. A link has to stay an anchor: it opens in a new tab, prefetches,
  and shows its destination in the status bar, none of which a button does.
