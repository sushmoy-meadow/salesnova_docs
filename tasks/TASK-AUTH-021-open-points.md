# TASK-AUTH-021 — open points

Every acceptance criterion was demonstrated; see `TASK-AUTH-021-demo.md`. What follows is what the
integration could not close, and what the task description asked to be recorded rather than passed.

**Resolved 2026-08-13, after the task closed.** Six of these were taken back up in one pass: two
became ADRs, four became code. Each section below says which. Nothing here is still waiting on a
decision.

## Google sign-in and Turnstile — decided, not built

> *Google sign-in and Turnstile are recorded as open decisions on TASK-AUTH-016 and are in scope
> here only if those decisions have landed — if they have not, this task records them as still open
> rather than silently passing.*

They had not landed when this task closed, so neither was in scope and both entry points were
exercised only to the point of confirming they were dead links.

**Now decided:**
[ADR-0069](../adr/0069-google-arrives-by-redirect-and-the-browser-never-holds-the-credential.md).
Google is a server-side authorization-code redirect run by the web app — no Google SDK anywhere, no
credential in the browser, and `/login/google` and `/signup/google` become route handlers rather
than pages, so both stay plain links that work unhydrated. The API's contract does not move: it
still takes a verified `id_token`. Turnstile is mounted as a plain script tag on the two screens
`SN-AUTH-004` names, which does not pull the application bundle and so leaves `SN-AUTH-010` intact.

Still unbuilt. `POST /signup/google` answers `501`, and until the redirect lands the two buttons
remain dead.

## Silent refresh — decided, not built

The API sets its rotating refresh token as an `HttpOnly` cookie scoped to `/api/v1/auth`. Every call
the web app makes is a server-to-server `fetch` from the Next process, which discards the response's
`Set-Cookie` — so the browser never holds a refresh token and nothing can present one. A session
therefore ends hard at the access token's fifteen minutes, and a replay cannot be driven from the
browser at all. It was demonstrated against the live API directly instead.

**Now decided:**
[ADR-0070](../adr/0070-the-refresh-cookie-is-set-on-our-own-origin-so-the-auth-routes-are-proxied.md).
A Next route handler proxies `/api/v1/auth/*` so the cookie is set on our own origin and the browser
holds it. The API is untouched and cannot tell the difference.

Still unbuilt, and it is the largest thing left in this area: until it lands, fifteen minutes is the
whole session.

## Switching organisation — fixed

The account menu linked out to `/login/organizations`, so switching left the authenticated tree and
came back. It re-authenticated nobody and it worked; it was one navigation more than it needed to be.

The menu now lists the account's other organisations as submit buttons and trades the token in
place, through `switchToOrganization` in `src/app/(app)/session-actions.ts`. The picker route stays
for the case that is not a switch — choosing where to land immediately after signing in, when there
is no app to be inside yet.

## Onboarding completion — fixed

Finishing the last screen redirected to `/`, the public site, leaving the reader to find the app
themselves. It now lands on `APP_PATH`, and the remaining crossings between the auth, onboarding and
app trees read their routes from `src/lib/auth/paths.ts` rather than from literals — which is how
this drifted apart in the first place.

## The extra round trip on signup and invite acceptance — fixed

Both endpoints answered with `AccountSession`, which named the organisation but nothing about the
role in it, while the session cookie holds `role_preset`, `status` and `organization_name` for the
picker. Both paths therefore called `GET /auth/memberships` before writing the cookie, and that
second call could fail after the membership it described had already been committed.

`AccountSession` now carries the membership list, the way signing in already did. One call, one
failure mode fewer, and the two answers that mint an account no longer describe it differently from
the one that resumes it.

## Types are hand-written — this was never open

The earlier wording here, carried from `TASK-AUTH-016` and `TASK-AUTH-017`, read `SN-ARCH-032` as a
live violation awaiting a fix. It is not:
[ADR-0068](../adr/0068-the-web-app-reads-the-contract-at-runtime-and-never-imports-it.md) decided
the web app validates every response with its own Zod schema and imports nothing from the API's
checkout, because the two are independent clones and a TypeScript type is not a runtime check
anyway. Hand-written schemas are the decision, not the debt.

What was true is now also fixed: `accountSessionSchema` is defined once, in
`src/lib/auth/account-session.ts`, and the membership shapes both it and `login-request.ts` need
live in `src/lib/auth/membership.ts`.

## A brand-new account still walks five onboarding screens before seeing the shell

Not a defect — the sequence is the product. Worth noting only because "lands in an authenticated
shell" reads as immediate and is not: signup lands in `/onboarding`, which is inside the
authenticated tree and behind the same gate, and the shell proper comes after.

## The reused-code message is deliberately not "you already used that code"

`OtpService::verify` answers a spent code with `OTP_INVALID` rather than a code of its own, because
telling a holder their code was already spent tells them somebody else spent it. The criterion asks
for two distinct on-screen errors and gets them — *"Check the six digits and try again"* against
*"Codes last ten minutes"* — but neither says the word "reused", and that is on purpose.

## Sign-out issues one UPDATE it does not need

`SessionTerminator::signOut` revokes the chain and then expires the presented access token. Where
the chain was found *by* that access token — the cookieless path, which is every server-rendered
client, so the common case — `revokeFamily` has already expired it, and the second write is a
guaranteed no-op on a row it just touched.

Left as it is: it is one primary-key UPDATE on an operation that happens once per session, and
removing it means `chainOf` reporting which of its two lookups matched, which is more moving parts
than the write costs. Recorded so it is a decision rather than an oversight.
