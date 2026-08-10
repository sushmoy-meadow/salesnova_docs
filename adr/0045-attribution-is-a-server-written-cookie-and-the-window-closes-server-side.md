# ADR-0045 — Attribution is a server-written cookie, and the window closes server-side

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-AUTH-014` requires the campaign a signup came from to be captured **server-side** and written to
`user.acquisition` when the account is created, inside a 15-day first-touch window.

The requirement exists because of how the prior art fails. Privyr keeps the bundle in `localStorage`
and expires it with `localStorage.clear()`, which wipes everything the origin stored rather than the
campaign keys. Ad blockers, private browsing and a cleared jar all lose attribution silently, and
once it is lost there is nothing to recover it from.

Server-side capture still needs somewhere to keep the touch. The click that carries `utm_source`
lands weeks before anyone reaches a signup screen, and the two requests share nothing but the
browser. There is no session — signup is unauthenticated by
[ADR-0029](0029-signup-and-invite-acceptance-are-public-and-tokenless-in-the-url.md) — and no
account to hang it on, because the account is what the touch is being kept for.

## Decision

**The server writes the first touch into an encrypted, `HttpOnly` cookie, and decides at account
creation whether the window still holds it.**

`CaptureFirstTouch` runs on the whole `api` group, not on the signup routes. Whichever request the
browser makes first has to be the one that records the campaign, and by the time a signup route is
reached the click has long since happened.

The bundle is encrypted with the application key before it leaves and decrypted on the way back in.
A cookie a page can read is a cookie a page can write, and a client that can write its own
attribution can claim any campaign's credit — which is the whole reason this is not in
`localStorage`. A cookie that fails to decrypt is treated as absent.

The cookie's own lifetime is 60 days and is deliberately longer than the window. Letting it expire
at 15 would move the rule into the browser, where a cleared jar or a short-lived session decides
attribution instead of us, and no server test could prove the window at all.

The window is all or nothing. Inside it, the whole bundle is the first touch's; outside it, the whole
bundle is the session that is signing up — which is what makes `referrer` reflect only the final
session once a campaign has lapsed. Mixing a lapsed campaign with a fresh referrer would credit a
channel for a visit it did not send.

## Consequences

- The signup page must fetch with `credentials: "include"`. A cross-origin `fetch` sends no cookies
  by default, and without them every signup reads as a session with no history — attribution is lost
  silently, exactly the failure this replaces.
- The cookie is `SameSite=Lax` and scoped to the API host. The API and the marketing surface are
  subdomains of one registrable domain, so they are same-site; splitting them across sites would
  force `SameSite=None; Secure` and is a decision to take deliberately.
- A first touch survives a device but not a change of one. Someone who clicks an ad on a phone and
  signs up on a laptop is recorded as the laptop's session. Cross-device stitching needs an identity
  the click does not carry, and inventing one is a bigger decision than attribution.
- `user.acquisition` is written once, when the account is created, and never rewritten. A returning
  address that already has an account keeps the attribution it was opened with.
