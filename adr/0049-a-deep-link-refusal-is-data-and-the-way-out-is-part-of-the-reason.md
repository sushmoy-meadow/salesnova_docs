# 0049 — A deep-link refusal is data, and the way out is part of the reason

- **Status:** Accepted
- **Date:** 2026-08-10
- **Task:** TASK-UX-002
- **Relates to:** `SN-UX-014` (deep links resolve or explain), `SN-ARCH-086` (the status and error-code
  contract), `SN-ARCH-085` (the dual policy objects), the six-state data surface

## Context

Every deep link — from a push notification, an email, a share — either resolves or explains itself.
Never a blank screen, never a bounce to the dashboard with nothing said. The failure mode is
specific and familiar: the reader taps a notification about a lead, lands on the front page, and
concludes they misread the link. Nothing told them the lead was deleted.

The obvious build is a `<DeepLinkRefusal>` component each route renders when its fetch fails. That
is where the second failure comes from. A deep-linked screen still has to load, still has to be
empty, still has to be degraded — and a route that renders the refusal *around* its data surface
rather than through it has shipped a page that knows how to fail and not how to wait.

## Decision

**The refusal is data, not a component.** `deepLinkErrorSurface()` returns the props an error
surface takes, so a screen writes `{ kind: "error", ...deepLinkErrorSurface(…) }` and hands it to
the same `DataSurface` it uses for its other five states. There is no deep-link component and no
deep-link folder — the surface is `ErrorState`, which the design system already owns.

**Eight reasons, and three of them are borrowed rather than restated.** `DeepLinkRefusal` is
`AccessWallKind | "sign-in" | "missing" | "gone" | "unavailable" | "unexpected"`. The permission,
plan and not-yet rows take their headings from the same table `AccessWall` reads, so a fourth wall
kind is a compile error in the deep-link module rather than a refusal it quietly cannot word. The
rule the copy is holding is worth stating plainly: **nothing in the permission row mentions money.**
Telling a member their admin restricted them to go buy a bigger tier is wrong and it reads as an
insult, which is why the protocol keeps `403` and `423` apart and why the copy does too.

**The reason is a code, never a status.** `refusalForCode` is the only entry point. A status is a
transport fact that only the fetch layer sees, and the repo already has one status table, next to
the wall kinds, owned by the data layer. Two of them would have drifted about what `423` means.

**Every refusal carries a way out, and the way out is a property of the reason.** Sign-in goes to
`/login` with the destination in `next=`, so the round trip ends where the link was pointing. Plan
goes to the plan comparison. The two transient reasons re-offer the link itself. Everything else
falls back to the part of the app the caller came from. None of them is the bare dashboard, and a
test asserts that for all eight — a link that lands on `/` is the failure this exists to prevent,
whether or not a heading came with it.

**An unrecognised code still gets a screen.** The catalogue is additive by contract, so a code from
next quarter is expected rather than a bug; it resolves to `unexpected`, which has words and a way
out. That is the branch that keeps the guarantee total.

## Consequences

- `404` and "belongs to another organisation" are one refusal with one sentence, deliberately.
  Wording them apart would confirm a record exists to anyone willing to try identifiers.
- The server's own message is never rendered. It is written for whoever reads the logs; the reader
  gets the reference id instead, which is the half they can quote.
- A screen that wants the refusal has to go through its data surface to get it. That is the
  pressure: the six states arrive together or not at all.
- `/login` and `/settings/plan` are forward references — neither route exists yet. The sign-in way
  out is a 404 until the auth screens land, which is the one place this module can currently
  produce the dead end it was written to prevent.
- Adding a reason means adding a row to one table: a title, a sentence naming what was being opened,
  a remedy, and which way out it takes. There is no second switch to keep in step.
