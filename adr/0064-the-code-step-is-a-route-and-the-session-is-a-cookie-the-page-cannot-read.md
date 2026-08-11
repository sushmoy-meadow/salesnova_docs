# ADR-0064 — The code step is a route, and the session is a cookie the page cannot read

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

[ADR-0034](0034-the-signup-screens-hold-their-state-in-a-cookie-and-their-failures-in-the-url.md)
settled how a server-rendered multi-step auth form carries its state: the step's facts in an
`HttpOnly` cookie, the last failure in the query string as a code. Signup runs on one URL and moves
between its three stages with `?stage=`.

Sign-in has the same shape and one requirement signup does not. `SN-AUTH-007` needs a third screen
that only some accounts ever see, and F01 §8 is explicit that the verification step **gets its own
URL** — with the reason spelled out beside it: Privyr holds that step as `activeStep` state, so a
refresh, or an Android reader switching to their messages app and back, drops them to step one with
the code still on the clipboard. On mobile web that is a routine failure, and it happens at the exact
moment the user has done everything right.

`?stage=VERIFICATION` would survive a reload. It would not survive the back button landing on
`/login`, it cannot be linked or bookmarked as the thing it is, and it makes the browser's own
history a poor description of where the reader has been.

The second question is new to this repo. Verification returns an access token, and until now nothing
here has held one.

## Decision

**Each sign-in step is a route of its own, and the issued session lives in an `HttpOnly` cookie no
page or script can read.**

Three routes: `/login` takes the identifier, `/login/verify` takes the code, `/login/organizations`
picks between memberships. Each renders from cookies and search params alone, so each is correct on
a cold request — a refresh, a restored tab, a link opened tomorrow.

Two cookies, because two different things are being kept and they expire on different clocks:

- `salesnova_login`, path `/login`, fifteen minutes — the pending challenge: the identifier, its
  channel, the masked form to display, and the instant a resend becomes available. Longer than the
  code's own ten minutes, so an expired code is refused by the server with something to say rather
  than by a vanished cookie with nothing.
- `salesnova_session`, path `/`, fifteen minutes — the access token, the user id and the memberships
  verification returned. The fifteen is `SN-AUTH-006`'s access-token lifetime, not a guess. The
  rotating refresh token is set by the API on its own cookie and is never read here.

Both are `HttpOnly` and `SameSite=Lax`, and `Secure` outside development. Failures travel as
`?error=<CODE>&detail=<field>` exactly as ADR-0034 established. The identifier never appears in a
URL — not on the way forward, and not on the way back from a refusal.

The organisation picker is reachable only with a choice to make: no session redirects to `/login`,
one membership redirects to `/`. Switching trades the token it already holds through
`POST /auth/switch-org`; it asks for no identifier and no code, which is what `SN-AUTH-007` means by
switching without re-authenticating.

## Consequences

**Accepted.** Three routes instead of one is three files that each read a cookie, and the challenge
cookie is now load-bearing for navigation rather than only for state — a reader who clears cookies
mid-flow lands on `/login` rather than on a broken step. That is the correct failure.

**Accepted.** The access token being unreadable by script means every authenticated request must be
made from the server, or through something that attaches it there. That is a constraint on how the
rest of the app fetches, and it is the reason the cookie is `HttpOnly`: an XSS anywhere in the
application otherwise reads a token out of storage and the session goes with it.

**Open.** Nothing yet reads `salesnova_session` — no middleware guards a route with it, and nothing
refreshes it when its fifteen minutes lapse. Recorded as an open point on TASK-AUTH-015 and owned by
whatever builds the authenticated request path.

**Superseded by nothing.** ADR-0034 stands as written; signup keeps its single URL, because signup
has no step a reader leaves the browser and comes back to.
