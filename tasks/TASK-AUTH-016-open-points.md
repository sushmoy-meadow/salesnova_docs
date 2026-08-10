# TASK-AUTH-016 — open points

Both acceptance criteria are tested here. What follows is what this repo cannot close on its own.

## Every signup endpoint answers 501

`POST /signup/identifier`, `/signup/profile`, `/signup/verify` and `/signup/resend` are published
and typed, and every one of them returns `NOT_IMPLEMENTED` until `TASK-AUTH-010` lands. The screens
post to them and render the rejection through the same typed-error path as any other failure, which
is the correct behaviour today and needs no change when the endpoints start working.

What is untested here is the round trip: nothing in this repo has yet seen a real `SignupState`, so
the stage the server chooses, the masked identifier it returns and the invited organisation name it
carries are all exercised against fixtures only. `TASK-AUTH-021` owns the end-to-end wiring.

The success path past verification is also unfinished for a second reason — `submitVerification`
redirects to `/`, because there is no authenticated shell to land in yet (`TASK-ARCH-021`), and the
returned `AccountSession` is validated and then dropped. Nothing here establishes a session.

## Google signup is an entry point without a handshake

**Task description:** *Google signup skipping stage 3.*

The stage logic is built and tested: `screensFor("google")` omits `VERIFICATION`, and the page
refuses to render a code field for a Google signup even when the URL asks for one. The first screen
carries a "Continue with Google" affordance.

What is missing is the credential exchange. `POST /signup/google` takes a verified `id_token`, which
only Google's client SDK can produce, and mounting that SDK would put script on the first screen —
the one thing `SN-AUTH-010` forbids. Closing this needs a decision recorded in an ADR: either a
server-side OAuth redirect flow that trades a `code` for the token without client script, or an
accepted exception that the Google button alone is a client island. The second is a real narrowing
of the requirement and should not be taken quietly.

Until then `/signup/google` is a dead link.

One consequence to fix alongside the handshake: if the server ever answers a Google signup with
`stage: "VERIFICATION"`, `resolveSignupScreen` clamps it to `PROFILE` and the visitor is returned to
the form they just submitted with no error and no way forward. The clamp is right for a stage typed
into a URL and wrong for a protocol mismatch, and the two are indistinguishable where it sits today.
Unreachable while Google cannot start a signup at all, which is why it is recorded here rather than
guarded.

## The captcha renders its failure but is not mounted

`SN-AUTH-004` requires Cloudflare Turnstile on signup initiation. This screen routes a captcha
rejection to its own notice rather than to the identifier field — that is the part `SN-AUTH-013`
demanded and it is tested — but no widget is rendered, so no such rejection can be produced in
practice today.

Turnstile needs its own decision for the same reason Google does: the widget is client script on a
page that is deliberately script-free. Whoever owns bot protection should record how that is
resolved. Note also that the error catalogue has no captcha member; this repo reads a captcha
failure as `VALIDATION_FAILED` carrying `captcha_token` in `error.details`, which is an assumption
about a server that does not yet reject anything. If the backend chooses a different key, the
mapping in `src/lib/auth/signup-failure.ts` is the one line that changes.

## Only one failure renders per round trip

A page with no JavaScript carries its last failure in the query string, so one error code and one
field name survive a redirect. The server's `422` `details` map may name several fields; only the
first is rendered. Reasoned in
[ADR-0034](../adr/0034-the-signup-screens-hold-their-state-in-a-cookie-and-their-failures-in-the-url.md).

With four short inputs across three stages this has not yet cost anything, but it is a genuine
narrowing of `422` handling and `TASK-AUTH-021` is the place it would first show up.

## Types are a stand-in, not generated

Unchanged from `TASK-AUTH-017`, and now larger. `SN-ARCH-032` forbids hand-written API types, and
the generated client lives in `salesnova_backend/contracts/` with no publishing route into this
repo. `src/lib/auth/signup-request.ts` mirrors `SignupState`, `SignupStage` and `AccountSession` as
Zod schemas read off that contract by hand. They validate at the boundary as `docs/tasks/RULES.md`
requires, but they are not generated and will drift.
