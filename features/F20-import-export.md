---
doc: F20-import-export
status: REVIEW
owner: Product + Engineering
area_code: DATA
depends_on: [F02-leads, 06-permissions-and-plans, 10-nfr-security-compliance]
---

# F20 — Import & Export

How data gets in on day one, and how it gets out on any day. Import is an activation feature;
export is a trust feature. They deserve different attention and get it here.

---

## 1. Import

### SN-DATA-001 — Five-step wizard

```
1. Upload      CSV or XLSX · ≤10 MB · ≤10 000 rows
2. Map         auto-suggested columns, incl. custom fields
3. Configure   duplicate policy, assignee, groups, tag this batch
4. Preview     the first 10 rows exactly as they will be created
5. Import      async, progress, per-row results
```

### SN-DATA-002 — Mapping is auto-suggested and remembered

Header matching by name and by sampled content (a column of `+91…` values suggests phone). A
confirmed mapping is remembered per org and pre-applied to files with the same header signature.

> Most imports in this market are repeated monthly from the same portal export. Remembering the
> mapping turns a five-minute task into a thirty-second one.

### SN-DATA-003 — Preview shows real transformations

Not raw cells — the **created record**: normalised E.164 numbers, resolved custom-field values,
flagged duplicates, and any rows that will be rejected with the reason.

### SN-DATA-004 — Partial success, with a fixable error file

An import **MUST NOT** fail wholesale. Valid rows import; invalid rows are reported.

Failed rows are downloadable as a **CSV in the original format plus an `_error` column**, so the
user fixes and re-uploads only the failures.

> The alternative — a list of error messages on screen — means the user manually finds 43 bad rows
> in a 4,000-row spreadsheet. Nobody does this; they give up and the data never arrives.

### SN-DATA-005 — Duplicate handling is per-import

The batch's duplicate policy defaults to the org setting and is overridable for that import. Merges
are reported separately from creations in the result.

### SN-DATA-006 — Imports do not trigger anything

Imported leads **MUST NOT** fire notifications, evaluate routing rules, enrol in sequences or set
`first_response_at` — unless the user explicitly opts in per batch.

> ⚠️ Same class of hazard as history sync ([`F12`](F12-whatsapp-coexistence.md) §SN-WA-025).
> Importing 3,000 old leads that each fire a push notification and enrol in the intro sequence is
> a catastrophe that is easy to ship by accident and impossible to undo cleanly.

### SN-DATA-007 — Batches are tagged and undoable for 7 days

Every batch creates an `import_batch`. Leads carry the batch id. Undo removes only leads created by
that batch, reports what could not be reverted (merged records, subsequently edited records), and
is available for **7 days**.

> "I imported the wrong file" is the most common support request in every CRM ever built. Making it
> self-serve is cheap insurance and a support-cost line item.

### SN-DATA-008 — Phone-contact import

A guided flow for importing phone contacts via vCard export, since responsive web cannot read the
address book directly. WhatsApp contact sync ([`F12`](F12-whatsapp-coexistence.md) §SN-WA-023) is
the better path and the UI should say so.

**Acceptance criteria**

- `AC-DATA-004.1` — Given a 1 000-row file with 43 invalid rows, when imported, then 957 leads are created and an error CSV of 43 rows is downloadable.
- `AC-DATA-006.1` — Given a 3 000-row import with routing rules active, when it completes, then zero notifications were sent and zero sequence enrolments were created.
- `AC-DATA-007.1` — Given an import 6 days ago, when undo is invoked, then only leads created by that batch are removed and merged records are reported as not reverted.

---

## 2. Export

### SN-DATA-010 — Export always works ⚠️

Data export **MUST** succeed in every subscription state, including `EXPIRED` and `CANCELLED`, for
90 days after termination.

> Required under DPDP and GDPR portability. Also simply correct. A product that holds data hostage
> generates the one kind of complaint no amount of marketing repairs.

### SN-DATA-011 — Scope and format

| Export | Contents |
|---|---|
| Leads | All fields, custom fields, groups, assignee, source, timestamps |
| Leads + activity | Above plus timeline events |
| Conversations | WhatsApp messages per lead |
| Content performance | Assets with share and view stats |
| Team dashboard | Per-member metrics for a period |
| **Full account** | Everything, as structured JSON |

CSV and XLSX for tabular exports; JSON for the full account export.

### SN-DATA-012 — Async with a signed link

Over 1,000 rows runs async. Completion notifies in-app and by email with a **signed download link
expiring in 24 hours**. The link requires an authenticated session — it is not a bearer URL.

> Privyr emails the export and states it "can take up to 1 hour". Slow is acceptable; an
> unauthenticated link to a customer database sitting in an inbox is not.

### SN-DATA-013 — Permission-scoped

An export returns exactly what the requester can see. A rep exports their own leads; a manager
their sub-team's.

### SN-DATA-014 — Every export is audited ⚠️

`audit_log` records the requester, filter, row count, format and delivery. Retained 2 years.
Visible to the org owner in settings.

> **Bulk export is the primary data-exfiltration path in any CRM.** A departing rep exporting the
> customer list is the single most common real-world incident in this category. We cannot prevent
> it — they have legitimate access — but it must be visible, immediately and permanently.

### SN-DATA-015 — Large exports are notified to the owner

An export above 5,000 rows, or any full-account export, notifies the org owner in real time —
regardless of who requested it.

### SN-DATA-016 — Rate limited

One export per member per hour; three per org per hour. Above that, `429` with a clear explanation.

Prevents both accidental hammering and rapid sequential extraction.

### SN-DATA-017 — Plan limits truncate visibly

Row limits per plan ([`06`](../06-permissions-and-plans.md) §2.2). Exceeding one **truncates and
reports** — `{requested, delivered, limit}` — never fails silently, and never silently delivers a
partial file the user believes is complete.

---

## 3. Account deletion

### SN-DATA-020 — Self-serve, with a grace period

An owner can delete the organisation from settings. Requires re-authentication and typing the
organisation name.

```
Request → 30-day grace (suspended, restorable, export still available)
        → permanent deletion → confirmation email
```

### SN-DATA-021 — Export is offered first

The deletion flow offers a full account export **before** confirming, and states plainly what will
be destroyed and when.

### SN-DATA-022 — Deletion is real

After the grace period: all tenant data purged from primary storage; backups purged within their
rotation (documented, ≤35 days); anonymised records retained only where a legal obligation
requires it (invoices, tax records), with the retention basis documented.

### SN-DATA-023 — Individual erasure

A single lead's personal data can be erased on request while retaining anonymised aggregate
records, so historical reporting is not destroyed by one erasure.

Required under DPDP and GDPR right-to-erasure. See
[`10-nfr-security-compliance.md`](../10-nfr-security-compliance.md).

---

## 4. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Import rows per file | 500 | 10 000 | 10 000 |
| Imports per month | 2 | unlimited | unlimited |
| Export rows | **0** | 25 000 | 100 000 |
| Full account export | ✅ | ✅ | ✅ |
| Conversation export | ❌ | ✅ | ✅ |
| Scheduled exports | ❌ | ❌ | ✅ |

> **Export is `0` on Free but full account export is available on every tier.** These are different
> things and the distinction is deliberate: routine bulk CSV extraction is a paid feature and the
> main vector for harvesting value without paying; the right to take *your own data and leave* is
> not something we charge for, ever.
