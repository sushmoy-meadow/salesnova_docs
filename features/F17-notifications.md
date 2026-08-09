---
doc: F17-notifications
status: REVIEW
owner: Product + Engineering
area_code: NOTIF
depends_on: [F02-leads, F04-follow-ups, F12-whatsapp-coexistence]
---

# F17 — Notifications

The product's outbound nervous system. Response time is the promise, and a notification is what
starts the clock on keeping it.

Also the fastest way to make people hate the product. Both facts are load-bearing here.

---

## 1. Principles

### SN-NOTIF-001 — Every notification is actionable

A notification **MUST** deep-link to the action, not to a list. "New lead: Raj Kumar" opens Raj's
record **with the WhatsApp composer ready** — not the lead list.

### SN-NOTIF-002 — Real-time means real-time

New-lead and inbound-message notifications **MUST** deliver within **5 seconds** of the event.

> This is the whole product. A lead notification arriving three minutes late has already lost the
> race against every other agency the person enquired with.

### SN-NOTIF-003 — Quiet hours are respected, and nothing is dropped

Default 21:00–08:00 in the **member's** timezone. Suppressed notifications are queued and delivered
at the next permitted time.

**Exception:** new-lead alerts **MAY** be configured to override quiet hours. Off by default, and
the setting explains the trade-off honestly.

### SN-NOTIF-004 — Digests are batched; alerts are not

A "lead opened your brochure" alert is immediate. A "you have 23 follow-ups" summary is a digest.
Never batch something time-sensitive, and never send an alert for something that is not.

### SN-NOTIF-005 — Defaults are conservative

Immediate notifications are on **only** for events the rep must act on now: new lead assigned,
inbound message, content opened, escalation. Everything else defaults to digest or off.

> Every product in this category ships with everything on, and every user's first experience is
> muting all of it. Once muted, nothing is ever unmuted — including the two notifications that
> actually mattered.

---

## 2. Catalogue

### SN-NOTIF-010 — Events and defaults

| Event | Push | Email | In-app | Default |
|---|---|---|---|---|
| **Lead assigned to you** | ✅ | ✅ | ✅ | immediate |
| **Inbound WhatsApp message** | ✅ | — | ✅ | immediate |
| **Content opened by a lead** | ✅ | — | ✅ | immediate |
| **Lead escalation** (manager) | ✅ | ✅ | ✅ | immediate |
| Follow-up due now | ✅ | — | ✅ | immediate |
| Sequence task due | ✅ | — | ✅ | immediate |
| New unassigned lead (manager) | ✅ | ✅ | ✅ | immediate |
| Form submitted | — | ✅ | ✅ | digest |
| Campaign completed | ✅ | ✅ | ✅ | immediate |
| **WhatsApp health warning** | ✅ | ✅ | ✅ | **immediate, non-dismissible** |
| Integration expiring / expired | ✅ | ✅ | ✅ | immediate |
| Payment failed | ✅ | ✅ | ✅ | immediate |
| Low credit balance | — | ✅ | ✅ | immediate |
| Morning follow-up digest | ✅ | ✅ | — | daily 08:30 |
| Evening summary | — | ✅ | — | off |
| Weekly team summary (manager) | — | ✅ | — | weekly |
| Member joined / left | — | ✅ | ✅ | immediate |
| Import / export complete | — | ✅ | ✅ | immediate |

### SN-NOTIF-011 — Three frequency modes per notification

`ALWAYS` · `IF_UPDATES` (digest, sent only when there is something) · `NEVER`

`IF_UPDATES` is the important one: an empty digest is a notification that teaches people to ignore
notifications.

---

## 3. Channels

### SN-NOTIF-020 — Web push in V1

Responsive web is the V1 platform, so **Web Push (VAPID)** is the mobile channel. Permission is
requested **contextually** — after the first lead arrives, with an explanation — never on first
load.

> A browser permission prompt in the first five seconds is denied by most users and cannot be
> re-requested. Asking at the moment the value is obvious ("we can tell you the instant a lead
> comes in") converts far better and is the difference between a usable product and one that
> silently fails at its core promise.

### SN-NOTIF-021 — Email is the fallback

Where push is unavailable or denied, immediate notifications fall back to email. The user is told
this is happening and how to enable push.

### SN-NOTIF-022 — In-app centre

Bell icon with an unread count, grouped by day, mark-read individually and in bulk, filterable.
Retained 30 days.

### SN-NOTIF-023 — SMS is not a V1 channel

Cost per message, deliverability variance across India and SEA, and the DLT registration burden in
India make it a poor fit. Reserved for a future critical-alert path only.

---

## 4. Preferences

### SN-NOTIF-030 — A matrix, per member

Rows are events, columns are channels, cells are frequency. Grouped by category with
category-level toggles.

Available presets: **All on** · **Essentials only** (recommended) · **Digest only** · **All off**.

### SN-NOTIF-031 — Org defaults, member override

An owner sets org defaults for new members. Members may always override for themselves — with one
exception.

### SN-NOTIF-032 — Some notifications cannot be disabled

Payment failure, WhatsApp disconnection warnings, and security events (permission changed,
impersonation started, new device sign-in).

> Each has data-loss or service-loss consequences and is not a matter of preference. The list is
> deliberately short — three categories, not thirty — because the moment it grows, users start
> looking for the global mute.

---

## 5. Delivery

### SN-NOTIF-040 — Queued, retried, deduplicated

Delivery is asynchronous and retried 3× with backoff. Duplicate notifications for the same event
and recipient within 60 s are collapsed.

### SN-NOTIF-041 — Grouped when bursty

Ten leads arriving in five minutes produce a grouped notification ("10 new leads assigned to you"),
not ten. Threshold: more than 3 of the same type within 5 minutes.

### SN-NOTIF-042 — Failures are visible to us

Push subscription expiry, email bounces and hard failures are tracked per member. A member whose
channel has been failing for 7 days is surfaced to the org owner.

> A rep who is not receiving lead notifications is not doing the job the product exists for, and
> nobody finds out until a monthly review.

### SN-NOTIF-043 — Content is minimal

A notification carries the lead's name and the event type. **Message bodies, phone numbers and
email addresses do not appear in push payloads or email subject lines** — they render on
lock screens and in notification centres.

---

## 6. Email

### SN-NOTIF-050 — Sender identity

From the org's configured name where white-label is enabled; otherwise SalesNova. SPF, DKIM and
DMARC aligned.

### SN-NOTIF-051 — One-click unsubscribe

`List-Unsubscribe` header on every non-transactional email. Unsubscribing from digests **MUST NOT**
unsubscribe from transactional notifications, and the confirmation says so.

### SN-NOTIF-052 — Plain text alongside HTML

Every email ships a text alternative. A meaningful fraction of this market reads mail on clients
that render HTML poorly.

---

## 7. Acceptance criteria

- `AC-NOTIF-002.1` — Given a lead created via webhook, when the notification is measured, then it is delivered within 5 s p95.
- `AC-NOTIF-003.1` — Given a follow-up due at 22:00 with quiet hours to 08:00, when the scheduler runs, then it is delivered at 08:00, not dropped.
- `AC-NOTIF-032.1` — Given a member attempting to disable payment-failure notifications, when saved, then the setting is rejected with an explanation.
- `AC-NOTIF-041.1` — Given 10 leads assigned within 3 minutes, when notifications are sent, then one grouped notification is delivered.
- `AC-NOTIF-043.1` — Given an inbound WhatsApp message containing a phone number, when the push payload is inspected, then the message body is absent.
