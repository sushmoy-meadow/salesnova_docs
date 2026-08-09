# ADR-0021 — `audit_log` is the compliance record, `activity_log` is model-change history, and no event goes to both

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`spatie/laravel-activitylog` is a required company package
([bible](../meadowkart_backend_architecture_bible_by_claude.md) §22) and its `activity_log` table is
already migrated in this repo. The obvious move is to make it the audit trail and write nothing new.
It does not survive contact with SN-SEC-010 and SN-SEC-016.

`activity_log` is `bigIncrements('id')`, `log_name`, `description`, `nullableMorphs('subject')`,
`nullableMorphs('causer')`, `json('properties')`, `timestamps()`, one index on `log_name`. Against
what the audit trail is required to be:

| Required | `activity_log` |
|---|---|
| `organization_id`, leading every composite index (SN-ARCH-020) | Absent. No tenant column at all, so a tenant's trail cannot be indexed, scoped or served without scanning every row in the table. |
| `impersonator_membership_id` (SN-SEC-010, F15 §3) | Absent. `causer` is one morph; agency staff acting inside a client org would be recorded as the client. |
| Append-only, "not editable or deletable through any interface, including admin" | No guarantee. The package's own `activitylog:clean` command deletes rows, which is the opposite requirement. |
| 2-year retention | No concept of one. |
| `before` / `after` as separate columns | Both live inside `properties`, by whatever convention the calling model chose. |
| UUIDv7 keys, no sequential integers (SN-ARCH-106) | `bigIncrements`, which also leaks volume across tenants. |

Adding those columns means editing a published package's migrations, and the package's own writer
(`LogsActivity`) would not populate them. That is a fork wearing a dependency's name — the worst of
both, because the next `composer update` has an opinion about it.

## Decision

**Both tables stay, with a split that is decided per action rather than per model.**

- `audit_log` is the **compliance record**. It holds the actions SN-SEC-016 makes mandatory, and
  those only. It is tenant-scoped, immutable at the database level (ADR-0022) and retained.
- `activity_log` stays for **low-stakes model-change history** — the "who last touched this record"
  affordance, on models where a diff is convenient and nothing turns on it.

**An event is written to exactly one of them.** The action set below is the boundary: an event whose
action appears in `App\Enums\Security\AuditAction` goes to `audit_log` and is not also logged
through `LogsActivity`. Everything else goes to `activity_log` and never to `audit_log`.

### Write points

One row per case of `AuditAction`. Eight requirements become eleven actions: impersonation and both
connect/disconnect pairs are two write points each, because a trail that cannot answer *when did
this end* is not evidence.

| Action | Written when | `resource_type` | Table |
|---|---|---|---|
| `PERMISSION_CHANGED` | A membership's capability grid is edited, or its role preset is changed | `membership` | `audit_log` |
| `MEMBER_STATUS_CHANGED` | A membership moves between invited, active and deactivated | `membership` | `audit_log` |
| `IMPERSONATION_STARTED` | Agency or support staff begin acting as a member of another organization | `membership` | `audit_log` |
| `IMPERSONATION_ENDED` | That session is ended or expires | `membership` | `audit_log` |
| `BILLING_CHANGED` | Plan, seat count, payment method or subscription state changes, whether driven by a member or by a provider webhook | `subscription` | `audit_log` |
| `DATA_EXPORTED` | An export is produced — leads, contacts, reports, anything leaving the tenant as a file | `export` | `audit_log` |
| `INTEGRATION_CONNECTED` | An integration connection is authorised | `integration_connection` | `audit_log` |
| `INTEGRATION_DISCONNECTED` | An integration connection is revoked, by a member or by the provider | `integration_connection` | `audit_log` |
| `BULK_DELETED` | A delete acting on a set rather than one record | the deleted type, e.g. `lead` | `audit_log` |
| `WHATSAPP_CONNECTED` | A WhatsApp number is linked to the organization | `whatsapp_account` | `audit_log` |
| `WHATSAPP_DISCONNECTED` | That number is unlinked, or the provider drops it | `whatsapp_account` | `audit_log` |

`resource_id` is null for `DATA_EXPORTED` and `BULK_DELETED` until the export or the batch has an id
of its own — an action on a set has no single subject, and inventing one would be worse than the
null.

### Known, and deliberately not cased yet

SN-SEC-010 and SN-SEC-016 list overlapping but unequal sets. SN-SEC-010 adds two write points and
words a third differently:

- **Settings changes** — a future `SETTINGS_CHANGED`. Not cased now because "settings" has no
  boundary yet; branding, org profile and notification preferences are three different tables, and
  a single case covering all of them would be a label rather than an action.
- **Login from a new device** — a future `LOGIN_FROM_NEW_DEVICE`. Not cased now because there is no
  device identity to compare against; it depends on session and device-fingerprint work that has not
  landed.
- **"Deletions" vs "bulk delete"** — SN-SEC-010 says deletions, SN-SEC-016 says bulk delete. The
  narrower reading ships. Auditing every single-record delete would put the compliance record on the
  hot path of ordinary CRUD, which is a volume decision nobody has taken.

Adding any of these is additive and safe. It requires a new case, a new row in the table above, and
a deliberate edit to the transcription in `tests/Unit/AuditActionTest.php`, which fails until all
three agree.

## Consequences

- **Any domain adding `LogsActivity` to a model checks its events against `AuditAction` first.** If
  an event is in that set, the model does not log it through the package; the audit writer records
  it instead.
- **`AuditLog` itself never uses `LogsActivity`.** The compliance record logging its own creation to
  the low-stakes table is precisely the double write this decision forbids, and it is asserted in
  `tests/Feature/Security/AuditActivityLogSplitTest.php`.
- **The "exactly one table" invariant is checked within a file, and not across files.** It cannot be
  checked at runtime yet: no audit writer exists and no model uses `LogsActivity`, so a scan of an
  empty `activity_log` for audit action values passes vacuously and would be false assurance. The
  rule is therefore asserted about the code — `tests/Unit/ArchitectureTest.php` fails any file under
  `app/` that names `AuditAction` and either adds `LogsActivity` or calls the package's `activity()`
  helper. It reads the files as text rather than loading the classes, because `LogsActivity` declares
  an abstract `getActivitylogOptions()` and a model that adds the trait without implementing it
  fatals on load.
- **What that check does not catch is the shape the violation is most likely to take.** The
  architecture puts a model in one file and whatever writes the audit entry in another, so a
  `LogsActivity` model plus an `AuditLog` write elsewhere passes green — and so does an audit write
  that spells the action as a string literal rather than naming the enum. Neither is decidable from
  one file. So the invariant is a review obligation with a partial backstop under it, not an enforced
  rule, and the first consequence below is where the weight actually sits. The check that would make
  it enforced is a runtime one — no `activity_log` row carrying an action `audit_log` also holds —
  and it becomes worth writing the moment the first writer lands.
- What is also asserted is structural: the two tables are incapable of being each other, because one
  carries `organization_id` and `impersonator_membership_id` and the other does not.
- `activity_log` keeps its `bigIncrements` key and its lack of a tenant column. That is acceptable
  precisely because nothing compliance-bearing lives there; it is a convenience log, and it is
  written down here so that nobody promotes it later on the grounds that it was already available.
- Two tables mean two things to look at when reconstructing what happened. The alternative is one
  table that satisfies neither purpose properly.

## Alternatives

- **Fork the package's migrations and add the columns.** Carries the maintenance cost of a fork with
  none of the ownership: `LogsActivity` still would not populate `organization_id` or
  `impersonator_membership_id`, so every model would need an override, and each package upgrade is a
  merge.
- **Drop the package and use `audit_log` for everything.** The package is a company standard, and
  the compliance table would then absorb every idle field change — inflating a 2-year immutable
  table with data nobody is required to keep and cannot delete.
- **Write both, and treat `activity_log` as a searchable mirror.** Two records of one event that can
  disagree; the immutable one cannot be corrected when they do. This is the outcome criterion 4
  exists to prevent.
- **A `source` column on one shared table.** Immutability is table-wide — either the convenience log
  becomes undeletable, or the compliance record becomes deletable. There is no per-row form of the
  guarantee.
