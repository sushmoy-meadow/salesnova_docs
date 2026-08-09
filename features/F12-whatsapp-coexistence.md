---
doc: F12-whatsapp-coexistence
status: REVIEW
owner: Product + Engineering
area_code: WA
depends_on: [04-domain-model, 05-api-design, F02-leads, F05-timeline-and-activity]
criticality: HIGHEST
---

# F12 — WhatsApp Coexistence ⭐

**The wedge.** Everything else in V1 is parity. This is the reason to switch.

> **Verification status.** The Meta capabilities described here were researched against Meta's
> developer documentation and multiple BSP partner docs. Meta iterates on this surface frequently
> and the rollout is regionally phased. **Every constraint in §2 MUST be re-verified against
> current provider documentation before implementation begins**, and again before the go-live date
> is committed publicly. Treat the numbers as accurate-as-researched, not as permanent.

---

## 1. The problem this solves

Privyr's architecture is the shortest path from a Facebook Lead Ad to a WhatsApp message sent from
the rep's own number. That is the right architecture for this market, and it is why customers
tolerate an otherwise ordinary CRM.

**It has one structural blind spot: the product cannot see the conversation.**

Everything after "message sent" is invisible. The reply, the objection, the negotiation, the
silence — none of it reaches the CRM. So every field after that point is manual data entry by a
busy rep, which in practice means the CRM is mostly empty. Privyr sells "WhatsApp Monitoring" as a
paid add-on, but it requires abandoning the personal number for a Business API number — which
destroys the exact thing that made the product work.

**Coexistence removes the trade-off.** One number runs the WhatsApp Business app *and* the Cloud
API simultaneously, mirrored both ways.

| | |
|---|---|
| The rep keeps | Their number, their app, their habits. Nothing about their day changes. |
| We gain | Contacts, up to 6 months of history, every message sent from the app, every inbound reply |
| The manager gets | A pipeline that reflects reality |
| Meta charges us | **Nothing** for any of the above |

---

## 2. Constraints — read before designing anything

These are Meta's, not ours. Several are product-shaping, not implementation details.

| # | Constraint | Product consequence |
|---|---|---|
| 1 | **13-day inactivity disconnect.** The user must open the WhatsApp Business app at least once every 13 days or the API link drops. | §6. **The single biggest operational risk in the product.** |
| 2 | **Fixed 5 msg/sec throughput.** Not raisable. | Campaign scheduling and ETA maths; §7 of [`F13`](F13-whatsapp-campaigns.md). |
| 3 | **No Official Business Account badge, no business verification.** | Set expectations in marketing. Not available on this path, ever. |
| 4 | **No migration to a full WABA** once coexistent. | A customer outgrowing this needs a *new* number. Say so before they connect. |
| 5 | **Companion devices are unlinked at onboarding.** WhatsApp for Windows/Mac and WearOS become unusable for that number. | ⚠️ **Must be stated in the consent screen.** A rep who loses WhatsApp Web mid-day will churn on the spot. |
| 6 | **Group chats, broadcast lists, disappearing messages, view-once and live location do not sync.** | Timeline completeness caveat; state it in the UI, do not let the user discover it. |
| 7 | **Templates are API-only.** They cannot be sent from the Business app. | Campaigns and `SYSTEM` sequence steps run through us. |
| 8 | **24-hour service window.** Free-form replies only within 24 h of the last inbound message. | Enforced server-side before every send; §5. |
| 9 | **Regionally phased; unavailable in some countries** (Nigeria and South Africa at time of research). | Eligibility check before offering it. Click-to-chat fallback. |
| 10 | Requires **Meta Tech Provider registration or a BSP**. | Open decision — [`13-open-decisions.md`](../13-open-decisions.md). Abstracted behind a provider port. |
| 11 | History sync is **up to 6 months**, delivered in **3 ordered phases**, and requires explicit consent. | §4. Partial-state UI required. |

### SN-WA-001 — Constraints surface in the product, not just in this document

Constraints 3, 4, 5 and 6 **MUST** be shown on the consent screen before the QR scan, in plain
language, not in a terms link.

> Constraint 5 in particular. A rep who connects, then discovers at 3pm that WhatsApp Web no longer
> works on their office desktop, will disconnect immediately and tell their team not to bother.
> **We tell them first, and we lose the ones who would have churned anyway — at zero cost instead
> of high cost.**

---

## 3. Onboarding

### SN-WA-010 — Five steps, under 15 minutes

```
1. Eligibility     country + provider availability checked BEFORE anything is shown
2. Explain         what happens, what syncs, what changes, what breaks   ← consent
3. Embedded Signup Meta's flow, in a popup; number entry + verification
4. QR scan         from the WhatsApp Business app: Settings → Linked devices
5. Consent         contact sync (optional) · history sync (optional)
6. Go live         connected; sync jobs start
```

### SN-WA-011 — Eligibility first

Availability **MUST** be checked before the flow is offered. Ineligible orgs see click-to-chat with
an honest explanation and a notify-me option — never a flow that fails at step 3.

### SN-WA-012 — Consent is granular and separable

Three independent choices:

| | Default | Note |
|---|---|---|
| Connect the number | required | |
| Sync contacts | opt-in | |
| Sync chat history | opt-in | Named explicitly: "up to 6 months of your past conversations" |

Declining either optional sync **MUST NOT** block connection. History **MUST** be requestable later
from settings.

> Some users will not want their existing chats imported the first time they meet the product, and
> will want it two weeks later once they trust us. Forcing the decision at onboarding loses both
> the connection and the data.

### SN-WA-013 — Progress is visible and the app stays usable

Contact and history sync run in the background. The connection is `CONNECTED` and usable
immediately; the timeline shows a **partial** state while phases land
([`F05`](F05-timeline-and-activity.md) §SN-TL-025).

### SN-WA-014 — Multi-number

An org **MAY** connect several numbers, plan-limited. Each has its own health, its own assigned
members and its own conversation set. Sending requires membership in
`accessible_whatsapp_account_ids` ([`06`](../06-permissions-and-plans.md) §1.3, which **fails
closed**).

**Acceptance criteria**

- `AC-WA-011.1` — Given an org in an ineligible country, when WhatsApp setup is opened, then Coexistence is not offered and click-to-chat is presented with the reason.
- `AC-WA-012.1` — Given a user who declines history sync, when onboarding completes, then the account is `CONNECTED`, `history_sync_status = DECLINED`, and settings offers to start it.
- `AC-WA-001.1` — Given the consent screen, when rendered, then companion-device unlinking, the absence of the OBA badge, the no-WABA-migration constraint and the non-syncing message types are all visible without expanding anything.

---

## 4. Sync

### SN-WA-020 — Four webhook streams

| Webhook | Delivers | Cost |
|---|---|---|
| `smb_app_state_sync` | Contacts from the user's phone | free |
| `history` | Up to 6 months of chat history, **3 ordered phases** | free |
| **`smb_message_echoes`** | **Messages the rep sent from the Business app**, incl. `edit` and `revoke` | **free** |
| `messages` | Standard inbound | free |

### SN-WA-021 — `smb_message_echoes` is the product ⭐

Every message the rep sends from their own phone mirrors into SalesNova, stored with
`source = APP_ECHO`.

> **This one webhook is the entire competitive difference.** The rep changes nothing about how they
> work; the CRM fills itself in. Echoes never open a billable conversation window, so this costs us
> nothing beyond storage.
>
> Message types: `text`, `image`, `video`, `document`. `edit` carries the revised body; `revoke`
> carries `original_message_id`.

### SN-WA-022 — Edits and revocations are honoured, and visible

An `edit` updates `body`, sets `is_edited`, and **preserves `original_body`**.
A `revoke` sets `is_revoked` and hides the body from the timeline, retaining the fact that a
message existed and was deleted.

> Silently vanishing a message is worse than showing "this message was deleted". The rep needs to
> know something was there.

### SN-WA-023 — Contact sync creates or matches leads

Each synced contact is matched on `phone_e164`/`whatsapp_e164`. A match enriches; no match
**MAY** create a lead per the org's setting.

**Default: do not auto-create.** Present them as an importable list with counts and a preview.

> A rep's phone contains their dentist, their landlord and their mother. Importing 800 contacts as
> leads unprompted destroys the lead list, poisons every metric, and is very hard to undo. Show
> the list, let them choose.

### SN-WA-024 — History in three phases

`history_sync_status`: `NOT_REQUESTED` → `PENDING` → `IN_PROGRESS` → `COMPLETE` / `PARTIAL` /
`DECLINED`

Each phase is a `coexistence_sync_job` row with counts. The UI shows which phase is landing and how
far back history currently reaches.

### SN-WA-025 — Historical messages do not trigger anything

Messages with `source = HISTORY_IMPORT` **MUST NOT** fire notifications, break sequences, trigger
rules, or affect `first_response_at` and response-time metrics.

> ⚠️ The most dangerous bug available in this feature. Six months of history landing as live events
> would fire thousands of push notifications, break every active sequence, and permanently corrupt
> the response-time baseline. **Gate on `source` at every consumer, and test it explicitly.**

### SN-WA-026 — Ingest is idempotent

Keyed on `wa_message_id` (unique). Webhooks are at-least-once; duplicates are discarded silently.

### SN-WA-027 — Media is re-hosted

Media referenced by a webhook **MUST** be fetched and re-hosted within the retention window —
Meta's URLs expire. Failures are retried, then marked with the media unavailable and the message
text intact.

**Acceptance criteria**

- `AC-WA-021.1` — Given a rep sending "Hi Raj" from the Business app, when the echo arrives, then a `whatsapp_message` exists with `source = APP_ECHO`, `direction = OUTBOUND`, `cost_credits = 0`, and it appears in the lead timeline within 10 s.
- `AC-WA-022.1` — Given a message later revoked from the app, when the timeline renders, then the body is hidden, a deleted marker shows, and `original_body` is retained in storage.
- `AC-WA-025.1` — Given a history import of 4 000 messages, when it completes, then zero notifications were sent, zero sequences broke, and no `first_response_at` value changed.
- `AC-WA-026.1` — Given the same `wa_message_id` delivered twice, when both are processed, then exactly one row exists.

---

## 5. Sending

### SN-WA-030 — Two send paths, one UI

| Path | When | Cost |
|---|---|---|
| **From SalesNova via the API** | Inside the 24 h service window, or an approved template outside it | free inside the window; templates are paid |
| **Deep link to the app** | Always available; the rep sends from their own phone | free — arrives back as an echo |

Both appear in the timeline. The rep chooses; the product does not force either.

### SN-WA-031 — Service window enforced server-side

`service_window_expires_at = last_inbound_at + 24h`.

Outside it, free-form sends **MUST** be rejected `423 WA_SERVICE_WINDOW_CLOSED` and the UI **MUST**
offer an approved template instead.

The composer shows the remaining window time. When closed, it explains why and shows the options —
never a silently disabled button.

### SN-WA-032 — Opt-out is checked before every send

No exceptions, campaign or otherwise. `423 WA_OPTED_OUT`.

Policy requirement, not courtesy. Violations damage the number's quality rating, which degrades
deliverability for that customer permanently.

### SN-WA-033 — Rate limiting

Sends queue and dispatch at ≤ 5 msg/sec per account. The queue is visible: pending count and ETA.

### SN-WA-034 — Failures are explained in human language

Meta error codes **MUST** be mapped to plain explanations with a next action.

| Code | Shown to the user |
|---|---|
| 131047 | "Outside the 24-hour window. Send an approved template instead." |
| 131026 | "This number can't receive WhatsApp messages." |
| 132000 | "Template variables don't match. Edit the template." |
| 130472 | "This person is in a Meta experiment group and can't be reached right now." |

> "Error 131047" in a timeline is worse than useless — it teaches the rep the product is broken.

---

## 6. Health monitoring ⚠️ launch blocker

**The 13-day disconnect is the highest-severity operational risk in the product.** It fails
silently, it is entirely outside our control, and the customer's first symptom is that their
timeline quietly stopped filling in.

### SN-WA-040 — Track activity continuously

`last_app_activity_at` updates on any signal from the account — echo, inbound message, status
update, heartbeat.

### SN-WA-041 — Four health states

| State | Condition | Response |
|---|---|---|
| `HEALTHY` | Activity within 7 days | — |
| `WARNING` | 7–10 days | In-app banner; email at day 7 |
| `CRITICAL` | 10–13 days | **Non-dismissible** banner; email + push daily; manager notified |
| `DISCONNECTED` | > 13 days, or Meta confirms | Full-width alert; guided reconnection |

### SN-WA-042 — Escalation is proportionate

Day 7 email, in-app banner. Day 10 push, non-dismissible banner. Day 11 and 12 push, daily, and the
org owner is notified separately. Day 13+ everything, plus a guided reconnect flow.

Copy is specific and actionable: *"Open WhatsApp Business on your phone within 3 days or SalesNova
will stop receiving your conversations."*

### SN-WA-043 — The fix is one action, explained

The banner explains what to do — open the WhatsApp Business app once — with a mobile deep link.
It is a **five-second fix** and the messaging must convey that, not alarm.

### SN-WA-044 — Reconnection preserves everything

Reconnecting **MUST** retain all history, conversations and lead links. It **MUST NOT** require
re-onboarding, and it **MUST NOT** re-import history.

### SN-WA-045 — Gaps are marked in the timeline

A disconnection period **MUST** render as a visible gap: *"SalesNova wasn't receiving messages
between 3 Aug and 7 Aug."*

> Silence that means "nothing happened" and silence that means "we weren't watching" are opposite
> facts, and a rep reading a timeline cannot tell them apart. Mark the gap.

**Acceptance criteria**

- `AC-WA-041.1` — Given an account with no activity for 8 days, when the sweep runs, then `health_state = WARNING`, a banner is present, and one email was sent.
- `AC-WA-042.1` — Given 11 days of inactivity, when the sweep runs, then the banner is non-dismissible and the org owner has been notified separately from the number's owner.
- `AC-WA-044.1` — Given a reconnection after 15 days, when it completes, then message count is unchanged and no history import is triggered.
- `AC-WA-045.1` — Given a 4-day disconnection, when an affected lead's timeline is viewed, then a gap marker covers those dates.

---

## 7. The Inbox

### SN-WA-050 — Lead-centric, not a WhatsApp client

`/inbox` lists conversations with unread counts, last message preview, lead name, assignee, stage
and service-window state.

**Scope guard: this is not a general WhatsApp client.** Every conversation resolves to a lead, and
every action is a CRM action. We are not rebuilding WhatsApp Web, and any request that starts
"could the inbox also…" is measured against that line.

### SN-WA-051 — Filters

Unread · assigned to me · unassigned · window closing soon · by stage · by group.

**"Window closing soon"** is a genuinely useful queue: conversations where the free reply window
expires within 4 hours. Act now, or pay for a template.

### SN-WA-052 — Full CRM context inline

The conversation view shows the lead's stage, custom fields, follow-up and recent activity beside
the messages. Stage changes, notes and follow-ups happen without leaving.

> This is the payoff for unifying the data. An inbox that is only messages is Interakt; an inbox
> where the CRM record is right there is why someone pays for SalesNova instead.

### SN-WA-053 — Real-time

New messages appear without refresh, via SSE. Typing and read receipts are **not** implemented
in V1 — they are not available on this path and pretending otherwise is worse than their absence.

---

## 8. Economics

### SN-WA-060 — What is free, permanently

| Traffic | Meta cost |
|---|---|
| Inbound messages | **free** |
| Messages sent from the rep's own app (echoes) | **free** — never opens a billable window |
| Replies inside the 24-hour service window | **free** |
| Contact sync | **free** |
| History import (up to 6 months) | **free** |

**Only API-initiated template messages are billable.**

### SN-WA-061 — Never metered

The items above **MUST NOT** be metered, rate-limited for commercial reasons, or gated behind a
tier — on any plan, including Free.

> **This is the packaging argument in one rule.** Full conversation visibility costs us nothing in
> Meta fees, so it goes in the base product. Privyr charges for WhatsApp Monitoring and requires
> giving up the personal number to get it. We include the better version for free.
>
> Anyone proposing to meter these later should read this paragraph first: it is not a pricing
> oversight, it is the strategy.

### SN-WA-062 — Metered, transparently

Template sends are metered at cost-plus. India marketing ≈ $0.0094/message; utility and
authentication are 80–90% cheaper. **18% GST applies** in India to both Meta's charges (imported
OIDAR services) and any BSP platform fee.

Every metered action shows its cost **before** it runs ([`05`](../05-api-design.md) §10). The credit
balance is always visible, with a low-balance warning before sends start failing.

---

## 9. Fallback: click-to-chat

### SN-WA-070 — Always available, everywhere

`wa.me` deep links with pre-filled text work in every country, on every plan, with no connection.

SalesNova **MUST** be fully usable without any WhatsApp connection at all.

> Coexistence is upside, not a dependency. If Meta changes terms, if a region is ineligible, or if
> a customer simply declines, the product is still a complete Privyr replacement. Building the
> whole experience on the assumption of a connection would make a Meta policy change an existential
> event rather than a bad quarter.

### SN-WA-071 — Manual logging when disconnected

A click-to-chat send logs a `MESSAGE` timeline event with the text, marked as unverified. The rep
gets a record; we do not pretend to have delivery confirmation we do not have.

---

## 10. Provider abstraction

### SN-WA-080 — Everything goes through one port

No BSP-specific or Meta-specific code above `WhatsAppChannelProvider`:

```php
interface WhatsAppChannelProvider {
    public function createOnboardingSession(Organization $org, array $opts): OnboardingSession;
    public function completeOnboarding(string $sessionId, array $callback): WhatsAppAccount;
    public function syncContacts(WhatsAppAccount $a): SyncJob;
    public function requestHistory(WhatsAppAccount $a, int $months): SyncJob;
    public function sendMessage(WhatsAppAccount $a, OutboundMessage $m): SendResult;
    public function sendTemplate(WhatsAppAccount $a, TemplateMessage $m): SendResult;
    public function listTemplates(WhatsAppAccount $a): array;
    public function submitTemplate(WhatsAppAccount $a, TemplateDefinition $t): TemplateResult;
    public function getHealth(WhatsAppAccount $a): HealthStatus;
    public function disconnect(WhatsAppAccount $a): void;
    public function parseWebhook(Request $r): array;   // → normalised events
}
```

> The provider decision is deliberately open ([`13-open-decisions.md`](../13-open-decisions.md)).
> This port is what makes that safe: it does not block engineering, and switching later is a swap
> rather than a rewrite. What it does *not* solve is who owns the embedded-signup UX, what
> per-message cost passes through to pricing, and the go-live date — those need the decision.

---

## 11. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Connected numbers | 1 | 5 | unlimited |
| **Conversation sync** | **✅** | **✅** | **✅** |
| History sync | 1 month | 6 months | 6 months |
| Contact sync | ✅ | ✅ | ✅ |
| Inbox | ✅ | ✅ | ✅ |
| Templates | ❌ | ✅ | ✅ |
| Campaigns | ❌ | ✅ | ✅ |

> `history_sync_months: 1` on Free is the hook, not a restriction. The user connects, sees one
> month of their real conversations appear, and the upgrade prompt says *"2,847 more messages are
> waiting"*. That converts far better than a locked button ever will.

---

## 12. Delivery checklist

- [ ] Eligibility check before the flow is offered
- [ ] Consent screen stating **all** constraints, especially companion-device unlinking
- [ ] Embedded Signup + QR, under 15 minutes
- [ ] Granular, separable, deferrable consent for contacts and history
- [ ] Four webhook streams ingesting, idempotent on `wa_message_id`
- [ ] `smb_message_echoes` → `source = APP_ECHO`, zero cost
- [ ] Edits and revocations honoured and visible
- [ ] Contact sync as a reviewable import, not auto-create
- [ ] History in 3 phases with visible progress and a partial timeline state
- [ ] **`HISTORY_IMPORT` triggers nothing** — tested explicitly
- [ ] Media re-hosted before Meta's URLs expire
- [ ] Service window enforced server-side, with template fallback offered
- [ ] Opt-out checked before every send
- [ ] 5 msg/sec queue with visible ETA
- [ ] Meta error codes mapped to human language
- [ ] **13-day health monitor with 4 states and proportionate escalation** ⚠️
- [ ] Reconnection preserving everything
- [ ] Timeline gap markers for disconnection periods
- [ ] Lead-centric inbox with CRM context inline
- [ ] "Window closing soon" filter
- [ ] Free traffic never metered, on any plan
- [ ] Click-to-chat fallback everywhere, always
- [ ] All provider calls behind `WhatsAppChannelProvider`
