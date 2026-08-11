# 0044 — The live region is in the page before there is anything to say

- **Status:** Accepted
- **Date:** 2026-08-10
- **Task:** TASK-DESIGN-014
- **Relates to:** `SN-DS-070` (WCAG 2.1 AA, live regions, visible focus, forms)

## Context

Two surfaces in this repo announced things, and both did it the same way: render a
`<div role="status">` when there is something to say, with the sentence already inside it.

That announces nothing. A live region is a *change* detector — the assistive technology watches an
element it already knows about and reads what changed. An element that arrives with its text
already in place is an insertion, not a change, and the common screen readers stay silent. The bug
is invisible in review, invisible in a unit test that asserts `getByRole("status")`, and invisible
to anyone developing without a screen reader turned on. Both of ours had it.

The second problem is that a region per surface does not compose. The pending-sync badge, the
connectivity banner, a toast and an inbox all announcing from their own regions gives four
independent politeness settings and no ordering between them.

## Decision

**There are exactly two live regions in the application, they are mounted at the root
unconditionally, and they start empty.** One polite, one assertive. Everything else announces
*through* them.

- `src/stores/announcement-store.ts` holds the sink, built with Zustand like the one store this
  repo already had. A store with no provider rather than a context, on purpose: every control in
  the library can announce, and a control rendered in a test, in a story, or on a public page with
  no `Announcer` above it must keep working rather than throw. Without one mounted, an
  announcement goes nowhere, which is the correct silent failure. `src/lib/a11y/announcement.ts`
  keeps only what is framework-free — the politeness vocabulary and what each region shows.
- The same sentence twice is not a change either, so an announcement carries a sequence number and
  the region alternates a trailing space. Two saves are two events and the reader hears both.
- `announce(sentence)` is the imperative entry — an event, a reply, a write that failed. It is a
  plain function, so a mutation handler with no component around it can call it.
  `useAnnouncement(sentence)` is the declarative one, for a sentence that is a function of state:
  it speaks when the sentence changes, stays quiet while it does not — so a re-render is not an
  announcement — and takes the sentence back out of the region when the surface stops saying it.
  The region is shared, so it only clears what it put there.
- The surfaces themselves keep their visible element and lose their `role="status"`. They are seen,
  not heard; the region does the hearing.

**One focus ring, in one file.** `FOCUS_RING` and `FOCUS_RING_INSET` (the second for a control
flush against its neighbour — a row, a cell — where an outward ring is clipped by the scroll
container). A test fails any component source that spells `focus-visible:outline` itself. It also
fails a control whose only focus signal is a colour change: the clear button had exactly that, and
a change of text colour is not a focus indicator — it fails 1.4.11 against its own resting colour
and disappears entirely under forced colours.

**The label/error association is a hook, not a component.** `useFieldWiring` was inside `Field` and
reachable only by rendering it. It now stands alone, taking the five things the association depends
on and nothing else, because the public lead form and the share viewer are held to the same bar and
are not built out of the component library.

## Consequences

- A new surface that wants to announce calls a hook. It does not add a region, and the review
  question "is this region mounted before its text?" stops needing to be asked.
- `resetAnnouncements()` exists for tests, which share a module registry. That is the cost of the
  singleton, and it is paid once per test file rather than by every caller.
- Three surfaces lost their own regions — the connectivity banner, the pending-sync badge and the
  stale-data indicator. Field errors and form notices still render `role="alert"` where they sit;
  moving those is a policy change about *when* a form speaks, which belongs to the tasks that own
  those forms rather than to the one that built the region.
- Reflow at 200% zoom is guarded statically — the constructs that break it fail a test — but not
  measured. jsdom has no layout, so the verdict itself is an open point against a real viewport.
