---
doc: F05-timeline-and-activity
status: REVIEW
owner: Product + Engineering
area_code: TL
depends_on: [04-domain-model, F02-leads, 11-ai-substrate]
---

# F05 — Timeline & Activity

The record of what happened. In V1 it is what a rep reads before picking up the phone. In V2 it is
what the model reads before drafting a reply.

---

## 1. Two logs, deliberately

| | `timeline_event` | `event` |
|---|---|---|
| Audience | Humans | Machines |
| Content | Curated, pre-rendered, filtered | Complete, structured, raw |
| Mutability | Manual entries are editable | **Append-only. Never mutated.** |
| Retention | Follows the lead | Follows the retention policy |
| Purpose | The story of the relationship | Audit, analytics, AI substrate |

### SN-TL-001 — They MUST NOT be merged

Every user-visible activity writes to both. Not every `event` writes a `timeline_event`.

> The temptation to unify these is strong and should be resisted. A timeline the user can edit
> cannot be an audit log. An audit log complete enough to reconstruct system behaviour is far too
> noisy to read. One table serving both ends up serving neither: either the audit is
> incomplete because entries were tidied away, or the timeline is unreadable because it records
> every field touch. Two tables, one write path.

---

## 2. Event taxonomy

### SN-TL-002 — Every event carries `origin`

`MANUAL` · `SYSTEM` · `WHATSAPP` · `INTEGRATION`

The UI **MUST** distinguish them visually. A note the rep wrote and a stage change the system made
are different kinds of fact.

### SN-TL-003 — The taxonomy

| Category | Types | Origin |
|---|---|---|
| **Lifecycle** | `LEAD_CREATED` `LEAD_ASSIGNED` `LEAD_UNASSIGNED` `LEAD_STAGE_CHANGED` `LEAD_MERGED` `DUPLICATE_DETECTED` | SYSTEM |
| **Response** | **`FIRST_RESPONSE`** ⚠️ | SYSTEM |
| **Manual** | `NOTE` `CALL` `MEETING` `MESSAGE` | MANUAL |
| **Content** | `CONTENT_SHARED` `CONTENT_VIEWED` | SYSTEM |
| **WhatsApp** | `WHATSAPP_INBOUND` `WHATSAPP_OUTBOUND` `WHATSAPP_TEMPLATE_SENT` `WHATSAPP_FAILED` | WHATSAPP |
| **Sequence** | `SEQUENCE_ENROLLED` `SEQUENCE_STEP_COMPLETED` `SEQUENCE_BROKEN` `SEQUENCE_REMOVED` | SYSTEM |
| **Campaign** | `CAMPAIGN_SENT` `CAMPAIGN_FAILED` | SYSTEM |
| **Follow-up** | `FOLLOW_UP_SET` `FOLLOW_UP_COMPLETED` | MANUAL/SYSTEM |
| **Acquisition** | `FORM_SUBMITTED` | INTEGRATION |

### SN-TL-004 — Failures are recorded

`WHATSAPP_FAILED`, `CAMPAIGN_FAILED` and `SEQUENCE_BROKEN` are first-class events with the reason
attached.

> A rep looking at a silent lead needs to know whether the message was never delivered. A timeline
> that shows only successes is actively misleading — it presents "we tried and it failed" as
> "we never tried".

### SN-TL-005 — `CONTENT_VIEWED` is the moment that matters

It carries `duration_seconds`, `device_type` and view sequence number. It is the highest-signal
event in the product: the lead is engaged *now*.

It **MUST** be visually prominent in the timeline, and it drives the "Recently active" view
([`F02`](F02-leads.md) §SN-LEAD-011) and a real-time notification.

---

## 3. Manual activity logging

### SN-TL-010 — Four types, minimum fields

`NOTE` · `CALL` · `MEETING` · `MESSAGE`

Required: type and `occurred_at` (defaulting to now). Everything else optional.

| Type | Optional extras |
|---|---|
| `CALL` | outcome (`CONNECTED`·`NO_ANSWER`·`BUSY`·`WRONG_NUMBER`), duration |
| `MEETING` | location, attendees |
| `MESSAGE` | channel |

> Minimum viable friction. A rep logging a call between two other calls will type one line or
> nothing. Requiring an outcome dropdown means the activity does not get logged at all, and an
> unlogged call is worse for everyone than a sparsely-logged one.

### SN-TL-011 — Backdating is allowed and marked

`occurred_at` **MAY** be in the past. Backdated entries display "logged on {created_at}" alongside
the event time.

Reps log yesterday's site visit this morning. Forbidding it produces wrong timestamps; allowing it
silently corrupts response-time metrics. Allow and mark.

### SN-TL-012 — Attachments

Up to 5 per activity, 10 MB each. Presigned upload ([`05`](../05-api-design.md) §12).

### SN-TL-013 — Manual entries are editable; system entries are not

`origin = MANUAL` entries **MAY** be edited or deleted by their author or by anyone with
`leads.edit_others`. Edits show "edited" with a timestamp.

System, WhatsApp and integration events **MUST NOT** be editable or deletable by anyone, at any
permission level.

> Nobody edits history in this product. Delete-and-relog is available for a genuine mistake and
> leaves a trace; silent rewriting does not exist. The audit log records every edit regardless.

### SN-TL-014 — Pinning

Any event **MAY** be pinned. Pinned events render above the stream, capped at 3.

For the "she asked us to call after 6pm" fact that would otherwise be 40 events down.

**Acceptance criteria**

- `AC-TL-011.1` — Given a call logged with `occurred_at` two days ago, when the timeline renders, then it sorts by `occurred_at` and displays the logged-on date.
- `AC-TL-013.1` — Given a `WHATSAPP_INBOUND` event and an owner-role session, when a delete is attempted, then the response is `403` and the event persists.
- `AC-TL-004.1` — Given a WhatsApp send that fails with error 131047, when the timeline renders, then a `WHATSAPP_FAILED` event shows a human-readable reason.

---

## 4. Rendering

### SN-TL-020 — Reverse chronological, cursor-paginated

Newest first, 50 per page, cursor-paginated on `(occurred_at, id)`. Never offset — new events
arriving would shift the window and silently skip records.

### SN-TL-021 — Day grouping

Grouped under sticky date headers, with relative labels for the recent past ("Today",
"Yesterday", "Last Tuesday").

### SN-TL-022 — Filters

By category: All · Messages · Calls & meetings · Notes · Content · WhatsApp · Sequence · System.

The **System** filter is off by default. Assignment changes and stage transitions are useful when
you are looking for them and noise when you are not.

### SN-TL-023 — Real-time updates

The lead detail timeline **MUST** update live for inbound WhatsApp messages and content-view events
without a refresh, via server-sent events ([`09`](../09-technical-architecture.md)).

> A lead replying while the rep has their record open is the highest-value moment in the product.
> Making them refresh to see it is unthinkable.

### SN-TL-024 — WhatsApp renders as conversation, not log lines

Inline in the timeline, messages render as chat bubbles — direction, media thumbnails, delivery
ticks, timestamps — with a reply box inline for the lead's conversation.

The timeline is not a list of "message sent" rows. It is the conversation, in context, alongside
everything else.

### SN-TL-025 — Six states

Loading · empty (never contacted) · empty (filtered) · error · partial (WhatsApp history still
importing) · permission-denied. Per [`03`](../03-information-architecture.md) §7.

The **partial** state matters here specifically: Coexistence history arrives in three phases, and
the timeline must be honest that more is coming rather than looking complete when it is not.

---

## 5. Org-wide activity feed

### SN-TL-030 — `/insights/activity`

The same events, unfiltered by lead, permission-scoped. Filters: member, event type, date range,
lead group.

For managers: what did the team actually do today.

### SN-TL-031 — Permission-scoped, strictly

A member without `leads.view_others` sees only events on leads they can see. Enforced by the
`visibleTo` query scope ([`06`](../06-permissions-and-plans.md) §1.6), not by post-filtering.

> Post-filtering a feed leaks counts and pagination boundaries even when it hides content. Scope
> the query.

---

## 6. Performance

| Operation | p95 |
|---|---|
| Timeline page, 50 events | < 300 ms |
| Activity write | < 150 ms |
| Real-time event delivery | < 2 s from webhook receipt |
| Org feed, 50 events | < 400 ms |

`timeline_event` is partitioned monthly on `occurred_at`. Queries are always bounded by
`lead_id` or `organization_id` plus a time range; an unbounded scan of this table in a request path
is a bug.

---

## 7. Why this is the AI substrate

Everything above is a V1 requirement justified by V1 value. It is also, without any additional
work, the corpus V2 needs.

| V1 property | V2 capability it enables |
|---|---|
| Unified stream — conversation + activity + content engagement | A model can read the whole relationship in one query |
| `occurred_at` distinct from insert time | Correct temporal reasoning over backdated entries |
| Structured `payload` per event type | Extraction without parsing prose |
| Failures recorded alongside successes | The model knows what did not happen |
| `correlation_id` / `causation_id` on `event` | Reconstructing *why* — which lead caused which assignment caused which message |
| Append-only | A stable corpus that does not shift under an index |

**None of it can be reconstructed later.** A CRM that starts logging properly in year two has a
year-one hole no model can fill. See [`11-ai-substrate.md`](../11-ai-substrate.md).
