# ADR-0018 — Identity values are lowercased on write, and query builders must repeat it

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

Email addresses and slugs arrive in whatever case their source used — typed into an invite form,
returned by an identity provider, pasted by an administrator. They identify one thing regardless,
so `Rep@Example.com` and `rep@example.com` must never resolve to two accounts.

The domain model reaches for Postgres `citext` for these columns. This project cannot: tests run on
`:memory:` SQLite, which has no `citext`, so a case-insensitive column would behave one way under
test and another in production — at precisely the point where being wrong creates duplicate people.
The portability mapping this project uses therefore renders `citext` as a plain `string` with a
unique index, and pushes normalisation into the application.

`TASK-AUTH-002` applied that faithfully to `invitations.email` and `organizations.slug`, and missed
`users.email`. The result was not a style inconsistency but a broken guarantee:
`UserProvisioningService` looked its user up by `Str::lower($email)` against a column nothing
lowercased, so an invitation addressed in a different case than the account was created in silently
minted a second account. The task's own acceptance criterion — an accepted invite for an existing
user's email creates a second membership row, *never* a second user row — failed. Nothing detected
it, because every test until then had used one casing throughout.

## Decision

**A column that carries an identity is lowercased on write by an `Attribute` mutator on its model,
and every query-builder comparison against such a column lowercases its argument explicitly.**

Both halves are load-bearing, and the second is the one that gets forgotten. A mutator runs on
`save`, `create` and `fill`; it does **not** run on `where`. A query builder writes SQL from the
value it is handed. So this is correct:

```php
User::query()->firstOrCreate(['email' => Str::lower($email)], [...]);
```

and dropping the `Str::lower` as redundant — because "the model already lowercases" — reintroduces
the exact defect above.

Columns under this rule today: `users.email`, `invitations.email`, `organizations.slug`.

## Consequences

- The unique index becomes effectively case-insensitive, because every write that reaches it has
  already been normalised. No functional index is needed.
- There are two things to remember per column, and only the first has any enforcement. A missing
  mutator is caught by a test if anyone writes one; a missing `Str::lower` in a `where` produces a
  silent miss that reads as "no such record" — which, for a `firstOrCreate`, means a duplicate.
- The rule protects nothing already stored. Adding a mutator does not rewrite existing rows. Doing
  this to a populated table needs a data migration and a duplicate-merge strategy first. It cost
  nothing here only because these tables have never been deployed.
- Comparisons in PHP can use `===` on values read back from the database, since everything stored is
  normalised. Values that have not been through the database cannot.
- Any future column holding an address, a handle, a slug or an external identifier inherits this,
  and inherits the failure mode with it.

## Alternatives

- **Postgres `citext`.** The correct answer if the test database matched production. It does not,
  and a correctness rule that only holds in production is worse than one that holds in both.
- **Normalise in the service layer only.** This is what was already happening, and it is what
  failed. It holds exactly until a second writer appears, and gives no signal when one does.
- **A `lower(email)` functional unique index.** Enforces uniqueness but does not normalise what is
  stored, so reads still return mixed case and every in-PHP comparison stays case-sensitive. It
  moves the bug rather than removing it.
- **A shared trait declaring `protected $lowercase = ['email']`.** Genuinely better than three
  hand-written mutators and worth doing if a fourth column appears. It does not touch the
  query-builder half, which is the half that actually broke, so it was not worth introducing an
  abstraction for on three columns.
