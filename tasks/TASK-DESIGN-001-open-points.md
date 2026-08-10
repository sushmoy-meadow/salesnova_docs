# TASK-DESIGN-001 — open points

All three acceptance criteria are tested in `salesnova_frontend/src/app/globals.test.ts` (22 tests).
What follows is not untested criteria — it is what the task leaves genuinely open for someone else.

## 1. §3.3 names a disabled contrast floor, and §3.2 gives it no token

The contrast rules require disabled elements at 3:1, but the mandated token table has no
`--color-text-disabled` / `--color-surface-disabled`. Nothing in this task can assert the rule
because there is nothing to assert it against; today a disabled control has to reach for
`--color-text-tertiary` (4.5:1 against surface, so it passes by accident rather than by contract).

**What would close it:** either add the two tokens to §3.2 and a contrast assertion beside the
others, or record in §3.3 that disabled state reuses `--color-text-tertiary` and delete the separate
floor. This is a spec decision, not an implementation one — `TASK-DESIGN-002` is the first task that
has to render a disabled state and will be forced to answer it.

## 2. Arbitrary values still bypass the token layer

Clearing the Tailwind namespaces (ADR-0036) means `text-sm`, `p-6`, `font-bold`, `rounded-xl` and
every palette colour now generate no CSS at all, and `globals.test.ts` fails the build on any of
them. Bracketed arbitrary values are the remaining hole: `p-[7px]` and `grid-cols-[1.1fr_0.9fr]`
compile and render regardless of the theme. The test blocks the bracket form for the colour, spacing
and radius utilities by name, but not for every utility that accepts one — `src/app/page.tsx:25`
carries a `grid-cols-[1.1fr_0.9fr]` layout ratio, which is deliberate and has no token to replace it.

**What would close it:** `TASK-DESIGN-016`'s lint rule, which owns arbitrary-value enforcement. Its
surface is much smaller than it was written to be — see ADR-0036's consequences.

## 3. The hex values are provisional by design (OD-2)

The task says so explicitly, and the two-layer structure is what makes it cheap: every semantic name
resolves through a `--sn-*` primitive, and `grep -rn -- "--sn-" src` returns nothing outside
`globals.css`. A green/amber direction change edits one `:root` block. Not a gap — recorded so the
next reader does not mistake the current palette for a settled one.

Note the same block is where §3.5's V1.5 dark theme goes: a `:root[data-theme="dark"]` redefining
the primitives, with no `@theme` mapping and no component touched.
