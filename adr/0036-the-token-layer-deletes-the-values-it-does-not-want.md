# ADR-0036 — The token layer deletes the values it does not want

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-DS-080` asks for the design system's scale configured as Tailwind theme values, and `SN-DS-081`
says components never contain raw values — "no hex, no arbitrary spacing, no magic numbers. Tokens
only. Enforced by lint." That last clause is the interesting one, because a lint rule is a promise
to catch a mistake after someone makes it, and there is a stronger option available here.

Tailwind 4 has no `tailwind.config.js`. Theme values are declared in CSS inside `@theme`, and each
namespace can be cleared with `--namespace-*: initial`. A cleared namespace does not warn — the
utility simply stops existing, and a class referencing it generates no CSS at all.

That turns a lint concern into a build property. `bg-emerald-300` is not a violation to be reported;
it is a class that does nothing, visible the first time anyone looks at the screen.

The scale itself also had a choice buried in it. The spec lists spacing as values — `0 · 4 · 8 · 12 ·
16 · 20 · 24 · 32 · 40 · 48 · 64` — not as indices, and Tailwind's default scale multiplies an index
by 4px, so `p-4` means 16px.

## Decision

**Every Tailwind namespace the design system replaces is cleared to `initial`, and the tokens are
declared over two layers.**

Cleared: `--color-*`, `--font-*`, `--text-*`, `--font-weight-*`, `--spacing-*`, `--spacing`,
`--radius-*`, `--shadow-*`. `transparent` and `currentColor` are re-added, being structural rather
than palette. What remains is the specification's own vocabulary and nothing else: no
`bg-emerald-300`, no `text-sm`, no `font-bold`, no `rounded-xl`, and — because the dynamic spacing
scale is off too — no `p-7`.

**Spacing is keyed by its pixel value**, so `p-16` is 16px and `gap-4` is 4px. This reads against
Tailwind habit, where `p-16` is 64px. It is chosen anyway because the spec writes the scale as
values, and a developer checking a step against the spec should not have to divide by four to know
whether they are on it.

**Semantic names resolve through primitives.** `--color-primary` points at `--sn-green-800`, which
holds the hex. Components only ever see the semantic name. This is what makes two later changes
cheap: the V1.5 dark theme of §3.5 is a second block redefining the primitives, and the still-open
green/amber direction (OD-2) is swappable by editing one `:root` block with no consumer touched.

Contrast is asserted, not asserted-to. `src/app/globals.test.ts` parses the stylesheet, resolves each
semantic name to its literal, and computes WCAG relative luminance: body text at 7:1 against every
surface it can sit on, UI labels and status colours at 4.5:1, focus ring and strong border at 3:1.

## Consequences

- A component reaching past the token layer produces an unstyled element, not a lint warning. The
  feedback is immediate and needs no tooling. `TASK-DESIGN-016` still has a job — arbitrary values
  like `p-[7px]` remain expressible and only a lint rule catches those — but its surface is much
  smaller than it was.
- The whole product moved from the scaffold's dark palette to light. §3.5 is explicit that
  light-first is correct for outdoor use, and the acceptance criterion forbade leaving raw hex
  behind, so the invite and signup screens were re-skinned as part of this rather than after it.
- The type scale tops out at 32px, so the marketing page's 60px hero is now 32px. That is the scale
  the spec defines; a marketing surface that wants more needs a token of its own and a reason.
- `--color-text-primary` yields the utility `text-text-primary`, which reads badly. The token names
  are normative in §3.2, so the stutter is inherited rather than chosen. Renaming the utility
  namespace without renaming the token is possible and was not worth the divergence.
- Anyone new to the repo will type `p-4` expecting 16px and get 4px. The scale is documented here and
  in the sheet's own comments, and the failure is visible rather than silent, but it is a real cost.

## Alternatives

**Keep Tailwind's defaults and add tokens alongside.** Rejected: it leaves `bg-emerald-300` working,
which makes `SN-DS-081` unenforceable by anything but review, and white-label branding (`F15`) then
depends on no component ever having reached for a palette value.

**Index-keyed spacing, Tailwind's convention.** Rejected: the spec lists values, and the translation
step is where an off-scale number gets in unnoticed.

**One flat layer of semantic tokens holding hex directly.** Rejected: it satisfies today and makes
§3.5 a rewrite. The dark theme needs somewhere to put a second set of values under the same names.

**Wait for OD-2 before implementing.** Rejected: the task is explicit that names and structure are
what matter now, and 193 downstream tasks are blocked on the token layer existing. The values are
the cheap part to change and this ADR is the record of how.
