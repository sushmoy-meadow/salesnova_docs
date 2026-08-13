# ADR-0070 — The refresh cookie is set on our own origin, so the auth routes are proxied

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

[ADR-0065](0065-the-refresh-chain-remembers-the-organisation-and-a-reuse-ends-the-family.md) gives
the API a thirty-day rotating refresh token in an `HttpOnly` cookie scoped to `/api/v1/auth`, and a
reuse of any link in the chain ends the whole family. It works: `TASK-AUTH-021` drove a replay
against the live API and watched the family die and the access token it had minted go from 200 to
401.

It cannot be driven from the web app, and that is the problem. Every call the app makes is a
server-to-server `fetch` from the Next process. `Set-Cookie` on those responses is discarded, so the
browser never holds a refresh token and nothing can present one. The consequences are not small:

- A session ends hard at the access token's fifteen minutes. There is no silent refresh; the reader
  is returned to sign-in with a reason.
- The half of `SN-AUTH-007` that reuse detection protects is unreachable from the product. It is
  tested against the API and untested through the thing people use.
- The web app keeps a session cookie of its own holding the access token, so there are two session
  representations for one session, and the shorter one is authoritative by accident.

Fifteen minutes is wrong for what this is. A sales tool is left open between calls; being signed out
mid-afternoon for having read rather than clicked is the behaviour, not an edge case.

## Decision

**The auth endpoints are proxied through the web app's own origin, so the refresh cookie is set on
that origin and the browser holds it.**

- A Next route handler serves `/api/v1/auth/*`, forwarding method, body and the `Cookie` header to
  the API and passing `Set-Cookie` back to the browser unchanged. The cookie stays `HttpOnly`,
  `Secure` and path-scoped; only the host on it changes.
- The API's cookie attributes, rotation and reuse detection are untouched. It cannot tell the
  difference, and `ADR-0065` stands as written.
- When a read fails with `UNAUTHENTICATED`, the app presents the refresh cookie once through that
  proxy, banks the new access token, and retries. A second failure is a real sign-out and carries
  its reason, exactly as today.
- Nothing else is proxied. Every other endpoint keeps its direct server-to-server call, which is
  faster and needs no cookie.

Rejected: **letting the browser call the API directly** with CORS and credentials. It removes the
duplicate session honestly, but it moves authentication into client components and rewrites how
every server-rendered read gets its token — a larger change than the problem, on the one surface
where being wrong signs everybody out.

Rejected: **raising the access token's TTL**. It buys time by widening the window a leaked token is
good for, which is the trade `ADR-0065` was written to avoid making.

## Consequences

Reuse detection becomes reachable from a browser, so the replay half of `SN-AUTH-007` can be
demonstrated in the product rather than only with `curl`.

The web app's own session cookie no longer has to carry the access token's fifteen minutes as its
lifetime; it holds what the shell needs to name the reader and the organisation, and the API's
cookie is what proves anything.

A proxied route is a route that can be attacked, so it forwards a fixed list of paths and methods
and nothing else — a proxy that forwards whatever it is given is an open relay into the API with
our own origin's cookies attached.

This is not built here. It is the decision the build follows, and until it lands a session still
ends at fifteen minutes.
