# 0048 — The breakpoint is a CSS variant, and JavaScript never measures the window

- **Status:** Accepted
- **Date:** 2026-08-10
- **Task:** TASK-DESIGN-013
- **Relates to:** `SN-DS-060` (the breakpoint table), the mobile-first rule the design system opens
  with, WCAG 1.4.10

## Context

The design system names five widths and says what each one is for: the bottom bar carries the phone
and `sm`, the sidebar arrives at `md`, it is persistent from `lg`, and the spreadsheet grid does not
fit below `lg`. Building that reads as a request for a width: something has to know which of the
three navigations is on screen.

The obvious shape is a `useMediaQuery` hook, and it is wrong here for a reason that has nothing to
do with taste. The server has no window. A component that decides its layout from a measured width
renders the phone layout on the server, ships it, hydrates, measures, and swaps — so the desktop
reader watches the wrong layout for one frame on every navigation, and the swap lands after the
largest contentful paint rather than before it.

## Decision

**Every width rule in the shell is a Tailwind variant. Nothing measures the viewport.**

- Both navigations render at every width and the stylesheet hides one. `BottomNav` is `md:hidden`,
  `SideNav` is `hidden md:flex`. Six links of static markup is cheaper than any mechanism that
  would avoid rendering the other one, and it is the same markup the server produced.
- `DesktopOnly` renders both halves for the same reason: the explanation is `lg:hidden`, the real
  surface is `hidden lg:block`. Because `display:none` skips layout and paint but not mounting, the
  children it is given must be markup rather than a subtree that fetches or subscribes — a surface
  that needs to load its own data belongs behind a route, not behind a class.
- A test greps every shell source for `matchMedia`, `innerWidth`, `useMediaQuery` and
  `ResizeObserver`, so the hook cannot arrive later without saying so.

**The breakpoint table is data, and it is what the shell's classes are checked against.**
`src/lib/design-system/breakpoints.ts` holds the five steps with what each is for. It decides
nothing at runtime — a class name cannot say *why* it turns on at `md`, so the table says it, and
`stepWhere()` turns the table into the variant prefix the tests assert with. The table's widths are
themselves asserted against the `--breakpoint-*` declarations Tailwind's theme actually emits, so a
table describing a layout the browser never draws fails the suite.

**A measure that renders is declared once, in the stylesheet.** `--container-content: 1440px` caps
the reading column and `--container-sidebar: 160px` sizes the rail. Neither has a TypeScript
counterpart: a constant nothing renders is a second number, and the two drift with nothing failing.
`globals.test.ts` asserts both, where the value lives.

**The rail shows words at every width it is on screen.** The table calls `md` "collapsible", which
invites a strip of icons — but there is no icon set in this repo yet, and a strip that hid its
labels for icons that do not exist is a column of empty boxes. Labels at every width; the collapse
is a decision to make when there are icons to collapse to.

## Consequences

- A new screen gets its frame by rendering inside `AppShell` and nothing else. It does not choose a
  navigation, and it cannot get one wrong.
- Adding a sixth width means adding it to the table first; the shell's own test fails a variant
  prefix the table does not name.
- Anything genuinely needing the window — a virtualiser's row count, a canvas — is a new decision,
  not an extension of this one. It should be argued on its own and kept out of the shell.
- The counts on the bar are a prop. Nothing fetches them here, so whichever layout owns the
  authenticated tree owns where they come from.
- `DesktopOnly` sits with the other full-surface states in the design system rather than in the
  shell: it is something a feature renders inside `<main>`, not part of the frame.
