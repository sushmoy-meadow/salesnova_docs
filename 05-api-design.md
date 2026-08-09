---
doc: 05-api-design
status: REVIEW
owner: Engineering
audience: Backend, frontend, QA, integration partners
depends_on: [04-domain-model, 06-permissions-and-plans]
---

# API Design & Contract Conventions

The contract between Laravel and Next.js, and eventually between SalesNova and third parties.
**Every rule here is normative.** An endpoint that violates one is a bug regardless of whether it
returns the right data.

---

## 1. Principles

### SN-ARCH-080 — One API version, server-driven rendering, uniform envelopes

The API surface **MUST** expose a single version (`/api/v1`) with no parallel deprecated versions
live at once. The server **MUST** be the sole source of permissions, plan limits, feature
availability, and pricing — the client **MUST NOT** hardcode any such rule. `GET` requests **MUST
NOT** mutate state under any circumstance. Every response **MUST** use the standard envelope shape.

| # | Principle | What it buys us |
|---|---|---|
| 1 | **One version. `/api/v1`.** | Privyr runs `user-client` at v1, v2 and v3 simultaneously with no deprecation path. Nobody on their team can safely delete anything. We version the whole surface or not at all. |
| 2 | **The server decides; the client renders.** | Permissions, plan limits, feature availability, editor vocabularies, onboarding steps and pricing all come from the API. The client never hardcodes a rule. |
| 3 | **Every response is an envelope.** | Uniform success/error handling, one place to attach policy and metadata. |
| 4 | **`GET` is safe. Always.** | Privyr's client-open handler fires `PUT .../update-last-interaction/` as a side effect of viewing. Ours does not mutate on read, ever. |
| 5 | **Write operations are idempotent or explicitly not.** | Mobile networks retry. A double-tap must not create two leads. |
| 6 | **Bulk operations are previewable before they are irreversible.** | Adopted from Privyr and one of their best ideas. |
| 7 | **Errors are machine-readable first, human-readable second.** | A `code` the client switches on, plus a message it may display. |

---

## 2. Shape

### 2.1 URL structure

#### SN-ARCH-081 — URL structure convention

Resource URLs **MUST** follow `{resource}[/{id}][/{sub-resource}][/{action}]` under `/api/v1`, with
resources named as plural nouns and actions as verbs following the id. No service name **MUST**
appear in the path.

```
https://api.salesnova.com/api/v1/{resource}[/{id}][/{sub-resource}][/{action}]
```

- Resources are **plural nouns**: `/leads`, `/content`, `/sequences`
- Actions are **verbs after the id**: `/leads/{id}/assign`, `/campaigns/{id}/send`
- No service prefix in the path. Privyr's `/api/{service}/api/{version}/` leaks its internal
  service topology into every public URL and freezes their ability to reorganise.

### 2.2 Success envelope

#### SN-ARCH-082 — Success envelope shape

Every successful response **MUST** use the `{success, data, meta, policy}` envelope. `meta` and
`policy` **MUST** be omitted when empty; `data` **MUST** be `null` for a `204`-equivalent success.

```json
{
  "success": true,
  "data": { },
  "meta": { },
  "policy": { }
}
```

`meta` and `policy` are omitted when empty. `data` is `null` for a `204`-equivalent success.

### 2.3 List envelope

#### SN-ARCH-083 — List envelope shape

A list response **MUST** include `meta.pagination`, `meta.counts`, `meta.applied_filters`, and
`meta.sort`. Tab/filter counts **MUST** be returned with the list itself, never fetched via a
separate round-trip.

```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "pagination": {"page": 1, "per_page": 50, "total": 1284, "total_pages": 26, "has_more": true},
    "counts": {"all": 1284, "unassigned": 12, "new": 47},
    "applied_filters": {"assigned_to": "…", "group_ids": ["…"]},
    "sort": {"field": "created_at", "direction": "desc"}
  },
  "policy": {
    "access_policy": {"can_create": true, "can_bulk_delete": false, "can_export": true},
    "subscription_access_policy": {"can_export": false, "export_locked_reason": "PLAN_LIMIT"}
  }
}
```

> **`counts` is returned with the list, not fetched separately.** Privyr's UI makes a second
> round-trip for tab counts on a screen where every millisecond costs a rep a lead.

### 2.4 Error envelope

#### SN-ARCH-084 — Error envelope shape

Every error response **MUST** use the `{success: false, error: {code, message, details, trace_id}}`
envelope. `trace_id` **MUST** be present on every error response and **MUST** match the
corresponding server log entry.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The lead could not be saved.",
    "details": {
      "phone_e164": ["Not a valid phone number for country IN."]
    },
    "trace_id": "01JAY7K2E9…"
  }
}
```

`trace_id` is on **every** error response and matches the server log entry. It is the single
biggest reduction in support time we can buy for one line of code.

---

## 3. The dual policy objects ⭐

### SN-ARCH-085 — Dual policy objects: access_policy and subscription_access_policy

Every record and list **MUST** carry both an `access_policy` and a `subscription_access_policy`,
computed independently. The client **MUST** AND the two before rendering an action as available.
The server **MUST** re-check both at write time regardless of what the policy object said. A denial
**MUST** carry a reason code (`NOT_ASSIGNED` · `INSUFFICIENT_ROLE` · `PLAN_LIMIT` · `SEAT_LIMIT` ·
`FEATURE_NOT_ENABLED`) so the UI can be specific.

Adopted from Privyr, and the most useful pattern in their entire design.

**Every record and every list carries two independent policy objects. The client ANDs them.**

```json
"policy": {
  "access_policy":               {"can_edit": true,  "can_delete": false, "can_export": true},
  "subscription_access_policy":  {"can_edit": true,  "can_delete": true,  "can_export": false}
}
```

| Object | Answers | Denial produces |
|---|---|---|
| `access_policy` | *Is this person allowed?* — role, capability grid, assignment, sub-team | `403` · a plain "you don't have access" · **no upgrade CTA** |
| `subscription_access_policy` | *Does this plan include it?* — tier, limits, seats | `423 Locked` · an upgrade modal naming the required tier |

**Rules**

1. The client renders an action as available **only if both are true**.
2. The two are computed independently. Never collapse them into one boolean — the resulting UI
   tells an unauthorised rep to upgrade the plan, which is both wrong and insulting.
3. The server **re-checks both on the write**. The policy object is a rendering hint, never the
   enforcement point.
4. A denial carries a reason code so the UI can be specific:
   `NOT_ASSIGNED` · `INSUFFICIENT_ROLE` · `PLAN_LIMIT` · `SEAT_LIMIT` · `FEATURE_NOT_ENABLED`.

---

## 4. HTTP status codes

### SN-ARCH-086 — HTTP status code and error code contract

Endpoints **MUST** use the status codes in the table below with their specified meaning, including
`404` (never `403`) for cross-tenant access, and the Privyr-adopted `423 Locked` / `425 Too Early`
distinction. Error `code` values from the §4.1 catalogue **MUST** be treated as permanent and
additive — removing one is a breaking change.

| Code | Meaning | Client behaviour |
|---|---|---|
| `200` | Success with body | — |
| `201` | Created | Includes `Location` |
| `202` | Accepted — async job started | Poll `data.job_id` |
| `204` | Success, no body | — |
| `400` | Malformed request | Developer error; generic message |
| `401` | Not authenticated / token expired | Refresh once, then redirect to login |
| `403` | Authenticated but not permitted | Plain denial. **No upgrade prompt.** |
| `404` | Not found, or not visible to this tenant | Identical response either way |
| `409` | Conflict — duplicate, or concurrent edit | Show the conflict resolution flow |
| `410` | Gone — share revoked, form closed | Recipient-facing "no longer available" |
| `422` | Validation failed | Field-level errors from `details` |
| **`423`** | **Locked — plan does not include this** | **Upgrade modal, names the tier** |
| **`425`** | **Too Early — feature flag off for this org** | **"Coming soon". No CTA.** |
| `429` | Rate limited | Respect `Retry-After` |
| `500` | Server error | Generic message + `trace_id` |
| `503` | Dependency unavailable | Degraded-mode banner |

> **`404` for cross-tenant access is deliberate.** Returning `403` confirms the record exists,
> which is an enumeration oracle. Not found and not yours must be indistinguishable.

> **`423` and `425` are both adopted from Privyr** and both are genuinely good calls. A locked
> feature and an unreleased feature need different UI, and separating them at the protocol level
> means the client never has to guess.

### 4.1 Error codes

```
Auth      UNAUTHENTICATED · TOKEN_EXPIRED · INVALID_CREDENTIALS · OTP_INVALID
          OTP_EXPIRED · OTP_MAX_ATTEMPTS · ACCOUNT_DEACTIVATED
Access    FORBIDDEN · NOT_ASSIGNED · INSUFFICIENT_ROLE · ORG_MISMATCH
Plan      PLAN_LIMIT_REACHED · SEAT_LIMIT_REACHED · FEATURE_NOT_IN_PLAN
          SUBSCRIPTION_EXPIRED · PAYMENT_REQUIRED
Flags     FEATURE_NOT_ENABLED
Validate  VALIDATION_FAILED · DUPLICATE_RESOURCE · INVALID_PHONE
          INVALID_STATE_TRANSITION · CONSTRAINT_VIOLATION
Resource  NOT_FOUND · GONE · CONFLICT · CONCURRENT_MODIFICATION
WhatsApp  WA_NOT_CONNECTED · WA_SERVICE_WINDOW_CLOSED · WA_TEMPLATE_NOT_APPROVED
          WA_OPTED_OUT · WA_RATE_LIMIT · WA_PROVIDER_ERROR · WA_ACCOUNT_DEGRADED
System    RATE_LIMITED · INTERNAL_ERROR · DEPENDENCY_UNAVAILABLE
```

Codes are **permanent and additive**. Removing one is a breaking change.

---

## 5. Authentication

### SN-ARCH-087 — Authentication: token scheme, rotation, and org context

Auth **MUST** use a short-lived (15 min) JWT access token plus a rotating, `HttpOnly`/`Secure`
refresh token; a refresh token reused after rotation **MUST** revoke its entire token family and
force re-login. Capabilities **MUST NOT** be embedded in the access token — they **MUST** be
sourced from `/bootstrap` and re-checked server-side on every write. `X-Organization-Id` **MUST**
be required whenever a user has more than one membership. OTP/auth endpoints **MUST** enforce the
server-side rate limits in this section, not client-side timers.

**Short-lived access token + rotating refresh token.**

| | |
|---|---|
| Access token | JWT, 15 min, `Authorization: Bearer` |
| Refresh token | Opaque, 30 days, **rotated on every use**, `HttpOnly` `Secure` `SameSite=Lax` cookie |
| Reuse detection | A refresh token used twice revokes the entire family and forces re-login |
| Org context | `X-Organization-Id` header. Required when the user has >1 membership. |

**Access token claims:** `sub` (user), `org` (organization), `mbr` (membership), `jti`, `exp`.
**Capabilities are not in the token** — they change mid-session (a manager promotes a rep) and a
stale token must not grant stale authority. They come from `/bootstrap` and are re-checked server-
side on every write.

### 5.1 Auth endpoints

```
POST /api/v1/auth/otp/request      {identifier, channel, purpose}   → 200 {expires_at, resend_after}
POST /api/v1/auth/otp/verify       {identifier, code}               → 200 {access_token, user, memberships}
POST /api/v1/auth/google           {id_token}                       → 200
POST /api/v1/auth/refresh          (cookie)                         → 200 {access_token}
POST /api/v1/auth/logout                                            → 204
POST /api/v1/auth/magic-link/verify {token}                         → 200
GET  /api/v1/auth/memberships                                       → 200 [org list]
POST /api/v1/auth/switch-org       {organization_id}                → 200
```

**Server-side rate limits, not client timers:** OTP request 1/15s and 5/hour per identifier;
verify 5 attempts per challenge; 20 requests/hour per IP.

---

## 6. `/bootstrap` — the one fat call ⭐

```
GET /api/v1/bootstrap
```

### SN-ARCH-088 — `/bootstrap` is the single source of shell-render state

`/bootstrap` **MUST** return everything the app shell needs in one round-trip: user, organization,
membership, capabilities, subscription, `app_constraints`, feature flags, navigation, warnings,
onboarding/activation state, counts, and `server_time`. Every client-side limit in the product
**MUST** appear in `app_constraints` — none **MUST** be hardcoded in the frontend. The response
**MUST** be invalidated via the `X-Bootstrap-Stale: true` header on any request after a relevant
mutation.

Everything the shell needs to render, in one round-trip. Adopted directly from Privyr's
`app-startup`, which is a genuinely good design that most SaaS products get wrong by scattering
across six calls.

```json
{
  "user": {"id": "…", "name": "…", "email": "…", "avatar_url": "…", "timezone": "Asia/Kolkata"},
  "organization": {"id": "…", "name": "…", "branding": {…}, "country_code": "IN", "currency": "INR"},
  "membership": {"id": "…", "role_preset": "MANAGER", "subteam_ids": ["…"]},
  "capabilities": {"leads.view_all": true, "leads.delete": false, "team.manage": true, …},
  "subscription": {"plan_key": "pro", "status": "ACTIVE", "seats_used": 8, "seats_total": 20,
                   "trial_ends_at": null, "current_period_end": "…"},
  "app_constraints": {"max_members": 20, "max_custom_fields": 30, "max_sequence_steps": 20,
                      "max_export_rows": 25000, "upgrade_prompt_member_threshold": 18,
                      "upload": {"file_max_bytes": 104857600, "pdf_max_pages": 200}},
  "feature_flags": {"whatsapp_coexistence": true, "ai_email_parsing": false},
  "navigation": [{"key": "leads", "label": "Leads", "route": "/leads", "badge_source": "leads.new"}],
  "warnings": [{"code": "WA_INACTIVITY_WARNING", "severity": "warning",
                "message": "Open WhatsApp Business on your phone within 4 days…",
                "action": {"label": "How to fix", "route": "/settings/whatsapp"},
                "dismissible": false}],
  "onboarding": {"is_complete": false, "next_screen_key": "connect_whatsapp"},
  "activation": {"completed": 3, "total": 7, "is_dismissed": false},
  "counts": {"leads.new": 12, "follow_ups.overdue": 5, "inbox.unread": 3},
  "server_time": "2026-07-27T09:14:22Z"
}
```

**Rules**
- **Every client-side limit in the product appears in `app_constraints`.** Nothing is a magic
  number in the frontend. This is how one build serves every plan.
- `navigation` is server-driven, so a plan change or a flag rollout reshapes the nav with no
  release.
- `warnings` is the single channel for banners — expiry, payment failure, WhatsApp health, seat
  limits. One rendering component, many producers.
- `server_time` lets the client compute relative times without trusting the device clock, which on
  budget Android is frequently minutes off.
- Cached client-side; invalidated by a `X-Bootstrap-Stale: true` response header on any request
  after a relevant mutation.

---

## 7. Pagination

### SN-ARCH-089 — Pagination modes: offset and cursor

Finite, sortable, jump-to-page lists **MUST** use offset pagination; append-heavy, unbounded
streams (timeline, messages, events, activity) **MUST** use opaque cursor pagination — a raw offset
**MUST NOT** be exposed on a stream. `per_page` **MUST** default to 50 and clamp (never reject) at
a max of 200, reporting the clamp in `meta`.

**Two modes. Pick per endpoint, and document which.**

**Offset** — for finite, sortable, jump-to-page lists: leads, content, team.
```
GET /api/v1/leads?page=2&per_page=50
```

**Cursor** — for append-heavy, unbounded streams: timeline, messages, events, activity.
```
GET /api/v1/leads/{id}/timeline?cursor=eyJ0IjoiMjAy…&limit=50
→ meta.pagination: {"next_cursor": "…", "has_more": true}
```

Cursors are **opaque base64** of `(occurred_at, id)`. Never expose a raw offset on a stream — new
rows arriving shift the window and the user silently skips records.

`per_page` default 50, max 200. Requests above the max are **clamped, not rejected**, and `meta`
reports the clamp.

---

## 8. Filtering, sorting, search

### SN-ARCH-090 — Filtering, sorting, and search contract

Simple filters **MUST** be expressible as query params with `-`-prefixed descending sort. Complex
filters (nested groups, long `IN` lists, custom-field predicates) **MUST** use the side-effect-free
`POST /query` sibling, capped at nesting depth 2 and 20 conditions, enforced server-side. Search
**MUST** normalise phone-number queries through libphonenumber against the org's default country
before hitting the index, and **MUST** hold p95 < 200 ms.

### 8.1 Simple filters — query params

```
GET /api/v1/leads
  ?assigned_to=me|unassigned|{membership_id}
  &group_ids=a,b            &stage=New,Contacted
  &source=INTEGRATION       &created_after=2026-07-01
  &has_follow_up=true       &is_new=true
  &q=raj                    &sort=-created_at
```

`sort` uses a `-` prefix for descending. Multiple keys comma-separated.

### 8.2 Complex filters — `POST /query`

When a filter needs nested groups, `IN` lists longer than a URL bears, or custom-field predicates,
use the `/query` sibling.

```
POST /api/v1/leads/query
{
  "filters": {
    "operator": "AND",
    "conditions": [
      {"field": "cf.stage", "operator": "IN", "value": ["New", "Contacted"]},
      {"field": "created_at", "operator": "GTE", "value": "2026-07-01"},
      {"operator": "OR", "conditions": [
        {"field": "source", "operator": "EQUALS", "value": "INTEGRATION"},
        {"field": "group_ids", "operator": "CONTAINS", "value": "…"}
      ]}
    ]
  },
  "sort": [{"field": "created_at", "direction": "desc"}],
  "page": 1, "per_page": 50
}
```

> **A `POST` that reads is acceptable only at the `/query` suffix, and it must remain side-effect
> free.** Naming the exception explicitly is what stops it spreading. The rule that `GET` never
> mutates is not weakened by this.

Max nesting depth 2. Max 20 conditions. Both enforced server-side with `VALIDATION_FAILED`.

### 8.3 Search

```
GET /api/v1/search?q=raj&types=leads,content&limit=10
```

Returns grouped results with a `type` discriminator. **p95 < 200 ms.**

**Phone-number normalisation is mandatory.** `98765 43210`, `+91 98765 43210`, `9876543210` and
`098765-43210` must all match the lead stored as `+919876543210`. The query is normalised through
libphonenumber against the org's default country before it hits the index. A rep searching by the
number as it appears on their phone screen is the single most common search in the product.

---

## 9. Idempotency

### SN-ARCH-091 — Idempotency keys and optimistic concurrency

Every `POST` that creates a billable or user-visible artefact **MUST** accept `Idempotency-Key`,
store it 24h with the response, replay the original response with `X-Idempotent-Replay: true` on
repeat, and return `409 CONFLICT` if the same key is reused with a different body. It is **required**
on lead create, message send, campaign send, share mint, payment, and bulk operations. `PATCH`
**MUST** accept `If-Match: <etag>` and return `409 CONCURRENT_MODIFICATION` with the current record
on mismatch.

**Every `POST` that creates a billable or user-visible artefact accepts `Idempotency-Key`.**

```
POST /api/v1/leads
Idempotency-Key: 01JAY7K2E9XQ8V4NRW3TZ6MB5C
```

- Key stored 24 h with the response.
- A replay returns the **original response** with `X-Idempotent-Replay: true`.
- Same key with a **different body** → `409 CONFLICT`.
- **Required** on: lead create, message send, campaign send, share mint, payment, bulk operations.
- Naturally idempotent by design: share minting (unique on `content_id, lead_id`), WhatsApp ingest
  (unique on `wa_message_id`).

**Optimistic concurrency on updates.** `PATCH` accepts `If-Match: <etag>`; a mismatch returns
`409 CONCURRENT_MODIFICATION` with the current record so the client can present a diff. This
matters most for a lead two reps have open at once — a common scenario, and one Privyr resolves
with silent last-write-wins.

---

## 10. Bulk operations ⭐ preview before you commit

### SN-ARCH-092 — Bulk operations: preview-before-commit and async execution

Every bulk endpoint **MUST** expose a `/preview` sibling with an identical request body, returning
`affected_count`, `eligible_count`, `ineligible` reasons, `estimated_cost`, `warnings`, and
`requires_confirmation` before the mutating call runs. `selection.mode` **MUST** support both `IDS`
and `FILTER`. Bulk operations over 500 records **MUST** run async (`202` + `job_id`, polled at
`/jobs/{job_id}`).

**Every bulk endpoint has a `/preview` sibling with an identical request body.**

```
POST /api/v1/leads/bulk/assign/preview      → what would happen, and what it costs
POST /api/v1/leads/bulk/assign              → do it
```

```json
{
  "selection": {"mode": "IDS", "ids": ["…"]},
  "action": {"assign_to_membership_id": "…"}
}
```

`selection.mode` is `IDS` or **`FILTER`** — the latter takes the same filter object as
`/leads/query`, so "select all 1,284 matching" does not require the client to send 1,284 ids.

**Preview response**

```json
{
  "affected_count": 1284,
  "eligible_count": 1240,
  "ineligible": [{"reason": "NOT_ASSIGNED_TO_YOU", "count": 44}],
  "estimated_cost": {"credits": 0, "currency": "INR", "amount": 0},
  "warnings": ["12 leads have an active sequence that will be broken."],
  "requires_confirmation": true
}
```

> The cost preview matters most for WhatsApp campaigns, where a mis-set filter is a real bill.
> Privyr's `preview-message-cost` is a good instinct; we generalise it to every bulk path.

Bulk operations over 500 records run **async**: `202` with a `job_id`, polled at
`GET /api/v1/jobs/{job_id}` returning `{status, progress, processed, total, errors[], result_url}`.

**Bulk endpoints**
```
/leads/bulk/{assign|delete|add-to-group|remove-from-group|set-field|enroll-sequence|export}
/content/bulk/{delete|move-to-folder|add-label|set-visibility}
/campaigns/{id}/recipients/preview
```

---

## 11. Ordering

### SN-ARCH-093 — Relative-move ordering convention

Where order is business logic (sequence steps, rule priority, custom-field display, form fields,
page blocks), reordering **MUST** be expressed as a relative move (`{position, relative_to}` or
`{move}`), never as a full index array — a full array allows two concurrent editors to silently
overwrite each other.

Where order is business logic — sequence steps, rule priority, custom-field display, form fields,
page blocks — reordering is a **relative move**, never a full index array.

```
POST /api/v1/sequences/{id}/steps/{step_id}/move   {"position": "AFTER", "relative_to": "…"}
POST /api/v1/custom-fields/{id}/move               {"move": "UP"}
```

> Adopted from Privyr's `{cf_id, move}` contract. Sending the whole array means two managers
> dragging simultaneously silently overwrite each other; a relative move is conflict-free and the
> payload is constant-size.

---

## 12. Uploads

### SN-ARCH-094 — Presigned direct-to-storage uploads

Uploads **MUST** go direct-to-storage via a presigned URL (`sign` → direct `PUT`/`POST` → register)
— the API **MUST NOT** proxy file bytes. The signing step **MUST** enforce plan limits and MIME
allowlists before any byte moves. Signed URLs **MUST** expire within 15 minutes, and storage keys
**MUST** be opaque and never guessable.

**Presigned direct-to-storage.** The API never proxies file bytes.

```
1. POST /api/v1/uploads/sign  {filename, mime, size_bytes, purpose}
   → {upload_url, fields{}, storage_key, expires_at}
2. PUT/POST direct to storage
3. POST /api/v1/content/files {storage_key, title, …}
```

- `purpose` ∈ `CONTENT_FILE` · `PAGE_IMAGE` · `AVATAR` · `LOGO` · `IMPORT_CSV` ·
  `TIMELINE_ATTACHMENT` · `CAMPAIGN_MEDIA`
- The signing step **enforces plan limits and MIME allowlists before a byte moves**. Validating
  after upload wastes the user's mobile data, which in this market is a real cost.
- Signed URLs expire in 15 minutes.
- Storage keys are opaque and never guessable; public serving is via CDN URLs minted separately.

---

## 13. Recipient-facing (public) API

### SN-ARCH-095 — Public API isolation and non-negotiables

The recipient-facing public API **MUST** run as a separate deployment with separate rate limits and
CORS, and **MUST NOT** require authentication or load third-party trackers. `?preview=1` **MUST**
be enforced server-side (submit returns `403 PREVIEW_MODE`). The engagement beacon **MUST** use
`visibilitychange`/`pagehide` via `navigator.sendBeacon`, never `unload`, and duration **MUST**
advance only on confirmed server ingest. Public identifiers (`share_code`, etc.) **MUST** be
high-entropy and non-enumerable.

**Separate deployment, separate rate limits, separate CORS, no authentication, no marketing
trackers.** See [`03-information-architecture.md`](03-information-architecture.md) §6.

```
GET  /public/v1/share/{share_code}          → content payload + tracking config
POST /public/v1/share/{share_code}/view     → register a view (engagement-gated)
POST /public/v1/share/{share_code}/beacon   → duration delta
GET  /public/v1/form/{form_code}            → form schema
POST /public/v1/form/{form_code}/submit     → create lead
GET  /public/v1/unsubscribe/{token}         → opt-out landing
POST /public/v1/unsubscribe/{token}         → confirm opt-out
```

**Non-negotiables on this surface**

1. **`?preview=1` is enforced server-side.** Privyr hides the submit button in the client and
   accepts the submission anyway. Preview mode returns `403 PREVIEW_MODE` on submit.
2. **No third-party trackers.** Privyr loads seven — including a Facebook pixel and a session
   recorder — onto public lead-capture forms, which are collecting personal data under our
   customers' names. We load none.
3. **The beacon uses `visibilitychange` + `pagehide`, never `unload`.** `unload` does not fire
   reliably on mobile Safari or Android Chrome — precisely the browsers our recipients use. Payload
   goes via `navigator.sendBeacon`.
4. **The duration watermark advances only on confirmed ingest.** Privyr fires the beacon and
   advances its counter before the server acknowledges, so a retried beacon re-counts elapsed time
   — inflating durations quadratically on a flaky connection.
5. **No enumerable identifiers.** `share_code` is high-entropy random. Privyr returns
   `hitcountPK: 6749871` and `hit_id: 3829825` to the recipient; two requests a day apart give any
   competitor their platform-wide daily view volume.
6. **Aggressive rate limiting by IP and code**, with a CAPTCHA challenge on form submit above
   threshold.

---

## 14. Inbound webhooks

```
POST /webhooks/v1/whatsapp/{provider}
POST /webhooks/v1/facebook/leadgen
POST /webhooks/v1/{integration_key}/{connection_token}
POST /webhooks/v1/billing/{razorpay|stripe}
```

### SN-ARCH-096 — Inbound webhook handling order

Inbound webhook handlers **MUST**, in order: (1) verify the signature and reject unsigned/mismatched
with `401`; (2) persist to `inbound_event` before any processing; (3) return `200` immediately and
process asynchronously; (4) deduplicate on the provider's event id (at-least-once delivery is
guaranteed, not exactly-once); (5) validate payload shape defensively, producing a replayable
`FAILED` row rather than a `500` that loses the lead.

**Mandatory handling, in this order:**

1. **Verify the signature.** Reject unsigned or mismatched with `401`, and log it.
2. **Persist to `inbound_event` before any processing.** Non-negotiable (see
   [`04`](04-domain-model.md) §8.4).
3. **Return `200` immediately.** Process asynchronously. Meta retries on slow responses and will
   throttle or disable a laggy endpoint.
4. **Deduplicate.** At-least-once delivery is guaranteed; exactly-once is not. Key on the
   provider's event id.
5. **Never trust the payload shape.** Validate against a schema; a shape change must produce a
   `FAILED` row we can replay, not a `500` that loses the lead.

---

## 15. Rate limiting

### SN-ARCH-097 — Rate limit scopes and headers

Rate limits **MUST** be enforced per the scopes in the table below, with `X-RateLimit-Limit`,
`X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers on every response, and `Retry-After` on
every `429`. WhatsApp send throughput **MUST** be governed separately by the account's
`throughput_mps`, enforced in the queue rather than the HTTP layer.

| Scope | Limit |
|---|---|
| Authenticated, per membership | 300 req/min |
| Search | 60 req/min |
| Bulk operations | 10 req/min |
| OTP request | 5/hour per identifier |
| Public share view | 120 req/min per IP |
| Public form submit | 10/hour per IP |
| Webhook ingest | 1000 req/min per provider |

Headers on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
`429` includes `Retry-After`.

**WhatsApp send throughput is governed separately** by the account's `throughput_mps` (5/sec on
Coexistence) and enforced in the queue, not the HTTP layer.

---

## 16. Endpoint inventory

Grouped by domain. Full request/response schemas live in the feature specs.

**Auth & identity** — `/auth/*`, `/bootstrap`, `/me`, `/me/preferences`, `/onboarding/screen`,
`/onboarding/submit`, `/activation/tasks`, `/activation/dismiss`

**Leads** — `/leads` (CRUD), `/leads/query`, `/leads/{id}/assign`, `/leads/{id}/timeline`,
`/leads/{id}/follow-up`, `/leads/{id}/duplicates`, `/leads/{id}/merge`, `/leads/{id}/contact-log`,
`/leads/bulk/*`, `/leads/import`, `/leads/export`, `/leads/counts`

**Schema** — `/custom-fields` (CRUD + `/move`), `/lead-groups` (CRUD), `/saved-filters` (CRUD)

**Follow-ups** — `/follow-ups?bucket=`, `/follow-ups/counts`, `/follow-ups/{id}/complete`

**Content** — `/content` (CRUD), `/content/messages`, `/content/files`, `/content/pages`,
`/content/{id}/duplicate`, `/content/{id}/shares`, `/content/{id}/analytics`,
`/content-folders`, `/content-labels`, `/page-templates`, `/page-templates/{key}/schema`

**Sharing** — `/shares` (mint), `/shares/{id}` (revoke), `/shares/{id}/views`

**Sequences** — `/sequences` (CRUD), `/sequences/{id}/steps` (CRUD + `/move`),
`/sequences/{id}/enroll`, `/sequences/{id}/enrolments`, `/enrolments/{id}/remove`,
`/my-tasks` (the rep's queue of `executor: USER` steps)

**Automation** — `/rules` (CRUD + `/move`), `/rules/{id}/test`, `/rules/{id}/logs`,
`/rules/{id}/distribution-state`

**Integrations** — `/integrations` (registry), `/integrations/{key}/connect`,
`/connections` (CRUD), `/connections/{id}/forms`, `/connections/{id}/sync`,
`/lead-forms` (CRUD), `/lead-forms/{id}/fields`, `/lead-forms/metadata`, `/lead-forms/{id}/qr`

**WhatsApp** — `/whatsapp/accounts` (CRUD), `/whatsapp/accounts/{id}/onboarding-session`,
`/whatsapp/accounts/{id}/health`, `/whatsapp/accounts/{id}/sync-history`,
`/whatsapp/conversations`, `/whatsapp/conversations/{id}/messages`,
`/whatsapp/messages` (send), `/whatsapp/templates` (CRUD), `/whatsapp/opt-outs`

**Campaigns** — `/campaigns` (CRUD), `/campaigns/{id}/recipients/preview`,
`/campaigns/{id}/send`, `/campaigns/{id}/cancel`, `/campaigns/{id}/report`

**Team & agency** — `/members` (CRUD), `/members/{id}/capabilities`, `/members/{id}/deactivate`,
`/invitations`, `/subteams` (CRUD), `/team/dashboard`, `/agency/accounts`,
`/agency/accounts/{id}/impersonate`

**Analytics** — `/analytics/overview`, `/analytics/leads`, `/analytics/content`,
`/analytics/team`, `/analytics/whatsapp`

**Billing** — `/billing/plans`, `/billing/subscription`, `/billing/checkout`,
`/billing/payment-method`, `/billing/invoices`, `/billing/credits`

**Platform** — `/notifications`, `/notification-preferences`, `/jobs/{id}`, `/uploads/sign`,
`/audit-log`

**~140 authenticated endpoints** against Privyr's ~180 templates. The reduction comes from
collapsing their `v1`/`v2`/`v3` duplicates, merging separate count endpoints into list `meta`, and
generalising three separate preview endpoints into the one `/preview` convention.

---

## 17. Reserved for third parties (V1.5)

Not built in V1, but the surface is designed so it can be exposed without a redesign:

- **`/api/v1` is the public surface.** No internal-only shapes leak into it.
- API keys will scope to a membership, inheriting its capability grid — no separate permission
  model to invent later.
- Outbound webhooks (`lead.created`, `lead.stage_changed`, `message.received`) map 1:1 onto the
  `event` table's `event_name` values, so the publisher is a subscriber to something that already
  exists.

This costs nothing now and prevents a v2-of-the-API rewrite in nine months.
