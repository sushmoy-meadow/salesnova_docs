# ADR-0067 — A magic link grants one action, and the action decides how long it lives

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-AUTH-060` asks for a link that reaches one named resource and nothing else, expiring in seven
days or in twenty-four hours where the action is sensitive, spent on first use where the action
changes state, dead as soon as the resource behind it is withdrawn, and logged with the address and
agent of every use. It is explicit that resolving one **must not** create a session — the note beside
it records a competitor answering the equivalent call with a `set-cookie`, which is a session grant
wearing a link's clothes.

The table `TASK-AUTH-004` left carries the scope as two free columns, `resource_type` and
`resource_id`, plus an `action`, unique together. So the schema already said one grant per resource
per action. What it did not say is who decides the expiry, who decides whether a use spends the link,
and what "withdrawn" looks like in a row.

## Decision

**The action is a closed enum and carries both policies.** `MagicLinkAction` answers
`expiresInHours()` and `isSingleUse()`. The server has to branch on the action to pick either one,
and the client has to branch on it to know which screen a resolved link opens, so it is a set both
sides must already ship — which is the test that separates an enum from data here, and is the same
test `ADR-0063` applied to onboarding screen keys and got the opposite answer to.

`resource_type` stays a free string beside it. Nothing branches on the type: resolution hands it back
and the caller knows what it asked for. A resource type is one column and one deploy away from every
module in the product, and closing that set would make each of them a change to auth.

**Unsubscribe changes state and is still not single-use.** The rule is that a state change spends the
link, and this is the one action where following it would be wrong: an unsubscribe link lives in the
footer of a message that stays in an inbox, and a second click has to land on the confirmation rather
than an error.

**Withdrawal is its own column.** `revoked_at` sits beside `used_at` and `expires_at` because the
three are different facts, and reusing the expiry to mean "withdrawn" would have made the row lie
about when the grant was meant to end. Withdrawing a resource withdraws every action granted against
it in one statement, so the links die with the resource rather than at their own expiry.

**Resolution answers the scope and nothing else.** Three fields — type, id, action. No token, no
cookie, no membership, nothing that would let the holder reach a second resource. A leaked link costs
the resource it names.

**A token that names nothing is a 404; one that was real and is no longer usable is a 410.** Spent,
lapsed and withdrawn are one answer between them, because which of the three it was is the sender's
business. The split between 404 and 410 is deliberate and is the opposite of the uniform 401 that
[ADR-0065](0065-the-refresh-chain-remembers-the-organisation-and-a-reuse-ends-the-family.md) argues
for on the refresh route: a refresh refusal is read by a client that can only retry or sign in, while
a dead link is read by a person who needs to know whether to ask for another one. The token is
sixty-four random characters, so the distinction tells a guesser nothing they could not already have
had.

**Issuing the same grant twice replaces the outstanding link.** The unique key leaves no room for two,
and the alternative — refusing the second — would make "resend the invitation" a failure. The
previous token stops resolving at that moment, because its digest is no longer in the row.

## Consequences

**Accepted.** Adding a fifth kind of link is a change to an enum in auth. That is the cost of the
client being able to branch on the action, and it is one line beside the feature that needed it.

**Accepted.** Every use overwrites `used_at`, `ip_address` and `user_agent` on the row, so a link that
may be used more than once records its most recent use and not its history. A trail of every use is a
second table, and nothing today reads one. The audit logger cannot stand in for it: it is keyed on an
organisation, and a link scoped to a resource does not know one.

**Open.** Nothing in the tree calls the withdrawal yet, because no resource a link can name is
revocable yet. Each feature that mints links owns the call at the point it withdraws its resource,
and until then a link outlives its resource until it expires.
