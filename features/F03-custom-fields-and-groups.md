---
doc: F03-custom-fields-and-groups
status: REVIEW
owner: Product + Engineering
area_code: FIELD / GROUP
depends_on: [04-domain-model, F02-leads]
---

# F03 — Custom Fields & Groups

The org's own vocabulary. Two independent taxonomies: **fields** describe a lead, **groups**
categorise it.

---

## 1. Custom fields

### SN-FIELD-001 — Four types, no more

`TEXT` · `NUMBER` · `DROPDOWN` · `DATE`

**Deliberately small.** Multi-select, formula, lookup, currency and file types will all be
requested. Each multiplies the surface area of filtering, importing, form building, sequence
tokens, grid rendering and reporting. The four above cover what this market actually models, and
resisting expansion in V1 is a decision, not an oversight.

### SN-FIELD-002 — System fields are seeded, not hardcoded

`LEAD_STAGE` and `OPPORTUNITY_SIZE` are seeded as `custom_field_definition` rows with
`system_field` set. They **MUST NOT** be columns on `lead`.

| Property | System field | Regular field |
|---|---|---|
| Rename label | ✅ | ✅ |
| Change options | ✅ | ✅ |
| Reorder | ✅ | ✅ |
| Hide | ✅ | ✅ |
| **Delete** | ❌ | ✅ |
| **Change type** | ❌ | ❌ |
| `key` immutable | ✅ | ✅ |

> A real-estate org calls it "Stage"; an insurance org calls it "Policy Status". Both need
> time-in-stage tracking, filtering and reporting on the same mechanism. Seeding rather than
> hardcoding gets that for free — and it is why SN-AUTH-032's industry presets are a data change
> rather than a code branch.

### SN-FIELD-003 — Keys are immutable, labels are not

`key` is generated once from the initial label and never changes. `label` is freely editable.

Everything that references a field — sequence tokens, import mappings, form fields, filters, rules
— references `key`. Renaming "Budget" to "Budget (INR)" **MUST NOT** break a single reference.

### SN-FIELD-004 — Typed storage

Values are stored in typed columns (`value_text`, `value_number`, `value_date`, `value_option`),
never a single text blob.

> Sorting a `NUMBER` field stored as text puts `"9"` after `"10"`. Filtering a `DATE` field stored
> as text cannot express "next 30 days". These are not edge cases; they are the two most common
> things anyone does with these fields.

### SN-FIELD-005 — Autofill from lead source

A field **MAY** declare `autofill_from_source` as a JSON path into `lead.source_payload`. On
ingest, matching values populate automatically.

The mapping UI **MUST** show real sample values from recent leads on that source, not a blank path
input. Nobody knows their Facebook form's field keys from memory.

### SN-FIELD-006 — Date-field reminders

A `DATE` field **MAY** carry a reminder:

| Property | Values |
|---|---|
| `reminder_frequency` | `NEVER` · `ONCE` · `YEARLY` |
| `reminder_offset` | `ON_DAY` · `ONE_DAY_BEFORE` · `ONE_WEEK_BEFORE` · `CUSTOM` |

Firing creates a follow-up (see [`F04`](F04-follow-ups.md)) assigned to the lead's current
assignee.

> `YEARLY` is what makes birthdays and policy renewals work — a small feature with outsized value
> in insurance, where the renewal date *is* the sales cycle.

### SN-FIELD-007 — Stage history is recorded

Every change to a field where `system_field = 'LEAD_STAGE'`, and to any `DROPDOWN` field flagged
`track_history`, **MUST** append to `custom_field_value_history`.

⚠️ **Not backfillable.** See [`04`](../04-domain-model.md) §13.

### SN-FIELD-008 — Relative-move reordering

```
POST /api/v1/custom-fields/{id}/move   {"move": "UP" | "DOWN"}
POST /api/v1/custom-fields/{id}/move   {"position": "AFTER", "relative_to": "…"}
```

The client **MUST NOT** send a full ordered array. Two managers reordering simultaneously would
silently overwrite each other; a relative move is conflict-free and constant-size.

### SN-FIELD-009 — Deletion is explicit about consequences

Deleting a field deletes every value across every lead. The confirmation **MUST** state how many
leads hold a value, and how many rules, forms and sequences reference it.

Where references exist, deletion **MUST** be blocked until they are removed. Hiding is offered as
the non-destructive alternative in the same dialog.

**Acceptance criteria**

- `AC-FIELD-003.1` — Given a field keyed `budget` referenced by a sequence token, when the label changes to "Budget (INR)", then the sequence still resolves the token.
- `AC-FIELD-004.1` — Given a `NUMBER` field with values 9, 10, 100, when sorted ascending, then the order is 9, 10, 100.
- `AC-FIELD-007.1` — Given a lead moved New → Contacted → Negotiation, when time-in-stage is requested, then it is computed from the most recent transition, and the full history is retrievable.
- `AC-FIELD-009.1` — Given a field referenced by an active automation rule, when deletion is attempted, then it returns `409 CONSTRAINT_VIOLATION` naming the rule.

---

## 2. Lead stage

### SN-FIELD-020 — Ordered, coloured, terminal-aware

Stage options carry `order` and `color_id`, and **MAY** be flagged `is_terminal` with an
`outcome` of `WON` or `LOST`.

Terminal stages drive conversion reporting, exclude leads from "needs follow-up" prompts, and
break active sequences by default.

> Privyr treats stage as an ordinary dropdown, so nothing in the product knows that "Closed Lost"
> means stop. Reps then get follow-up nudges for deals they lost weeks ago, which is precisely the
> kind of noise that trains people to ignore the product.

### SN-FIELD-021 — Stage changes are visible

Every change writes a `LEAD_STAGE_CHANGED` timeline event showing from, to, who and when.

---

## 3. Groups

### SN-GROUP-001 — Many-to-many tags

A lead **MAY** belong to any number of groups. Groups **MUST NOT** be hierarchical.

> Hierarchy is the most-requested and least-used feature in every tagging system. It doubles the
> UI complexity of every picker and filter for a case that a naming convention solves.

### SN-GROUP-002 — Server-owned colour palette

`color_id` references a fixed palette of **10** server-defined swatches, each with a background and
a text colour. Free-form hex **MUST NOT** be accepted.

> Adopted from Privyr, and right. Guarantees contrast, keeps the UI coherent, and makes a rebrand a
> one-row change instead of a data migration.

### SN-GROUP-003 — Dual counts

Every group returns `total_leads` and `my_leads`. A rep filtering by "Hot Leads" wants to know how
many are *theirs*, not how many exist org-wide.

### SN-GROUP-004 — Group operations

Create · rename · recolour · delete · merge · bulk add/remove leads.

Deleting a group **MUST NOT** delete its leads. The confirmation states the count and that leads
are unaffected.

Merging moves all members to the target and deletes the source — the standard fix for
"Hot Leads" / "hot leads" / "HOT".

### SN-GROUP-005 — Groups as automation targets

Group membership is a rule condition and a rule action ([`F09`](F09-automation.md)), a sequence
enrolment filter, and a campaign audience filter.

---

## 4. Screens

| Screen | Route |
|---|---|
| Custom fields | `/settings/custom-fields` |
| Field editor | modal — type, label, options, autofill, reminders |
| Groups | `/settings/groups` |
| Inline group assignment | lead detail + grid cell |

Field and group editing sit in **Settings**, not in the daily workflow. Schema changes are
infrequent, org-wide and consequential; they do not belong beside the lead list.

---

## 5. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Custom fields | 5 | 30 | 100 |
| Dropdown options per field | 20 | 50 | 100 |
| Groups | 10 | 200 | unlimited |
| Groups per lead | 10 | 25 | 25 |

Served in `app_constraints`. Never hardcoded.
