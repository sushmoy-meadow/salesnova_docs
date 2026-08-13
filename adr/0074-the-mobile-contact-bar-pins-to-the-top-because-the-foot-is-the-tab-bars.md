# ADR-0074 — The mobile contact bar pins to the top, because the foot is the tab bar's

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

SN-LEAD-020 is emphatic and normative: Call · WhatsApp · Email · SMS **MUST** be reachable without
scrolling, at every breakpoint, including when the lead has a long timeline. "If a rep has to scroll
to message someone, the design has failed." It is the product's primary action.

TASK-DESIGN-007 built `ContactActionBar` to a task-level acceptance criterion phrased as *"above the
fold on lead detail at every breakpoint, and sticky-bottom on mobile,"* and shipped the component
with `sticky bottom-0 … sm:static`. TASK-LEAD-007 is the slice that first renders it on a real
lead-detail screen and drives the criterion in a browser against a long timeline.

Two things surfaced there that the component could not have known about on its own:

- **`sticky bottom-0` never pins from this position.** The bar sits high in the page — header, then
  actions, then a long timeline below. `position: sticky; bottom: 0` holds an element whose natural
  place is *below* the viewport foot; an element near the top simply scrolls away upward. Measured:
  at a 3000px scroll the bar's top was −2880px, fully gone. So the "sticky-bottom" the criterion
  named was inert — the actions were reachable only at the top of the page, and a long timeline
  scrolled them out of reach, which is exactly the failure SN-LEAD-020 forbids.

- **The foot of the mobile viewport already belongs to the tab bar.** `BottomNav` is
  `fixed inset-x-0 bottom-0 md:hidden`, and `AppShell`'s main reserves `pb-64` for it. A contact bar
  that actually pinned to the bottom would land on top of the navigation. Two things fixed to the
  same edge fight, and the reader loses.

So the criterion's *bottom* was doubly unavailable: the mechanism didn't pin, and the place was
taken.

## Decision

**On mobile the contact bar pins to the top of the viewport; from `sm` up it folds back into the flow
under the lead.** `sticky top-0 … sm:static`, with an opaque `bg-surface-raised` and a bottom border
so the timeline scrolls cleanly beneath it.

The page's non-sticky header scrolls away first; the bar then holds at the viewport top for the whole
length of the timeline. Measured at 0, 2000 and 4000px of scroll on a 375×667 viewport with eighteen
timeline entries, all three action links stayed fully within the viewport. On `sm` and up the bar
returns to its place in the composition (SN-LEAD-021), above the fold at load, where the wider screen
keeps it reachable without a scroll.

This keeps the normative requirement — reachable without scrolling, at every depth, at every
breakpoint — and drops the task-level wording it was expressed in. SN-LEAD-020 governs; "sticky-bottom
on mobile" was a means to it that its own shell contradicts.

## Consequences

The lead-detail page no longer reserves its own bottom padding for the bar; `AppShell` already
reserves the foot for the tab bar, and the bar is a top element now, so the page's `pb-*` override is
gone.

TASK-DESIGN-007's acceptance criterion and its open-points note the bar as sticky-bottom; that wording
is superseded here, and the component test now asserts `top-0` rather than `bottom-0`. The change is a
CSS placement only — the component's structure, its data props and its channel-resolution behaviour
are untouched.

A bottom-anchored primary action is still a defensible mobile pattern, but it needs a bar deliberately
seated above the tab bar's measured height, not a `sticky` that pins to the same edge. Should that be
wanted later, it is a `fixed` element with a bottom offset, and a decision to make the tab bar's
height a shared token rather than a magic number.
