---
doc: 04-domain-model
status: REVIEW
owner: Engineering
audience: Backend, data, QA
depends_on: [02-product-scope]
---

# Domain Model & Database Schema

PostgreSQL 16+. Laravel 13 / Eloquent.

---

## 1. Conventions — read before any migration

### SN-ARCH-106 — Standard schema conventions apply to every table

Every table **MUST** follow the conventions below: UUIDv7 primary keys (no sequential integers),
`organization_id` on every tenant-scoped table enforced via a global scope (raw queries reviewed for
tenancy leaks), `timestamptz` UTC timestamps, `snake_case` naming, `varchar` + `CHECK` constraint
enums (never native Postgres enums), `numeric(14,4)` + `currency char(3)` for money, E.164 phone
storage, hard delete by default (soft delete only where explicitly specified), and `jsonb` (never
`json`) for every document column, documented at its point of use.

| Convention | Rule | Rationale |
|---|---|---|
| **Primary keys** | `uuid` using **UUIDv7**. No sequential integers anywhere. | Time-ordered so B-tree locality is good, but opaque so nothing leaks. Privyr's sequential IDs let any recipient infer their total business volume from two requests a day apart. |
| **Tenancy** | Every tenant-scoped table has `organization_id uuid NOT NULL` with an FK, and it is the **leading column** of every composite index. | Shared-schema multi-tenancy. Simplest to operate at our scale; schema-per-tenant buys isolation we don't need and costs migration pain we can't afford. |
| **Tenancy enforcement** | A global Eloquent scope applies `organization_id` automatically. Raw queries **MUST** be reviewed. | One forgotten `WHERE` is a cross-tenant data leak. This is the single highest-severity bug class in the product. |
| **Timestamps** | `timestamptz`, always UTC. `created_at`, `updated_at` on every table. | Never `timestamp without time zone`. Our users span IST, WIB, PHT, GST. |
| **Naming** | `snake_case`, singular table names, `_id` FK suffix, `is_`/`has_` boolean prefix. | |
| **Enums** | `varchar` + a `CHECK` constraint, backed by a PHP enum. **Not** native Postgres enums. | Native enums cannot have values removed and `ALTER TYPE` locks. We will change these. |
| **Money** | `numeric(14,4)` plus a `currency char(3)`. Never float. | |
| **Phone numbers** | `varchar(20)` in **E.164** plus `country_code char(2)`. | Privyr persists the full serialised libphonenumber struct. It is over-modelled and makes querying painful. Store E.164, derive the rest. |
| **Soft deletes** | Only where specified. Default is hard delete. | Blanket soft-delete makes uniqueness constraints and GDPR/DPDP erasure both harder. |
| **JSON** | `jsonb`, never `json`. Every `jsonb` column's shape is documented here. | Undocumented JSON becomes a schemaless dumping ground within two quarters. |
| **Audit** | `created_by_membership_id` on anything a human creates. | |

### 1.1 Standard columns

#### SN-ARCH-107 — Standard tenant-scoped column set

Every tenant-scoped table **MUST** carry `id` (UUIDv7 PK), `organization_id` (FK, `NOT NULL`,
`ON DELETE CASCADE`), `created_at`, and `updated_at` (both `timestamptz`, default `now()`), as
shown below.

Every tenant-scoped table:

```sql
id                uuid        PRIMARY KEY DEFAULT uuidv7(),
organization_id   uuid        NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
created_at        timestamptz NOT NULL DEFAULT now(),
updated_at        timestamptz NOT NULL DEFAULT now()
```

---

## 2. Entity map

#### SN-ARCH-108 — Entity relationship map

The entity map below is the authoritative cross-domain relationship graph; every FK relationship
it depicts (lead → its child entities, organization → its owned domains, `event`/`audit_log` as
cross-cutting sinks) **MUST** be preserved by any schema change.

```
                             ┌──────────────┐
                             │     user     │  global identity
                             └──────┬───────┘
                                    │
┌───────────────┐            ┌──────┴───────┐         ┌──────────┐
│ organization  │──────────< │  membership  │ >───────│ subteam  │
└───────┬───────┘            └──────┬───────┘         └──────────┘
        │                           │
        │                    capabilities (jsonb)
        │
        ├──< lead ──┬──< lead_group_link >── lead_group
        │           ├──< custom_field_value >── custom_field_definition
        │           │        └──< custom_field_value_history      (time-in-stage)
        │           ├──< timeline_event ──< timeline_attachment
        │           ├──< follow_up
        │           ├──< sequence_enrolment ──< sequence_step_state
        │           ├──< content_share ──< content_view
        │           └──< whatsapp_conversation ──< whatsapp_message
        │
        ├──< content ──┬── content_message | content_file | content_page
        │              ├──< content_label_link >── content_label
        │              └──< content_folder_item >── content_folder
        │
        ├──< sequence ──< sequence_step
        ├──< automation_rule ──< rule_condition
        │                    └──< distribution_state / distribution_log
        ├──< integration_connection ──< external_lead_form
        ├──< lead_form ──< lead_form_field
        ├──< whatsapp_account ──┬──< whatsapp_template
        │                       ├──< campaign ──< campaign_recipient
        │                       └──< coexistence_sync_job
        ├──< opt_out
        ├──< subscription ──< credit_ledger
        ├──< event                                      (immutable, AI substrate)
        ├──< audit_log
        └──< agency_membership >── agency
```

---

## 3. Identity and organisation

### 3.1 `user` — global identity

#### SN-AUTH-061 — `user` is a global, not org-scoped, identity

A `user` row **MUST** represent one human across every organisation they belong to, never a
per-organisation profile. `email` and `phone_e164` are each nullable but at least one **MUST** be
present (`CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL)`). `acquisition` **MUST** be captured
once, server-side, at account creation, within a 15-day first-touch window, and is never
reconstructed later.

Deliberately **not** org-scoped. One human, one row, however many organisations they belong to.

> **Divergence from Privyr.** They conflate the person and the membership into `user_profile`,
> which belongs to an organisation. That makes agency staff, contractors working for two
> brokerages, and a rep moving between orgs all awkward — and it's why their agency feature needs
> `login-as-user` impersonation to do things a proper membership model handles natively.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `email` | citext unique | Nullable — a phone-only account is valid |
| `phone_e164` | varchar(20) unique | Nullable |
| `country_code` | char(2) | |
| `is_email_verified` | bool default false | Gates email OTP login |
| `is_phone_verified` | bool default false | |
| `google_sub` | varchar unique | Google subject claim |
| `name` | varchar(255) | |
| `avatar_url` | text | |
| `timezone` | varchar(64) default 'UTC' | IANA |
| `locale` | varchar(10) default 'en' | |
| `last_login_at` | timestamptz | |
| `acquisition` | jsonb | `{utm_source, utm_medium, utm_campaign, utm_content, gclid, fbclid, referrer, device_type, first_touch_at}` |

> `acquisition` is captured **once, at account creation, server-side**, with a 15-day first-touch
> window. It is the only way to ever answer "which channel produces customers who stick", and it
> cannot be reconstructed later. Privyr does this client-side in `localStorage` and clears the whole
> origin's storage when the window expires — we do it server-side.

**Constraint:** `CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL)`

### 3.2 `organization`

#### SN-AUTH-062 — `organization` schema and soft-delete

`organization` **MUST** carry a unique `slug` (the branded share subdomain), a `branding` jsonb
shape (`logo_url`, `primary_color`, `accent_color`, `show_powered_by`, `email_from_name`), and
**MUST** be soft-deleted (`deleted_at`), never hard-deleted, since a cascading hard delete of an
organization is an unrecoverable data-loss event.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `name` | varchar(255) | |
| `slug` | citext unique | Used for the branded share subdomain |
| `owner_membership_id` | uuid | FK added after `membership` exists |
| `country_code` | char(2) | Drives default currency, tax, phone defaults |
| `currency` | char(3) default 'INR' | |
| `timezone` | varchar(64) | |
| `industry` | varchar(64) | From onboarding survey; segments activation content |
| `share_domain` | varchar(255) | Custom domain for tracked links; null = platform default |
| `branding` | jsonb | `{logo_url, primary_color, accent_color, show_powered_by, email_from_name}` |
| `deleted_at` | timestamptz | **Soft delete** — cascading a real org delete is a data-loss footgun |

### 3.3 `membership` — a user's role inside one organisation

#### SN-AUTH-063 — `membership` is deactivated, never deleted

`(organization_id, user_id)` **MUST** be unique. `capabilities` jsonb is the sole source of
authority; `role_preset` is presentational only. A membership **MUST** be deactivated
(`status = 'DEACTIVATED'`), never hard-deleted — assigned leads, authored content, and historical
activity must survive a member's departure.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `user_id` | uuid | |
| `role_preset` | varchar(20) | `OWNER` · `MANAGER` · `REP` · `CUSTOM` — presentational; authority is `capabilities` |
| `capabilities` | jsonb | The capability grid. Shape in [`06`](06-permissions-and-plans.md). |
| `status` | varchar(20) | `INVITED` · `ACTIVE` · `DEACTIVATED` |
| `display_name` | varchar(255) | Org-specific override |
| `job_title` | varchar(255) | |
| `certification_id` | varchar(64) | Agent licence (e.g. CEA in Singapore, RERA in India) |
| `invited_by_membership_id` | uuid | |
| `invited_at`, `activated_at`, `deactivated_at` | timestamptz | |
| `preferences` | jsonb | Per-member settings. Shape in [`F18`](features/F18-settings.md). |

**Unique:** `(organization_id, user_id)`

> **Members are deactivated, never deleted.** Assigned leads, authored content and historical
> activity must survive. A hard delete of a membership is a bug, not a feature.

### 3.4 `subteam` / `subteam_membership`

#### SN-TEAM-032 — `subteam` scopes both leads and content

`subteam_membership` **MUST** enforce a unique `(subteam_id, membership_id)` pair. Sub-teams live in
the org domain (not the content domain) since both lead access and content visibility reference
them.

`subteam`: `id`, `organization_id`, `name`, `description`.
`subteam_membership`: `subteam_id`, `membership_id`. Unique on the pair.

> **Divergence.** Privyr puts sub-teams in `product-collection` because they originally scoped
> *content* visibility, then retrofitted lead access onto them. We place them in the org domain
> from the start, and both content and lead scoping reference them.

### 3.5 `invitation`

#### SN-AUTH-064 — Invitation tokens are stored hashed

An invitation's token **MUST** be persisted only as `token_hash`; the plaintext token **MUST**
exist nowhere but the outbound email.

`id`, `organization_id`, `email`, `token_hash`, `capabilities` jsonb, `subteam_ids` uuid[],
`invited_by_membership_id`, `expires_at`, `accepted_at`, `revoked_at`.

**The token is stored hashed.** The plaintext exists only in the email.

### 3.6 `otp_challenge`

#### SN-AUTH-065 — OTP challenge storage and rate-limiting invariants

The OTP code **MUST** be stored hashed (never in plaintext or logs). Resend cooldown (15s) and the
attempt cap (`max_attempts` default 5, TTL 10 minutes) **MUST** be enforced server-side, and the
challenge **MUST** be rate-limited on `(identifier, ip_address)`, locking after `max_attempts`.

`id`, `identifier` (email or E.164), `channel` (`EMAIL`|`SMS`), `code_hash`, `purpose`
(`LOGIN`|`SIGNUP`|`CHANGE_EMAIL`|`VERIFY_PHONE`), `attempts` int, `max_attempts` int default 5,
`expires_at`, `consumed_at`, `ip_address` inet, `requested_at`.

**Invariants**
- The code is stored **hashed**. Never in plaintext, never in logs.
- Resend cooldown is enforced **server-side** (15s). Privyr enforces it only with a client-side
  `setInterval`.
- Rate limited on `(identifier, ip_address)`; lock after `max_attempts`.
- TTL 10 minutes.

---

## 4. Leads

### 4.1 `lead` ⭐ the core entity

#### SN-LEAD-083 — `lead` schema, write-time fields and soft delete

`lead` **MUST** enforce `CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL OR whatsapp_e164 IS NOT NULL)`
— a lead with no contact channel is invalid. `first_response_at` **MUST** be stamped at write time
on first outbound contact; it is not backfillable and is the basis for the average-response-time
metric. `lead` **MUST** be soft-deleted (`deleted_at`), since timeline and share history must
survive a delete.

One entity, two lifecycle stages. Not two tables.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `assigned_membership_id` | uuid null | null = unassigned |
| `assigned_at` | timestamptz | |
| `name` | varchar(255) | |
| `display_name` | varchar(255) | Derived per preference (full name / first word) |
| `email` | citext null | |
| `phone_e164` | varchar(20) null | |
| `whatsapp_e164` | varchar(20) null | Separate from `phone_e164` — they differ often |
| `phone_country` | char(2) | |
| `notes` | text | |
| `source` | varchar(32) | `MANUAL` · `IMPORT_CSV` · `IMPORT_PHONEBOOK` · `INTEGRATION` · `WHATSAPP` · `LEAD_FORM` |
| `lead_source_key` | varchar(64) null | e.g. `facebook_lead_ads`, `indiamart`, `wordpress` |
| `integration_connection_id` | uuid null | |
| `source_payload` | jsonb | **The raw inbound payload, unmodified.** Campaign/adset/ad, every form answer. |
| `source_summary` | text | Human-readable preview for list views |
| `received_at` | timestamptz | When the lead reached us — not when we created the row |
| `is_new` | bool default false | The "new lead" badge |
| **`first_response_at`** | timestamptz null | ⚠️ **Write-time only. Not backfillable.** |
| `first_response_channel` | varchar(20) null | |
| `last_interaction_at` | timestamptz | |
| `last_content_opened_at` | timestamptz null | Powers "recently active" |
| `converted_at` | timestamptz null | |
| `created_by_membership_id` | uuid null | |
| `deleted_at` | timestamptz | **Soft delete** — timeline and share history must survive |

> **`first_response_at` is a timestamp, not a boolean.** Privyr models this as
> `is_first_resp_logged: bool`, which throws away the exact data the average-response-time metric
> needs. This is the single most consequential schema correction in this document.

**Constraint:** `CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL OR whatsapp_e164 IS NOT NULL)`
— a lead with no way to contact them is not a lead.

### 4.2 `lead_group` / `lead_group_link`

#### SN-GROUP-006 — `lead_group` colours are server-owned, not free-form

A lead group's `color_id` **MUST** reference a fixed, server-owned ten-swatch palette — never a
free-form hex value — so colours stay consistent and a rebrand is a one-line change.

`lead_group`: `id`, `organization_id`, `name`, `color_id` smallint, `description`.
`lead_group_link`: `lead_id`, `lead_group_id`, `added_at`, `added_by_membership_id`. PK on the pair.

**`color_id` references a server-owned palette, not a free-form hex.** Ten fixed swatches. Keeps
tag colours consistent and makes a rebrand a one-line change. Privyr does this and it is right.

### 4.3 `custom_field_definition`

#### SN-FIELD-022 — `custom_field_definition` is a per-org metadata schema

`(organization_id, key)` **MUST** be unique, and `key` is immutable after creation. `system_field`
identifies seeded system fields (e.g. `LEAD_STAGE`) without hardcoding dedicated columns for them.
`DATE`-typed fields **MAY** carry a `reminder_frequency`/`reminder_offset` pair driving
birthday/renewal follow-ups.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `key` | varchar(64) | Stable machine key, immutable after creation |
| `label` | varchar(255) | User-editable |
| `field_type` | varchar(20) | `TEXT` · `NUMBER` · `DROPDOWN` · `DATE` |
| `system_field` | varchar(32) null | `LEAD_STAGE` · `OPPORTUNITY_SIZE` — seeded per org, not hardcoded columns |
| `config` | jsonb | `{prefix, suffix, min, max, decimals}` |
| `options` | jsonb | `[{value, label, color_id, order}]` for `DROPDOWN` |
| `display_order` | int | |
| `is_hidden` | bool | |
| `autofill_from_source` | varchar(255) null | JSON path into `lead.source_payload` |
| `reminder_frequency` | varchar(20) null | `NEVER` · `ONCE` · `YEARLY` — `DATE` fields only |
| `reminder_offset` | varchar(20) null | `ON_DAY` · `ONE_DAY_BEFORE` · `ONE_WEEK_BEFORE` · `CUSTOM` |
| `reminder_offset_days` | int null | |

**Unique:** `(organization_id, key)`

> `YEARLY` reminders on a `DATE` field are what power birthday and policy-renewal follow-ups —
> a small feature with outsized value in insurance and real estate.

### 4.4 `custom_field_value`

#### SN-FIELD-023 — `custom_field_value` uses typed columns, never a text blob

`(lead_id, custom_field_definition_id)` **MUST** be unique. Values **MUST** be stored in
type-specific typed columns (`value_text`, `value_number`, `value_date`, `value_option`), never a
single text blob, so that filtering and sorting stay indexable and numerically correct.

`id`, `organization_id`, `lead_id`, `custom_field_definition_id`, `value_text`, `value_number`
numeric(20,4), `value_date` date, `value_option` varchar(64), `updated_at`,
`updated_by_membership_id`.

**Unique:** `(lead_id, custom_field_definition_id)`

Typed columns rather than a single text blob, so filtering and sorting are indexable and correct
(`"9" < "10"` is a bug that a text column guarantees).

### 4.5 `custom_field_value_history` ⚠️

#### SN-FIELD-024 — `custom_field_value_history` is append-only and write-time-only

A row **MUST** be written for every change to a field where `system_field = 'LEAD_STAGE'`, and for
any `DROPDOWN` field flagged `track_history`. The table is append-only and cannot be backfilled —
it is the sole source for the time-in-stage metric.

`id`, `organization_id`, `lead_id`, `custom_field_definition_id`, `from_value`, `to_value`,
`changed_at`, `changed_by_membership_id`.

**Append-only. Written for every change to a field where `system_field = 'LEAD_STAGE'`, and for any
`DROPDOWN` field flagged `track_history`.**

> **This table is why time-in-stage exists.** Without it, you have only the current value and the
> metric is permanently unrecoverable. It is cheap now and impossible later. Privyr surfaces
> "Time in Stage" in the UI but the recon could not confirm they store the history — if they derive
> it from a single `last_updated` timestamp, it silently breaks on the second stage change.

### 4.6 `timeline_event` — the unified activity stream

#### SN-TL-032 — `timeline_event` is the single, partitioned activity taxonomy

One taxonomy, one table serves the per-lead timeline, the org-wide feed, and the AI substrate.
`occurred_at` **MUST** record business time, not insert time. The table **MUST** be partitioned by
month on `occurred_at` given its expected volume. `timeline_attachment` rows are capped at 5 per
event, 10 MB each.

Serves the per-lead timeline, the account-wide feed, and (see [`11`](11-ai-substrate.md)) the AI
substrate. One taxonomy, one table.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `lead_id` | uuid null | Null for org-level events |
| `event_type` | varchar(40) | See §11.3 |
| `origin` | varchar(16) | `MANUAL` · `SYSTEM` · `WHATSAPP` · `INTEGRATION` |
| `title` | varchar(255) | Pre-rendered summary for list display |
| `body` | text null | |
| `payload` | jsonb | Variant data, per `event_type` |
| `occurred_at` | timestamptz | **The business time**, not the insert time |
| `actor_membership_id` | uuid null | Null for system and inbound events |
| `related_content_id` | uuid null | |
| `related_share_id` | uuid null | |
| `related_message_id` | uuid null | |
| `is_pinned` | bool default false | |

**Partitioned by month on `occurred_at`.** This is the highest-volume table in the system —
conversation sync alone will produce tens of events per lead. Partitioning from day one avoids a
painful migration at exactly the moment the product is succeeding.

`timeline_attachment`: `id`, `timeline_event_id`, `file_url`, `mime`, `size_bytes`, `filename`.
Max 5 per event, 10 MB each.

### 4.7 `follow_up`

#### SN-FUP-033 — `follow_up` buckets are derived, and one PENDING per lead

`due_at IS NULL` **MUST** be treated as the `SOMEDAY` bucket, a real state, not missing data.
Buckets (`OVERDUE`/`TODAY`/`UPCOMING`/`SOMEDAY`) **MUST** be derived at query time, never stored. At
most one `PENDING` follow-up per lead **MUST** be enforced via a partial unique index on `lead_id`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id`, `lead_id` | uuid | |
| `due_at` | timestamptz null | **Null means the `SOMEDAY` bucket** — a real state, not missing data |
| `note` | text | |
| `status` | varchar(16) | `PENDING` · `COMPLETED` · `CANCELLED` |
| `completed_at` | timestamptz null | |
| `assigned_membership_id` | uuid | |
| `created_by_membership_id` | uuid | |
| `auto_created` | bool | Created by policy rather than by a human |

**Buckets are derived, never stored:**

| Bucket | Condition |
|---|---|
| `OVERDUE` | `due_at < now()` |
| `TODAY` | `due_at` within the member's local day |
| `UPCOMING` | `due_at > end of today` |
| `SOMEDAY` | `due_at IS NULL` |

Storing the bucket would require a cron to move rows across midnight in four timezones. Derive it.

**Invariant:** at most one `PENDING` follow-up per lead.
`CREATE UNIQUE INDEX ON follow_up (lead_id) WHERE status = 'PENDING'`

---

## 5. Content

### 5.1 `content` — polymorphic base

#### SN-CONT-052 — `content` is a polymorphic base with explicit delete semantics

`content_type` (`MESSAGE`/`FILE`/`PAGE`) drives which type table applies. Deleting content **MUST**
invalidate every tracked link ever minted from it, and this **MUST** be surfaced explicitly at
delete time (live-link and open-access counts shown in the confirmation) — never a silent
cascade. **Archive** (`status = 'ARCHIVED'`) **MUST** exist as a state distinct from delete, so
sharing can stop without destroying engagement history.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `content_type` | varchar(16) | `MESSAGE` · `FILE` · `PAGE` |
| `title` | varchar(255) | |
| `private_notes` | text | Internal only; never rendered to a recipient |
| `visibility` | varchar(16) | `PRIVATE` · `SUBTEAM` · `ORG` |
| `owner_membership_id` | uuid | |
| `status` | varchar(16) | `DRAFT` · `ACTIVE` · `ARCHIVED` |
| `share_count`, `view_count`, `unopened_count` | int | Denormalised counters |
| `last_shared_at` | timestamptz | |
| `deleted_at` | timestamptz | **Soft delete** — see the invalidation rule below |

> **Deleting content invalidates every tracked link ever minted from it.** That is correct
> behaviour, but it must be *explicit*: the delete confirmation states how many live links will
> break and how many leads have open access. We also model **archive** as a distinct state, so
> "stop sharing this" never requires destroying the engagement history.

### 5.2 Type tables

#### SN-CONT-053 — Content type tables: message, file, page

`content_file.processing_status` **MUST** distinguish `WILL_NOT_PROCESS` (file is fine, just not a
trackable type) from `FAILED` (processing broke) — collapsing them loses the ability to explain UI
state. `content_page.blocks` **MUST** be an ordered array of `{slot_key, type, value, style}`, with
every slot keyed uniformly (no special-cased slot types) and styling stored as semantic tokens
(e.g. `{"spacing": "md"}`), never raw CSS class names.

**`content_message`** — `content_id` pk, `body` text, `message_role` (`MAIN` · `FOLLOW_UP` ·
`DEFAULT_SHARE`), `email_subject`, `tokens_used` jsonb.

**`content_file`** — `content_id` pk, `storage_key`, `cdn_url`, `mime`, `size_bytes`,
`page_count`, `processing_status` (`NOT_PROCESSED` · `PROCESSING` · `PROCESSED` ·
`WILL_NOT_PROCESS` · `FAILED`), `processing_error`, `thumbnail_url`.

> `WILL_NOT_PROCESS` is deliberately distinct from `FAILED`: the file is fine, it just isn't a
> trackable type. Collapsing them loses the ability to explain the UI state to the user.
> PDF limits: 200 pages, 100 MB.

**`content_page`** — `content_id` pk, `page_template_id`, `blocks` jsonb, `cover_image_url`,
`primary_cta` (`WHATSAPP` · `CALL` · `EMAIL` · `URL` · `NONE`), `cta_value`, `theme` jsonb.

`blocks` is an **ordered array** of `{slot_key, type, value, style}`:

```json
[
  {"slot_key": "title",   "type": "TITLE",   "value": {"text": "Acme Residences"}},
  {"slot_key": "gallery", "type": "GALLERY", "value": {"images": ["…", "…"]}},
  {"slot_key": "map",     "type": "MAP",
   "value": {"lat": 12.97, "lng": 77.59, "address": "…"},
   "style": {"spacing": "md"}}
]
```

> **Three corrections to Privyr's page contract, all from their live capture:**
> 1. They key `components` as an object of `{comp_type}-{comp_code}` — except `image_gallery`,
>    which is special-cased to a bare `"images"` key with a different envelope. **We key every
>    slot uniformly.**
> 2. They persist raw Tailwind class names (`"mt-3"`) as styling data, so a CSS framework change
>    becomes a data migration. **We store semantic tokens** (`"spacing": "md"`).
> 3. They round-trip `placeholder` strings through the API as if they were data. **We don't.**

### 5.3 Taxonomy

#### SN-CONT-054 — Content folders and labels are independent taxonomies

Folders (hierarchical containers) and labels (cross-cutting tags) **MUST** remain two independent
taxonomies, both applicable to all three content types.

`content_label`: `id`, `organization_id`, `name`, `color_id`.
`content_label_link`: `content_id`, `content_label_id`.
`content_folder`: `id`, `organization_id`, `name`, `content_type` null, `parent_folder_id` null.
`content_folder_item`: `content_folder_id`, `content_id`.

Two **independent** taxonomies — folders are hierarchical containers, labels are cross-cutting tags.
Both apply to all three content types.

### 5.4 `page_template` — server-declared slot schema

#### SN-CONT-055 — Page templates are global, server-declared metadata

`page_template` **MUST** be global seed data, not org-scoped. `slots` **MUST** declare which blocks
exist, in order, with per-slot constraints (`required`, `max_length`/`max_items`) — the editor asks
the server what blocks exist rather than the client shipping the list, so a new block type needs no
frontend release.

`id`, `key`, `name`, `description`, `preview_image_url`, `slots` jsonb, `is_active`, `industry` null.

**Global seed data, not org-scoped.** `slots` declares which blocks exist, in order, with
constraints:

```json
[{"slot_key": "title", "type": "TITLE", "required": true, "max_length": 120},
 {"slot_key": "gallery", "type": "GALLERY", "required": false, "max_items": 20}]
```

> This is the **metadata-endpoint pattern** — the editor asks the server what blocks exist rather
> than shipping the list in the client. It is why a new block type needs no frontend release.
> The same pattern drives the lead-form builder (§8.3). Worth adopting deliberately.

### 5.5 `content_share` — a minted per-recipient link

#### SN-SHARE-061 — `content_share` minting is idempotent per (content, lead)

`(content_id, lead_id)` **MUST** be unique — minting a share for the same pair twice **MUST**
return the existing `share_code` and preserve accumulated view stats, not create a new row. Re-sends
**MUST** increment `share_count` rather than creating a new share row.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id`, `content_id`, `lead_id` | uuid | |
| `share_code` | varchar(16) unique | High-entropy, opaque, URL-safe |
| `slug` | varchar(255) | Cosmetic, SEO/readability only |
| `shared_by_membership_id` | uuid | |
| `channel` | varchar(16) | `WHATSAPP` · `EMAIL` · `SMS` · `TELEGRAM` · `COPY` · `QR` |
| `first_shared_at`, `last_shared_at` | timestamptz | |
| `share_count` | int | Re-sends increment; they do **not** create a new row |
| `view_count`, `total_duration_seconds` | int | |
| `first_viewed_at`, `last_viewed_at` | timestamptz null | |
| `revoked_at` | timestamptz null | |

**Unique:** `(content_id, lead_id)` — **minting is idempotent per pair.**

> Verified against Privyr: calling `generate-page` twice for the same (template, client) returns
> the same code with `is_new: false`, and preserves accumulated view stats. This matters — a rep
> who re-sends a brochure must not lose the evidence that the lead already read it.

### 5.6 `content_view` — one row per view

#### SN-SHARE-062 — `content_view` engagement-gate and duration semantics

`duration_seconds = NULL` **MUST** mean *no duration data*, distinct from `0` meaning *measured,
zero*. A view row **MUST** only be created once the engagement gate passes (not merely on
`DOMContentLoaded`). Duration **MUST** accumulate from delta chunks with the watermark advancing
only on confirmed ingest. Views by the content owner **MUST NOT** be recorded at all.

`id`, `organization_id`, `content_share_id`, `viewed_at`, `duration_seconds` int null,
`device_type` (`MOBILE`·`TABLET`·`DESKTOP`·`UNKNOWN`), `country_code`, `ip_hash`,
`user_agent_hash`, `is_engaged` bool, `beacon_count` int.

**Invariants**
- `duration_seconds` **NULL** means *no duration data*. `0` means *measured, and it was zero*.
  Privyr conflates these; the distinction is the difference between "the beacon failed" and "they
  bounced".
- A row is only created once the **engagement gate** passes. Privyr records a view 500 ms after
  `DOMContentLoaded` — no scroll, no dwell, no interaction. See [`F07`](features/F07-sharing-and-tracking.md).
- Duration accumulates from delta chunks; the watermark advances **only on confirmed ingest**.
- Views by the content owner are **not recorded at all** — instrumentation is omitted at render
  time, not filtered afterwards.

---

## 6. Sequences

### 6.1 `sequence`

#### SN-SEQ-054 — `sequence.break_criteria` must be implemented from day one

`whatsapp_account_id` **MUST** be set only when `sequence_type = 'AUTOMATED'`; a manual sequence
requires no WhatsApp Business account. `break_criteria` **MUST** be evaluated and enforced from V1
— exit conditions (inbound message, outbound message, content view, stage change) pull a lead out
the moment a real conversation starts, so the engine never spams mid-conversation.

`id`, `organization_id`, `name`, `description`, `sequence_type` (`MANUAL`·`AUTOMATED`·`MIXED`),
`status` (`DRAFT`·`ACTIVE`·`PAUSED`·`ARCHIVED`), `visibility`, `whatsapp_account_id` null,
`break_criteria` jsonb, `owner_membership_id`, `enrolled_count`, `completed_count`.

`whatsapp_account_id` is set **only** when `sequence_type = 'AUTOMATED'`. A manual sequence needs
no WhatsApp Business account — that is the entire point of `executor: USER`.

**`break_criteria`** — exit conditions that pull a lead out when a real conversation starts:

```json
{"on_inbound_message": true, "on_outbound_message": false,
 "on_content_view": false, "on_stage_change": ["Converted", "Lost"]}
```

> This is the difference between a sequence engine that feels helpful and one that spams people
> mid-conversation. **Implement it from day one**, not as a follow-up.

### 6.2 `sequence_step`

#### SN-SEQ-055 — `sequence_step.executor` switches manual vs. automated behaviour

`executor` (`USER`/`SYSTEM`) **MUST** be the single switch between manual and automated step
behaviour: a `USER` step becomes a task in the rep's queue sent from their own WhatsApp; a `SYSTEM`
step dispatches on its own. `display_number` **MUST** be tracked separately from `order` so delay
steps (`display_number = 0`) sit between numbered steps. `max_steps_per_sequence` **MUST** be
enforced server-side at 20.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `sequence_id`, `organization_id` | uuid | |
| `order` | int | Execution order, includes delays |
| `display_number` | int | **Separate from `order`.** Delay steps get `0` so they sit *between* numbered steps |
| `action_type` | varchar(32) | `SHARE_CONTENT` · `CONTACT_LEAD` · `DELAY` · `SEND_WHATSAPP_TEMPLATE` |
| `executor` | varchar(8) | **`USER` · `SYSTEM`** |
| `delay_seconds` | int default 0 | |
| `delay_display_unit` | varchar(8) | Presentation hint so "1 day" redisplays as days, not 24 hours |
| `content_id` | uuid null | |
| `whatsapp_template_id` | uuid null | |
| `action_data` | jsonb | Per-`action_type` payload |
| `instructions` | text | Shown to the rep on a `USER` step |

> **`executor` is the single switch between manual and automated sequences.** A `USER` step becomes
> a task in the rep's queue and is sent from their own WhatsApp; a `SYSTEM` step dispatches on its
> own. This one enum is Privyr's best idea and the reason they can offer "automation" without the
> Business API. It is central to our V1 too.

**Constraint:** `max_steps_per_sequence` = 20, enforced server-side.

### 6.3 `sequence_enrolment` / `sequence_step_state`

#### SN-SEQ-056 — At most one active enrolment per (sequence, lead)

`(sequence_id, lead_id)` **MUST** be unique where `status = 'ACTIVE'` on `sequence_enrolment` — a
lead cannot be actively enrolled in the same sequence twice concurrently.

`sequence_enrolment`: `id`, `organization_id`, `sequence_id`, `lead_id`, `enrolled_at`,
`enrolled_by` (`MANUAL`·`RULE`·`BULK`·`API`), `enrolled_by_membership_id`, `status`
(`ACTIVE`·`COMPLETED`·`BROKEN`·`REMOVED`), `current_step_order`, `completed_at`,
`broken_at`, `break_reason`.

**Unique:** `(sequence_id, lead_id)` where `status = 'ACTIVE'`.

`sequence_step_state`: `id`, `enrolment_id`, `sequence_step_id`, `status`
(`PENDING`·`DUE`·`SENT`·`SKIPPED`·`FAILED`·`REMOVED`), `due_at`, `completed_at`,
`completed_by_membership_id`, `failure_reason`, `message_id` null.

---

## 7. Automation

### 7.1 `automation_rule`

#### SN-RULE-054 — `automation_rule` evaluation order and per-recipient sequencing

Rules **MUST** be ordered and evaluated by `priority`, first match wins — ordering is business
logic with its own reorder endpoint, not presentation order. For `ROUTING` actions, `sequence_id`
**MUST** be assignable per recipient (not per rule), so round-robin can hand different team members
different follow-up sequences from the same rule.

`id`, `organization_id`, `name`, `rule_kind` (`ROUTING`·`DISTRIBUTION`), `priority` int,
`is_active`, `is_default` bool, `lead_source_key` null, `logical_operator` (`AND`·`OR`),
`actions` jsonb, `match_count` int, `last_matched_at`.

**Rules are ordered and evaluated by `priority`. First match wins.** Ordering is business logic,
not presentation — it gets its own reorder endpoint.

`actions` by kind:

```json
// ROUTING
{"assign": [{"membership_id": "…", "weight": 1, "sequence_id": "…"}],
 "add_to_groups": ["…"], "set_fields": {"cf_stage": "New"}}

// DISTRIBUTION
{"mode": "ROUND_ROBIN",
 "recipients": [{"type": "EMAIL", "value": "…"}, {"type": "WHATSAPP", "value": "+91…"}],
 "save_to_account": true, "channels": ["EMAIL", "WHATSAPP"]}
```

> **`sequence_id` is per recipient, not per rule** — round-robin can hand different team members
> different follow-up sequences from the same rule. Lifted from Privyr's live payload capture.

### 7.2 `rule_condition`

#### SN-RULE-055 — `rule_condition` is a flat conjunction with a fixed operator set

Conditions **MUST** form a flat conjunction (one nesting level, no condition trees), restricted to
exactly five operators: `EQUALS`, `NOT_EQUALS`, `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`.
`display_value` **MUST** be captured at authoring time alongside the raw `value`, so a renamed
source (e.g. a Facebook form) doesn't turn the rule's display into a bare, unreadable ID.

`id`, `automation_rule_id`, `field_key`, `operator`, `value`, `display_value`, `field_label`,
`order`.

**A flat conjunction, one nesting level. No condition trees.** Five operators only: `EQUALS`,
`NOT_EQUALS`, `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`. Deliberately small — resist expanding it
before there is demand.

> **`display_value` stores the human label at authoring time**, alongside the raw `value`. If the
> Facebook form is later renamed, the rule still reads as "Form = Diwali Campaign" rather than a
> bare ID, with no join. Denormalisation earning its keep.

### 7.3 `distribution_state` / `distribution_log`

#### SN-RULE-056 — Round-robin distribution state must be exposed, not opaque

Round-robin cursor state (`distribution_state`) and per-lead distribution outcomes
(`distribution_log`) **MUST** be exposed in the UI, per recipient — opaque round-robin is a chronic
support burden ("why didn't I get that lead?") that is unanswerable without this data.

`distribution_state`: `automation_rule_id` pk, `cursor_recipient_index`, `round_number`,
`leads_this_round`, `last_distributed_at`.

`distribution_log`: `id`, `organization_id`, `automation_rule_id`, `lead_id`, `recipient_type`,
`recipient_value`, `channel`, `status`, `error`, `dispatched_at`, `cost_credits`.

> **Round-robin state is exposed in the UI, per recipient.** Opaque round-robin is a chronic
> support burden — "why didn't I get that lead?" is unanswerable without it.

---

## 8. Integrations and lead capture

### 8.1 `integration_definition` — global registry seed

#### SN-INTG-063 — `integration_definition` is a global, not org-scoped, registry

`integration_definition` **MUST NOT** be org-scoped — adding an integration is a seed row plus a
parser, never a frontend release. `visibility` (`PUBLIC`/`BETA`/`STAFF_ONLY`/`UPCOMING`) **MUST**
double as the feature-flag mechanism for shipping an integration dark and revealing it per account.

`id`, `key` unique, `name`, `description`, `icon_url`, `category`
(`LEAD_SOURCE`·`AUTOMATION`·`IMPORT_EXPORT`·`OTHER`), `auth_type`
(`OAUTH`·`API_KEY`·`TOKEN`·`WEBHOOK`·`EMAIL`·`NONE`), `visibility`
(`PUBLIC`·`BETA`·`STAFF_ONLY`·`UPCOMING`), `parser_key`, `config_schema` jsonb,
`setup_url`, `help_url`, `display_order`.

**Not org-scoped.** Adding an integration is a seed row plus a parser — no frontend release.
`visibility` doubles as a feature-flag mechanism: ship dark, reveal per account.

### 8.2 `integration_connection`

#### SN-INTG-064 — `integration_connection` must distinguish expiring from expired

`status` **MUST** include `EXPIRING_SOON` as a state distinct from `EXPIRED`, since OAuth tokens for
lead sources expire routinely and silently — this is what turns a support ticket into a proactive
nudge. `credentials` **MUST** be stored encrypted.

`id`, `organization_id`, `integration_definition_id`, `status`
(`CONNECTED`·`NOT_CONNECTED`·`EXPIRING_SOON`·`EXPIRED`·`ERROR`), `credentials` **encrypted**,
`external_account_id`, `external_account_name`, `config` jsonb, `inbound_email`,
`webhook_secret`, `connected_by_membership_id`, `connected_at`, `expires_at`,
`last_synced_at`, `last_error`, `error_count`.

> **`EXPIRING_SOON` as a status distinct from `EXPIRED`** is the difference between a proactive
> nudge and a support ticket. OAuth tokens for lead sources expire routinely and silently.

`external_lead_form`: `id`, `integration_connection_id`, `external_id`, `name`,
`parent_external_id` (the FB page), `is_enabled`, `last_lead_at`, `lead_count`. Per-form
enable/disable within the account → page → form hierarchy.

### 8.3 `lead_form` / `lead_form_field` — first-party hosted forms

#### SN-FORM-034 — `lead_form_field` visibility/required invariant, derived from custom fields

A field **MUST NOT** be both hidden and required: setting `is_required = true` **MUST** force
`is_visible = true`, and setting `is_visible = false` **MUST** clear `is_required` — enforced once,
in the model layer. Form fields **MUST** derive from the org's custom-field schema, so a new custom
field becomes available in every form builder with no release.

`lead_form`: `id`, `organization_id`, `name`, `title`, `description`, `header_image_url`,
`form_code` unique, `status`, `success_message`, `success_cta` jsonb, `assign_to_group_ids` uuid[],
`automation_rule_id` null, `qr_url`, `lead_count`, `last_lead_at`, `theme` jsonb,
`created_by_membership_id`.

`lead_form_field`: `id`, `lead_form_id`, `field_key`, `label`, `field_type`
(`TEXT`·`EMAIL`·`PHONE`·`DATE`·`DROPDOWN`·`NUMBER`), `is_visible`, `is_required`,
`is_mandatory` (locked, cannot be hidden), `placeholder`, `options` jsonb, `order`,
`custom_field_definition_id` null.

**Invariant, enforced in the model layer:** a field cannot be both hidden and required.
Setting `is_required = true` forces `is_visible = true`; setting `is_visible = false` clears
`is_required`. Privyr enforces this in two separate event handlers — we do it once, in the model.

**Form fields derive from the org's custom-field schema**, so adding a custom field makes it
available in every form builder with no release.

### 8.4 `inbound_event` — the raw ingest log

#### SN-INTG-065 — Every inbound webhook is persisted before processing

Every inbound webhook payload **MUST** be persisted to `inbound_event` before it is processed, with
no exception — it is the only mechanism that lets a bad parser, a changed provider payload shape,
or a "I never got that lead" report be replayed rather than guessed at. Retention: 90 days.

`id`, `organization_id` null, `source_key`, `integration_connection_id` null, `raw_payload` jsonb,
`headers` jsonb, `signature_valid` bool, `received_at`, `processed_at`, `status`
(`PENDING`·`PROCESSED`·`FAILED`·`DUPLICATE`·`REJECTED`), `error`, `lead_id` null, `attempt_count`.

> **Every inbound webhook is persisted before it is processed.** This is not optional. When a
> parser has a bug, or Meta changes a payload shape, or a customer says "I never got that lead",
> this table is the only thing that lets us replay rather than guess. Retention: 90 days.

---

## 9. WhatsApp

### 9.1 `whatsapp_account` — a connected number

#### SN-WA-081 — `whatsapp_account` health monitoring is a launch blocker

`last_app_activity_at` and `health_state` **MUST** be tracked and actively monitored: if the user
does not open their WhatsApp Business app for 13 days, Meta severs the API connection
irrecoverably. Monitoring and nudging on this signal is a launch blocker, not an enhancement.
Coexistence throughput **MUST** be fixed at 5 msg/sec (`throughput_mps` default 5).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id` | uuid | |
| `connection_mode` | varchar(16) | **`COEXISTENCE`** · `CLOUD_API` · `CLICK_TO_CHAT` |
| `phone_e164` | varchar(20) | |
| `display_name`, `verified_name` | varchar(255) | |
| `waba_id`, `phone_number_id` | varchar(64) | Meta identifiers |
| `provider` | varchar(32) | Which BSP/direct path minted it — see the provider port in [`09`](09-technical-architecture.md) |
| `status` | varchar(24) | `PENDING` · `CONNECTED` · `DEGRADED` · `DISCONNECTED` · `ERROR` |
| `quality_rating` | varchar(16) | Meta's `GREEN`/`YELLOW`/`RED` |
| `messaging_limit_tier` | varchar(16) | |
| `throughput_mps` | int default 5 | **Coexistence is fixed at 5 msg/sec** |
| **`last_app_activity_at`** | timestamptz | ⚠️ Drives the 13-day disconnect warning |
| **`health_state`** | varchar(16) | `HEALTHY` · `WARNING` · `CRITICAL` · `DISCONNECTED` |
| `history_sync_status` | varchar(16) | `NOT_REQUESTED` · `PENDING` · `IN_PROGRESS` · `COMPLETE` · `PARTIAL` · `DECLINED` |
| `history_synced_through` | timestamptz | How far back history reached |
| `contacts_synced_at` | timestamptz | |
| `connected_by_membership_id` | uuid | |
| `assigned_membership_ids` | uuid[] | Which members may send from this number |

> **`last_app_activity_at` and `health_state` are the most operationally important columns in this
> schema.** If the user does not open their WhatsApp Business app for **13 days**, Meta severs the
> API connection and neither we nor the provider can do anything about it. Silent failure here
> means the customer's conversations stop syncing and they don't find out until they notice the
> timeline has gone quiet. Monitoring and nudging is specified in
> [`F12`](features/F12-whatsapp-coexistence.md) and is a launch blocker, not an enhancement.

### 9.2 `whatsapp_conversation`

#### SN-WA-082 — Every conversation resolves to a lead; the service window is enforced server-side

`(whatsapp_account_id, contact_e164)` **MUST** be unique, and every conversation **MUST** resolve to
a lead, creating one if the contact is unknown. `service_window_expires_at` (`last_inbound_at + 24h`)
**MUST** be enforced server-side before every send — outside the window a template is required, a
Meta policy constraint whose violation causes failed sends and quality-rating damage.

`id`, `organization_id`, `whatsapp_account_id`, `lead_id`, `contact_e164`, `contact_name`,
`last_message_at`, `last_inbound_at`, `last_outbound_at`, `service_window_expires_at`,
`unread_count`, `message_count`, `is_archived`.

**Unique:** `(whatsapp_account_id, contact_e164)`

**Every conversation resolves to a lead**, creating one if the contact is unknown. That is what
makes this a CRM rather than an inbox.

`service_window_expires_at` = `last_inbound_at + 24h`. Free-form replies are only permitted inside
it; outside it a template is required. **This must be enforced server-side before every send** —
it is a Meta policy constraint, and violating it produces failed sends and quality-rating damage.

### 9.3 `whatsapp_message`

#### SN-WA-083 — `whatsapp_message` idempotency and echo sourcing

Ingest **MUST** be keyed on `wa_message_id` (Meta's ID, unique); webhooks are at-least-once and
duplicates **MUST** be discarded silently, never double-inserted. `source = 'APP_ECHO'` **MUST** be
tracked distinctly from `API`/`HISTORY_IMPORT` — echoed messages cost nothing and are not sent by
the platform, yet are the majority of what makes the timeline valuable. The table **MUST** be
partitioned by month on `sent_at`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `organization_id`, `conversation_id`, `whatsapp_account_id`, `lead_id` | uuid | |
| `wa_message_id` | varchar(128) unique | Meta's ID — the idempotency key |
| `direction` | varchar(8) | `INBOUND` · `OUTBOUND` |
| **`source`** | varchar(16) | **`APP_ECHO`** · `API` · `HISTORY_IMPORT` |
| `message_type` | varchar(20) | `TEXT`·`IMAGE`·`VIDEO`·`DOCUMENT`·`AUDIO`·`LOCATION`·`CONTACT`·`STICKER`·`TEMPLATE`·`SYSTEM` |
| `body` | text | |
| `media_url`, `media_mime`, `media_size_bytes` | | Fetched and re-hosted; Meta's URLs expire |
| `template_id`, `template_variables` | | |
| `status` | varchar(16) | `PENDING`·`SENT`·`DELIVERED`·`READ`·`FAILED`·`DELETED` |
| `error_code`, `error_message` | | |
| `sent_at`, `delivered_at`, `read_at` | timestamptz | |
| `is_edited`, `edited_at`, `original_body` | | From `smb_message_echoes` edit events |
| `is_revoked`, `revoked_at` | | From revoke events |
| `sent_by_membership_id` | uuid null | |
| `cost_credits` | numeric(10,4) | Zero for echoes, inbound and service messages |

**Partitioned by month on `sent_at`.** Highest-volume table in the system after `timeline_event`.

> **`source = 'APP_ECHO'` is the wedge, in one column.** These are messages the rep sent from their
> own phone that we learned about via `smb_message_echoes`. They cost nothing, we did not send
> them, and they are the majority of what makes the timeline valuable.

**Idempotency:** ingest is keyed on `wa_message_id`. Webhooks are at-least-once; duplicates
**MUST** be discarded silently, not double-inserted.

### 9.4 `whatsapp_template`, `campaign`, `campaign_recipient`, `opt_out`

#### SN-WA-084 — Opt-out is checked before every outbound send, campaign or otherwise

`opt_out` **MUST** enforce a unique `(organization_id, phone_e164)` pair, and the opt-out check
**MUST** run before every outbound WhatsApp send — campaign or individual — as a mandatory WhatsApp
policy requirement; skipping it degrades deliverability for every customer on that number.

`whatsapp_template`: `id`, `organization_id`, `whatsapp_account_id`, `meta_template_id`, `name`,
`language`, `category` (`MARKETING`·`UTILITY`·`AUTHENTICATION`), `status`
(`DRAFT`·`PENDING`·`APPROVED`·`REJECTED`·`PAUSED`·`DISABLED`), `components` jsonb,
`rejection_reason`, `quality_score`.

`campaign`: `id`, `organization_id`, `whatsapp_account_id`, `whatsapp_template_id`, `name`,
`status` (`DRAFT`·`TEMPLATE_PENDING`·`SCHEDULED`·`SENDING`·`COMPLETED`·`FAILED`·`CANCELLED`),
`recipient_source` (`FILTER`·`UPLOAD`·`PASTE`), `recipient_filter` jsonb, `scheduled_at`,
`started_at`, `completed_at`, plus counters: `recipient_count`, `sent_count`, `delivered_count`,
`read_count`, `failed_count`, `opted_out_count`, `estimated_cost`, `actual_cost`.

`campaign_recipient`: `id`, `campaign_id`, `lead_id` null, `phone_e164`, `variables` jsonb,
`status` (`PENDING`·`SENDING`·`SENT`·`DELIVERED`·`READ`·`FAILED`·`SKIPPED_OPTED_OUT`),
`wa_message_id`, `error_code`, `status_at`.

`opt_out`: `id`, `organization_id`, `phone_e164`, `source`, `opted_out_at`, `opted_in_at` null.
**Unique:** `(organization_id, phone_e164)`.

> **The opt-out check is mandatory before every outbound send**, campaign or otherwise. It is a
> WhatsApp policy requirement, not a courtesy, and violating it damages the number's quality rating
> — which degrades deliverability for every customer on that number.

### 9.5 `coexistence_sync_job`

#### SN-WA-085 — History sync arrives in three ordered phases

`coexistence_sync_job` **MUST** track history sync as three ordered phases
(`HISTORY_PHASE_1`/`2`/`3`) plus `CONTACT_SYNC`. The UI **MUST** show progress, and the timeline
**MUST** render correctly while later phases are still landing, not block on full completion.

`id`, `organization_id`, `whatsapp_account_id`, `job_type`
(`CONTACT_SYNC`·`HISTORY_PHASE_1`·`HISTORY_PHASE_2`·`HISTORY_PHASE_3`), `status`,
`started_at`, `completed_at`, `records_received`, `records_imported`, `records_skipped`, `error`.

History arrives in **three ordered phases**. The UI shows progress; the timeline must render
correctly while phases are still landing.

---

## 10. Billing, platform, audit

### 10.1 Billing

#### SN-BILL-063 — Plan limits are server-served; payment data is minimised

Every plan limit (`limits`/`app_constraints`) **MUST** be served from the API and **MUST NOT** be
hardcoded in the client, so one build enforces different ceilings per plan with no release.
`subscription.payment_method` **MUST** store only `{brand, last4, exp_month, exp_year,
method_type}` — never the full provider payment-method object (card fingerprint, 3DS flags,
regulated status). `credit_ledger` **MUST** be append-only; balance is a running total, never
recomputed from scratch in a request path.

`plan`: `id`, `key`, `name`, `tier`, `price_inr`, `price_usd`, `billing_period`, `limits` jsonb,
`features` jsonb, `is_public`, `display_order`.

`limits` is the `app_constraints` object served to the client:

```json
{"max_members": 25, "max_leads": null, "max_custom_fields": 30, "max_groups": 200,
 "max_whatsapp_accounts": 5, "max_sequence_steps": 20, "max_export_rows": 25000,
 "upgrade_prompt_member_threshold": 20,
 "upload": {"file_max_bytes": 104857600, "pdf_max_pages": 200}}
```

**Every limit is served from the API. None is hardcoded in the client.** This is how one build
enforces different ceilings per plan without a release. Adopted directly from Privyr.

`subscription`: `id`, `organization_id`, `plan_id`, `status` (eight states — §11.7), `provider`
(`RAZORPAY`·`STRIPE`), `provider_subscription_id`, `provider_customer_id`, `seats`,
`current_period_start/end`, `trial_ends_at`, `cancel_at_period_end`, `cancelled_at`,
`payment_method` jsonb.

> **`payment_method` stores `{brand, last4, exp_month, exp_year, method_type}` and nothing else.**
> Privyr proxies the entire Stripe PaymentMethod object to the browser, including card
> fingerprint, 3DS support flags and regulated status. That is needless exposure.

`credit_ledger`: `id`, `organization_id`, `delta` numeric(12,4), `balance_after`, `reason`,
`reference_type`, `reference_id`, `created_at`. **Append-only.** Balance is a running total, never
recomputed from scratch in a request path.

`invoice`: `id`, `organization_id`, `provider_invoice_id`, `number`, `status`, `amount`, `tax`,
`currency`, `gstin`, `pdf_url`, `issued_at`, `paid_at`.

### 10.2 `event` — the immutable event log ⚠️ AI substrate

#### SN-AI-046 — `event` is append-only and distinct from `timeline_event`

`event` **MUST** be append-only — never updated, never deleted inside the retention window — and
**MUST** be partitioned by month. `correlation_id`/`causation_id` **MUST** be populated so causal
chains (which arrival caused which assignment caused which message) are reconstructible.
`timeline_event` (user-facing, filtered) and `event` (complete, machine-readable) **MUST** remain
separate tables and must never be merged.

| Column | Type |
|---|---|
| `id` | uuid pk |
| `organization_id` | uuid |
| `event_name` | varchar(64) |
| `aggregate_type`, `aggregate_id` | varchar(32), uuid |
| `actor_type` | `MEMBER`·`SYSTEM`·`INTEGRATION`·`LEAD` |
| `actor_id` | uuid null |
| `payload` | jsonb |
| `occurred_at` | timestamptz |
| `correlation_id`, `causation_id` | uuid |

**Append-only. Never updated, never deleted inside the retention window. Partitioned by month.**

> This table is the entire reason V2 is possible. It is nearly free to write in V1 and cannot be
> reconstructed afterwards. `correlation_id` and `causation_id` let us reconstruct *why* something
> happened — which lead arrival caused which assignment caused which message. See
> [`11-ai-substrate.md`](11-ai-substrate.md).
>
> `timeline_event` is the **user-facing, filtered, human-readable** view. `event` is the
> **complete, machine-readable** record. They are different concerns and must not be merged.

### 10.3 `audit_log`

#### SN-SEC-016 — `audit_log` mandatory coverage and retention

`audit_log` entries **MUST** be written for: permission changes, member status changes,
impersonation (start and end), billing changes, data export, integration connect/disconnect, bulk
delete, and WhatsApp connect/disconnect. Rows **MUST** be immutable, retained for 2 years.

`id`, `organization_id`, `actor_membership_id`, `impersonator_membership_id` null, `action`,
`resource_type`, `resource_id`, `before` jsonb, `after` jsonb, `ip_address`, `user_agent`,
`occurred_at`.

**Mandatory for:** permission changes, member status changes, **impersonation (start and end)**,
billing changes, data export, integration connect/disconnect, bulk delete, WhatsApp
connect/disconnect.

Retention: 2 years. Immutable.

### 10.4 Remaining platform tables

#### SN-ARCH-109 — Remaining platform tables follow §1 conventions

`notification`, `notification_preference`, `activation_task`, `activation_progress`,
`app_warning`, `app_warning_dismissal`, `feature_flag`, `feature_flag_override`, `agency`,
`agency_membership`, `saved_filter`, `export_job`, `import_batch`, and `import_row` **MUST** follow
the standard column conventions in §1/SN-ARCH-106; their detailed columns are specified in their
owning feature specs, not duplicated here.

`notification` · `notification_preference` · `activation_task` (global seed) ·
`activation_progress` · `app_warning` · `app_warning_dismissal` · `feature_flag` ·
`feature_flag_override` · `agency` · `agency_membership` · `saved_filter` ·
`export_job` · `import_batch` · `import_row`.

Columns for these follow the conventions in §1 and are detailed in their feature specs.

---

## 11. Enum reference

Normalised from Privyr's 82 constant groups. Where their wire values are inconsistent or
misspelled, **we fix them and note it**.

### 11.1 Lead
```
LeadSource       MANUAL | IMPORT_CSV | IMPORT_PHONEBOOK | INTEGRATION | WHATSAPP | LEAD_FORM | API
ContactChannel   PHONE | SMS | EMAIL | WHATSAPP | TELEGRAM
DisplayNameStyle FULL_NAME | FIRST_WORD
DuplicatePolicy  CREATE_NEW | MERGE_EXISTING | FLAG_FOR_REVIEW
UnmarkTrigger    CONTENT_SENT | LEAD_VIEWED | CONTACT_CLICKED | FOLLOW_UP_SET | ACTIVITY_LOGGED | MESSAGE_SENT
```
> `FLAG_FOR_REVIEW` is new — Privyr offers only create-or-merge. Silent auto-merge of a false
> positive is unrecoverable, so a review queue is the safe third option.

### 11.2 Follow-up
```
FollowUpBucket   OVERDUE | TODAY | UPCOMING | SOMEDAY      (derived)
FollowUpStatus   PENDING | COMPLETED | CANCELLED
```

### 11.3 Timeline event types
```
LEAD_CREATED · LEAD_ASSIGNED · LEAD_UNASSIGNED · LEAD_STAGE_CHANGED · LEAD_MERGED
FIRST_RESPONSE ⚠️ · NOTE · CALL · MEETING · MESSAGE
CONTENT_SHARED · CONTENT_VIEWED
WHATSAPP_INBOUND · WHATSAPP_OUTBOUND · WHATSAPP_TEMPLATE_SENT · WHATSAPP_FAILED
SEQUENCE_ENROLLED · SEQUENCE_STEP_COMPLETED · SEQUENCE_BROKEN · SEQUENCE_REMOVED
CAMPAIGN_SENT · CAMPAIGN_FAILED · FOLLOW_UP_SET · FOLLOW_UP_COMPLETED
DUPLICATE_DETECTED · FORM_SUBMITTED
```
> **`FIRST_RESPONSE` is a first-class event.** Emit it at write time; it cannot be backfilled, and
> average-response-time reporting depends on it.
> **Failure events are stored alongside successes** — the rep needs to see *why* a lead went quiet.

### 11.4 Content
```
ContentType       MESSAGE | FILE | PAGE
Visibility        PRIVATE | SUBTEAM | ORG
MessageRole       MAIN | FOLLOW_UP | DEFAULT_SHARE
FileStatus        NOT_PROCESSED | PROCESSING | PROCESSED | WILL_NOT_PROCESS | FAILED
PageBlockType     TITLE | DESCRIPTION | GALLERY | VIDEO | MAP | LINK | ATTACHMENT | PDF_VIEWER | CTA
ShareChannel      WHATSAPP | EMAIL | SMS | TELEGRAM | COPY | QR
TokenScope        LEAD | CONTENT | MEMBER | ORG
```

### 11.5 Sequence
```
SequenceType   MANUAL | AUTOMATED | MIXED
StepAction     SHARE_CONTENT | CONTACT_LEAD | DELAY | SEND_WHATSAPP_TEMPLATE
StepExecutor   USER | SYSTEM
StepStatus     PENDING | DUE | SENT | SKIPPED | FAILED | REMOVED
EnrolmentStatus ACTIVE | COMPLETED | BROKEN | REMOVED
```

### 11.6 Automation
```
RuleKind         ROUTING | DISTRIBUTION
Operator         EQUALS | NOT_EQUALS | CONTAINS | STARTS_WITH | ENDS_WITH
DistributionMode BROADCAST | ROUND_ROBIN         ← Privyr ships "ROUND_ROBBIN". Fixed.
DistributionChannel APP | EMAIL | WHATSAPP
```

### 11.7 Subscription
```
SubscriptionStatus  TRIALING | TRIAL_ENDING | TRIAL_EXPIRED | ACTIVE | RENEWING
                    | PAYMENT_FAILING | PAYMENT_OVERDUE | CANCELLED | EXPIRED
```
> `PAYMENT_FAILING` (retrying) is separate from `PAYMENT_OVERDUE` (retries exhausted). The two
> warrant very different tone in the UI, and collapsing them makes dunning either alarmist or
> too late.

### 11.8 WhatsApp
```
ConnectionMode  COEXISTENCE | CLOUD_API | CLICK_TO_CHAT
AccountStatus   PENDING | CONNECTED | DEGRADED | DISCONNECTED | ERROR
HealthState     HEALTHY | WARNING | CRITICAL | DISCONNECTED
MessageSource   APP_ECHO | API | HISTORY_IMPORT
MessageStatus   PENDING | SENT | DELIVERED | READ | FAILED | DELETED
TemplateStatus  DRAFT | PENDING | APPROVED | REJECTED | PAUSED | DISABLED
TemplateCategory MARKETING | UTILITY | AUTHENTICATION
```

---

## 12. Indexes

#### SN-ARCH-110 — Mandatory indexes for hot-path queries

The indexes below **MUST** exist: lead-list and duplicate-detection indexes (the hottest query and
the per-inbound-lead hot path, respectively), the full-text search GIN index, the single-PENDING
follow-up partial unique index, per-partition timeline indexes, the `content_share`/`whatsapp_message`
uniqueness constraints, and the WhatsApp health-sweep index. `organization_id` **MUST** lead every
composite index.

Partial and composite indexes that carry real query load. `organization_id` leads every one.

```sql
-- Lead list: the single hottest query in the product
CREATE INDEX ON lead (organization_id, assigned_membership_id, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX ON lead (organization_id, is_new, created_at DESC)
  WHERE is_new AND deleted_at IS NULL;
CREATE INDEX ON lead (organization_id, last_content_opened_at DESC NULLS LAST)
  WHERE deleted_at IS NULL;

-- Duplicate detection: runs on EVERY inbound lead. Hot path, not incidental.
CREATE INDEX ON lead (organization_id, lower(email))       WHERE email IS NOT NULL;
CREATE INDEX ON lead (organization_id, phone_e164)         WHERE phone_e164 IS NOT NULL;
CREATE INDEX ON lead (organization_id, whatsapp_e164)      WHERE whatsapp_e164 IS NOT NULL;

-- Search
CREATE INDEX ON lead USING gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(email,'')));

-- Follow-up buckets and the count endpoint
CREATE INDEX ON follow_up (organization_id, assigned_membership_id, due_at)
  WHERE status = 'PENDING';
CREATE UNIQUE INDEX ON follow_up (lead_id) WHERE status = 'PENDING';

-- Timeline (per partition)
CREATE INDEX ON timeline_event (lead_id, occurred_at DESC);
CREATE INDEX ON timeline_event (organization_id, occurred_at DESC);
CREATE INDEX ON timeline_event (organization_id, event_type, occurred_at DESC);

-- Sharing and views
CREATE UNIQUE INDEX ON content_share (content_id, lead_id);
CREATE UNIQUE INDEX ON content_share (share_code);
CREATE INDEX ON content_view (content_share_id, viewed_at DESC);

-- WhatsApp
CREATE UNIQUE INDEX ON whatsapp_message (wa_message_id);
CREATE INDEX ON whatsapp_message (conversation_id, sent_at DESC);
CREATE INDEX ON whatsapp_message (organization_id, lead_id, sent_at DESC);
CREATE UNIQUE INDEX ON whatsapp_conversation (whatsapp_account_id, contact_e164);
CREATE INDEX ON whatsapp_account (health_state, last_app_activity_at)
  WHERE status = 'CONNECTED';                       -- drives the 13-day sweep

-- Sequences and campaigns
CREATE UNIQUE INDEX ON sequence_enrolment (sequence_id, lead_id) WHERE status = 'ACTIVE';
CREATE INDEX ON sequence_step_state (status, due_at) WHERE status IN ('PENDING','DUE');
CREATE INDEX ON campaign_recipient (campaign_id, status);

-- Compliance and ingest
CREATE UNIQUE INDEX ON opt_out (organization_id, phone_e164);
CREATE INDEX ON inbound_event (status, received_at) WHERE status = 'PENDING';
```

---

## 13. Fields that can only be captured at write time

#### SN-ARCH-111 — Write-time-only fields must ship in the first migration

The six write-time-only metrics below (average first-response time, time in stage, content view
duration, contacted %, lead-source attribution through conversion, campaign delivery funnel)
**MUST** have their capturing fields/tables present from the first relevant migration — none is
backfillable, and omitting one at launch makes the metric permanently unavailable.

**Read this section before writing the first migration.** Six metrics the product promises are
derivable only if the data is captured as it happens. None can be backfilled.

| Metric | Requires | Consequence of missing it |
|---|---|---|
| Average first-response time | `lead.first_response_at` stamped on first outbound contact | The headline team-dashboard metric is permanently unavailable |
| Time in stage | `custom_field_value_history` rows on every stage change | Silently wrong after the second stage change |
| Content view duration | Delta-chunk beacons with a confirmed-ingest watermark | Only open/not-open, which is far less useful |
| Contacted % | The configurable unmark triggers, recorded as events | Cannot distinguish "contacted" from "opened once" |
| Lead source attribution through to conversion | `source_payload` preserved from ingest, untouched | Cannot answer which campaign produced revenue |
| Campaign delivery funnel | Per-recipient status transitions from webhooks | Only "sent", not delivered/read/failed |

> Three of these six are in the first migration for exactly this reason. Getting them wrong is not
> a bug you fix later — it is data that never existed.

---

## 14. Migration order

#### SN-ARCH-112 — Migration groups 2 and 3 must land together with group 1

Migrations **MUST** follow the dependency-ordered groups below. Groups 2 (`event`, `audit_log`,
`feature_flag`, `plan`, `subscription`) and 3 (leads and custom fields) **MUST** land together with
group 1 (identity) as the G1 foundation — `event` and `custom_field_value_history` are
write-time-only and must exist before the first lead is created.

Dependency-ordered. Each group is independently deployable.

| # | Group | Tables |
|---|---|---|
| 1 | Identity | `user`, `organization`, `membership`, `subteam`, `subteam_membership`, `invitation`, `otp_challenge` |
| 2 | Platform | `event`, `audit_log`, `feature_flag`, `plan`, `subscription` |
| 3 | Leads | `lead`, `lead_group`, `lead_group_link`, `custom_field_definition`, `custom_field_value`, `custom_field_value_history` |
| 4 | Activity | `timeline_event` (+ partitions), `timeline_attachment`, `follow_up` |
| 5 | Content | `content`, `content_message`, `content_file`, `content_page`, `page_template`, labels, folders |
| 6 | Sharing | `content_share`, `content_view` |
| 7 | Sequences | `sequence`, `sequence_step`, `sequence_enrolment`, `sequence_step_state` |
| 8 | Automation | `automation_rule`, `rule_condition`, `distribution_state`, `distribution_log` |
| 9 | Integrations | `integration_definition`, `integration_connection`, `external_lead_form`, `lead_form`, `lead_form_field`, `inbound_event` |
| 10 | WhatsApp | `whatsapp_account`, `whatsapp_conversation`, `whatsapp_message` (+ partitions), `whatsapp_template`, `opt_out`, `coexistence_sync_job` |
| 11 | Campaigns | `campaign`, `campaign_recipient` |
| 12 | Billing | `credit_ledger`, `invoice` |
| 13 | Ops | `notification`, `activation_task`, `export_job`, `import_batch`, `agency` |

**Groups 1–4 are the G1 foundation.** Groups 2 and 3 must land together — `event` and
`custom_field_value_history` are write-time-only and must exist before the first lead is created.
