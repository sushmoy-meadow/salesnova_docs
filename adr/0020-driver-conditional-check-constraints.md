# ADR-0020 — A multi-column CHECK is written per driver: a constraint on Postgres, a trigger pair on SQLite

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

A lead must carry at least one of `email`, `phone_e164` or `whatsapp_e164`, and the requirement is
explicit that the database enforces it rather than validation alone — the write paths that matter
are the ones that skip the application: a CSV import, a console session, a future bulk job.

Three facts made this harder than adding one line to a migration.

`Blueprint` has no `check()`. The only CHECK the schema builder emits is the single-column
membership test inside `typeEnum`, which cannot express an `OR` across three columns.
No installed package adds one.

SQLite accepts a CHECK **only inside the original `CREATE TABLE`**. `ALTER TABLE … ADD CONSTRAINT`
is not in its grammar. So `Schema::create` followed by an `ALTER TABLE` works on Postgres and fails
outright on SQLite — which is the driver the tests run on, and therefore the only place the rule
would actually be exercised.

The framework-shaped alternative — a model event, an observer, a `saving` hook — is precisely what
the requirement excludes. Every one of them is bypassed by `DB::insert`, by `php artisan db`, by a
psql session. On the test driver the choice was between a trigger and nothing.

## Decision

**Both forms are derived from one column list inside the migration, and the driver picks which one
is emitted.**

- Postgres and anything else: `alter table leads add constraint leads_contactable_check check
  (email is not null or phone_e164 is not null or whatsapp_e164 is not null)`.
- SQLite: `leads_contactable_on_insert` and `leads_contactable_on_update`, each a `before` trigger
  whose `when` clause is the De Morgan negation of the same list, raising `abort`.

The two conditions are built by the same loop over `['email', 'phone_e164', 'whatsapp_e164']`, so a
fourth contact column changes both or neither. The statements are issued through
`Schema::getConnection()->statement(…)` rather than the `DB` facade, so the guard provably lands on
the connection that received the table.

Tests assert on the exception class (`QueryException`) and on the resulting row state, never on the
message text — Postgres reports SQLSTATE 23514 and SQLite reports 23000 with entirely different
wording, and one test file has to cover both.

`down()` needs nothing extra: `DROP TABLE` takes the table's triggers with it on SQLite and its
constraints on Postgres.

## Consequences

- **A later migration that alters `leads` can silently remove the guard on SQLite.**
  `SQLiteGrammar::compileAlter` implements `change`, `primary`, `dropPrimary`, `foreign` and
  `dropForeign` by rebuilding the table — create `__temp__leads`, copy, drop, rename — and
  reconstructs it from introspection, which does not carry the triggers across. An inline CHECK
  would be lost to the same rebuild, so this is a property of the driver rather than an argument
  against triggers. Two mitigations, both required: the contactability test runs against the
  migrated schema on every run, so a rebuild that drops the guard turns the suite red; and **a
  migration that alters `leads` in a way SQLite implements as a rebuild must re-assert the
  triggers.** The integrations task will hit this when it adds the foreign key for
  `integration_connection_id`.
- The Postgres branch is not executed anywhere. The suite runs on SQLite, so the `ALTER TABLE` line
  is covered by review only. A Postgres leg in CI would close that, and needs no `phpunit.xml`
  change — PHPUnit's non-forced `<env>` yields to a real environment variable, so
  `DB_CONNECTION=pgsql php artisan test` already selects it.
- Enum-valued columns stay `string(n)` with a PHP backed enum cast. `$table->enum()` compiles to a
  real CHECK on both drivers, which would make adding one source value a SQLite table rebuild, and
  a rebuild is the thing that drops the guard.
- Every future multi-column invariant inherits this shape. It is more code than a one-liner, and
  the alternative is an invariant that holds in production and not under test.

## Alternatives

- **Raw `CREATE TABLE` for the whole table.** Loses `foreignUuid()->constrained()`, `->comment()`
  and portable column types, and needs per-driver column SQL — it creates the two-code-path problem
  it was meant to avoid, across twenty-six columns instead of one constraint.
- **Smuggle a table constraint into `CREATE TABLE` through `Blueprint::rawColumn()`**, appending
  `constraint leads_contactable check (…)` to an unrelated column's definition. This does work on
  both drivers from a single line. It hides a load-bearing invariant inside the definition of a
  column that has nothing to do with it, forces that column's type to be hand-written per driver,
  and disappears without a sound the first time someone tidies the line back to
  `$table->softDeletes()`. The cleverest option and the worst one to inherit.
- **Enforce it in the application only.** What the requirement rules out, and the failure is silent:
  the row that gets written without a contact method is written by the code path that skipped the
  model.
- **Skip enforcement on SQLite and rely on Postgres.** The rule would then be untested everywhere it
  is enforced and unenforced everywhere it is tested.
