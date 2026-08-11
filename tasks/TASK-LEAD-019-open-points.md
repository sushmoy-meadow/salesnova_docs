# TASK-LEAD-019 — open points

Built: the four system-view tabs badged from `meta.counts`, custom saved views with an org-visible
option for managers, and a filter builder over the SN-LEAD-081 surface that serialises into the URL.
What follows is what could not be closed inside `salesnova_frontend`, and what would close it.

## 1. Saved-view CRUD answers 501

`routes/splits/customer.php` registers `saved-views` index/store/show/update/destroy, and every
controller returns `NOT_IMPLEMENTED`. `src/lib/leads/saved-views.ts` is built against the wire
contract published by `SavedViewDTO` and `SavedViewRequest` (`name`, `filter`, `sort`, `columns`,
`visibility: member|organization`) and is unit-tested with a stub fetcher, including the 204 on
delete and the 501 refusal.

**Closes when** the saved-view controllers are implemented and one round trip — create, list,
apply, delete — is exercised against the running API.

## 2. An unfiltered lead list cannot be requested

`ComplexQueryRequest` validates `filters` as `required` and `filters.conditions` as
`required|array|min:1`, so there is no valid body for "all leads, no filters". `toLeadQueryRequest`
omits the `filters` key when nothing is filtered rather than sending a group the endpoint rejects
or a nonsense condition to pad it; against the current validator that request 422s.

**Closes when** `filters` becomes `sometimes` and `filters.conditions` accepts an empty array, or
the endpoint reads `view` alone when no filter group arrives. One line either way.

## 3. Five filter fields the query service does not map

`LeadQueryService::applyCondition` maps `assigned_to`, `created_after`, `last_activity_after`,
`source`, `integration`, `is_new`, `has_follow_up`, `contacted_state`, `has_whatsapp_conversation`
and `q`. It throws `errors.leads.unsupported_filter_field` for anything else, which is these:

| Filter | Field sent |
|---|---|
| Groups | `group_ids` |
| Stage | `stage` |
| Assignee → a sub-team | `subteam_id` |
| Follow-up due | `follow_up_bucket` |
| Any custom field | `cf_<key>` |

They are offered because SN-LEAD-081 names them as the filter surface; omitting them would ship a
filter builder the spec calls incomplete.

**Closes when** the query service maps those five and the UI is driven against the live endpoint.

## 4. AC-LEAD-012.1 is proved on the server, not here

The criterion — `meta.counts` carries a permission-scoped value for all four system views — is a
property of the response, so the permission scoping is the backend's test to write. What is proved
here is the client half: the response schema rejects a list whose `meta.counts` is missing any of
the four, and the tab badges read that meta rather than issuing a second request.

**Closes when** the backend asserts the four counts are scoped to what the membership may see.

## 5. Nothing yet publishes the signed-in member's capabilities

`canShareWithOrganisation` is a prop on `LeadViewsToolbar`. The intended source is the bootstrap
payload (TASK-ARCH-013, pending), and until it lands the screen mounting the toolbar has to supply
the answer. The capability chosen is `team.manage` — the only manager-shaped entry in the grid;
SN-LEAD-011 names none of its own.

**Closes when** bootstrap publishes the capability grid and the toolbar's caller reads
`team.manage` off it.
