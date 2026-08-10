# TASK-AUTH-011 — open points

All three acceptance criteria are tested. These are things the task's description touches that this
build deliberately left to the task that owns them.

## The invitation link is never sent anywhere

`issue()` and `resend()` mint a plaintext token and return it on `IssuedInvitationDTO`; the stored row
keeps only the hash. Nothing carries it to the invited address — there is no mail transport in this
repo yet, and dispatch has to be a queued job rather than something the HTTP request waits on.

**Closed by** TASK-AUTH-007 (@sakib), which owns queued delivery for the signup code and is the
natural home for this one. The seam it needs is the returned plaintext, which is the only place the
token exists in the clear.

## Nothing meters seats yet

`SeatLimitResolver` is bound to `UnmeteredSeatLimitResolver`, which answers `null` for every
organisation, so `SEAT_LIMIT_REACHED` is reachable only under a test that swaps the binding. The rule,
the guard and the 423 are built and covered; what is missing is a plan to read a number from.

**Closed by** TASK-BILL-001 (unclaimed) for the subscription schema, and then a resolver reading the
active subscription's seat count. Enabling it is one container binding — see ADR-0046 for why the
default deliberately does not fail closed.

## Reactivation is not in the route contract the frontend was given

`POST /api/v1/members/{membership}/reactivate` is new here. The generated OpenAPI document and the
TypeScript types carry it, but no frontend task named it, so the team screen has no button for it yet.

**Closed by** whichever frontend task builds the deactivated-member row. Nothing is needed on this side.
