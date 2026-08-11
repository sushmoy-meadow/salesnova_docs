# TASK-AUTH-010 — open points

All three acceptance criteria have tests behind them. What follows is scope this task deliberately
left to the tasks that own it, and what would close each.

## The verification code is announced but not delivered

`SignupService` generates the six digits, stores their hash and dispatches `SignupCodeIssued`.
Nothing listens. Until something does, a real person cannot finish stage three — the tests read the
code off the event.

Closed by **TASK-AUTH-007** (OTP generation, delivery and verification), which adds the listener and
the transport. The event is the seam it hangs from; nothing about the flow needs to change.

## Phone signup is refused at stage one

`IdentifierChannel::PHONE` is published and the identifier is parsed into it, but a phone signup
answers `NOT_IMPLEMENTED`. The account a signup ends at is keyed by `users.email`, and there is no
column for a phone identity to land in.

Closed by **TASK-AUTH-001** (auth & session schema), which is where a phone identity column belongs.
One test asserts the refusal, so the day it lands the assertion fails and points at this.

## Google signup is still the contract only

`POST /signup/google` answers `NOT_IMPLEMENTED`. Verifying an ID token needs a Google port that does
not exist, and none of the three criteria run through it.

Closed by the task that introduces that port. `SN-AUTH-011` requires the Google path to skip stage
three and prefill stage two from the token claims; the state machine already supports both.

## No captcha error code was added

`SN-AUTH-013` names captcha failure as a branch the client must distinguish. Nothing in this build
issues a captcha, and a catalogue case for a mechanism that does not exist cannot be branched on.
The frontend already reads a captcha failure as `VALIDATION_FAILED` carrying `captcha_token` in
`details` (ADR-0034), which needs no new code and stays true when a captcha lands.

## A new organisation's country is a config default

Signup asks nobody where they are, so `ORGANIZATION_DEFAULT_COUNTRY` seeds the currency, timezone and
phone region. Geolocation at signup, or asking during onboarding, would replace it.
