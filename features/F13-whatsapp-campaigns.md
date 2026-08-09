---
doc: F13-whatsapp-campaigns
status: REVIEW
owner: Product + Engineering
area_code: CAMP
depends_on: [F12-whatsapp-coexistence, 04-domain-model]
---

# F13 — WhatsApp Templates & Campaigns

Bulk outbound to many leads at once. The only part of the WhatsApp surface that costs real money,
and the only part that can damage a customer's number.

Both facts drive every requirement here.

---

## 1. Templates

### SN-CAMP-001 — Meta owns approval; we own the experience

Templates are submitted to Meta, reviewed, and returned `APPROVED` or `REJECTED`. Turnaround is
typically minutes to 24 hours.

SalesNova **MUST** make that wait comprehensible: state visible, rejection reason shown in plain
language, and one-click resubmission after edits.

### SN-CAMP-002 — Three categories, very different prices

| Category | Use | Relative cost (India) |
|---|---|---|
| `MARKETING` | Promotions, offers | ≈ $0.0094/msg — the expensive one |
| `UTILITY` | Order updates, reminders, confirmations | 80–90% cheaper |
| `AUTHENTICATION` | OTPs | ≈ $0.0014/msg |

The builder **MUST** show the category's cost implication as the user chooses, and **MUST** warn
when content looks like `MARKETING` submitted as `UTILITY`.

> Meta re-categorises misclassified templates and bills accordingly. A user who thinks they are
> sending a cheap utility message and gets a marketing bill will blame us, not Meta — and they will
> be partly right, because we let them.

### SN-CAMP-003 — Constraints enforced at authoring ⚠️

| Rule | |
|---|---|
| **MUST NOT** start or end with a variable | Meta rejects |
| No two adjacent variables | Meta rejects |
| Variables numbered sequentially from `{{1}}` | Meta rejects |
| Header ≤ 60 chars; body ≤ 1024; footer ≤ 60 | Meta rejects |
| Buttons: max 3 quick-reply, or 2 CTA | Meta rejects |

All validated in the editor, **before** submission.

> Every one of these costs the user a 24-hour round trip to discover. Privyr surfaces the
> leading/trailing-variable rule (`"Sorry, WhatsApp templates can't start or end with a variable"`)
> — good instinct, incomplete coverage.

### SN-CAMP-004 — Variables map to real fields

Each `{{n}}` binds to a lead field, custom field or constant, with a sample value shown live.
The preview renders against a **real lead** from the org's data.

### SN-CAMP-005 — Quality is surfaced

Meta's per-template quality score and the number's `quality_rating`
(`GREEN`/`YELLOW`/`RED`) **MUST** be visible, with plain-language consequences.

> A `RED` rating means reduced messaging limits and eventual disabling. Customers do not know this
> and will not read Meta's docs. Telling them early, in our UI, is worth more than any feature in
> this document.

### SN-CAMP-006 — Library

Pre-built, pre-validated templates per industry — appointment reminder, document request, festival
greeting, renewal reminder, site-visit confirmation. One click to submit for approval.

The first template is the hardest; a library removes the blank page.

---

## 2. Campaigns

### SN-CAMP-010 — Lifecycle

```
DRAFT → TEMPLATE_PENDING → SCHEDULED → SENDING → COMPLETED
                                              └→ FAILED
                        └→ CANCELLED
```

`TEMPLATE_PENDING` is a real state: the campaign is ready but its template is awaiting Meta. It
transitions automatically on approval.

### SN-CAMP-011 — Three audience sources

| Source | Notes |
|---|---|
| **`FILTER`** | Any lead filter ([`F02`](F02-leads.md) §SN-LEAD-081). Preferred. |
| `UPLOAD` | CSV of numbers with variable columns |
| `PASTE` | Pasted numbers |

`FILTER` stores the filter, not the resolved ids, and resolves at **send time** — so a scheduled
campaign reaches leads who qualified after it was built.

### SN-CAMP-012 — Preview is mandatory and costed ⚠️

A campaign **MUST NOT** be sendable without an executed preview:

```json
{"total_matched": 1284,
 "eligible": 1197,
 "excluded": [{"reason": "OPTED_OUT", "count": 43},
              {"reason": "NO_WHATSAPP_NUMBER", "count": 31},
              {"reason": "INVALID_NUMBER", "count": 13}],
 "estimated_cost": {"currency": "INR", "amount": 1123.45, "includes_gst": true},
 "credit_balance": 5000.00,
 "sufficient_credit": true,
 "estimated_duration_seconds": 240,
 "sample_rendered": ["Hi Raj, your policy renewal is due on 12 Aug…"]}
```

Cost is shown **inclusive of GST**, because that is the number that leaves the customer's account.

`estimated_duration_seconds` derives from the 5 msg/sec ceiling — 1,197 messages take about four
minutes, and the user should know that before they wonder why it is not instant.

### SN-CAMP-013 — Confirmation names the numbers

Above 100 recipients, confirmation requires typing the recipient count. The dialog states
recipients, cost and duration.

### SN-CAMP-014 — Per-recipient status

`PENDING` → `SENDING` → `SENT` → `DELIVERED` → `READ`, or `FAILED` / `SKIPPED_OPTED_OUT`.

Driven by Meta webhooks, per recipient, visible and exportable.

### SN-CAMP-015 — Cancellable mid-send

A `SENDING` campaign **MUST** be cancellable. Queued messages are dropped; sent ones cannot be
recalled and the UI says so honestly.

### SN-CAMP-016 — Scheduling respects quiet hours and local time

Scheduled in the **org's** timezone, with quiet hours (default 21:00–08:00) enforced. A campaign
scheduled inside quiet hours is deferred, with the actual send time shown at scheduling.

> In India, a 10pm marketing WhatsApp is how a number gets blocked by recipients and rated `RED`.
> Protecting the customer from themselves here is protecting our own deliverability too.

**Acceptance criteria**

- `AC-CAMP-012.1` — Given a campaign with no preview executed, when send is attempted, then it returns `422` requiring a preview.
- `AC-CAMP-012.2` — Given 43 opted-out leads in the audience, when preview runs, then they appear in `excluded` and are absent from `eligible`.
- `AC-CAMP-014.1` — Given a delivery webhook for a recipient, when processed, then that recipient's status advances and campaign counters update within 10 s.
- `AC-CAMP-016.1` — Given a campaign scheduled for 22:00 with quiet hours to 08:00, when scheduled, then the confirmed send time is 08:00 the next day and is shown before confirming.

---

## 3. Compliance

### SN-CAMP-020 — Opt-out is checked at dispatch, per recipient

Not at preview time. A lead who opts out between scheduling and sending **MUST NOT** receive the
message.

### SN-CAMP-021 — Every marketing campaign carries an opt-out path

A quick-reply "Stop" button or footer instruction. **Enforced by the builder** for `MARKETING`
templates.

### SN-CAMP-022 — Opt-out is instant and honoured everywhere

An opt-out reply **MUST**:

1. Write `opt_out` within 60 s
2. Break every active sequence for that lead ([`F08`](F08-sequences.md) §SN-SEQ-023)
3. Remove them from every queued campaign
4. Show clearly on the lead record
5. Block all outbound until they explicitly opt back in

### SN-CAMP-023 — Quality guardrails

The system **MUST** block or warn when:

| Condition | Action |
|---|---|
| `quality_rating = RED` | **Block** marketing campaigns |
| `quality_rating = YELLOW` | Warn, require confirmation |
| Campaign > 50% of the account's total leads | Warn — this looks like a blast |
| Same audience messaged within 24 h | Warn |
| Approaching Meta's messaging limit tier | Warn with the remaining count |

> These protect the customer's number, and ours. A customer who gets their number rated `RED` and
> then blames the CRM is a churned customer and a bad review — and they were three warnings away
> from avoiding it.

---

## 4. Billing

### SN-CAMP-030 — Prepaid credits

Campaign and template sends draw from a prepaid credit balance. Balance always visible; low-balance
warning at 20% and 5%.

**Prepaid rather than postpaid.** A customer cannot accidentally run up a bill they did not intend,
which in this segment matters more than the convenience of invoicing.

### SN-CAMP-031 — Cost-plus, disclosed

Our margin over Meta's rate is stated in the pricing page and the credit purchase flow. Not hidden
in an effective rate.

### SN-CAMP-032 — Insufficient credit blocks, before sending

A campaign whose estimated cost exceeds the balance **MUST NOT** start. Partial sends that stop
mid-audience are the worst outcome — the customer paid, half their leads got a message, and they
cannot tell which half without exporting.

### SN-CAMP-033 — Ledger

`credit_ledger` is append-only, exportable, and reconciles to the provider's reported usage. Any
divergence beyond 1% raises an internal alert.

---

## 5. Reporting

### SN-CAMP-040 — Funnel per campaign

Sent → Delivered → Read → Replied → Opted out. Plus failures by reason, cost actual vs estimated,
and replies attributed back to leads.

### SN-CAMP-041 — Replies are conversations, not metrics

A reply to a campaign message lands in the lead's timeline and the inbox as a normal conversation,
**and** opens the 24-hour free service window.

> This is the compounding advantage of Coexistence. A campaign is not a broadcast that ends — it is
> a conversation starter, and every reply becomes 24 hours of free two-way messaging in a CRM that
> records all of it. Competitors selling a bulk-sender cannot follow the conversation that results.

### SN-CAMP-042 — Cross-campaign view

Spend over time, delivery and read rates by template and category, opt-out rate trend, cost per
reply.

**Cost per reply is the metric that matters** — not cost per message, and certainly not delivery
rate.

---

## 6. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Campaigns | ❌ | ✅ | ✅ |
| Templates | ❌ | 20 | unlimited |
| Recipients per campaign | — | 5 000 | 50 000 |
| Campaigns/month | — | 20 | unlimited |
| Scheduling | — | ✅ | ✅ |

---

## 7. Throughput

At **5 msg/sec** (Coexistence fixed ceiling):

| Recipients | Duration |
|---|---|
| 100 | 20 s |
| 1 000 | 3 min 20 s |
| 5 000 | 16 min 40 s |
| 50 000 | 2 h 47 min |

Shown at preview, and as a live ETA during sending. Large campaigns run in the background with
progress and a completion notification.
