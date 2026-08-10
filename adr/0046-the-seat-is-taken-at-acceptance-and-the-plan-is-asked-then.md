# ADR-0046 — The seat is taken at acceptance, and the plan is asked then

**Status:** Accepted
**Date:** 2026-08-10

## Context

An organisation on a metered plan has a ceiling on how many people may hold an active membership.
Two moments could enforce it: when an administrator sends an invitation, or when the invited person
accepts one. They are not equivalent, and they can be days apart — long enough for the plan to change
underneath the invitation, for another invitation to be accepted first, or for a member to leave.

Refusing at send is the more comfortable of the two to build, because the caller is authenticated and
already inside the tenant. It is also the one that lies: five invitations sent against three seats all
succeed under a check that only counts current members, and the refusal then lands on the fourth and
fifth people to click a link they were told was theirs.

There is no subscription table yet. AUTH-011 needed the rule before billing existed to answer it.

## Decision

**The check is at acceptance, and at reactivation, and nowhere else.** Sending an invitation against a
full plan is legitimate — the administrator may be replacing somebody who leaves tomorrow — and the
endpoint publishes no seat error at all. Accepting refuses with `SEAT_LIMIT_REACHED` and 423, which is
the same answer a deactivated member gets when somebody tries to let them back in.

Only members whose status is active hold a seat. A deactivated one does not, or an organisation that
lost somebody could never replace them. A person who already has a membership and accepts a second
invitation to the same organisation does not take a second seat.

**The ceiling arrives through `App\Contracts\Billing\SeatLimitResolver`**, whose `seatsFor()` returns
the seat count or `null` for a plan that does not meter seats. The organisations module counts its own
occupied seats and never reads a subscription; billing supplies the number and never counts
memberships. `SeatGuard` is the only place they meet, so acceptance and reactivation cannot drift into
two different rules.

**The bound implementation returns `null` for everything.** Every other resolver in this tree fails
closed, and this one deliberately does not: with no subscription table, a closed default does not mean
"be cautious", it means no organisation may ever add a member. A rule that refuses everyone is a worse
answer than one that refuses no one, and the seam is the point — replacing the binding is the whole of
what enabling metering costs.

## Consequences

An invitation that was valid when it was sent can be refused when it is accepted, and the acceptance
screen has to say so in terms the invited person can act on: free a seat or upgrade, then accept
again. That is the honest failure, and it is the one this decision buys.

Nothing meters seats until a plan resolver replaces the unmetered binding, so the 423 path is reachable
only in tests today. That is deliberate, and it is why the path is tested rather than deferred — the
rule is built and covered now, and turning it on later is a container binding rather than a change to
acceptance.
