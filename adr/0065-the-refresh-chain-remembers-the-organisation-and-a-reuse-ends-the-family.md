# ADR-0065 — The refresh chain remembers the organisation, and a reuse ends the family

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-AUTH-006` asks for a fifteen-minute access token beside a thirty-day rotating refresh token, and
for a refresh token presented twice to revoke its whole family. `SN-AUTH-007` asks that somebody
holding memberships in several organisations be able to move between them without signing in again.

Read together, those two produce a question neither of them asks. The access token is scoped to a
membership — that is what `X-Organization-Id` and the tenant resolver read. The refresh token is
scoped to a person. So when a refresh mints a fresh access token, which organisation is it for?

The schema `TASK-AUTH-003` left had no answer in it: `refresh_tokens` carried a family, a parent, a
hash and the Sanctum token it minted, and nothing about scope.

`05-api-design.md` §5 says the access token is a JWT. It is not, and
[ADR-0057](0057-three-deviations-from-the-company-bible-and-why-each-one-stands.md) already records
auth as one of the three places this project departs from the bible: the tokens are Sanctum's, minted
with `createToken`, and capabilities are read from `/bootstrap` rather than carried in the credential.
Nothing below depends on which of the two it is.

## Decision

**The refresh token carries `membership_id`, and rotation mints against it.** Signing in writes the
first active membership onto the first token in the chain; each rotation copies it onto the
replacement. A refresh therefore returns to the organisation the session was last in, not the one it
started in.

**Switching organisation rotates the chain when a cookie is presented, and mints regardless.** The
switch is what changes the scope, so the chain has to learn about it or the next refresh would
quietly undo the switch. A client holding no cookie — anything that is not a browser — still gets its
new access token, and the refresh half is simply absent. That conditional is the whole of the
special-casing: the switch does not consult, create or repair a chain it was not handed.

**Nothing on the server remembers which organisation a caller is in.** The scope lives in the token
and in the chain, both of which arrive with the request. A worker that outlives the request holds no
notion of a current organisation, so there is none to be stale.

**A reuse revokes the family, and every access token the family minted.** Each refresh token records
the Sanctum token it handed out, which is what makes the second half possible: revocation expires
those rows rather than waiting fifteen minutes for them to lapse. They are expired one second behind
the revocation instant, because Sanctum admits a token whose expiry has not yet passed and an expiry
level with the revocation would leave it usable for the remainder of that second.

**Every refusal on the refresh route is the same 401.** Unknown, spent, expired, revoked, and scoped
to a membership since deactivated all answer `UNAUTHENTICATED` with no detail. Distinguishing them
tells whoever is holding a token which of their guesses was once real.

**A membership deactivated under a live chain ends the chain rather than widening it.** The
alternative — minting an account-scoped token when the membership is gone — hands back more reach
than the session was ever issued for, quietly.

## Consequences

**Accepted.** A refresh token is now a small amount of state about where a session is, not only a
credential. That is what makes the switch survive a refresh, and it means a chain and its
organisation are revoked together, which is the behaviour a deactivated member should get.

**Accepted.** The reuse response cannot be told from the ordinary expired one, so a client cannot
show "you were signed out because your session was reused elsewhere". It shows the sign-in screen.
That is the correct trade while the alternative is telling an attacker holding a stolen token that
the token was genuine.

**Accepted.** Google sign-in verification is a port with no adapter, so a deployment that has not
named one fails when `POST /auth/google` is called and nowhere else. The port is taken as a method
dependency on the controller rather than a constructor one, because a constructor dependency is
resolved whenever the controller class is — including by the tooling that reads controllers to
generate the API document, which would make an unconfigured deployment unable to produce a contract
for any endpoint at all.

**Open.** There is no sign-out. Ending a session deliberately means revoking a family, and the route
for it is not in this task; until it exists, signing out is a client discarding its tokens and the
chain lapsing after thirty days.
