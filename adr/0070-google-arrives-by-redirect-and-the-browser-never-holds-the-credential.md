# ADR-0070 — Google arrives by redirect, and the browser never holds the credential

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-AUTH-011` puts "Continue with Google" beside the identifier field on signup, and the sign-in
screen carries the same affordance. Both have been rendered since `TASK-AUTH-016`, and both link to
routes that do not exist. `TASK-AUTH-016-open-points.md` asked for this decision and `TASK-AUTH-021`
found the links still dead, which is the second task in a row to report the same thing.

The API is already built for one half of it. `POST /auth/google` takes a verified `id_token`,
`GoogleAuthService` refuses an identity whose email Google has not itself confirmed, and
`GoogleIdentityVerifierInterface` is the seam a real verifier drops into. `POST /signup/google`
answers `501` and is the only piece missing on that side.

What was never decided is where the `id_token` comes from. Google's client SDK is the obvious
answer and the reason this stalled: `SN-AUTH-010` says the signup page **MUST NOT** require the
application bundle, and mounting an SDK on it felt like the thing that requirement forbids.

Read exactly, it is not — a third-party `<script>` is not the application bundle, and the screens
could carry one without breaking that sentence. So the constraint is not what settles this. Three
other things do:

- The SDK's button does nothing with JavaScript off. An `<a href>` is a link, and the screens are
  server-rendered precisely so they work for somebody the bundle never reached.
- The SDK hands the browser a credential. A redirect flow exchanges the code server-side, so the
  only process that ever holds a Google token is one we run.
- Sign-in and signup are the same handshake until the identity comes back. One redirect endpoint
  can decide which it was by whether that identity already has an account — which is the branch
  `SN-AUTH-005` already requires everywhere else.

## Decision

**Google is an OAuth 2.0 authorization-code redirect, driven entirely by the web app's server. No
Google SDK is loaded anywhere, and no Google credential reaches the browser.**

- `/login/google` and `/signup/google` become Next route handlers. Each mints a `state` and a PKCE
  verifier, banks them in a short `httpOnly` cookie, and `302`s to Google's authorization endpoint.
  Both entry points stay plain links, and both work with no script at all.
- `/auth/google/callback` is a route handler on the same origin. It checks `state`, exchanges the
  `code` and the verifier for an `id_token` server-side, and posts that token to the API's existing
  `POST /auth/google` or `POST /signup/google`.
- The client secret is configuration of the Next process. It is never sent to a browser, and the
  API's contract does not change: it still receives a verified `id_token` and nothing else.
- Signup by Google skips the code stage, which `screensFor("google")` already implements.

**Turnstile is mounted as a plain script tag on the two screens `SN-AUTH-004` names**, rendering
into the server-rendered form and contributing one more field. It is not a React island and does
not pull the application bundle, so `SN-AUTH-010` holds. There is no server-side equivalent — a
captcha is script by construction — and that is the requirement's own trade, not a deviation from
it.

## Consequences

A visitor with JavaScript entirely disabled can no longer request a code or start a signup, because
`SN-AUTH-004` makes the captcha mandatory on exactly those two actions. Everything else on those
screens keeps working without it, Google included.

The web app gains its first routes that are not pages, and its first outbound call to somebody other
than our own API. Both belong to it rather than to the API because the redirect has to land on the
origin the reader is on.

`error.details` naming `captcha_token` on a `422` stays the agreed shape for a rejected captcha;
`src/lib/auth/signup-failure.ts` already reads it and is the one line that changes if the API picks
a different key.

The clamp in `resolveSignupScreen` — which rewrites an unexpected `VERIFICATION` stage to `PROFILE`
and would strand a Google signup silently — becomes reachable the day this ships, and is fixed with
it rather than before it.
