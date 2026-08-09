---
doc: F14-team-and-subteams
status: REVIEW
owner: Product + Engineering
area_code: TEAM
depends_on: [06-permissions-and-plans, F01-identity-and-onboarding]
---

# F14 — Team & Sub-teams

Managing who is in the organisation, what they can do, and how well they are doing it.

Permission *semantics* live in [`06-permissions-and-plans.md`](../06-permissions-and-plans.md).
This document covers the screens, the lifecycle and the dashboard.

---

## 1. Members

### SN-TEAM-001 — Invite by email, with a preset

Inviting asks for: email, role preset, sub-teams, and accessible WhatsApp numbers. Advanced
capability toggles are collapsed behind "Customise permissions".

> Privyr exposes the raw capability grid with no presets. It is powerful, and it means adding a
> five-person team is several minutes of toggling — real friction at exactly the activation moment
> where we can least afford it.

### SN-TEAM-002 — Bulk invite

Up to 50 addresses at once, one preset applied to all, then individually adjustable.

### SN-TEAM-003 — Lifecycle

```
INVITED ──accept──► ACTIVE ──deactivate──► DEACTIVATED ──reactivate──► ACTIVE
   │
   ├─ resend   (new token, old invalidated)
   └─ cancel   (token invalidated, row retained for audit)
```

### SN-TEAM-004 — Deactivate, never delete

A membership **MUST NOT** be deletable. Assigned leads, authored content and historical activity
must survive.

Deactivation requires an explicit reassignment decision for their open leads
([`F01`](F01-identity-and-onboarding.md) §SN-AUTH-022) and immediately: revokes sessions, removes
them from round-robin rotation, and stops notifications. It does **not** break their sequences or
delete their content.

### SN-TEAM-005 — List

Name · email · role · status · **assigned leads** · last active · sub-teams · WhatsApp numbers.

Filter by status, role, sub-team. Search by name or email.

Envelope stats: active / deactivated / invited counts, and seat usage against the plan.

### SN-TEAM-006 — One endpoint, many uses

```
GET /api/v1/members?include_self=&include_invited=&status=&apply_subteams=&has_whatsapp=
```

Serves the admin list, assignee pickers, filter dropdowns and mention autocomplete.

> Lifted from Privyr's query-flag approach, which is a genuinely good piece of API design — one
> well-parameterised endpoint instead of four near-duplicates that drift apart.

### SN-TEAM-007 — Seat limits are self-serve

Hard cap plus a soft upsell threshold ([`06`](../06-permissions-and-plans.md) §2.4). Increases
within the plan's cap are **self-serve and prorated**.

> Privyr routes a seat increase to a sales form. For a 12-person brokerage that wants a 13th seat on
> a Tuesday evening, that is a multi-day stall on a decision they had already made. Sales
> involvement begins above Business, not at seat 13.

---

## 2. Sub-teams

### SN-TEAM-010 — In the org domain from the start

Sub-teams scope **both** lead access and content visibility.

> Privyr puts them in `product-collection` because they originally scoped only content, then
> retrofitted lead access. Building them in the identity domain from day one avoids a structural
> oddity that is very hard to unpick later.

### SN-TEAM-011 — Flat, and members may belong to several

No nesting. A member may be in any number of sub-teams; `accessible_subteam_ids` is an array.

> Nested sub-teams are the same trap as nested groups: they double the complexity of every scope
> calculation and permission check for a case that two flat sub-teams handle.

### SN-TEAM-012 — Effect

| Capability | Effect of sub-team scoping |
|---|---|
| `leads.view_others` | Narrowed to leads assigned to sub-team members |
| `leads.view_unassigned` | Unaffected — the unassigned pool is org-wide |
| Content `SUBTEAM` visibility | Visible to the author's sub-teams |
| Team dashboard | Shows only sub-team members |

**Empty `accessible_subteam_ids` means no restriction**, not no access — consistent with every
other scope array except `accessible_whatsapp_account_ids`, which fails closed
([`06`](../06-permissions-and-plans.md) §1.3).

### SN-TEAM-013 — Management

Create · rename · add/remove members · delete. Deleting a sub-team removes the scoping; it
**MUST NOT** delete members, leads or content. The confirmation states which members gain broader
access as a result.

> That last clause matters: deleting a sub-team is a **permission-widening** operation, and it does
> not look like one. Saying so prevents an accidental data exposure inside the org.

---

## 3. Team dashboard

### SN-TEAM-020 — Per-member metrics

| Column | Source |
|---|---|
| Assigned leads | count |
| Contacted leads | derived from unmark triggers |
| **Contacted %** | the headline efficiency number |
| **Median first-response time** | from `lead.first_response_at` ⚠️ |
| Activities logged | `timeline_event` where `origin = MANUAL` |
| Messages sent | `whatsapp_message` outbound, both `API` and `APP_ECHO` |
| Follow-ups: overdue / completed | |
| **Leads with no next step** | the leak |

Plus an org-level summary row with the same metrics.

### SN-TEAM-021 — Median, not mean ⚠️

First-response time **MUST** be reported as a **median**, with p90 available.

> Privyr's team dashboard reports `avg_response_time_seconds: 413264.66` — 4.8 days. That is a mean
> destroyed by a handful of leads nobody ever called. It is a number no manager can act on, and its
> presence trains people to ignore the dashboard. Report the median; show the mean only alongside
> it if at all.

### SN-TEAM-022 — Filters

Date range (`last_7_days`, `last_30_days`, `this_month`, `custom`, `all_time`), sub-team, lead
group, lead source.

Consistent `from`/`to` ISO-8601 convention on every analytics endpoint. **Not epoch seconds.**

### SN-TEAM-023 — Drill-down is mandatory

Every number **MUST** be clickable through to the underlying lead list.

> A dashboard number that cannot be inspected is a number nobody trusts. "Priya has 12 overdue" is
> interesting; the list of 12, one click away, is actionable.

### SN-TEAM-024 — Comparison

Each metric shows change against the previous equivalent period, with direction and magnitude.

### SN-TEAM-025 — Export

CSV export of the dashboard for the selected period and filters. Audit-logged.

---

## 4. Lead escalation

### SN-TEAM-030 — The manager's safety net

When a lead goes un-actioned beyond a configured threshold, escalate.

| Setting | Default |
|---|---|
| Threshold | 30 minutes with no first response |
| Escalate to | The assignee's manager |
| Channel | Push + email |
| Also for leads assigned to others | Configurable |
| Auto-reassign after | Off by default; configurable |

> **This is what makes response-time metrics actionable rather than merely observed.** Privyr has
> the preference keys (`lead_escalation_alerts`, `lead_escalation_alerts_assigned_to_others`) and it
> is one of the most valuable things in their settings screen. A dashboard tells you last week was
> bad; escalation stops this hour from being bad.

### SN-TEAM-031 — Escalation respects quiet hours

A lead arriving at 23:00 does not escalate at 23:30. The clock pauses during quiet hours and
resumes.

---

## 5. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Members | 1 | 20 | unlimited |
| Sub-teams | ❌ | ❌ | ✅ |
| Team dashboard | ❌ | ✅ | ✅ |
| Lead escalation | ❌ | ✅ | ✅ |
| Custom capability grid | ❌ | ✅ | ✅ |
| Role presets | — | ✅ | ✅ |

---

## 6. Acceptance criteria

- `AC-TEAM-004.1` — Given a member with 40 assigned leads, when deactivation is attempted without a reassignment target, then it returns `422` requiring the choice.
- `AC-TEAM-012.1` — Given a rep in sub-team A with `leads.view_others`, when the lead list is requested, then only leads assigned to sub-team A members and unassigned leads are returned.
- `AC-TEAM-021.1` — Given response times of 2, 3, 4, 5 minutes and one of 6 days, when the dashboard renders, then the headline figure is 4 minutes.
- `AC-TEAM-030.1` — Given a lead unactioned for 31 minutes with a 30-minute threshold, when the sweep runs, then the assignee's manager is notified once.
