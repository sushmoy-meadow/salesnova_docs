---
doc: F04-follow-ups
status: REVIEW
owner: Product + Engineering
area_code: FUP
depends_on: [04-domain-model, F02-leads]
---

# F04 — Follow-ups

The rep's daily work queue. On mobile it earns its own bottom-tab slot — the only feature besides
Leads and Inbox that does.

---

## 1. Model

### SN-FUP-001 — One pending follow-up per lead

A lead **MUST** have at most one `PENDING` follow-up. Setting a new one completes or replaces the
existing one.

Enforced by `CREATE UNIQUE INDEX ON follow_up (lead_id) WHERE status = 'PENDING'`.

> "What is the next step with this person" has exactly one answer. Allowing several turns the queue
> into a to-do list, and a to-do list nobody clears is a to-do list nobody opens. History is
> preserved through completed rows.

### SN-FUP-002 — Buckets are derived, never stored

| Bucket | Condition |
|---|---|
| `OVERDUE` | `due_at < now()` |
| `TODAY` | `due_at` within the member's local day |
| `UPCOMING` | `due_at` after today |
| `SOMEDAY` | `due_at IS NULL` |

Storing a bucket would require a cron moving rows across midnight in four timezones, and would be
wrong for any member whose timezone differs from the org's.

### SN-FUP-003 — `SOMEDAY` is a real state

`due_at = NULL` means *deliberately undated*, not *missing*. It is how a rep parks a lead that is
real but not now, without pretending to know when.

> Adopted from Privyr, and a genuinely good piece of product thinking. Without it, reps either
> invent fake dates — poisoning the overdue count — or leave the field empty, which is
> indistinguishable from forgetting.

### SN-FUP-004 — Timezone is the member's

All bucketing uses `user.timezone`, not the org's and not UTC. A rep in Jakarta and a manager in
Delhi see correct — and different — "today" buckets over the same data.

---

## 2. Setting follow-ups

### SN-FUP-010 — Quick-set shortcuts

**Today · Tomorrow · In 3 days · Next week · Next month · Someday · Clear**

Plus a date-time picker. The shortcuts **MUST** be reachable in one tap from lead detail, the grid
and the follow-up list.

Time defaults to `membership.preferences.default_followup_time` (default 09:00 local).

### SN-FUP-011 — Auto-follow-up on contact

When `auto_followup_mode` is set, contacting a lead or sending content creates a follow-up
automatically.

| Mode | Behaviour |
|---|---|
| `NEVER` | No automatic creation |
| **`IF_NONE_EXISTS`** | Create only when no pending follow-up exists. **Default.** |
| `IF_OVERDUE` | Also replace an overdue one |
| `ALWAYS` | Always reschedule |

Offset from `default_followup_days` (default 3).

> `IF_NONE_EXISTS` is the right default: it never overwrites a deliberate decision the rep already
> made, which is the failure mode that makes people switch automation off entirely.

### SN-FUP-012 — Notes are optional

A follow-up **MAY** carry a note. Requiring one adds friction to the action we most want repeated.

### SN-FUP-013 — Follow-ups follow assignment

Reassigning a lead reassigns its pending follow-up. The `assigned_membership_id` on the follow-up
**MUST** track the lead's assignee unless explicitly overridden.

---

## 3. The follow-up list

### SN-FUP-020 — Bucketed view with counts

```
/follow-ups?bucket=overdue|today|upcoming|someday
GET /api/v1/follow-ups/counts
→ {"overdue": 12, "today": 23, "upcoming": 247, "someday": 2}
```

Counts appear as tab badges and in the mobile bottom bar.

### SN-FUP-021 — Default landing is `today`

Not `overdue`. Opening the app to a wall of failure is demoralising and, on a busy day, unhelpful —
the overdue count is visible on its tab and is not going anywhere.

### SN-FUP-022 — Complete in one tap, from the list

Completing **MUST NOT** require opening the lead. The row offers: **Complete** · **Snooze**
(+1 day / +1 week) · **Open lead**.

### SN-FUP-023 — Completion prompts the next one

On completion, offer to set the next follow-up with the same quick-set shortcuts, defaulted per
`auto_followup_mode`. Dismissible, and dismissal is remembered for the session.

### SN-FUP-024 — Row content

Lead name · phone/WhatsApp · stage · note · due time · **and a one-tap WhatsApp action**.

> The whole point of the queue is to act, not to read. A follow-up list that requires two more taps
> to reach the message is a report.

**Acceptance criteria**

- `AC-FUP-001.1` — Given a lead with a pending follow-up, when a new one is set, then the original is `COMPLETED` or replaced and exactly one `PENDING` row remains.
- `AC-FUP-002.1` — Given a follow-up due 23:30 IST and a member in `Asia/Jakarta`, when buckets are computed, then it appears in that member's correct local bucket.
- `AC-FUP-011.1` — Given a lead with a pending follow-up in 5 days and mode `IF_NONE_EXISTS`, when the rep sends a WhatsApp message, then the existing follow-up is unchanged.
- `AC-FUP-022.1` — Given the `today` bucket, when Complete is tapped on a row, then the row clears, counts update optimistically, and no navigation occurs.

---

## 4. Reminders

### SN-FUP-030 — Notification schedule

| Trigger | Channel | Default |
|---|---|---|
| Due today, morning digest | Push + email | ✅ |
| Due now | Push | ✅ |
| Overdue > 1 day | Push, once daily | ✅ |
| Overdue > 7 days | Email digest, weekly | ✅ |

Configurable per member. See [`F17`](F17-notifications.md).

### SN-FUP-031 — The digest is actionable

The morning digest **MUST** list leads with deep links, not a bare count. "You have 23 follow-ups"
is a number; a list with names is a start.

### SN-FUP-032 — Quiet hours

Notifications **MUST** respect quiet hours (default 21:00–08:00 local). A queued notification is
delivered at the next permitted time, never dropped.

---

## 5. Reporting

Exposed on the team dashboard ([`F16`](F16-analytics.md)):

- Overdue count and percentage, per member
- Median time from due to completion
- Completion rate over the period
- Leads with **no** pending follow-up and no terminal stage — **the leak**

> That last one is the number a sales manager actually wants and no CRM in this segment surfaces.
> It is the set of live leads with nothing scheduled: not lost, not won, just quietly forgotten.
> It is trivially derivable from this schema and it should be a headline metric, not a filter
> somebody has to think to build.

---

## 6. Limits

Follow-ups are **not** plan-gated in any tier. Restricting the queue that makes the product work
would be a self-inflicted wound.
