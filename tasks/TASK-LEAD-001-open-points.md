# TASK-LEAD-001 — open points

Written 2026-08-03. The task is **`done`**: gate green, no blocking review findings. Acceptance
criterion 1 was closed on a partial verification — see §0. Nothing is committed. Delete this file
once §0 and §1 are closed.

---

## 0. Criterion 1 was closed on a partial verification

> A raw INSERT bypassing application code with all three contact fields null is rejected by the
> database.

**Proven, on SQLite.** The migration creates `leads_contactable_on_insert` and
`leads_contactable_on_update`, each aborting when all three contact columns are null. A prepared
statement issued directly on the PDO handle — no query builder, no model, no events — raised
SQLSTATE 23000 and left the table empty. Narrowing the trigger loop to `insert` only, and flipping
the negation join from `and` to `or`, both fail the suite.

**Not proven.** The Postgres branch — `alter table leads add constraint leads_contactable_check` —
has never executed. `phpunit.xml` pins `:memory:` SQLite, `.env.example` is SQLite, and `pgsql`
appears nowhere in the repository outside `config/database.php`. Production runs the branch nobody
has run. The two forms are derived from one column list and were read side by side, but that is
review evidence, not execution evidence.

**What closes it:** a PostgreSQL leg in CI. It needs no `phpunit.xml` change — PHPUnit's
non-forced `<env>` yields to a real environment variable, so `DB_CONNECTION=pgsql php artisan test
tests/Feature/Leads` already selects it. That was cut from this task's scope deliberately:
`CLAUDE.md` states `composer gate` is the same set `.github/workflows/ci.yml` runs, and a
Postgres-only job breaks that invariant, so it is a decision about CI rather than about leads.

Closing this criterion here was a deliberate call by the developer, not evidence.

---

## 1. Still open: the guard is null-only, not contactability

`'' is not null` on both drivers, so a row whose three contact columns are empty strings satisfies
the constraint while being exactly the thing the requirement forbids — a lead nobody can contact.
CSV import is the realistic path: a blank cell maps to `''` unless something upstream coerces it.

Not fixed here because it is a design decision with more than one defensible answer — coerce empty
to null at the boundary, widen the constraint to `nullif(trim(col), '') is not null`, or both. The
boundary is `TASK-LEAD-007`'s (parsing and validation) and the bulk path is `TASK-DATA-003`'s.
Whichever takes it should also decide whether the DB constraint widens, since the point of the
constraint is that it holds when the boundary is bypassed.

---

## 2. Review warnings carried forward, none blocking

| Where | What |
|---|---|
| `database/migrations/2026_08_03_100500_create_leads_table.php:45` | `source_summary` is nullable; the domain-model table marks it NOT NULL and it is not among the six declared nullability deviations. Undeclared. |
| `database/migrations/2026_08_03_100500_create_leads_table.php:48` | `is_new` has no `->comment()`, unlike every sibling boolean here, and it is the column encoding the lead/client split. |
| `database/factories/Leads/LeadFactory.php:35` | The default copies `phone_e164` into `whatsapp_e164` and sets `whatsapp_inferred = true` — the output of the inference service `TASK-LEAD-007` will build. A test of that service would start from its own expected result, and `phoneOnly()` produces a lead that still has WhatsApp. |
| `tests/Feature/Leads/LeadSchemaTest.php:13` | The FK-index assertion is a verbatim copy of `tests/Feature/Auth/OrganizationSchemaTest.php:16`. That file's `dataset('tenant tables', …)` is hardcoded and should discover tables the way `TenantIndexLeadingColumnTest` already does; `'leads'` then belongs in the dataset rather than in a second copy. |
| `docs/adr/0018-lowercased-identity-values.md:41` | The column list still names three columns. `leads.email` is the fourth, which is the ADR's own stated trigger to revisit the shared-trait alternative it rejected at three. An accepted ADR is immutable, so this is a new ADR, not an edit. |
| `database/migrations/2026_08_03_100500_create_leads_table.php:101` | Four lines of inline rationale where `docs/adr/0020` already carries the argument. |

---

## 3. Decided during the run

- **The contactability rule is driver-conditional**, and `docs/adr/0020` records why: Laravel 13's
  `Blueprint` has no `check()`, and SQLite accepts a `CHECK` only inside the original
  `CREATE TABLE`. An observer or a `saving` hook is what the criterion explicitly forbids, so the
  choice was a trigger or nothing on the test driver.
- **A later migration that alters `leads` will silently drop both triggers.**
  `SQLiteGrammar::compileAlter` rebuilds the table for `change`/`primary`/`foreign`/`dropForeign`
  and does not carry triggers across. `TASK-INTG-001`, adding the `integration_connection_id`
  foreign key, is the first that will hit this and must re-assert them. The only thing enforcing
  the rule is the contactability test going red.
- **`leads.email` inherits ADR-0018.** The duplicate-*account* failure mode does not apply — there
  is no unique index, and there must not be one, because the default duplicate policy is
  flag-for-review. The mutator is `?string`-typed; the two existing ones are `string` and would
  fatal on a null email.
- **The three contact indexes are deliberately not unique**, for the same reason.
- **`timestamptz` renders as `timestamp()`**, matching every existing migration. A project-wide
  move to `timestampTz()` is its own change.
- **`jsonb` is not byte-verbatim on Postgres** — it normalises whitespace, drops key order and
  de-duplicates keys. `source_payload` is the structured queryable copy; byte-level raw retention
  belongs to the inbound-event ingestion log (`TASK-ARCH-016`).

---

## 4. State

- 177 tests, 438 assertions, `composer gate` exits 0.
- 17 tests added across four files under `tests/Feature/Leads/`.
- Criterion 2 `VERIFIED` with mutation evidence: changing the column to `string(…, 255)` leaves the
  megabyte round-trip passing on SQLite and fails only the declared-type assertion, which is the
  silent-truncation trap that assertion exists to catch.
- Criterion 1 closed per §0.
- Nothing committed. `tasks.json` moved only through the CLI.
