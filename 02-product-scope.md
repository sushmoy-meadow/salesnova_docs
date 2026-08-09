---
doc: 02-product-scope
status: REVIEW
owner: Product
audience: Product, engineering, design, QA
depends_on: [00-executive-summary, 01-market-and-positioning]
---

# Product Scope, Phasing & Success Metrics

## 1. The scope decision

**V1 is full web parity with Privyr, plus WhatsApp Coexistence.**

This is a deliberate and expensive choice, so it's worth stating the reasoning plainly.

A thin wedge would ship faster, but this market does not buy wedges. The buyer is replacing a
working product. If SalesNova is missing custom fields, or bulk reassign, or CSV export, the
evaluation ends there regardless of how good the WhatsApp story is. **Parity is the price of
admission; Coexistence is the reason to switch.** Shipping the reason without the price of
admission sells nothing.

The counter-risk is a long runway before anything is sellable. Section 5 manages that with four
gates, each of which produces something real.

### 1.1 What "parity" means precisely

Parity means: **a Privyr customer can move to SalesNova without losing a capability they use on the
web.** It does not mean endpoint-for-endpoint equivalence, and it explicitly does not mean copying
their defects, their inconsistent API versioning, or their mobile-only features.

Where we deliberately diverge, the feature spec says so and gives the reason.

---

## 2. In scope for V1

Mapped against the reverse-engineered Privyr surface. **Every row here is a commitment.**

### 2.1 Identity, org and access

| Capability | Notes |
|---|---|
| Passwordless email OTP sign-in | Server-enforced cooldown and attempt limits |
| Phone/SMS OTP sign-in | Equal-status alternative, not a fallback |
| Google Sign-In | ID token verified server-side |
| Server-rendered signup (separate from the app) | Faster first paint, indexable, no app bundle for non-users |
| Acquisition attribution captured at signup | Server-side window. Cannot be added later. |
| Change email with OTP re-verification | |
| Magic-link scoped access | For shared resources |
| Single bootstrap endpoint | User + permissions + flags + subscription + limits in one call |
| Organisation and member model | Deactivate-never-delete |
| Per-member capability grid + role presets | Owner / Manager / Rep expand into the grid |
| Sub-teams | Scoping both content visibility and lead access |
| Server-driven onboarding | Backend picks the next screen; A/B-testable variants |
| Activation checklist | Server-defined copy, covers, thresholds |
| Dismissible server-driven app warnings | |

### 2.2 Leads

| Capability | Notes |
|---|---|
| Single lead entity with lifecycle flag | Not separate lead/client tables |
| Spreadsheet grid view | Column order and visibility persisted per user |
| Compact table view | Light projection for speed |
| Uncontacted, recently-active, follow-up views | |
| Lead detail with inline editing | |
| E.164 phone storage, separate contact and WhatsApp numbers | Not the libphonenumber struct Privyr persists |
| Typed custom fields | text, number, dropdown, date; ordered, hideable, autofill-from-lead |
| Built-in Lead Stage and Opportunity Size | As system custom fields, not hardcoded columns |
| **Time-in-stage** | Requires stage-change history. Write-time only. |
| Groups (tags) | M2M, server-owned colour palette |
| Polymorphic timeline | One `item_type` taxonomy, with attachments |
| Manual activity logging | Calls, meetings, notes, messages |
| Follow-ups | Four buckets, quick-set shortcuts, configurable defaults |
| Auto-follow-up on contact | Configurable trigger policy |
| Configurable mark/unmark-contacted triggers | Six independent triggers |
| Duplicate detection and merge | Org-level policy, on every inbound lead |
| Bulk delete, reassign, field edit | All-or-nothing on permission failure |
| Saved and complex filters | One shared filter model across the product |
| CSV import with column mapping | |
| Async CSV export delivered by email | With a per-user watermark |

### 2.3 Content

| Capability | Notes |
|---|---|
| Polymorphic content record | message · file · page, with shared taxonomy |
| Folders and labels | Two independent taxonomies |
| Messages with personalisation tokens | Server-rendered preview, WhatsApp template constraints enforced |
| File upload with async processing | All five processing states |
| Block-composed page builder | Server-declared slot schema |
| Page templates as starting points | |
| Per-page CTA, pixel/GTM injection, powered-by toggle | |
| Content visibility: private / sub-team / org | Plus shared folders as a distinct third mechanism |
| Copy-on-edit for content you can't edit | |
| Private notes on content | Not shown to recipients |

### 2.4 Sharing and tracking

| Capability | Notes |
|---|---|
| Per-recipient tracked link minting | Bound to (content, lead); idempotent per pair |
| Short branded domain per org | Falls back to the main host |
| Render-time token substitution | Links stay correct as lead data changes |
| Branded public viewer | Logo, colours, click-to-call/SMS/WhatsApp back to the rep |
| **View tracking with dwell duration** | Visibility-aware, idle-capped, `pagehide`-flushed |
| Per-view records | Timestamp, duration, device — never just a counter |
| Engagement gate before recording a view | Privyr has none. We do. |
| Prefetch and bot filtering | |
| Owner exclusion | Sturdier than session-only |
| QR codes and short links | |
| Content group sharing (bundles) | |
| Real-time alert to the rep on view | |

### 2.5 Sequences

| Capability | Notes |
|---|---|
| Ordered steps with separate display numbering | So delays sit between numbered steps |
| `executor: USER` and `SYSTEM` | The single switch between manual and automated |
| Step types: share content, contact lead, delay, automated message | |
| Per-lead step status tracking | |
| Break criteria | Exit when a real conversation starts. Day one, not later. |
| Bulk enrolment with a **mandatory dry-run preview** | |
| Sequence pause as a first-class state | So deletion is never the only way to stop |
| AI sequence generation | In one server-side transaction |

### 2.6 Automation

| Capability | Notes |
|---|---|
| Rule engine with ordered priority evaluation | Shared by assignment and distribution |
| Three-part condition builder | Server-supplied criteria and dynamic value lookup |
| Lead routing: assign to member(s) + enrol in sequence | Sequence is per-recipient, not per-rule |
| Lead distribution: broadcast and round-robin | With visible per-recipient round state |
| Save-to-account toggle on forwarded leads | |
| Full distribution audit history | |
| Auto-tagging by source attribute | |

### 2.7 Acquisition

| Capability | Notes |
|---|---|
| Server-declared integration registry | Visibility, per-account status, staged rollout |
| Facebook / Instagram Lead Ads | Account → page → form hierarchy, per-form toggles, backfill, delayed-lead detection, token renewal |
| LinkedIn Lead Gen Forms | |
| WordPress plugin | Token-based, 9 form plugins |
| IndiaMART | API key |
| First-party hosted lead forms | Fields derived from the CRM schema, QR, atomic create |
| AI email lead parsing | Per-account inbound address — the universal fallback |
| Zapier | The long tail |
| Webhook ingest pipeline | Pluggable parsers keyed on lead source type |
| Campaign/adset/ad metadata preserved | Through to conversion reporting |
| Meta Conversions API | Server-side conversion events back to Meta |

### 2.8 WhatsApp ⭐

| Capability | Notes |
|---|---|
| Click-to-chat deep links | Works everywhere, day one, no dependency |
| **Coexistence onboarding** | Embedded signup + QR scan; keep your own number |
| **Contact sync** | Via `smb_app_state_sync` |
| **Chat history import** | Up to 6 months, three ordered phases, on consent |
| **Outbound echo ingest** | Via `smb_message_echoes`, including edits and revokes |
| **Inbound message ingest** | Standard `messages` webhook |
| **Conversation view in the lead timeline** | The payoff |
| **Connection health monitor + 13-day nudge** | Non-negotiable; the link drops silently otherwise |
| Multi-number support | Per-member number access scoping |
| Template management and approval state | |
| Campaigns with per-recipient delivery status | Webhook-driven |
| Opt-out ledger, enforced before every send | A policy requirement, not a nicety |
| Auto-responder | Composed from connection + rule + automated sequence |
| Chat monitoring for managers | Falls out of Coexistence for free |

### 2.9 Team, agency, analytics, platform

| Capability | Notes |
|---|---|
| Member invite lifecycle | invite → resend → cancel → activate → deactivate → reactivate |
| Seat caps: hard limit + soft upsell threshold | |
| Team performance dashboard | Assigned, contacted, activities, **average first-response time** |
| Agency: manage, sponsor, impersonate | Impersonation audited, time-boxed, visibly indicated |
| White-label branding | Permission-gated |
| Account activity feed | Cursor-paginated, bidirectional, calendar navigation |
| Native analytics dashboards | Over our own event stream. No embedded third-party BI. |
| Lead source statistics | |
| Content performance stats | Including `TOTAL_UNOPENED` as a first-class metric |
| Notification matrix | Per-channel alerts, digests, thrice-daily summaries |
| **Lead escalation alerts** | What makes response-time metrics actionable |
| User and org preference scopes | With an admin lock |
| Personalisation defaults | |
| Razorpay + Stripe billing | UPI AutoPay, e-mandate, GST invoicing |
| Metered credit ledger | With top-up and payment-failure handling |
| Plan-driven paywall | Central modal, server-declared limits |

---

## 3. Explicitly out of scope for V1

Deferred, not dropped. Each has a target phase.

| Not in V1 | Why | Target |
|---|---|---|
| **Native iOS / Android apps** | Doubles the build. Responsive web plus WhatsApp deep links covers the loop; app-store presence is a trust signal we can add once retention is proven. | V1.5 |
| **Browser extension** | Privyr uses one to scrape PropertyGuru listings into pages. Narrow value, high maintenance. | V2 |
| **WhatsApp chat-assistant agents** | Inbound-triggered automated reply rules. Needs the conversation corpus V1 creates before it can be any good. | V2 |
| **Custom/embedded BI dashboards** | We build native dashboards over our own events. Customer-defined dashboards come later. | V2 |
| **Telegram, SMS and email as first-class send channels** | Modelled in the channel abstraction, not implemented beyond deep links. | V1.5 |
| **Voice calling / dialler** | A different product. TeleCRM's territory. | Not planned |
| **Multi-currency and multi-language UI** | English only at launch; the i18n layer is built in from day one so adding a locale is a translation file, not a refactor. | V1.5 |
| **Offline mode** | Real need on patchy connections, but heavy. Mitigated by aggressive caching and optimistic UI. | V2 |
| **Public API for customers** | Zapier covers the integration need at launch. | V1.5 |
| **SSO / SAML** | No enterprise buyers in the ICP. | Not planned |

### 3.1 Non-goals — things we choose not to be

Stated so they don't creep in:

- **Not a pipeline forecasting tool.** No weighted forecasts, no quota tracking.
- **Not a marketing automation platform.** No drip email campaigns, no landing-page A/B testing.
- **Not a helpdesk.** No tickets, no SLAs, no CSAT.
- **Not a general-purpose WhatsApp inbox.** We are lead-centric. Conversations attach to leads.
- **Not configurable to the point of needing an implementation consultant.** Every configuration
  surface we add is a support burden and an onboarding drop-off.

---

## 4. Assumptions and dependencies

Things outside our control that the plan depends on. Each has an owner and a verification step.

| # | Assumption | Risk if wrong | Verify by |
|---|---|---|---|
| A1 | Coexistence is available for phone numbers in India, Indonesia, Philippines, Malaysia, Singapore and UAE | The wedge doesn't work in the beachhead | Written confirmation from the chosen provider, **before** G3 |
| A2 | A BSP or direct Tech Provider path can be operational within the G3 window | G3 slips; the wedge is undemonstrable | Provider decision closed by end of G1 — [`13`](13-open-decisions.md) |
| A3 | `smb_message_echoes`, `smb_app_state_sync` and history webhooks behave as documented | Core sync is unreliable | Spike against a real test number during G2 |
| A4 | Facebook Lead Ads webhook access is obtainable (app review, permissions) | Our primary lead source is unavailable | Start Meta app review during G1 — it is the longest lead time in the plan |
| A5 | Razorpay onboarding for our entity completes before G4 | Cannot bill Indian customers | Begin merchant onboarding at G2 |
| A6 | Privyr's list price is in the assumed $25–35 range | Pricing table and comparison messaging are wrong | Direct confirmation before public launch |

> **A4 is the most commonly underestimated item in this plan.** Meta app review for lead-ads
> permissions is slow and iterative. It must start in G1 even though the feature lands in G2.

---

## 5. Phasing

Four gates. Each ends with something that exists and works, not a percentage.

### G1 — Foundations

**Goal:** the skeleton is real, and the team can use it.

| In | |
|---|---|
| Auth, session, signup, bootstrap endpoint | Org, members, capability grid, role presets |
| Lead entity, both list views, lead detail | Custom fields, groups, timeline |
| Follow-ups with buckets | Preferences (user + org) |
| Manual lead creation and CSV import | Design system foundation and app shell |

**Exit criteria**
- The team runs its own inbound leads through SalesNova for two weeks
- A lead can be created, assigned, edited, filtered, followed up and logged against
- Permission enforcement verified per-record, not just per-route
- `first_response_at`, stage history and the event log are being written from the first migration

**Also running:** Meta app review submission (A4), WhatsApp provider decision (A2).

### G2 — The loop

**Goal:** the core value proposition works end to end for one real customer.

| In | |
|---|---|
| Content: messages, files, pages + page builder | Tracked link minting and the public viewer |
| View tracking with duration | Sequences with both executors, break criteria |
| Lead routing rules | Facebook Lead Ads + first-party lead forms |
| Click-to-chat send flow | Notifications and alerts |

**Exit criteria**
- A Facebook lead arrives, routes to a rep, and the rep sends a tracked page over WhatsApp in under
  two minutes without training
- View duration is accurate within ±10% against manual stopwatch testing on Android Chrome and
  mobile Safari
- Three design partners are using it for real work

### G3 — The wedge

**Goal:** the thing nobody else has.

| In | |
|---|---|
| Coexistence onboarding flow | Contact sync, history import, echo and inbound ingest |
| Conversation view in the lead timeline | Connection health monitor and 13-day nudge |
| Multi-number support and scoping | Remaining lead sources |

**Exit criteria**
- Connect-to-first-synced-conversation under five minutes, demoable live without failing
- Six months of history imports and renders correctly, in order
- A number that goes 13 days idle produces a nudge at day 7 and a clear recovery path
- Ten design partners connected, with measured auto-capture volume per rep

### G4 — Commercial

**Goal:** strangers can buy it.

| In | |
|---|---|
| Plans, paywall, Razorpay + Stripe | Metered credit ledger |
| Team dashboard, analytics | Agency and white-label |
| WhatsApp templates and campaigns | Remaining integrations, Zapier |
| Async export, activation checklist, onboarding polish | |

**Exit criteria**
- Self-serve signup → paid, with no human involvement
- Full permission and plan-gating audit passed
- Security review and DPDP/PDPA obligations closed out ([`10`](10-nfr-security-compliance.md))
- Load tested against the ingest burst profile

---

## 6. Success metrics

### 6.1 The one that matters

**Median time from lead arrival to first outbound message.** Target: **under 5 minutes.**

If this number is good, the product works. If it isn't, nothing else compensates. It is measurable
from `received_at` and `first_response_at`, both of which are stamped at write time and cannot be
reconstructed later.

### 6.2 Product health

| Metric | Definition | Target | Instrumented in |
|---|---|---|---|
| Time-to-first-message | Median `first_response_at − received_at` | < 5 min | [`F02`](features/F02-leads.md) |
| Coexistence connection rate | Orgs with ≥1 connected number / activated orgs | > 55% | [`F12`](features/F12-whatsapp-coexistence.md) |
| Auto-captured conversations | Messages ingested per active rep per week | > 40 | [`F12`](features/F12-whatsapp-coexistence.md) |
| Lead coverage | Leads with ≥1 logged interaction within 24h | > 85% | [`F16`](features/F16-analytics.md) |
| Content engagement | Shares with ≥1 view | > 45% | [`F07`](features/F07-sharing-and-tracking.md) |
| Week-4 rep retention | Reps active in week 4 / week 1 | > 60% | Product analytics |
| Connection health | Numbers in a healthy state | > 95% | [`F12`](features/F12-whatsapp-coexistence.md) |

### 6.3 Business

| Metric | Target |
|---|---|
| Free → paid within 30 days | > 8% |
| Net revenue retention | > 105% |
| CAC payback | < 6 months |
| Gross margin after Meta and BSP fees | > 80% |
| Logo churn, monthly | < 3% |

### 6.4 Quality gates that block release

| Gate | Threshold |
|---|---|
| p95 API latency, read endpoints | < 400 ms |
| Lead ingest to visible in app | < 10 s at p95 |
| Lead ingest to rep alerted | < 30 s at p95 |
| Error rate, 5xx | < 0.1% |
| Test coverage on domain and business rules | > 80% |
| Critical/high security findings open | 0 |
| Known data-loss defects | 0 |

Detail and measurement method: [`10-nfr-security-compliance.md`](10-nfr-security-compliance.md).

---

## 7. What we are not measuring, deliberately

- **Daily active users.** A rep who gets four leads a week and handles all four perfectly is a
  great customer. DAU would punish them.
- **Time in app.** We want reps *out* of the app and into conversations. Increasing session length
  would mean we'd made the software worse.
- **Feature adoption breadth.** A customer who only ever uses leads, follow-ups and WhatsApp sync
  is fully served. Pushing them toward sequences they don't need helps nobody.

Stated because these are the metrics teams drift toward, and each would pull the product away from
the job it exists to do.
