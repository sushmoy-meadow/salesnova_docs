---
doc: F09-automation
status: REVIEW
owner: Product + Engineering
area_code: RULE
depends_on: [04-domain-model, F02-leads, F08-sequences, F10-integrations]
---

# F09 — Automation: Routing, Distribution & Meta CAPI

What happens in the seconds after a lead arrives. This is where the response-time promise is
actually kept.

---

## 1. Two rule kinds, deliberately distinct

| | **Routing** | **Distribution** |
|---|---|---|
| Question | Who inside the account owns this lead? | Who outside gets told about it? |
| Actions | Assign, enrol in a sequence, add to groups, set fields | Forward by WhatsApp/email/app to recipients |
| Recipients | Members | Any address, inside or outside the org |
| Modes | — | Broadcast · Round-robin |

Both share one condition engine, one priority-ordering mechanism and one evaluation pipeline. They
are separate *rule kinds*, not separate features with duplicated machinery.

> Privyr splits these across two services with two different endpoint families and two builders
> that behave slightly differently. Same engine, two `rule_kind` values.

---

## 2. Conditions

### SN-RULE-001 — Three-part tuples, flat conjunction

`field` → `operator` → `value`, combined with a single `AND`/`OR` across the rule.

**One nesting level. No condition trees.**

> Small on purpose. Nested boolean logic in a rule builder is where CRM products go to die: it
> doubles the UI, makes rules unreadable to the next person, and serves a tiny minority. Two flat
> rules in priority order express almost everything anyone actually wants.

### SN-RULE-002 — Five operators

`EQUALS` · `NOT_EQUALS` · `CONTAINS` · `STARTS_WITH` · `ENDS_WITH`

### SN-RULE-003 — Server-supplied vocabulary

```
GET  /api/v1/rules/fields                     available fields for this org
POST /api/v1/rules/fields/{key}/values        allowed values for a field
```

A two-step dynamic builder. Fields include lead attributes, custom fields, source, integration,
form, and **specific keys within `source_payload`** for the selected source.

> Adopted from Privyr's `criteria-list` / `criteria-list-values`. It is what lets a user build a
> rule on "Facebook form question 3" without anyone hardcoding Facebook form question 3.

### SN-RULE-004 — Conditions store the display label

`display_value` and `field_label` are captured at authoring time alongside the raw `value`.

> So a rule still reads "Form = Diwali Campaign" after the Facebook form is renamed, with no join
> and no lookup. Denormalisation earning its keep — lifted from Privyr's live payload.

### SN-RULE-005 — Validation is specific

`"Missing rule criteria"` and `"Missing 3rd dropdown value"` — Privyr's actual messages — are
better than a generic failure and still not good enough. Ours name the field and the row:
*"Row 2: choose a value for 'Lead Source'."*

---

## 3. Evaluation

### SN-RULE-010 — Priority-ordered, first match wins

Rules evaluate in `priority` order. **The first match wins; evaluation stops.**

A `is_default` rule **MAY** exist as the final fallback and always matches.

### SN-RULE-011 — Reordering is a relative move

`POST /api/v1/rules/{id}/move` with `{"move": "UP"}` or `{"position": "AFTER", "relative_to": …}`.
Never a full array.

### SN-RULE-012 — Evaluation is synchronous in the ingest path

Routing rules **MUST** evaluate before the lead-created notification fires, so the lead is already
assigned when the rep is told about it.

**Budget: < 50 ms p95.**

> An unassigned lead sitting in a queue while a background job catches up is exactly the failure
> the product exists to prevent. The rep gets the notification, opens the lead, and it says
> "unassigned" — so nobody acts.

### SN-RULE-013 — Rules are testable before activation

```
POST /api/v1/rules/{id}/test   {"lead_id": "…"}  or  {"sample_payload": {…}}
```

Returns whether it matches, which condition failed, and what actions would run — **without
executing them**.

The builder also shows a live count: *"142 of your last 500 leads would have matched this rule."*

> Building a routing rule you cannot test until the next real lead arrives is guesswork with
> customer consequences.

### SN-RULE-014 — Every evaluation is logged

`rule_execution_log`: rule, lead, matched (bool), conditions evaluated, actions taken, errors,
duration.

Retained 30 days. Visible in the UI per rule.

> "Why did this lead go to Priya?" must be answerable in one click. Without a log it is
> unanswerable, and it will be asked weekly.

---

## 4. Routing rules

### SN-RULE-020 — Actions

```json
{"assign": [{"membership_id": "…", "weight": 1, "sequence_id": "…"}],
 "add_to_groups": ["…"],
 "set_fields": {"cf_stage": "New", "cf_priority": "High"},
 "notify": ["ASSIGNEE", "MANAGER"]}
```

### SN-RULE-021 — `sequence_id` is per assignee

Different team members can receive different follow-up sequences from the same rule.

> Directly from Privyr's live payload capture. It is a small design choice with real consequence:
> the senior rep gets the consultative sequence, the junior gets the qualification one, from one
> rule.

### SN-RULE-022 — Weighted round-robin within a rule

`assign` with multiple members distributes round-robin, honouring `weight`. State is per rule and
**visible in the UI**: whose turn is next, how many each received this round, and when each last
received a lead.

> "Why didn't I get that lead?" is a weekly question and opaque round-robin makes it unanswerable.
> Privyr exposes this state and they are right to.

### SN-RULE-023 — Assignment respects availability

A member who is `DEACTIVATED`, or who has set themselves unavailable, is **skipped in rotation
without consuming their turn**.

---

## 5. Distribution rules

### SN-RULE-030 — Broadcast and round-robin

`BROADCAST`: every matching lead to all recipients. `ROUND_ROBIN`: leads cycle one at a time.

> Note: Privyr's shipped constant is `ROUND_ROBBIN`. We spell it correctly. Small, but the misspelt
> value ends up in every integration, export and API contract forever.

### SN-RULE-031 — Recipients

Email · WhatsApp number · in-app member · webhook URL. Recipients need **not** be members —
distribution forwards outside the org.

### SN-RULE-032 — `save_to_account`

Controls whether a forwarded lead is also saved into the sender's account, or only forwarded. Both
are legitimate: an agency forwarding to a client wants the record; a lead reseller may not.

### SN-RULE-033 — Full history

`distribution_log` records every dispatch: rule, lead, recipient, channel, status, error, cost.
Queryable and exportable.

### SN-RULE-034 — Costed and previewed

WhatsApp distribution consumes credits. The rule builder shows estimated monthly cost from recent
volume, and the account warns before the balance runs out — not after sends start failing.

---

## 6. The WhatsApp auto-responder

### SN-RULE-040 — A composition, not an engine

The auto-responder is **not a separate subsystem**. It is:

```
connected WhatsApp account  +  routing rule  +  AUTOMATED sequence
```

The UI presents it as one feature with a guided setup that checks the three preconditions and
links to whichever is missing.

> Privyr layers it exactly this way — their page probes each precondition with a cheap
> `page_size=1` existence check. It is good architecture: one scheduler, one rule engine, one
> sequence engine, composed. Replicate the layering, and present the composition as a product.

### SN-RULE-041 — Preconditions are explained, not just blocked

Missing a precondition shows what is missing, why it is needed and a direct link — never a disabled
button with no explanation.

---

## 7. Meta Conversions API

### SN-RULE-050 — Server-side conversion events

When a lead reaches a configured stage, SalesNova sends a server-side conversion event to Meta so
campaign optimisation learns which leads were actually good.

Config: which stage maps to which event, per connected ad account.

> A genuine competitive feature and a strong reason CRM-plus-ads integration is sticky. Privyr
> surfaces it prominently ("You've sent 99+ conversion events to Meta in the last 7 days") and
> performance marketers — a large slice of our ICP — care about it a great deal.
>
> It is also the **honest substitute for the pixel injection we refuse to do**
> ([`F06`](F06-content.md) §SN-CONT-034): the same ad-optimisation benefit, from data the customer
> already owns, without fingerprinting the lead on a page they never consented to.

### SN-RULE-051 — Per-lead event state

`fb_conversion_event`, `fb_conversion_sent_at`, `can_send_conversion_event`, plus dedup on
`event_id` so a stage bounce does not double-count.

### SN-RULE-052 — PII is hashed

Email and phone are SHA-256 hashed before transmission, per Meta's requirement. Raw PII
**MUST NOT** be sent.

### SN-RULE-053 — Reporting

Events sent, match rate, per-campaign and per-adset attribution, 7/30-day windows.

---

## 8. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Routing rules | 1 | 25 | unlimited |
| Distribution rules | 0 | 5 | unlimited |
| Distribution recipients per rule | — | 2 | 20 |
| Auto-responder | ❌ | ✅ | ✅ |
| Meta CAPI | ❌ | ✅ | ✅ |
| Rule execution log retention | 7 d | 30 d | 90 d |

---

## 9. Acceptance criteria

- `AC-RULE-010.1` — Given rules A (priority 1) and B (priority 2) that both match, when a lead arrives, then only A's actions execute and B is logged as not evaluated.
- `AC-RULE-012.1` — Given a lead arriving via webhook, when the assignment notification is delivered, then `assigned_membership_id` is already set.
- `AC-RULE-013.1` — Given a rule tested against a lead, when the test returns, then no assignment, enrolment or message occurs.
- `AC-RULE-022.1` — Given round-robin over 3 members with one deactivated, when 6 leads arrive, then the two active members receive 3 each and the deactivated member's turn is never consumed.
- `AC-RULE-052.1` — Given a CAPI event for a lead with email and phone, when the request is captured, then both fields are SHA-256 hashes and no plaintext PII is present.
