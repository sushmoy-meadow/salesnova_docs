# TASK-TL-006 — open points

What this slice could not close, and what would close it. Everything else it was asked for is built
and tested; the demo is in `TASK-TL-006-demo.md`.

## The lead-group filter has nothing to filter on

SN-TL-030 names four filters: member, event type, date range, lead group. Three are built — the
category chips, the member select and the date range, all of them scoping the query rather than the
answer. The fourth has no storage anywhere in the system: there is no group table, no membership of
one, and nothing on `leads` that names a group. The `groups.manage` capability exists in the
capability map and grants power over a thing that does not exist yet.

Building the control now would mean a select with no options, or one populated from a shape invented
here that the real feature would then have to match.

**What closes it:** the lead-group model — table, tenant scope, lead membership — and then a
`group_id` filter on the feed query that joins through it, one `FilterDescriptor` in the bar, and one
key in `useFeedFilters`. The scoping rule is the same as the member filter's: the group narrows what
is already visible to the reader, never widens it.

## The member filter offers only members who appear in the loaded rows

There is no roster endpoint, so the options come from `actorsIn()` over the rows the screen holds —
the initial server page plus whatever has been paged in. A manager who wants to filter by somebody
quiet enough not to appear in the first 50 events cannot pick them from the list.

The one case where this is visibly wrong is already handled: a link naming a member no loaded row
mentions keeps the filter applied and labels it "The member in this link" rather than dropping it,
which is what makes a shared filtered link survive being opened by somebody else.

**What closes it:** a members endpoint the bar can read — the same one the assignment control will
need — and `feedFilterSurface()` taking the roster instead of deriving it. The derived list stays as
the fallback for a degraded read.

## The day headings are stamped from the server's clock at render, and do not move

`groupByDay` is given `new Date(now)`, where `now` came from the shell payload when the page was
rendered. That is deliberate — it is why "Today" means the account's today rather than the browser's
— but it also means a screen left open across midnight keeps labelling yesterday's events "Today"
until something re-renders it.

The obvious fix, re-reading the clock during render, is what the React compiler's `react-hooks/purity`
rule forbids: `Date.now()` cannot be called while rendering. Reverted, and left as it is rather than
worked around, because the wrong version of this is a hook that re-renders the whole feed on a timer.

**What closes it:** an effect that recomputes the day boundary when the account's date actually
changes — one timeout scheduled to the next local midnight, not a poll — feeding a state value that
`groupByDay` reads.

## The RSC pass ignores `searchParams`, so a shared filtered link renders twice

`page.tsx` always asks the API for the unfiltered default page, and the screen then re-queries from
the client once `useFeedFilters` has read the query string. Opening somebody's filtered link
therefore costs two reads and shows the unfiltered feed for the length of the second one.

It is correct, and it is what makes the initial page reusable as the untouched cache entry, but it is
work that did not need doing.

**What closes it:** the page reading `searchParams`, parsing it with the same helpers the hook uses,
and passing the resolved filters into both the server fetch and the screen — with the screen seeding
its query cache under the matching key rather than only under the untouched one.

## `useListUrlState` stamps `page` and `per_page` into a cursor feed's URL

The shared hook writes offset-pagination keys whenever a filter changes, because every other list
screen is offset-paginated. The feed is keyset-paginated and ignores both, so the address grows two
parameters that mean nothing and that a reader will reasonably assume they can edit.

Harmless today; misleading in a link.

**What closes it:** an option on `useListUrlState` for cursor-paginated callers that suppresses the
two keys, rather than a second hook — the URL-writing and filter-reading behaviour is otherwise
exactly what the feed wants.

## The server action trusts its own caller's filter argument

`loadActivityFeed(filters, cursor)` is a server action, so its argument arrives over the wire and is
attacker-controllable regardless of what the screen passes. It is forwarded to the API without a zod
parse; the API validates it and every field is scoped there, so the failure mode is a 422 rather than
a leak.

Recorded because "validate at the boundary" is a house rule and this is a boundary, not because the
current behaviour is unsafe.

**What closes it:** a `feedFiltersSchema` parsed at the top of the action, answering a malformed
argument with the envelope's own validation failure instead of forwarding it.

## The first-run empty state points at `/welcome`

`EmptyStateProps.action` is required, and the destination that would actually help — the leads list,
where an empty account gets its first lead — does not exist yet. It points at the activation
checklist instead, which is the nearest built screen that leads somewhere useful.

**What closes it:** `/leads`, then changing the one href.
