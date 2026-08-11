# TASK-AUTH-009 — open points

Both acceptance criteria have tests behind them in
`salesnova_backend/tests/Feature/Auth/MagicLinkTest.php`. What follows is what the task's description
reaches past this layer, and the decisions that should be argued rather than inherited.

## Nothing calls the withdrawal yet

`MagicLinkService::revokeFor($resourceType, $resourceId, $now)` is what makes the second criterion
true, and the test drives it directly. No production code calls it, because no resource a link can
name is revocable in the tree yet: shared content, invitations, unsubscribes and lead claims are all
later features.

Each of them owns one call, at the point it withdraws its resource — a share revoked, an invitation
cancelled, a lead deleted. Until then a link outlives its resource until it expires, which is seven
days at worst. What would close this is a line in each of those features' delete and revoke paths,
and a test there that resolving afterwards is refused.

The alternative considered and rejected was a registry that resolves each `resource_type` to a lookup
and asks, at resolution time, whether the resource is still live. That is the more robust shape and
it is worth revisiting once three resource types exist; with none, it would have been an abstraction
with one entry and no second caller.

## Every use is recorded, but only the most recent one survives

`used_at`, `ip_address` and `user_agent` are written on the link row on every successful resolution,
which is what the columns are for. A link that may be used more than once — shared content, an
unsubscribe — therefore records its latest use and not its history.

`AuditLogger` cannot stand in for a trail here: it takes an organisation id and an actor membership
id, and a link scoped to a resource has neither. Closing this means either a `magic_link_uses` table,
or widening the audit contract so an entry can be written without an organisation. The second is the
larger decision and belongs with whoever owns the audit surface, not here.

## Issuing has no route

Everything above is reachable from a service. There is no endpoint that mints a link, because there
is nothing to mint one for: the four actions the enum names are all owned by features that do not
exist. `POST /auth/magic-link/verify` is the only route this task lights up.

That is deliberate rather than missing — a mint endpoint with no caller would have to invent who is
allowed to call it and against what, which is a per-feature question. Each feature mints through the
service from its own controller.

## The expiry the requirement writes may be wrong for unsubscribe

Seven days is the default the requirement gives, and it is what an unsubscribe link gets here. An
unsubscribe link sits in the footer of a message that stays in an inbox for years, so in practice it
will be clicked long after it lapses and the person will land on a refusal.

This task does not overrule the requirement. What would settle it is either an action-specific expiry
long enough to be honest, or a separate unauthenticated unsubscribe path that does not expire at all
— which is what most senders do, and which is a messaging decision rather than an auth one.

## The link is not tied to who opened it

A magic link is a bearer credential: anybody holding the token gets the resource. There is no check
that the address it was sent to is the one presenting it, and nothing binds a link to a device or a
session.

That is what a magic link is, and the scope is the mitigation — the grant is one action against one
resource, so a forwarded link costs that and no more. If a future action needs more than that, the
answer is a second factor at resolution, not a wider link.
