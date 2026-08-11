# ADR-0062 — A verified identifier is an account, and both OTP ceilings hold

Accepted · 2026-08-11 · @sushmoy

## Context

Two things had to be settled before the one-time-code endpoints could answer
anything.

The first is what happens when a code verifies for an identifier no account
exists under. The authentication chapter forbids the request from revealing
whether an account exists and says the existence branch runs only after a
successful verification — but it does not say what that branch returns, and the
published contract for the verify endpoint carries a single shape: a token, a
user id and a list of memberships.

The second is that two normative chapters cap code generation differently. The
security chapter allows three per identifier per fifteen minutes and ten per IP
per hour; the authentication chapter allows five per identifier per hour and
twenty per IP per hour. Neither implies the other: three every fifteen minutes
is twelve over an hour, which the second forbids, and the second permits an IP
volume the first does not.

## Decision

Verifying a code for an unrecognised identifier provisions the account. The
person has proved they hold the identifier, which in a passwordless product is
the whole of authentication; what they do not have is an organisation, and an
empty membership list is what says so. One response shape serves both cases and
the client routes an empty list into onboarding.

Code generation carries three windows, all of which must pass: three per
identifier per fifteen minutes, five per identifier per hour, ten per IP per
hour. The authentication chapter's twenty-per-IP is dropped as strictly implied
by the security chapter's ten.

## Consequences

An address that can receive mail can mint a user row, so the row count now
tracks people who asked for a code rather than people who finished signing up.
That is bounded by the generation limits above and by the fact that a row with
no membership reaches nothing.

The name on such an account is the local part of the address until onboarding
replaces it. Nothing reads it before then.

Taking the tighter of each pair means a deployment is never in breach of either
chapter, and the reconciliation is one expression rather than a per-endpoint
judgement. The cost is that the published ceiling a client can rely on is the
lower one, which no client currently reads.

## Alternatives

Returning a signup handoff instead of a session was rejected: it needs a second
response shape on an endpoint whose contract is already published, and the
signup flow it would hand off to issues its own code, so the person who has
just proved an address would be asked to prove it again.

Nulling the token and user id for the unregistered case was rejected because it
weakens the type every registered caller reads, to describe a state an empty
membership list already describes.

Choosing one chapter's numbers over the other's was rejected because both are
normative and the conflict is not a drafting slip — the burst limit and the
hourly ceiling constrain different attacks.
