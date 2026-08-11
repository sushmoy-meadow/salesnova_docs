# TASK-AUTH-007 — open points

Every acceptance criterion on this task has a test behind it in
`salesnova_backend/tests/Feature/Auth/OtpFlowTest.php`. What follows is scope the task's description
names that this repository cannot close on its own.

## SMS is refused rather than delivered

`SN-AUTH-002` makes email and phone equal-status sign-in paths. This build answers a request for an
SMS code with `501 NOT_IMPLEMENTED`, which is what the signup flow already does for a phone number.
(A body whose channel and identifier disagree is a separate, and different, `422` — that one is a
client mistake rather than a missing transport.)

No SMS provider exists anywhere in the repository: there is no port under `app/Contracts/`, no
driver key in `config/providers.php`, and no vendor has been chosen. Refusing is the honest answer;
accepting the request and queueing a job that has no transport would report a code as sent that
nobody can receive.

What closes it: an SMS port with a named driver in `config/providers.php`, a transport branch in
`App\Jobs\Auth\SendVerificationCode` (which takes an identifier and a code today, and would take
the channel back), and lifting the refusal in `OtpService::refuseUndeliverableChannel()`.

## The Turnstile widget has no front end to render it

The server side is live: `captcha_token` is accepted on OTP generation and signup initiation,
verified against Cloudflare, and rejected as `422 VALIDATION_FAILED` carrying `captcha_token` in
`error.details` — the shape `salesnova_frontend/src/lib/auth/signup-failure.ts` already reads.

Nothing renders the widget, so no real token can be produced yet. `TASK-AUTH-016`'s open points
record the same gap from the other side: the sign-up screen is deliberately script-free and mounting
a captcha there needs its own decision.

Until a secret is configured the gate is open, which is what keeps a developer machine and CI able
to send a code at all. That also means **a production deployment with `TURNSTILE_SECRET_KEY` unset
has no bot protection and nothing will say so.**

What closes it: the widget mounted on the sign-in and sign-up screens, and a deployment check that
the secret is set outside local and testing.

## Turnstile is a concrete service, not a port

`App\Services\Security\TurnstileVerifier` calls Cloudflare directly rather than going through an
interface in `app/Contracts/` bound in `ProviderServiceProvider`, which is how every other external
dependency in this repository is reached.

That is deliberate — the spec names Cloudflare Turnstile specifically, so there is no vendor choice
for a driver key to express, and a port with one permanent implementation is an abstraction ahead of
its second use. It is recorded here because it is a visible departure from the surrounding pattern,
and it is the line to revisit if bot protection ever becomes a deployment-level choice.

## The signup flow still delivers nothing

`SignupService` announces a `SignupCodeIssued` event and no listener is registered for it, so a
signup code reaches nobody. That predates this task and belongs to `TASK-AUTH-010`, which is closed.

It is recorded here because this task built the transport the fix would use:
`App\Jobs\Auth\SendVerificationCode` takes a channel, an identifier, a code and an expiry, and a
queued listener on `SignupCodeIssued` that dispatches it is the whole of the change.
