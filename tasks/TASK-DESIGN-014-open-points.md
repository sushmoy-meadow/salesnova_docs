# TASK-DESIGN-014 — open points

## 1. "All app content is usable at 200% zoom with no horizontal scroll"

**Half-closed, and the honest half is the smaller one.** `src/app/reflow.test.ts` fails the
constructs that break reflow — a viewport-width measure, a minimum wider than 320px, an
`overflow-x: hidden` on the page that makes the overflow unreachable rather than removing it, a
second horizontal scroller anywhere but the data table WCAG 1.4.10 exempts, a root pinned to the
viewport height. It passed on the first run: nothing in the tree violates it today, so it is a
fence around a clean state rather than a repair.

**What it does not do is measure the page.** jsdom has no layout engine, so no unit test here can
answer "does this reflow into 320 CSS pixels". A test that claimed to would be a false verdict, and
that is a worse outcome than an open point.

**What would close it:** a Playwright pass at 320×512 and at 1280×1024 with a 200% page zoom, over
every route, asserting `document.scrollingElement.scrollWidth <= clientWidth`. The repo has
Playwright available but no e2e harness; TASK-DESIGN-018 owns the conformance verification and is
the natural home. Two of the routes that matter most — the share viewer and the lead form — do not
exist yet, so the sweep is worth running once they do rather than twice.

## 2. Two consumers named in the criterion do not exist yet

The criterion asks for the live region to be used for "toasts/new-message/count announcements".
Built and used today:

- **count** — `PendingSyncIndicator` announces the queue depth, and no longer owns a live region
  that appears with its text already inside it.
- **interruption** — `ConnectivityBanner` announces assertively, which is the one case in the repo
  that earns it.

Not built here, on purpose:

- **toasts** — TASK-UX-001 owns the confirmation tiers, toast-with-undo among them. `announce()`
  is the imperative entry point a toast calls; building a toast component here would decide that
  task's first tier for it.
- **new messages** — the WhatsApp inbox does not exist. `announce()` is what it will call.

## 3. No skip link — **closed by TASK-DESIGN-013**

The description asks for keyboard focus management, and a skip link is the usual first item. It
needed a `<main>` landmark with a stable id at the shell level, which TASK-DESIGN-013 owns, so it
was left open here rather than putting the shell's landmark structure in the accessibility task.

TASK-DESIGN-013 built it: `src/components/shell/skip-link.tsx`, first in the tab order, `sr-only`
until focused, aiming at the `main-content` id that `AppShell` puts on its `<main>`. It wears
`FOCUS_RING` rather than inventing a third ring, which is what leaving the point open was for.

## 4. Form errors still announce from where they render

`invite-acceptance-form.tsx`, `signup-field.tsx` and `signup-notice.tsx` mount a `role="alert"`
with the message already inside it — the same construct this task removed from the three offline
surfaces. They were left alone deliberately: `Field` states the opposite policy in its own comment
(an error is reached through `aria-describedby` and read on focus, so announcing it again reads it
twice, and a form of ten reads all ten), and deciding which of the two policies a form follows is a
decision about forms, not about the region. The id derivation in those files now goes through
`fieldIds`/`describedBy`, so whichever way that decision falls, the wiring is already shared.
