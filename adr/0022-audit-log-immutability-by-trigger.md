# ADR-0022 — `audit_log` immutability is enforced by a trigger, not by a privilege revoke, and retention lifts that trigger under a role the application does not hold

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

SN-SEC-010 requires the audit trail to be **append-only and "not editable or deletable through any
interface, including admin"**, and retained for two years. SN-SEC-016 repeats the immutability
requirement for `audit_log` specifically.

TASK-SEC-001's description offered two mechanisms as equals: revoke `UPDATE`/`DELETE` from the
application's database role, or a `BEFORE UPDATE`/`DELETE` trigger that raises. They are not equal
here.

**A revoke cannot be written portably in a migration.** SQLite has no `GRANT`/`REVOKE` grammar at
all, and SQLite is the driver the test suite runs on — so the requirement would be unenforced
everywhere it is tested and untested everywhere it is enforced, which ADR-0020 already rejected for
the contactability rule. On Postgres the migration has no portable way to name the application role.
And the application owns the table it created: an owner's privileges are implicit and
self-re-grantable, so revoking from it is a speed bump rather than a control, and a superuser
bypasses it outright. `php artisan db`, a `psql` session as the owner, and the next migration would
all still be free to `UPDATE`.

A model event, an observer or a `saving` hook fails the requirement for the same reason it did in
ADR-0020: every one of them is bypassed by `DB::update`, by the query builder's mass update, by a
console session.

## Decision

**A driver-conditional trigger, following ADR-0020's shape**, in `App\Support\Security\AuditLogGuard`
and called at the end of the migration's `up()`. It branches on the driver and issues statements
through the `Illuminate\Database\Connection` it is handed, so the guard provably lands on the
connection that received the table.

The DDL sits in a class rather than in a private method on the migration because retention (below)
has to lift the guard and put it back, and a second copy of the same statements in the prune command
would drift from the first the moment either changed. The class is four static methods with no state
of their own — `apply`, `suspend`, `restore`, `remove` — so it is safe on a reused Octane worker and
HTTP-unaware.

- **Postgres and anything else:** a `plpgsql` function `audit_log_immutable()` that raises with
  SQLSTATE 23514, wired to two triggers — `before update or delete … for each row`, and **`before
  truncate … for each statement`**. The second is not optional. A row-level trigger never fires for
  `TRUNCATE`, and `TRUNCATE` is the one statement that destroys the whole trail at once; `BEFORE
  TRUNCATE` is only accepted at statement level.
- **SQLite:** `audit_log_immutable_on_update` and `audit_log_immutable_on_delete`, each a `before`
  row trigger calling `raise(abort, …)`. SQLite has no `TRUNCATE`, and although an unqualified
  `delete from audit_log` normally takes the truncate optimisation and skips row triggers, that
  optimisation is disabled on any table that has a delete trigger — so the guard holds. There is a
  test that asserts exactly this.

The function is created with `create or replace`: `migrate:fresh` drops tables without calling
`down()`, which would otherwise leave the function behind and fail the next `create function`.

**`down()` needs more than ADR-0020's did.** `Schema::dropIfExists` takes the triggers on both
drivers, but the Postgres function is a `pg_proc` object in its own right and survives the table, so
`down()` drops it explicitly on the non-SQLite branch.

**The Eloquent model guards too, and this is not redundant.** The trigger is the authority, but a
model that silently offered `save()` would hand the developer a raw `QueryException` with no
catalogue code and no envelope. `AuditLog::booted()` registers `updating` and `deleting` listeners
that throw `ApiException` — the same shape as `Membership::booted()`. `updating` rather than
`saving`, so inserts still work. Both layers are covered by tests that fail independently: removing
the trigger reddens the raw-SQL tests and leaves the model tests green, and removing the model guard
does the reverse.

**Foreign keys are `restrictOnDelete` on all three membership and organization references, and that
is load-bearing.** `cascadeOnDelete` would delete the evidence when the subject of the evidence is
removed — and it collides with the guard, because the cascade issues a `DELETE` that the trigger
raises on, aborting the parent delete while naming the wrong table. `nullOnDelete` would keep the
row and erase *who*, and a row saying *somebody* changed permissions is not an audit record.

**`actor_membership_id` is `NOT NULL`.** SN-SEC-016 annotates exactly one column nullable
(`impersonator_membership_id`), so the omission elsewhere reads as deliberate. This leaves one open
question, recorded rather than resolved: **a provider webhook driving a `BILLING_CHANGED` has no
membership actor.** The answer is either a system membership per organization or a separate actor
column, decided at the writer — not a nullable evidence field. Widening the column later is a SQLite
table rebuild, which is the thing that drops the guard (below), so this has to be a decision rather
than a default.

## Consequences

- **A later migration that alters `audit_log` can silently remove the guard on SQLite.**
  `SQLiteGrammar::compileAlter` implements `change`, `primary`, `dropPrimary`, `foreign` and
  `dropForeign` by rebuilding the table from introspection, which does not carry triggers across.
  Two mitigations, both required: the immutability tests run against the migrated schema on every
  run, so a rebuild that drops the guard turns the suite red; and **a migration that alters
  `audit_log` in a way SQLite implements as a rebuild must re-assert the triggers.** Adding a column
  is safe — `add` is not one of the rebuild paths.
- **`action` is `string(64)` with a driver-conditional rule beside it, not `$table->enum()`.**
  SN-ARCH-106 asks for a `varchar` plus a `CHECK` backed by a PHP enum, and the column carries all
  three. The rule follows ADR-0020's shape: `alter table … add constraint audit_log_action_check` on
  Postgres, and a `before insert` trigger raising `raise(abort, …)` on SQLite. Insert only, where
  `leads` needs an update trigger as well — every update to this table is refused outright, so a
  second trigger would be unreachable.

  An earlier revision of this ADR declined the constraint altogether, on the grounds that
  `$table->enum()` compiles to a CHECK that a later action would have to `change`, and `change` is
  one of the paths `SQLiteGrammar::compileAlter` implements by rebuilding the table — which drops
  the immutability triggers. That is a correct argument against `$table->enum()` and no argument at
  all against the raw idiom this repo already uses, which was the option actually available. A
  twelfth action arrives as a migration that drops the constraint or the trigger and re-adds it with
  the wider list, and neither of those is a rebuild path.

  The permitted names are written out in the migration rather than read from `AuditAction`: a
  migration whose shape changes when a later commit edits an enum produces one table on a fresh
  database and a different one on an existing database. Two tests hold the copies together — the
  database refuses an action the enum does not name, and accepts every action it does.
- **Both branches now run in CI, and getting there required editing a committed migration.**
  ADR-0020 recorded the standing close as "a Postgres leg in CI needs no `phpunit.xml` change,
  because PHPUnit's non-forced `<env>` yields to a real environment variable". The first half was
  true; the conclusion was not, because `DB_CONNECTION=pgsql php artisan test` failed during
  migration before any test ran. `2026_08_03_100100_create_memberships_table.php` declared a
  self-referencing foreign key (`invited_by_membership_id` → `memberships.id`) on a table whose
  primary key comes from the `uuid('id')->primary()` column modifier. Laravel emits that primary key
  as an `ALTER TABLE` *after* the foreign key commands, so Postgres rejected the constraint with
  SQLSTATE 42830, "there is no unique constraint matching given keys". SQLite never saw it because
  its foreign key is inline in `CREATE TABLE`. Every migration that references `memberships` was
  downstream of this, `audit_log` included.

  That migration was amended rather than superseded by a new one — normally the wrong move, and
  correct here because it had never successfully run on Postgres, so there was no deployed state to
  stay compatible with. It now declares the column inside `Schema::create` and adds the constraint
  in a following `Schema::table` call, which is the idiom
  `2026_08_03_100300_add_owner_membership_foreign_key_to_organizations_table.php` already used for
  the same problem. The SQLite schema is unchanged.

  With that fixed, `.github/workflows/ci.yml` runs the suite twice: once on SQLite and once against
  a `postgres:16` service container. The second run is what keeps the `plpgsql` function, the two
  triggers, the `TRUNCATE` case and the privilege separation from decaying unobserved.
- **Retention is a scheduled prune that runs as a different role from the application's, and that
  role split is what reconciles it with immutability.** `config/audit.php` holds `retention_days`
  (730, from `AUDIT_LOG_RETENTION_DAYS`); `App\Console\Commands\PruneAuditLog` deletes entries whose
  `occurred_at` is older than the window; `routes/console.php` schedules it daily.

  The prune has to delete, and the guard exists to stop deletes. Resolving that by having the
  command suspend the trigger on the application's own connection would demonstrate that the
  application can remove audit rows, which is exactly what the requirement forbids. So the command
  runs over `config('database.maintenance')` — a connection naming a role that owns `audit_log`,
  distinct from the one the API connects as.

  **The fallback to the default connection is refused wherever a second role is possible.** An unset
  `database.maintenance` used to collapse onto the application's own connection, which made the
  unconfigured case — the default, and what CI ran — the one case where the guard is lifted on
  precisely the connection the criterion says must not be able to delete. On any driver with roles
  the command now fails, naming `DB_MAINTENANCE_CONNECTION`. SQLite has no roles at all, so it is
  the one driver where the fallback is the only thing that can work, and there it is kept.

  **What the command compares is the login role, not the connection.** It issues `select
  current_user` on the maintenance connection and on the application's and refuses when they match.
  An earlier revision tested the resolved `Connection` objects for identity, which two connection
  entries defeat by naming the same credentials — `DB_MAINTENANCE_CONNECTION=pgsql_maintenance` with
  `DB_MAINTENANCE_USERNAME` left equal to `DB_USERNAME` produced a second object, the same role, and
  a prune that lifted the guard on exactly the role the requirement forbids. That is the same
  silent-misconfiguration shape as the `DB_URL` inheritance below, and it is closed the same way:
  by asking the server who it is talking to rather than trusting the configuration to differ.
  Comparing roles subsumes the identity case, since one connection resolves to one role.

  The suite therefore provisions a real second login role on Postgres — created outside the test's
  own transaction, granted membership of the role that owns `audit_log` so it can still lift the
  guard, and dropped afterwards — because a maintenance connection sharing the application's
  credentials is now exactly what the command refuses. The tests that need it skip on SQLite.

  **Suspend, delete and restore are one transaction, not a `finally`.** A `finally` covers a thrown
  exception and nothing else. A fatal error, an OOM kill, a lost connection or a `SIGKILL` between
  the three autocommitted statements left the triggers dropped on SQLite and disabled on Postgres,
  with nothing to detect it and nothing to re-apply it — a daily job able to silently disarm the
  audit trail is worse than no prune. Both drivers roll DDL back, so the transaction makes recovery
  the database's job rather than the process's. `tests/Feature/Security/AuditLogRetentionTest.php`
  stages the real failure on Postgres: a second process is caught inside the delete with the guard
  lifted, its backend is terminated, and `pg_trigger.tgenabled` is read afterwards. Under the
  `finally` the triggers stay disabled; under the transaction they come back. That file runs on
  migrations rather than a wrapping transaction — a second connection cannot open a transaction
  while the suite holds the handle inside another, and a delete that fails partway is only
  observable if there is no outer transaction for Postgres to abandon.

  **That transaction is bounded, because an unbounded one stalls the trail it protects.** The first
  revision wrapped a single `delete … where occurred_at < ?` over the whole expired set. On Postgres
  `alter table … disable trigger` takes SHARE ROW EXCLUSIVE, which conflicts with the ROW EXCLUSIVE
  every `INSERT` needs, and a transaction holds its locks until commit — so for the length of that
  delete no audit row could be written anywhere in the application, on a schedule, including the days
  it removed nothing. It also produced one WAL burst proportional to the entire expired set, pinned
  autovacuum behind a long-running transaction, and threw away all of its progress if the process
  died partway.

  The sweep is therefore a loop of bounded chunks, each its own transaction with its own
  suspend/restore, sized by `audit.prune_chunk` (`AUDIT_LOG_PRUNE_CHUNK`, default 5000). Every
  property the single transaction bought survives per chunk — an interrupted sweep still ends with
  the guard where it started — while the write stall drops from the length of the whole delete to the
  length of one chunk, and finished chunks stay finished. The chunk size is the dial between those
  two: smaller stalls the trail for less time and costs more transactions. A configured value below
  one is read as one, since a chunk of nothing deletes nothing and the loop, which stops on the first
  short chunk, would never get one.

  **The sweep has an index of its own.** It is the only query against `audit_log` that crosses
  tenants, so neither `(organization_id, occurred_at)` nor `(organization_id, resource_type,
  resource_id)` can serve it, and without a third index the daily prune scanned the whole table —
  growing for two years before it deleted anything. A plain btree on `occurred_at` serves both the
  range predicate and the chunk's `order by occurred_at limit n` without a sort. It is the cheapest
  btree insert pattern there is, because an append-only table with a monotonic timestamp only ever
  writes to the right edge of the index. A BRIN index would cost less still per insert and is worth
  revisiting if write volume ever justifies it, but it cannot serve the ordering, and it is a third
  driver-conditional branch for a table this size does not yet need.

  **The window has a floor the configuration cannot go under.** `AUDIT_LOG_RETENTION_DAYS` is read
  through a clamp of 730 days in the command rather than trusted; a typo there would otherwise
  delete evidence inside the required window, daily, with no way to get it back. The command clamps
  and warns rather than refusing to run, because a prune that declines leaves the table growing
  without bound over a mistake it can correct by itself. Lengthening the window is unclamped.

  **The schedule is `->daily()->withoutOverlapping()`.** Two app servers each running the scheduler
  would otherwise prune at the same moment, and every concurrent prune widens the window in which
  the guard is down.

  **Provisioning is a deployment step, not a migration.** A migration cannot portably create a role,
  and the role that runs migrations is the one that ends up owning what it creates. On Postgres:

  ```sql
  -- as a superuser, after migrating as the owner role
  create role salesnova_app login password '…';
  grant usage on schema public to salesnova_app;
  grant insert, select on audit_log to salesnova_app;
  ```

  `DB_USERNAME` then names `salesnova_app`, and `DB_MAINTENANCE_USERNAME` names the owner. Granting
  the application anything more than `INSERT` and `SELECT` on this table silently reopens every hole
  the trigger was built to close, because ownership carries the right to drop the trigger outright.

  **The maintenance connection reads `DB_MAINTENANCE_URL`, never `DB_URL`.** It inherited `DB_URL` at
  first, and `ConfigurationUrlParser::getPrimaryOptions` merges a URL's username and password over
  the ones spelled out beside it — so any environment configured the ordinary way for a managed
  Postgres, with one connection URL, made the maintenance connection log in as the *application* role
  and ignore `DB_MAINTENANCE_USERNAME` entirely. No error, no warning, and the whole split gone.
  Where `DB_URL` configures the application, the maintenance connection needs a URL of its own
  carrying the owner's credentials. Host, port and database still come from the `DB_*` variables, so
  a URL-configured deployment that forgets `DB_MAINTENANCE_URL` fails to connect rather than
  connecting as the wrong role.
  `tests/Feature/Security/AuditLogRoleSeparationTest.php` asserts the shape: a role holding only
  those two grants can append and read, and is refused `UPDATE`, `DELETE`, `TRUNCATE`, `ALTER TABLE
  … DISABLE TRIGGER`, `DROP TRIGGER` and `SET session_replication_role = 'replica'`.

  **Range-partitioning by month, expiring by detaching partitions, remains the better long-term
  route** and is not taken now. It is DDL rather than `DELETE`, so it never touches the guard at
  all. SN-ARCH-021 uses that pattern for `timeline_event`, `whatsapp_message` and `event` but does
  not list `audit_log`; partitioning it is a change to that requirement, not an implementation
  detail of this one. Until then the window during which the trigger is disabled — one `DELETE`, on
  a connection the API does not hold — is the residual cost, and it is real.
- **`AuditLogGuard::suspend` on Postgres disables the trigger for every session, not just its own.**
  `ALTER TABLE … DISABLE TRIGGER` is table-wide and takes an `ACCESS EXCLUSIVE` lock. The prune is a
  daily job over a small range and holds it briefly, but any future caller of `suspend` should know
  it is not a session-local switch.
- **The `impersonator_membership_id` cross-organization semantics are carried by a column comment
  and nothing else.** The column may point at a membership in a *different* organization than
  `organization_id` — agency staff reach a client org by impersonation, never by holding a
  membership there. No test can prove this until impersonation exists, and the shape most likely to
  be "fixed" by a well-meaning reader is a same-tenant assumption.

## Alternatives

- **`REVOKE UPDATE, DELETE` from the application role.** Rejected above: unwritable on SQLite,
  unportable in a migration, and toothless against the owner it would be revoking from.
- **Enforce it in the application only** — a model event, an observer, a repository that exposes no
  update path. Bypassed by the exact write paths the requirement names, and the failure is silent.
- **Grant the application `INSERT` and `SELECT` only, and let another role own the table.** Not an
  alternative in the end — it is the second half of the decision, adopted above. It supersedes
  nothing: the trigger stops the statement, and the grant stops the role from removing the trigger.
  Either one alone leaves a way through, which is why the criterion needs both.
- **No `TRUNCATE` trigger, on the grounds that nothing truncates in production.** One statement,
  entire trail gone, no error. The requirement says *any interface*.
