---
doc: F02-leads
status: REVIEW
owner: Product + Engineering
area_code: LEAD
depends_on: [04-domain-model, 05-api-design, 06-permissions-and-plans]
---

# F02 — Leads

The core entity. Every other feature exists to move a lead forward.

---

## 1. Model

### SN-LEAD-001 — One entity, two lifecycle stages

A lead and a client **MUST** be the same record. The distinction is `is_new` plus whether
interaction has been logged — never a separate table, never a migration between tables.

> Privyr's UI says "lead" and "client"; their API says `user-client` for both. They got this
> right. Modelling them separately forces a conversion step that the sales process does not
> actually have.

**Vocabulary decision: SalesNova says "lead" everywhere.** Privyr's split vocabulary means their
own help centre, UI and API disagree with each other. One word, used consistently, in the UI, the
API and this specification.

### SN-LEAD-002 — Contactability is required

A lead **MUST** have at least one of: `email`, `phone_e164`, `whatsapp_e164`.

Enforced by a database `CHECK`, not only by validation. A lead nobody can contact is not a lead.

### SN-LEAD-003 — Phone and WhatsApp are separate fields

`phone_e164` and `whatsapp_e164` **MUST** be independently settable. When only one is provided,
the other is populated with the same value and flagged `whatsapp_inferred = true`.

> They differ often enough to matter: a second business number, a landline for calls, a spouse's
> number on WhatsApp. Privyr models them separately and that is correct.

### SN-LEAD-004 — E.164 storage

Phone numbers **MUST** be stored as E.164 plus a two-letter country code. The full libphonenumber
structure **MUST NOT** be persisted.

Parsing uses the org's default country when the input has no country code. An unparseable number
is **rejected at the boundary with a clear message**, never stored raw.

> Privyr persists the serialised libphonenumber object — `country_code`, `national_number`,
> `italian_leading_zero`, `number_of_leading_zeros`, `country_code_source`,
> `preferred_domestic_carrier_code`. It is over-modelled and makes every query painful.

### SN-LEAD-005 — Source payload preserved verbatim

`source_payload` **MUST** store the inbound payload exactly as received, unmodified and
untruncated.

> Privyr dumps the raw form payload into the `notes` free-text field, which mixes machine data with
> the rep's own writing and makes both worse. Keep them apart: `source_payload` is structured and
> immutable; `notes` belongs to the human.

**Acceptance criteria**

- `AC-LEAD-002.1` — Given a create request with no email, phone or WhatsApp number, when submitted, then the response is `422 VALIDATION_FAILED`.
- `AC-LEAD-004.1` — Given `"98765 43210"` and org country `IN`, when a lead is created, then `phone_e164 = "+919876543210"` and `phone_country = "IN"`.
- `AC-LEAD-004.2` — Given `"12345"` and org country `IN`, when submitted, then the response is `422 INVALID_PHONE` and no record is created.
- `AC-LEAD-005.1` — Given a Facebook lead with 14 form answers, when ingested, then all 14 survive in `source_payload` and `notes` is empty.

---

## 2. List views

### SN-LEAD-010 — Two projections, one dataset

| View | Route | Purpose |
|---|---|---|
| **Table** | `/leads/table` | Compact, scannable, mobile-first. **The default.** |
| **Grid** | `/leads/grid` | Wide, column-configurable, inline-editable spreadsheet. `lg` breakpoint and above only. |

Both read the same data through `POST /api/v1/leads/query`. They are presentations, not separate
features.

> Privyr backs these with two different endpoints (`GET user-client/` and
> `POST spreadsheet/clients`) which have drifted apart in filter support and response shape. One
> query surface, two renderers.

### SN-LEAD-011 — Saved views

Four system views, always present:

| View | Definition |
|---|---|
| **All leads** | Everything visible to the member |
| **Uncontacted** | No logged interaction — derived, see §5 |
| **Follow-ups** | Has a pending follow-up (see [`F04`](F04-follow-ups.md)) |
| **Recently active** | `last_content_opened_at` within 7 days, most recent first |

> **"Recently active" is the most under-rated view in Privyr's product.** A lead who just opened
> your brochure is warm *right now*. Surfacing it as a first-class view rather than a report is why
> reps open it daily. Keep it prominent.

Users **MUST** be able to save custom views (`saved_filter`), with an org-visible option for
managers.

### SN-LEAD-012 — Counts come with the list

The list response **MUST** include `meta.counts` for every visible view. The client **MUST NOT**
make a second request for tab badges.

### SN-LEAD-013 — Column configuration persists per member

Grid column order and visibility persist in `membership.preferences.grid_columns`. Custom fields
appear as available columns automatically.

### SN-LEAD-014 — Inline editing in the grid

The grid **MUST** support inline editing of: assignee, stage, groups, follow-up date, notes and any
custom field.

Each edit is an **independent** `PATCH`. A failed cell edit **MUST NOT** discard other pending
edits, and **MUST** revert only that cell with an inline error.

**Acceptance criteria**

- `AC-LEAD-010.1` — Given a viewport under `lg`, when `/leads/grid` is opened, then the client redirects to `/leads/table` and shows a one-time notice.
- `AC-LEAD-012.1` — Given a lead list request, when the response returns, then `meta.counts` contains a value for all four system views, permission-scoped.
- `AC-LEAD-014.1` — Given three cells edited and the second failing validation, when the responses return, then cells 1 and 3 persist and cell 2 reverts with an inline error.

---

## 3. Lead detail

### SN-LEAD-020 — Contact actions are always above the fold

Call · WhatsApp · Email · SMS **MUST** be reachable without scrolling, at every breakpoint,
including when the lead has a long timeline.

> This is the product's primary action. Everything else on the screen is context for it. If a rep
> has to scroll to message someone, the design has failed regardless of how good the rest is.

### SN-LEAD-021 — Screen composition

```
Header      name · assignment · stage · new badge
Actions     Call · WhatsApp · Email · SMS · Share content · More
Follow-up   next step, or a prominent "Set follow-up"
Info        display name, phone, WhatsApp, email, custom fields (inline-editable),
            stage + time-in-stage, groups, notes
Source      where it came from + structured source_payload, collapsed
Timeline    unified activity + WhatsApp messages, newest first, cursor-paginated
```

### SN-LEAD-022 — WhatsApp messages are in the timeline, not a tab

Synced WhatsApp messages **MUST** render inline in the lead timeline, interleaved chronologically
with notes, calls, shares and stage changes.

A separate conversation view exists at `/inbox` for reply-focused work, but the lead detail shows
one story.

> **This is the entire product difference, expressed as a layout decision.** Privyr's "View
> WhatsApp Chats" is a link to a separate surface, because their data is separate. Ours is not.
> Splitting them here would throw away the advantage at the exact point the user would notice it.

### SN-LEAD-023 — Reading never writes

Opening a lead **MUST NOT** mutate it as a side effect of the `GET`.

Where a state change is warranted — clearing the "new lead" badge on view — the client **MUST**
issue an explicit, debounced `POST /api/v1/leads/{id}/interactions` after a **2-second dwell**.

> Privyr fires `PUT .../update-last-interaction/` on page open. Combined with
> `unmark_new_lead_view_client`, merely opening a lead clears its new-lead status — including an
> accidental tap, and including a manager auditing the queue. The *behaviour* is useful; the
> *mechanism* is wrong. Dwell-gating also removes the accidental-tap case.

### SN-LEAD-024 — Time in stage

Displayed from `custom_field_value_history`, as a human string ("3 weeks, 3 days"). Where no
history exists (pre-existing data, imports), display "—", never a fabricated value derived from
`updated_at`.

**Acceptance criteria**

- `AC-LEAD-022.1` — Given a lead with 3 notes and 12 WhatsApp messages, when the timeline is opened, then all 15 render in one chronological stream.
- `AC-LEAD-023.1` — Given a `GET /leads/{id}`, when the response returns, then `last_interaction_at` is unchanged.
- `AC-LEAD-023.2` — Given a lead opened and closed within 1 s, when the session ends, then `is_new` remains true.

---

## 4. Assignment

### SN-LEAD-030 — Assignment is auditable

Every change **MUST** write a `LEAD_ASSIGNED` timeline event and an `event` row with the previous
and new assignee.

### SN-LEAD-031 — Unassigned is a first-class state

`assigned_membership_id = NULL` is valid and visible. Members with `leads.view_unassigned` see the
pool; claiming is one click.

### SN-LEAD-032 — Reassignment can re-mark as new

When `org_preferences.mark_new_lead_on_reassign` is true, reassignment sets `is_new = true` for the
new assignee.

> Correct default: the receiving rep has not seen this lead, whatever the previous one did.

---

## 5. Contacted / uncontacted

### SN-LEAD-040 — "Contacted" is derived and configurable

There is no `is_contacted` column. A lead is contacted when any configured trigger has fired.

| Preference key | Trigger | Default |
|---|---|---|
| `unmark_on_contact_click` | Tapped call/SMS/email/WhatsApp | ✅ |
| `unmark_on_content_sent` | Content shared | ✅ |
| `unmark_on_message_sent` | WhatsApp message sent | ✅ |
| `unmark_on_followup_set` | Follow-up scheduled | ❌ |
| `unmark_on_activity_logged` | Activity logged | ✅ |
| `unmark_on_view` | Lead opened (2 s dwell) | ❌ |

> **`unmark_on_view` defaults to off.** Privyr defaults it on, which means scrolling through your
> queue silently marks everything contacted. That is a metric that flatters the rep and lies to the
> manager. Available, but opt-in.

### SN-LEAD-041 — First response is stamped once, with a timestamp

On the **first** trigger that constitutes outbound contact, the system **MUST** set
`first_response_at` (timestamptz) and `first_response_channel`, and emit a `FIRST_RESPONSE`
timeline event.

Once set, it **MUST NOT** be modified by any subsequent action.

> ⚠️ **Not backfillable.** Privyr stores `is_first_resp_logged: bool`, which throws away exactly
> the number their own team dashboard headlines. Store the timestamp.

### SN-LEAD-042 — New-lead badge scope

`org_preferences.mark_new_lead_sources` controls which sources get the badge; default
`["INTEGRATION", "LEAD_FORM", "WHATSAPP"]`. Manually added leads do not get it — the person who
typed it in has by definition already seen it.

---

## 6. Duplicates

### SN-LEAD-050 — Detection on ingest, not on view

Duplicate detection **MUST** run when a lead is created — manually, by import, or by integration —
against `email`, `phone_e164` and `whatsapp_e164`.

> Privyr fires `search-duplicates` when you *open* a lead detail page. By then the duplicate has
> already been created, assigned, possibly messaged and possibly counted twice in the team
> dashboard. Detect at the point of creation.

### SN-LEAD-051 — Three org-level policies

| Policy | Behaviour |
|---|---|
| `CREATE_NEW` | Create anyway; link both as related |
| `MERGE_EXISTING` | Merge automatically; append to timeline |
| **`FLAG_FOR_REVIEW`** | Create, mark both, queue for human decision. **Default.** |

> Privyr offers only the first two. Automatic merge on a false positive — two family members
> sharing a phone number, which in this market is common — is unrecoverable: notes, stage and
> history are conflated with no undo. Review costs a click and prevents a class of silent data
> corruption.

### SN-LEAD-052 — Merge is explicit and reversible for 30 days

The merge UI **MUST** show a field-by-field comparison with per-field winner selection. Merge
**MUST**:

- Combine timelines chronologically
- Union groups, custom-field values (survivor wins conflicts unless overridden), shares, follow-ups
  (keep the earliest pending), WhatsApp conversations
- Write a `LEAD_MERGED` event carrying the full pre-merge state of both records
- Retain the merged record soft-deleted for **30 days**, with an undo path

**Acceptance criteria**

- `AC-LEAD-050.1` — Given an existing lead with `+919876543210`, when an integration delivers a lead with the same number, then a duplicate is flagged before assignment runs.
- `AC-LEAD-052.1` — Given two leads with 5 and 7 timeline events, when merged, then the survivor's timeline has 12 events in chronological order.
- `AC-LEAD-052.2` — Given a merge 29 days ago, when undo is invoked, then both records are restored with their original timelines.

---

## 7. Bulk operations

### SN-LEAD-060 — Preview before commit

Every bulk operation **MUST** have a `/preview` sibling ([`05`](../05-api-design.md) §10).

### SN-LEAD-061 — Per-record permission enforcement

Bulk operations **MUST** check permissions per record. Ineligible records are **skipped and
reported**, never silently dropped and never failing the whole batch.

```json
{"succeeded": 1240, "skipped": 44,
 "skipped_detail": [{"reason": "NOT_ASSIGNED_TO_YOU", "count": 44,
                     "sample_ids": ["…", "…"]}]}
```

> Privyr fails the entire operation: *"Sorry, this action can't be performed because one or more of
> the clients was assigned to someone else"* — leaving the user to find the offending record among
> 1,200 by hand. Partial success with a clear report is strictly better.

### SN-LEAD-062 — Filter-based selection

`selection.mode = FILTER` **MUST** be supported so "select all 1,284 matching" does not require the
client to enumerate ids.

### SN-LEAD-063 — Bulk delete is guarded

Bulk delete over 50 records **MUST** require typed confirmation of the count. It is soft-delete,
recoverable for 30 days.

---

## 8. Import and export

### SN-LEAD-070 — CSV import with column mapping

```
1. Upload            (presigned; ≤10 MB, ≤10 000 rows per file)
2. Map columns       auto-suggested, incl. custom fields
3. Preview           first 10 rows as they will be created
4. Configure         duplicate policy, assignee, groups, tags for this batch
5. Import            async; progress; per-row error report
```

Every batch creates an `import_batch` with per-row results. Failed rows are **downloadable as a
corrected-format CSV** so the user fixes and re-uploads only the failures.

### SN-LEAD-071 — Import is reversible for 7 days

An entire batch **MUST** be undoable for 7 days, removing only leads created by that batch and
leaving merges and subsequent edits intact where possible (reporting what could not be reverted).

> The single most common support request in every CRM is "I imported the wrong file". Making it
> self-serve is cheap insurance.

### SN-LEAD-072 — Export

Async, permission-scoped, plan-limited on row count, delivered as a signed download link with a
24-hour expiry. **Every export is audit-logged** with the requester, filter and row count.

---

## 9. Search and filtering

### SN-LEAD-080 — Phone-tolerant search

Search input **MUST** be normalised through libphonenumber before matching. `98765 43210`,
`+91 98765 43210`, `9876543210` and `098765-43210` all match `+919876543210`.

> The most common search in the product is a rep typing the number as it appears on their phone
> screen. Getting this wrong makes search feel broken in the one case it matters most.

### SN-LEAD-081 — Filter surface

Assignee (me / unassigned / member / sub-team) · groups · stage · any custom field · source ·
integration · date added · last activity · has follow-up · follow-up bucket · is new ·
contacted state · has WhatsApp conversation.

### SN-LEAD-082 — Filters are URL-encoded

Active filters **MUST** serialise into the URL so a filtered view is shareable and
back-button-safe.

---

## 10. Performance

| Operation | p95 |
|---|---|
| Lead list, 50 rows | < 300 ms |
| Lead detail | < 250 ms |
| Timeline page, 50 events | < 300 ms |
| Search | < 200 ms |
| Inline edit | < 200 ms |
| Duplicate check on ingest | < 100 ms |

Duplicate detection sits in the inbound-lead hot path. It runs on every lead from every
integration, and a slow check delays the notification that starts the response clock.

---

## 11. Delivery checklist

- [ ] Single entity, `is_new` lifecycle flag
- [ ] E.164 storage; independent phone and WhatsApp fields
- [ ] Contactability constraint at the database level
- [ ] `source_payload` preserved verbatim, separate from `notes`
- [ ] Table and grid over one query surface
- [ ] Four system views + saved custom views
- [ ] Counts in list `meta`
- [ ] Per-member persisted column config
- [ ] Independent inline cell edits
- [ ] Contact actions above the fold at every breakpoint
- [ ] WhatsApp messages inline in the timeline
- [ ] No side effects on `GET`; explicit dwell-gated interaction call
- [ ] `first_response_at` as a timestamp, stamped once ⚠️
- [ ] Configurable unmark triggers, `unmark_on_view` off by default
- [ ] Duplicate detection **on ingest**, with `FLAG_FOR_REVIEW` default
- [ ] Merge with per-field selection and 30-day undo
- [ ] Bulk preview, partial success, per-record permission checks
- [ ] Import with mapping, per-row errors, 7-day undo
- [ ] Audit-logged export
- [ ] Phone-normalised search
