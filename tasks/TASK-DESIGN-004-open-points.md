# TASK-DESIGN-004 — open points

Foundation display/action primitives: Button, IconButton, Chip, Badge, Avatar, Tooltip, Spinner,
Skeleton. All three acceptance criteria have tests behind them. What follows is what those tests
cannot reach, and the decisions taken without asking.

## Not testable in this repo

### The 44px hit area is asserted as a rule, not measured

`button-classes.test.ts` holds each size's class against `BUTTON_SIZE_PX` and
`touchTargetPaddingFor()`, so `h-32 + before:-inset-y-8` is checked to reach 48. jsdom has no
layout, so nothing here confirms the pseudo-element actually paints an interactive area of that
size, or that it is not clipped by an ancestor's `overflow: hidden`.

**Closes with:** a Playwright pass calling `elementFromPoint` at the four corners of the intended
44×44 box for one button and one icon button at each size, and a check that the `::before` is not
clipped inside a scroll container.

### Two small buttons 8px apart have overlapping hit areas

A consequence of growing the target past the painted box rather than with padding. `gap-8` between
two `sm` buttons is the minimum that keeps their targets disjoint — below that, the pseudo-elements
overlap and the top one wins. Nothing in this repo can detect the layout that does it.

**Closes with:** the same Playwright pass, over a real toolbar once one exists.

### Tooltip reachability is asserted structurally

WCAG 1.4.13 has three parts. Dismissible and Persistent are tested here: Escape closes a tooltip
opened by hover as well as by focus, and hover and focus are tracked as separate reasons so the mouse
leaving a keyboard-focused trigger does not close it. Hoverable is asserted only by its cause — the
8px standoff is padding inside the panel rather than a margin between the two, so no dead gap exists
for the pointer to cross. Whether the pointer can in fact travel from trigger to panel is a geometry
question jsdom cannot answer.

**Closes with:** a Playwright pass that moves the pointer from the trigger into the panel in steps
and asserts the tooltip is still open at the end.

### The palette contrast is computed; the rendered contrast is not

`globals.test.ts` now computes WCAG relative luminance over both tone tables, holding every one of
the seven tones at 4.5:1 for small text in both the subtle and the filled treatment, and rejecting
any alpha background outright. It cannot see a tone rendered over an unexpected parent, a tone
against a photo, or the composite of the switch knob against its track.

**Closes with:** an axe or Playwright contrast sweep over a page rendering all eight primitives.

## Decided without asking

### The touch target is a pseudo-element, not padding

`SN-DS-032` names both a 32/40/48 visual scale and a 44×44 floor, and says padding makes up the
difference. Padding cannot: on a filled button it grows the painted box, so a padded `sm` button is
a 44px button and the small size stops being small. Recorded as ADR-0040.

### Class names are never computed

The first version built `` `h-${BUTTON_SIZE_PX[size]}` ``, which is the DRY-looking version and
produces a button with no height — Tailwind reads source for whole class names and generates nothing
for that. Every unit test stayed green, because a test reads the string the function returned rather
than the stylesheet that was not written. The tables are now literal and the test holds them against
the scale; `generated-classes.test.ts` fails the suite on any recurrence. Recorded in ADR-0040.

### The tone wash was removed rather than re-tuned

`bg-<tone>/10` composites over whatever is behind the badge, so the text contrast depended on the
parent: accent cleared 4.5:1 on a white card and failed at 4.29:1 on the page background — the same
component compliant or not according to where it was put. The backgrounds are now opaque, which
makes the pair a fact the component can be held to. The floor across all seven tones is 5.22:1.
Nothing in the palette was changed.

### `Describable` was added to three contracts

`ButtonProps`, `IconButtonProps` and `ChipProps` accept `aria-describedby`. A description has to land
on the control itself — one carried by a wrapper describes the wrapper, and a screen reader on the
button hears nothing. This is an addition to the D-02 contracts from TASK-DESIGN-002, made here
because Tooltip is the first thing that needed it.

### `SINGLETON_VARIANTS` is still not enforced

"Exactly one primary button per screen" cannot be checked by a component; nothing in one can count
its siblings. It stays published as data in `src/lib/design-system/button.ts` for a lint rule that
does not exist yet. **This is a real gap, not a closed point** — nothing currently prevents a screen
shipping three primary buttons.

**Closes with:** an ESLint rule, or a review checklist item, consuming `SINGLETON_VARIANTS`.

### Avatar uses `<img>`, not `next/image`

Avatar URLs come from the API's storage host, which needs a `remotePatterns` entry this task cannot
invent. The `<img>` carries explicit `width`/`height` so it reserves its box before loading, plus
`loading="lazy"`, which matters at contact-list scale.

**Closes with:** the storage host being known, at which point this is a one-line swap.

### `ActionControl` decides where a surface can render

The `href` form is serialisable, so an empty or failed surface built from one is a Server Component.
The `onSelect` form is a closure crossing into a client boundary, so only a caller already inside one
can supply it. Nothing in the type system enforces the split; it is stated in a comment at
`ActionControl`. The four surfaces that use it have no non-test callers yet, so this is latent.

**Closes with:** a type-level split of `SurfaceAction`, if it ever bites.

## Reuse deliberately left for other tasks

The reuse pass found five screens hand-rolling a primary button or a link-styled-as-button that the
new `Button`/`ActionControl` now cover: `invite/invite-acceptance-form.tsx`,
`invite/invite-dead-end.tsx`, and all three of `signup/{identifier,profile,verification}-form.tsx`.
All five lose `aria-busy`, the loading spinner and the focus-visible ring by hand-rolling. They are
not converted here: they belong to the AUTH tasks that own those screens, and the signup files are
being written concurrently.

**Four of the five have since been converted** by the pending-state sweep, which needed the spinner
those screens were missing: `invite/invite-acceptance-form.tsx` and all three signup forms now use
`Button`/`SubmitButton` and get the focus ring and the 44px target with it. Only
`invite/invite-dead-end.tsx` is still hand-rolled — it is a navigation rather than a write, so the
sweep had no reason to reach it. See `open-pending-state-sweep.md`.
