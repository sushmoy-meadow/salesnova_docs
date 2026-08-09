# ADR-0017 — UUID keys on org-scoped tables, bigint `users.id` until the auth schema task lands

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`04-domain-model.md` specifies uuid primary keys across the domain, `user` included. The shipped
`users` table is the Laravel starter one: `id` is an auto-incrementing bigint, and it already has
foreign keys pointing at it from `sessions` and `personal_access_tokens`, plus Spatie's polymorphic
`model_has_roles` / `model_has_permissions` rows keyed on `model_id`.

`TASK-AUTH-002` creates `organizations`, `memberships` and `invitations`. `memberships` must
reference a user. Reshaping `users.id` to a uuid is `TASK-AUTH-001`'s job — it has to migrate the
existing key, every referencing table, and the Spatie morph rows together, and it had not started
when this schema was written.

That left three columns' worth of choice and one column that could not be settled locally.

## Decision

**The three new tables get uuid primary keys. `memberships.user_id` stays a bigint foreign key to
`users.id` until the auth schema task converts it.**

Concretely:

- `organizations.id`, `memberships.id` and `invitations.id` are `uuid` primary keys, minted by
  Eloquent's `HasUuids` (time-ordered UUIDv7, so they index like sequential keys).
- Every reference *between* the new tables — `memberships.organization_id`,
  `memberships.invited_by_membership_id`, `invitations.organization_id`,
  `invitations.invited_by_membership_id`, `organizations.owner_membership_id`,
  `invitations.superseded_by_invitation_id` — is `uuid`.
- `memberships.user_id` alone is `foreignId` → `users.id` bigint.
- `App\Models\Users\User` does **not** get `HasUuids`. Adding it while the column is an
  auto-increment integer would mint uuids Eloquent then tries to write into an integer column.

## Consequences

- The seam is exactly one column in one table. The task that converts `users.id` changes
  `memberships.user_id` with it, in the same migration, and nothing else in this schema moves.
- Until that happens, a membership's key is a uuid and its user's key is an integer. Code that
  treats "an id" as uniformly one type will be wrong about one of them; the type declarations on
  the models are the guard.
- `users.password` stays `NOT NULL` for the same reason, so `UserProvisioningService` writes an
  unusable random value on create. That line disappears with the same task.
- New tables added before the conversion face the same choice and should make the same one — uuid
  everywhere, bigint only where it touches `users.id` — so the eventual conversion stays mechanical.

## Alternatives

- **Make `memberships.user_id` a uuid now and convert `users` in this task.** This is the auth
  schema task's whole scope, pulled into a task about organisations. It would have to migrate
  Sanctum tokens, sessions and Spatie's morph rows, and it would collide with that task when it
  lands.
- **Give the new tables bigint keys and convert them later.** Three tables and six cross-references
  to convert instead of one column, and organisation ids appear in share URLs, where a sequential
  integer leaks tenant count and invites enumeration.
- **Keep `user_id` unconstrained (no foreign key) to avoid the type coupling.** The database would
  stop catching orphaned memberships, which is the one referential rule that matters most here.
