# TASK-AUTH-008 — open points

All three acceptance criteria have tests behind them in
`salesnova_backend/tests/Feature/Auth/SessionRotationTest.php`, and the Google half of the
description in `GoogleSignInTest.php`. What follows is what the task's own description reaches past
this layer, and the decisions that should be argued rather than inherited.

## There is no sign-out

`05-api-design.md` §5.1 lists `POST /api/v1/auth/logout → 204` beside the four routes built here, and
this task's description does not mention it. Nothing built here ends a session deliberately: a
family is revoked only by a reuse, and otherwise the chain lapses after thirty days.

The pieces are in place — revoking a family already expires every access token it minted — so the
route is a controller and a call. It belongs to whichever task owns the sign-out screen.

## The Google adapter is not written, and the port fails loudly without one

`GoogleIdentityVerifierInterface` is bound through `ProviderServiceProvider` with no driver, exactly
as WhatsApp, payment, notification and storage are. `POST /api/v1/auth/google` therefore raises
`UnconfiguredProviderException` on a deployment that has named none, and every other endpoint is
unaffected.

What an adapter has to do is written on the port: signature against Google's published keys,
audience against this deployment's client id, issuer, and expiry. The flow either side of it —
refusing an address Google has not itself confirmed, provisioning by lowercased address, and
establishing the same session a code does — is built and tested against a bound stand-in.

Two things are decided here and are worth revisiting when the adapter lands. The account is keyed on
the verified address, not on Google's subject, so somebody who signed in with a code and then with
Google arrives at one account; that is what the test asserts. And `GoogleIdentityDTO::$subject` is
carried but read by nothing, because linking by subject is the more durable identity and the adapter
task is where that choice should be made rather than foreclosed here.

## `X-Organization-Id` is not enforced

`SN-ARCH-087` requires the header whenever a user holds more than one membership. The access token
minted here already names the membership, and the tenant resolver reads its own context, so the
header is a second, weaker statement of the same fact. Reconciling them is not this task's — nothing
in the three acceptance criteria mentions the header, and the resolver is `TASK-ARCH-*`.

Until then a caller holding two memberships is scoped by whichever token they present, which is
correct but is not the rule the specification writes.

## Reuse is detected, not reported

Every refusal on `POST /auth/refresh` answers `401 UNAUTHENTICATED` with no detail, so a client
cannot distinguish "your session was replayed elsewhere" from "your session expired" and show the
first as a security notice. That is deliberate and recorded in
`adr/0065-the-refresh-chain-remembers-the-organisation-and-a-reuse-ends-the-family.md`.

If the product wants the notice, it has to arrive somewhere other than the refusal — an audit-log
entry written at revocation and surfaced on next sign-in. Nothing writes one today.

## The revocation instant is a second wide

Revoking a family expires the Sanctum tokens it minted one second before the revocation instant,
because Sanctum admits a token whose expiry has not yet passed. Setting them level with the instant
left a live token usable for the remainder of that second, which a test now covers.

The residual is that the two clocks — the family's `revoked_at` and the access tokens' `expires_at` —
are deliberately one second apart, and anything that later reads them as the same instant will be
wrong by that much.
