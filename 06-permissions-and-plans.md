---
doc: 06-permissions-and-plans
status: REVIEW
owner: Engineering + Product
audience: Backend, frontend, QA, security
depends_on: [04-domain-model, 05-api-design]
---

# Permissions, Plans & Paywall

Two orthogonal systems that the UI combines and the server enforces independently.

| System | Question | Owner | Denial |
|---|---|---|---|
| **Permissions** | *Is this person allowed to?* | The organisation's admin | `403` — no upgrade path |
| **Plans** | *Does this subscription include it?* | Us | `423` — upgrade path |

**They must never be collapsed.** A rep who lacks the delete capability should not be shown an
upsell; an owner on the Free plan should not be told they lack permission. Getting this wrong
produces support tickets that are impossible to answer and pricing pages nobody trusts.

---

## 1. Permissions

### 1.1 Model

#### SN-PERM-001 — Capability grid with role-preset overlay

`membership.role_preset` MUST be treated as presentational only; the server MUST always evaluate
`membership.capabilities` (the jsonb capability grid) as the sole source of authorization truth,
never the preset label.

**A per-member capability grid, with named role presets on top.**

Privyr exposes the raw grid with no presets. It is powerful, and it is why adding a team member
takes several minutes of toggling — which is a real drag on activation for a five-person brokerage.
We keep the grid as the authority and add presets as the default path.

```
role_preset ──expands to──► capabilities (jsonb) ──enforced by──► policy layer
                                    │
                            editing any toggle
                            sets role_preset = CUSTOM
```

`membership.role_preset` is **presentational**. `membership.capabilities` is authority. The server
never reads `role_preset` to make a decision.

### 1.2 The capability grid

#### SN-PERM-002 — Capability grid namespace and scope

Capabilities MUST be stored as a flat, namespaced (`domain.action`) jsonb object of booleans
across the ~40 capabilities spanning the 11 domains listed below (leads, schema/content/engagement,
channels/acquisition, organisation). `leads.view_own` MUST always be implicitly true regardless of
grid state.

Namespaced `domain.action`. Stored as a flat jsonb object of booleans.

#### Leads

| Capability | Meaning |
|---|---|
| `leads.create` | Add leads manually or by import |
| `leads.view_own` | See leads assigned to them — **implicit, always true** |
| `leads.view_others` | See leads assigned to other members |
| `leads.view_unassigned` | See leads with no assignee |
| `leads.view_subteam` | Narrows `view_others` to their sub-teams only |
| `leads.edit_others` | Edit leads not assigned to them |
| `leads.delete` | Delete leads |
| `leads.assign` | Change assignment |
| `leads.export` | Export to CSV |
| `leads.bulk_operations` | Bulk assign / delete / group / field-set |
| `leads.view_duplicates` | Access the duplicate queue and merge |

> **Lead visibility is three-dimensional and independently togglable** — self / others /
> unassigned — then narrowed by sub-team. Lifted directly from Privyr, whose i18n
> (`assignment.self|others|unassigned`) confirms the shape. It maps exactly to how these teams
> actually work: a rep sees their own; a team lead sees their sub-team's; a manager sees everything
> including the unassigned pool.

#### Schema, content, engagement

| Capability | Meaning |
|---|---|
| `groups.manage` | Create/edit/delete lead groups |
| `custom_fields.manage` | Manage the org's field schema |
| `content.create` · `content.copy` · `content.edit_others` · `content.delete_others` | |
| `content.edit_pages` | Access the page builder specifically |
| `content.manage_sharing` | Mint and revoke tracked links |
| `content.set_visibility_org` | Publish content org-wide |
| `content.set_visibility_subteam` | Publish to their sub-teams |
| `content_labels.manage` | |
| `sequences.manage` | Create/edit sequences (running one is `leads.*`) |
| `view_tracking.manage` | Configure tracking; see per-view detail |

#### Channels and acquisition

| Capability | Meaning |
|---|---|
| `whatsapp.connect` | Connect or disconnect a number |
| `whatsapp.send` | Send from a connected number — **further scoped by `accessible_whatsapp_account_ids`** |
| `whatsapp.view_all_conversations` | See conversations on leads not assigned to them |
| `whatsapp.manage_templates` | |
| `campaigns.manage` | Create and send campaigns — **spends money** |
| `integrations.manage` | Connect/disconnect lead sources |
| `lead_forms.manage` | |
| `automation.manage` | Routing and distribution rules |

#### Organisation

| Capability | Meaning |
|---|---|
| `team.manage` | Invite, edit permissions, deactivate |
| `team.view_dashboard` | Team performance analytics |
| `subteams.manage` | |
| `subscription.manage` | Billing, plan changes, payment method |
| `branding.manage` | Logos, colours, white-label toggle |
| `agency.manage` | Agency features |
| `analytics.view_org` | Org-wide analytics, not just their own |
| `audit_log.view` | |
| `settings.manage_org` | Org-level preferences |

**~40 capabilities across 11 domains.**

### 1.3 Scoping arrays

#### SN-PERM-003 — Scoping arrays and default-open/default-closed semantics

`accessible_subteam_ids` and `accessible_whatsapp_account_ids` MUST narrow (not replace) their
associated boolean capabilities. Every scoping array in this spec MUST fail open (empty =
unrestricted) except `accessible_whatsapp_account_ids`, which MUST fail closed (empty = no send
access).

Booleans say *what*. These say *which*.

| Field | Type | Effect |
|---|---|---|
| `accessible_subteam_ids` | uuid[] | Narrows `leads.view_others` and content visibility. Empty = no sub-team restriction. |
| `accessible_whatsapp_account_ids` | uuid[] | Which numbers they may send from. Empty = **none**, not all. |

> **`accessible_whatsapp_account_ids` fails closed.** Empty means no send access. Every other
> empty-array scope in this spec fails open (no restriction). This one is deliberately the
> exception because the failure mode is a rep messaging a customer from the wrong company number.
> Document it wherever it appears; a reviewer *will* try to "fix" the inconsistency.

### 1.4 Role presets

#### SN-PERM-004 — Role presets (Owner/Manager/Rep)

Role presets MUST be applied at invite time and MUST flip to `CUSTOM` the instant any individual
capability toggle is edited. Exactly one `OWNER` MUST exist per organisation at all times; the
owner's own capabilities MUST NOT be reducible by anyone, including themselves, and a member MUST
NOT be able to grant a capability they do not themselves hold.

Applied at invite time. Editing any toggle flips `role_preset` to `CUSTOM`.

| Capability group | **Owner** | **Manager** | **Rep** |
|---|:--:|:--:|:--:|
| Leads — create, view own | ✅ | ✅ | ✅ |
| Leads — view others, unassigned | ✅ | ✅ | ❌ |
| Leads — edit others, delete, assign | ✅ | ✅ | ❌ |
| Leads — export, bulk operations | ✅ | ✅ | ❌ |
| Content — create, copy, share | ✅ | ✅ | ✅ |
| Content — edit others, org visibility | ✅ | ✅ | ❌ |
| Custom fields, groups, labels | ✅ | ✅ | ❌ |
| Sequences — manage | ✅ | ✅ | ❌ |
| WhatsApp — send (scoped) | ✅ | ✅ | ✅ |
| WhatsApp — connect, templates | ✅ | ✅ | ❌ |
| Campaigns — manage | ✅ | ✅ | ❌ |
| Integrations, lead forms, automation | ✅ | ✅ | ❌ |
| Team — manage, dashboard | ✅ | ✅ | ❌ |
| Sub-teams, branding, org analytics | ✅ | ✅ | ❌ |
| **Subscription, agency, audit log** | ✅ | ❌ | ❌ |

**Rules**
- Exactly **one** `OWNER` per organisation. Transfer is explicit, audit-logged, and requires
  re-authentication.
- The owner's capabilities cannot be reduced — no locking yourself out.
- A member cannot grant a capability they do not hold. **Enforced server-side**, not just hidden.
- Deactivating a member with assigned leads **requires choosing a reassignment target** or
  explicitly leaving them unassigned. Silently orphaning leads is how a team loses a week of
  pipeline.

### 1.5 Resolution order

#### SN-PERM-005 — Authorization resolution order

Authorization checks MUST be evaluated in the fixed 8-step order (authentication → tenant match →
membership status → capability grid → record-level scope → plan feature → plan limit → feature
flag), with the first denial winning. Tenant mismatch MUST resolve to `404`, never `403`, to avoid
the API acting as a cross-tenant enumeration oracle.

Evaluated in this order; **first denial wins**.

```
1. Is the session authenticated?                            no → 401
2. Does membership.organization_id match the resource?      no → 404  (never 403)
3. Is membership.status = ACTIVE?                           no → 403 ACCOUNT_DEACTIVATED
4. Does the capability grid permit the action?              no → 403 INSUFFICIENT_ROLE
5. Does the record-level scope permit it?                   no → 403 NOT_ASSIGNED
   (assignment · sub-team · accessible_whatsapp_account_ids)
6. Does the plan include the feature?                       no → 423 FEATURE_NOT_IN_PLAN
7. Is the org within its plan limits?                       no → 423 PLAN_LIMIT_REACHED
8. Is the feature flag on for this org?                     no → 425 FEATURE_NOT_ENABLED
```

> **Order matters and is not arbitrary.** Tenant mismatch resolves to `404` at step 2 so the API
> is not an enumeration oracle. Permission (steps 3–5) always resolves before plan (6–7), so an
> unauthorised rep never sees an upgrade prompt for something they would still not be allowed to do
> after paying.

### 1.6 Enforcement

#### SN-PERM-006 — Four-layer enforcement

Authorization MUST be enforced at all four layers independently (tenancy scope, policy, query
scope, response) — no single layer may be relied upon alone. Every list endpoint MUST have a test
asserting a `REP` sees strictly fewer rows than a `MANAGER` in the same fixture.

Four layers. **Every one is required; none is sufficient alone.**

| Layer | Mechanism | Catches |
|---|---|---|
| 1. Tenancy | Global Eloquent scope on `organization_id` | Cross-tenant leaks |
| 2. Policy | Laravel Policy per model, `authorize()` in every controller action | Capability violations |
| 3. Query scope | Repository-level `visibleTo(membership)` | Over-broad list results |
| 4. Response | Policy objects computed on serialisation | Renders the correct UI |

**Layer 3 is the one that gets forgotten.** A correctly-authorised `index` action that returns
every lead in the org is a permission bug that no policy check catches, because the action itself
was allowed. Every list query goes through `visibleTo`.

```php
// The only sanctioned way to build a lead list query.
Lead::visibleTo($membership)      // steps 2 + 5 in one place
    ->filter($request->filters())
    ->paginate();
```

**Test requirement:** every list endpoint has a test asserting a `REP` sees strictly fewer rows
than a `MANAGER` in the same fixture. This is the single highest-value test class in the suite.

---

## 2. Plans

### 2.1 Everything is a server-served constraint

#### SN-PERM-007 — Plan constraints are server-served only

No plan limit or feature gate MAY be hardcoded in the client. `app_constraints` from `/bootstrap`
MUST be the sole source of plan-derived limits, so a single client build serves every plan tier.

**No plan limit is hardcoded in the client.** Ever. `app_constraints` from `/bootstrap`
([`05`](05-api-design.md) §6) is the only source. One build serves every plan; changing a limit is
a database update.

Adopted from Privyr, who do this well.

### 2.2 Plan matrix

#### SN-PERM-008 — Plan matrix (constraint keys and feature keys)

The plan matrix (constraint keys such as `max_members`/`max_leads`/etc. and feature keys such as
`whatsapp_coexistence`/`campaigns`/etc.) defines the shape engineering MUST build against,
independent of the `PROPOSED` pricing figures themselves. WhatsApp Coexistence and view tracking
MUST remain available on the Free tier.

Tiers and prices are `PROPOSED` — see [`01-market-and-positioning.md`](01-market-and-positioning.md).
The *shape* below is what engineering builds against.

| Constraint key | Free | Pro | Business |
|---|---|---|---|
| `max_members` | 1 | 20 | unlimited |
| `max_leads` | 500 | unlimited | unlimited |
| `max_custom_fields` | 5 | 30 | 100 |
| `max_lead_groups` | 10 | 200 | unlimited |
| `max_content_items` | 20 | unlimited | unlimited |
| `max_sequences` | 1 | 25 | unlimited |
| `max_sequence_steps` | 5 | 20 | 20 |
| `max_automation_rules` | 1 | 25 | unlimited |
| `max_lead_forms` | 1 | 20 | unlimited |
| `max_integrations` | 1 | unlimited | unlimited |
| `max_whatsapp_accounts` | 1 | 5 | unlimited |
| `max_export_rows` | 0 | 25 000 | 100 000 |
| `history_sync_months` | 1 | 6 | 6 |
| `analytics_retention_days` | 30 | 365 | unlimited |
| `upgrade_prompt_member_threshold` | — | 18 | — |

| Feature key | Free | Pro | Business |
|---|:--:|:--:|:--:|
| **`whatsapp_coexistence`** | **✅** | **✅** | **✅** |
| **`view_tracking`** | **✅** | **✅** | **✅** |
| `view_duration_detail` | ❌ | ✅ | ✅ |
| `sequences_automated` | ❌ | ✅ | ✅ |
| `campaigns` | ❌ | ✅ | ✅ |
| `lead_distribution` | ❌ | ✅ | ✅ |
| `duplicate_merge` | ❌ | ✅ | ✅ |
| `subteams` | ❌ | ❌ | ✅ |
| `advanced_analytics` | ❌ | ❌ | ✅ |
| `white_label` | ❌ | ❌ | ✅ |
| `agency` | ❌ | ❌ | ✅ |
| `audit_log` | ❌ | ❌ | ✅ |
| `custom_share_domain` | ❌ | ❌ | ✅ |
| `api_access` (V1.5) | ❌ | ❌ | ✅ |

> **Three deliberate positions.**
>
> **1. Coexistence and view tracking are on Free.** They cost us nothing in Meta fees, and they are
> the entire argument for switching. Gating the wedge behind a paywall means the prospect never
> experiences it. Privyr's free tier lets you contact only your single most recent lead — a demo,
> not a product. Ours is genuinely usable, and the upgrade trigger is *team size and volume*, which
> is the honest one.
>
> **2. `history_sync_months: 1` on Free is not a limit, it is the hook.** They connect, see one
> month of their real conversations appear in the CRM, and the upgrade prompt says "see the other
> five months". That is a far better conversion moment than a locked button.
>
> **3. `max_export_rows: 0` on Free** — export is the primary vector for a competitor to harvest
> value and leave. Free accounts can use the product fully; they cannot bulk-extract from it.

### 2.3 Enforcement points

#### SN-PERM-009 — Plan enforcement points and downgrade data-retention

Creation limits, feature flags, volume limits and seat limits MUST each be enforced at their
documented breach behaviour (`423 PLAN_LIMIT_REACHED`, `423 FEATURE_NOT_IN_PLAN`,
truncate-and-report, `423 SEAT_LIMIT_REACHED`). A downgrade MUST NOT destroy any data that exceeds
the new plan's limits — it only blocks further creation.

| Type | Behaviour on breach |
|---|---|
| **Creation limits** (`max_*` counts) | The create call returns `423 PLAN_LIMIT_REACHED` with `{limit, current, plan_required}`. |
| **Feature flags** (`features.*`) | `423 FEATURE_NOT_IN_PLAN`. |
| **Volume limits** (export rows, history months) | Truncate and report — never fail silently. Response includes `{requested, delivered, limit}`. |
| **Seats** | Invite returns `423 SEAT_LIMIT_REACHED`. |

**Downgrade does not destroy data.** If an org drops from Business to Pro with 40 custom fields,
all 40 survive and remain readable. They cannot create a 41st, and the UI shows a persistent
"over your plan limit" notice. **Deleting a customer's data because they paid us less is not an
acceptable behaviour**, and it is a support catastrophe.

Same rule for members: over-limit members are **not deactivated automatically**. The owner is asked
to choose within 14 days; after that, the most recently added over-limit members are deactivated —
never deleted — with notice at day 7, 3 and 1.

### 2.4 Seat limits: hard cap and soft threshold

#### SN-PERM-010 — Seat limits: hard cap, soft threshold, self-serve increase

Seats MUST expose both a soft `upgrade_prompt_threshold` and a `hard_cap`, and seat increases up to
the plan's cap MUST be self-serve and prorated, without requiring a sales interaction below the
Business tier.

```json
"seats": {"used": 18, "included": 20,
          "upgrade_prompt_threshold": 18, "hard_cap": 20,
          "can_self_serve_increase": true}
```

Privyr's `sales_gate_limit` pairs a hard cap with a soft threshold at which upsell prompts begin.
Good pattern, worth keeping.

**Where we diverge:** Privyr routes a seat increase to a **sales form**. For a 12-person brokerage
in Pune that wants a 13th seat on a Tuesday evening, that is a multi-day stall on a decision they
had already made. **Seat increases are self-serve and prorated up to the plan's cap.** Sales
involvement begins only above the Business tier.

### 2.5 Subscription states

#### SN-PERM-011 — Subscription state access matrix

Each of the nine subscription states MUST grant exactly the read/write/send access defined in this
table. Read access and data export MUST remain available in every terminal state (`TRIAL_EXPIRED`,
`EXPIRED`), and `PAYMENT_OVERDUE` MUST block sends only, never reads or writes.

Nine states, from [`04`](04-domain-model.md) §11.7, with the access each grants:

| Status | Read | Write | Send | UI |
|---|:--:|:--:|:--:|---|
| `TRIALING` | ✅ | ✅ | ✅ | Days remaining, from day 7 |
| `TRIAL_ENDING` | ✅ | ✅ | ✅ | Persistent banner, ≤3 days |
| `TRIAL_EXPIRED` | ✅ | ❌ | ❌ | Full-screen paywall, **export still works** |
| `ACTIVE` | ✅ | ✅ | ✅ | — |
| `RENEWING` | ✅ | ✅ | ✅ | — |
| `PAYMENT_FAILING` | ✅ | ✅ | ✅ | Warning banner. Retries in progress. |
| `PAYMENT_OVERDUE` | ✅ | ✅ | ❌ | Urgent banner. Sends blocked; the product still works. |
| `CANCELLED` | ✅ | ✅ | ✅ | Access until `current_period_end` |
| `EXPIRED` | ✅ | ❌ | ❌ | Paywall, **export still works for 90 days** |

> **Read and export survive every terminal state.** A customer who stops paying must always be able
> to get their leads out. It is the right thing to do, it is required under DPDP and GDPR
> portability, and a product that holds data hostage generates the kind of public complaint no
> amount of marketing repairs.
>
> **`PAYMENT_OVERDUE` blocks sending but not working.** Outbound messages cost us real money to a
> customer who is not paying. Everything else stays open.

---

## 3. Paywall UX

### 3.1 Three walls, three treatments

#### SN-PERM-012 — Paywall wall types and visual treatment

Each of the three denial types (permission `403`, plan `423`, flag `425`) MUST render its own
distinct visual treatment. Plan-locked controls MUST remain visible (with a lock badge), never
hidden, so the customer can discover and want the capability.

| Wall | Status | Visual | CTA |
|---|---|---|---|
| **Permission** | `403` | Control hidden, or shown disabled with a tooltip | **None.** "Ask your admin." |
| **Plan** | `423` | Control **visible**, lock badge | "Upgrade to Pro" → plan comparison, feature pre-selected |
| **Flag** | `425` | Control visible, "Soon" badge | **None.** Optional waitlist. |

> **Plan-locked controls stay visible.** Hiding them means the customer never learns the capability
> exists, so they never want it. A visible lock with a specific promise is the entire mechanism by
> which a free tier converts. A permission-denied control is the opposite case — showing a rep
> things they will never be allowed to do is just noise.

### 3.2 Upgrade prompts must be specific

#### SN-PERM-013 — Upgrade prompt content requirements

Every upgrade prompt MUST name the specific limit, the current usage, the tier that lifts it, and
what is gained — generated from `app_constraints` plus a live count. Generic upgrade copy is
prohibited.

Never *"Upgrade for more features."*

| Trigger | Copy |
|---|---|
| Custom field limit | "You've used all 5 custom fields. Pro includes 30." |
| Seat threshold | "You're using 18 of 20 seats. Business includes unlimited." |
| History sync | "You're seeing 1 month of conversation history. Pro imports the full 6 months — 2,847 more messages are waiting." |
| Export | "Export is available on Pro. You have 1,284 leads to export." |

The prompt names **the limit, the current usage, the tier that lifts it, and what they get.** Every
one is generated from `app_constraints` plus a live count, so the numbers are always real.

### 3.3 Frequency

#### SN-PERM-014 — Upgrade prompt frequency caps

At most one interstitial upgrade modal MAY appear per session. A dismissed prompt for a given
feature MUST NOT reappear for 7 days, and no upgrade prompt MAY be shown during onboarding or in a
user's first session.

- At most **one** interstitial upgrade modal per session.
- Inline lock badges are always visible — they are information, not interruption.
- A dismissed prompt for a given feature does not reappear for 7 days.
- **No upgrade prompt during onboarding, or in the first session.** A user who has not yet sent a
  message has no basis to evaluate the offer, and asking makes the product feel like a funnel
  rather than a tool.

---

## 4. Impersonation (agency)

### SN-PERM-015 — Agency impersonation controls

Impersonation MUST satisfy all 8 listed requirements as launch blockers: capability + accepted
non-revoked `agency_membership`, explicit separately-revocable consent, a 60-minute non-extendable
time box, a persistent non-dismissible indicator banner, start/end audit logging with
`impersonator_membership_id` stamped on every write, default read-mostly access with destructive
actions gated behind `allow_destructive`, client-visible impersonation history, and an email
notification to the impersonated user on session start.

The most security-sensitive capability in the product. Privyr's `login-as-user` has no documented
consent gate, time box or visible indicator.

**Requirements — all mandatory, all launch blockers for the agency feature:**

| # | Requirement |
|---|---|
| 1 | Requires `agency.manage` **and** an accepted, non-revoked `agency_membership` |
| 2 | Client-side consent is explicit at invite acceptance and separately revocable at any time, without ending the management relationship |
| 3 | **Time-boxed** — the session expires after 60 minutes and cannot be silently extended |
| 4 | **Visibly indicated at all times** — a persistent, non-dismissible banner naming both the agency and the impersonated account, with a one-click exit |
| 5 | **Audit-logged on start and end**, with `impersonator_membership_id` stamped on **every** write performed during the session |
| 6 | **Read-mostly by default.** Destructive actions — delete, export, billing changes, permission changes, WhatsApp disconnect — are blocked unless the client has granted `allow_destructive` |
| 7 | The client sees an impersonation history in their own settings, not buried in an admin console |
| 8 | The impersonated user is notified by email on session start |

**Sponsorship is distinct from management.** An agency paying the bill does not thereby gain
account access. Three independent relationships — manage, sponsor, impersonate — each separately
granted and separately revocable.

---

## 5. Feature flags

### SN-PERM-016 — Feature flag lifecycle

Feature flags MUST reach the client only through `/bootstrap.feature_flags` and MUST resolve in
order (org override → percentage rollout → default). An off flag MUST return `425`, never `404`.
Flags MUST be removed within 2 releases of reaching 100% rollout, enforced by a lint check failing
on any flag older than 90 days at 100%.

Separate from plans. Plans are commercial; flags are release control.

`feature_flag`: `key`, `description`, `default_state`, `rollout_percentage`.
`feature_flag_override`: `organization_id`, `feature_flag_key`, `state`.

Resolution: **org override → percentage rollout → default**.

Flags reach the client only through `/bootstrap.feature_flags`. An off flag produces `425`, never
`404` — the endpoint exists and the client should say "coming soon" rather than break.

**Flags are removed within 2 releases of reaching 100%.** A flag that outlives its rollout becomes
permanent untested branching. This is a maintenance commitment, and it should be enforced by a
lint check that fails on a flag older than 90 days at 100%.
