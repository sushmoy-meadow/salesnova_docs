# TASK-DESIGN-012 — open points

All three acceptance criteria have tests behind them in `src/app/motion.test.ts`. What follows is
where those tests stop, and what would close the gap.

## 1. "Disables motion instantly" is verified against the stylesheet, not against a reader

The reduced-motion criterion is asserted two ways: every shared transition utility carries a
`prefers-reduced-motion: reduce { transition: none }` block, and every `animate-*` class in the
source sits in the same string as `motion-reduce:animate-none`. Both are true of the CSS. Neither
runs a browser — jsdom does not evaluate media queries against real stylesheets, so nothing here
observes an element failing to travel.

**Closes when:** the Playwright suite exists (TASK-QA-*) and takes a run with
`reducedMotion: "reduce"`, asserting a hovered control's computed `transition-duration` is `0s`.

## 2. The guard only sees class names written as string literals under `src/`

`motion.test.ts` extracts string literals from every `.ts`/`.tsx` file and scans those. A class name
that arrives from a data file, from an API response, or from inside a dependency's own stylesheet is
invisible to it, as is motion declared in a `<style>` tag or an inline `style` attribute.

This is a deliberate trade — scanning whole files instead would flag the word "transition" in a
sentence, and a guard that cries wolf gets disabled rather than fixed. The narrower scan covers the
way the rule actually gets broken, which is somebody typing `transition` into a `className`.

**Closes when:** an eslint rule sits beside it, reading the JSX `className` attribute properly
rather than by regex. That is the earlier and better place for the source half of this guard; the
stylesheet half has to stay a test either way.

## 3. Two of the three speeds in the design system are unbuilt

Only `--motion-micro` (100ms) exists. A sheet arriving from an edge is specified at 200ms and a route
change at 250ms, and neither has a call site: `Overlay` mounts and unmounts with `if (!open) return
null`, so there is no enter state for a transition to run against, and there is no route transition
anywhere.

Declaring the tokens early was tried and rejected on evidence — Tailwind drops an unreferenced
`@theme` variable, so `--motion-surface` and `--motion-page` were absent from the compiled sheet
while still present in the source. The two numbers now live only in the spec and in ADR-0052; they
were deliberately kept out of a source comment, where nothing can check them.

**Closes when:** the first sheet or drawer needs to animate. The scan test will fail on
`duration-200`, which is what forces the rung to be added properly rather than inlined.

## 4. The 300ms ceiling is not applied to the two indeterminate loaders

`animate-spin` (1s) and `animate-pulse` (2s) run well past the ceiling. They are read as outside it:
the criterion governs transitions, and a spinner has no end state to be late for — a 300ms spinner
is a strobe. What binds them instead is the reduced-motion guard, which both carry and which the
test enforces.

If the ceiling is meant to cover looping indicators too, this is the decision to reverse, and the
one-line change is to add their durations to the ladder assertion.

**Closes when:** somebody with the design authority confirms the reading either way. Recorded here
rather than silently assumed.

## 5. Three test files now walk the whole source tree, and each has its own copy of the walk

`src/app/globals.test.ts`, `src/test/reflow.test.ts` and `src/app/motion.test.ts` each read every
file under `src/` with their own `readdirSync`. Vitest isolates module graphs per file, so they
cannot share a cached read, but they can share the helper — the duplication is the shape of the
walk, not the work it does (~10ms each, immaterial).

Two of the three also run under jsdom for no reason. `motion.test.ts` carries
`// @vitest-environment node` and went from 673ms to 344ms; the same one-line docblock is worth
adding to the other string-scanning tests, of which there are roughly twenty across the repo.

**Closes when:** somebody extracts a `src/test/sources.ts` helper and sweeps the docblock across the
scanners. Left out here because it edits two test files that have nothing to do with motion.

## 6. Ten copies of one primary button, and the design system already ships it

The nine call sites converted here — plus `src/components/invite/invite-dead-end.tsx` — hand-roll
`rounded-full bg-primary px-24 py-12 font-semibold text-on-primary` instead of using
`buttonClassName` from `src/components/design-system/button-classes.ts`, which already ends in
`transition-micro` and would have given each of them the focus ring, the disabled and loading
states, and the enlarged hit area they currently lack.

Swapping them is a visual and accessibility change, not a motion one, so it was left alone: hover
would move from `hover:bg-primary-hover` to `hover:brightness-95` and the heights would change. Note
that `src/app/signup/page.test.tsx` forbids `"use client"` anywhere under `src/components/signup/`,
so those three sites need `buttonClassName` on a plain element rather than the `Button` component.

**Closes when:** a task owns the signup and error surfaces. It is a genuine ten-fold duplication and
it is the durable fix for keeping their motion correct.
