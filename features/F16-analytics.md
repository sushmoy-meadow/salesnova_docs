---
doc: F16-analytics
status: REVIEW
owner: Product + Engineering
area_code: ANL
depends_on: [04-domain-model, F05-timeline-and-activity]
---

# F16 — Analytics

Answering "is this working" for a rep, a manager and an owner. Three different questions.

---

## 1. Principles

### SN-ANL-001 — Native, not embedded

Dashboards **MUST** be built natively over our own event data. Third-party BI **MUST NOT** be
embedded in the product.

> Privyr's analytics appear to be an embedded BI iframe — there is exactly one first-party
> analytics endpoint in their entire bundle. It is why their dashboards are plan-gated behind a
> sales call and cannot drill through to a lead. With the event stream we already have, native is
> both achievable and dramatically better integrated.

### SN-ANL-002 — Basic analytics are free

Lead counts, source breakdown, follow-up status and personal performance are available on every
plan.

> Gating the sales-funnel view behind a sales call, as Privyr does, is a monetisation choice
> disguised as a product boundary. A user who cannot see whether the product is working cannot
> justify paying for it.

### SN-ANL-003 — Every number drills through

Clicking any metric opens the underlying lead list, filtered to exactly that set. A number that
cannot be inspected is a number nobody trusts.

### SN-ANL-004 — Consistent date convention

`from` and `to` as ISO-8601, in the org's timezone, on every analytics endpoint. Presets:
`today` · `yesterday` · `last_7_days` · `last_30_days` · `this_month` · `last_month` ·
`custom` · `all_time`.

**Not epoch seconds.** Privyr's `from_utc`/`to_utc` epochs are unreadable in logs, unpastable into
a browser, and a recurring source of off-by-one-day bugs at timezone boundaries.

### SN-ANL-005 — Permission-scoped at the query

A rep sees their own. A manager sees their sub-team. An owner sees everything. Enforced by
`visibleTo`, not by post-filtering ([`06`](../06-permissions-and-plans.md) §1.6).

---

## 2. Dashboards

### SN-ANL-010 — Overview `/insights`

The default landing for managers. Six cards, all drill-through:

| Card | Content |
|---|---|
| **Lead flow** | New leads over time, by source |
| **Response** | **Median first-response time**, trend, % responded within 15 min |
| **Pipeline** | Leads per stage, funnel view |
| **Engagement** | Content shared, opened, opened-recently |
| **Conversations** | Messages sent/received, active conversations, replies |
| **The leak** ⚠️ | **Live leads with no pending follow-up and no terminal stage** |

> **"The leak" is the card nobody else in this segment builds**, and it is the one a sales manager
> would pay for on its own. It is the set of leads that are neither won, lost, nor scheduled — just
> quietly forgotten. Trivially derivable from our schema; genuinely hard to see any other way.

### SN-ANL-011 — Lead analytics `/insights/leads`

By source (with campaign/adset/ad drill-down), by stage with **time in stage**, by assignee, by
group; created vs converted over time; conversion rate by source; **cost per converted lead** where
ad spend is available via the Meta connection.

### SN-ANL-012 — Content analytics `/insights/content`

Per asset: shared, opened, open rate, **median view duration**, unopened, viewed multiple times.
Ranked best and worst performing.

**Unopened is a work queue, not a statistic** — it links straight to the leads who have not opened,
ready to follow up.

### SN-ANL-013 — Team analytics `/insights/team`

Per [`F14`](F14-team-and-subteams.md) §3.

### SN-ANL-014 — WhatsApp analytics `/insights/whatsapp`

Messages by direction and source (`APP_ECHO` vs `API`), active conversations, median response time
to inbound, service-window utilisation, campaign performance, opt-out rate, **spend and cost per
reply**.

> The `APP_ECHO` vs `API` split is quietly the most interesting chart in the product: it shows how
> much of the team's real work the CRM is capturing that it previously could not see at all.

### SN-ANL-015 — Activity feed `/insights/activity`

Per [`F05`](F05-timeline-and-activity.md) §5. Cursor-paginated, bidirectional, calendar navigation,
filtered by type and member.

---

## 3. Personal view

### SN-ANL-020 — Every rep gets their own

`/insights` for a member without `analytics.view_org` shows their own numbers: leads assigned,
contacted, response time, follow-ups completed, content engagement, messages sent.

> Analytics that only a manager can see are surveillance. Analytics a rep can see for themselves
> are a tool. It is the same query with a different scope, and it changes how the feature is
> received.

### SN-ANL-021 — Comparison is opt-in and anonymised

A rep **MAY** see how they compare to the team median. Named leaderboards are an org setting,
**off by default**.

---

## 4. Implementation

### SN-ANL-030 — Read from the event stream

`timeline_event` and `event` are the source. Aggregates are materialised nightly into rollup tables
for periods older than 7 days; recent periods query live.

### SN-ANL-031 — Rollups are rebuildable

Any rollup **MUST** be recomputable from source events. No rollup is the only copy of anything.

### SN-ANL-032 — Performance

| | p95 |
|---|---|
| Overview dashboard | < 800 ms |
| Drill-through list | < 400 ms |
| Custom range over 12 months | < 2 s |
| Export | async |

### SN-ANL-033 — Empty states teach

A dashboard with no data explains what would populate it and links to the action. A new account's
first view of analytics is an empty one, and it is a teaching opportunity rather than a dead end.

---

## 5. Metrics that require write-time capture ⚠️

Restating [`04`](../04-domain-model.md) §13 because this is the document where the consequence
becomes visible:

| Metric | Requires | If missed |
|---|---|---|
| Median first-response time | `lead.first_response_at` | Permanently unavailable |
| Time in stage | `custom_field_value_history` | Silently wrong after the second change |
| View duration | Confirmed-ingest delta beacons | Only open/not-open |
| Contacted % | Unmark triggers as events | Cannot distinguish contacted from opened |
| Source → conversion | `source_payload` preserved | Cannot attribute revenue to campaigns |
| Campaign funnel | Per-recipient webhook transitions | Only "sent" |

---

## 6. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Overview | ✅ | ✅ | ✅ |
| Personal analytics | ✅ | ✅ | ✅ |
| Lead & content analytics | basic | ✅ | ✅ |
| Team analytics | ❌ | ✅ | ✅ |
| WhatsApp analytics | basic | ✅ | ✅ |
| Custom date ranges | 30 d | 365 d | unlimited |
| Export | ❌ | ✅ | ✅ |
| Scheduled email reports | ❌ | ❌ | ✅ |
