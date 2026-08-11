# ADR-0034 — The signup screens hold their state in a cookie and their failures in the URL

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-AUTH-010` requires the signup page to be server-rendered and to work without the application
bundle. `SN-AUTH-011` gives it three stages, and `SN-AUTH-013` requires every typed failure to
render against the thing that actually failed rather than defaulting to the email field.

Those two requirements pull against each other. A multi-stage form normally keeps its progress and
its last error in client memory, and rendering an error beside the right input normally means a
client-side form library holding a field-error map. A page with no JavaScript has neither. It gets
one request, one response, and whatever it can persist between them.

Two things have to survive a stage boundary: the `signup_id` the server minted, and the failure the
last submission produced. They are not the same kind of thing and they do not want the same home.

`signup_id` resumes a half-made account. [ADR-0029](0029-signup-and-invite-acceptance-are-public-and-tokenless-in-the-url.md)
already settled that no credential rides in a URL — path segments and query strings land in browser
history, `Referer` headers, proxy logs and error reports, and none of those redact.

A failure is not a credential. It is a fact about the request that just happened, and the visitor is
about to look at it.

## Decision

**The signup session lives in an `HttpOnly` cookie; the last failure travels in the query string as
a code, never as text.**

The cookie (`salesnova_signup`, path `/signup`, `SameSite=Lax`, 30 minutes) carries `signup_id`, the
channel, the masked identifier and the invited organisation name. It is written by the server
action that advances a stage and read by the page that renders the next one. No script reads it and
no referrer carries it.

A failed action redirects to `/signup?stage=…&error=<CODE>&detail=<field>`. Only the error code from
the published catalogue and the first key of `error.details` travel — never anything the visitor
typed, which would otherwise end up in history and access logs.

`src/lib/auth/signup-failure.ts` turns that pair into a target and its copy. `details` is field-keyed,
so a server that names a field gets that field marked; a server that names none gets a banner. The
one code that has to be inferred is the captcha, which the catalogue has no member for: it arrives as
`VALIDATION_FAILED` with `captcha_token` in `details`.

The same module reads the current stage, because the same code means different things at different
points. `NOT_FOUND` on the first screen is a bad invitation; past it, the invite token is no longer
in play and it is our own signup having aged out, so it says to start again instead.

## Consequences

- The whole route is server components. There is no `"use client"` anywhere under `src/app/signup/`
  or `src/components/signup/`, and a test asserts it, so the criterion cannot rot quietly.
- Failures are not preserved per-field across a redirect — one failure renders at a time, because
  that is what a code in a query string can carry. The server's `details` map may name several
  fields; only the first is rendered. This is a real narrowing of `422` handling and is worth
  revisiting if signup validation ever fails on two fields at once, which its four inputs make
  unlikely.
- Submitted values are lost on a failed round trip, since nothing the visitor typed is echoed back.
  For four short inputs this is cheaper than the alternative, which is putting an identifier in a
  URL.
- Google signup is entry-point only. `/signup/google` takes a verified `id_token`, which needs
  Google's client SDK and would put script on the first screen. The stage logic that skips
  verification for a Google signup is built and tested; the credential handshake is not, and is
  recorded as an open point on `TASK-AUTH-016`.

## Alternatives

**Keep `signup_id` in the query string.** Rejected: it is the construction ADR-0029 argued against,
and a resumable half-made account is exactly the sort of thing that must not sit in history.

**A client island for the form.** Rejected: it is the one thing `SN-AUTH-010` forbids. The whole
reason signup is served outside the bundle is the visitor on a slow connection who does not yet have
an account.

**Flash the failure in the cookie instead of the URL.** Rejected: it makes the back button lie. A
cookie-borne error survives a reload and a navigation that had nothing to do with it, and clearing
it needs a second write on every successful render.
