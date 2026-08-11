# TASK-ARCH-025 — open points

Built: the ⌘K / Ctrl+K palette, its request and grouping, and the recently-opened list a browser
keeps per membership. What follows is what could not be closed inside `salesnova_frontend`, and what
would close it.

## 1. `GET /search` answers with an empty result set, always

`SearchController` is registered, the request is validated, and the response DTO is the shape this
repo parses — `type`, `id`, `title`, `subtitle` — but the controller passes `results: []`
unconditionally. Nothing has been indexed and nothing is queried.

So the palette's own half is proved and the server's is not. `src/lib/search/global-search.ts` is
tested against a stub fetcher for the grouping, the requested types, the phone term travelling
unstripped, and a refusal being reported as a refusal; `src/components/search/global-search.test.tsx`
proves the palette renders only what the response carried. What is unproved is that a real search
returns anything, and — the part that matters for the third criterion — that the server scopes what
it returns to what the reader may see.

**Closes when** the search implementation behind `SearchController` lands. No client change: the
schema already reads the published DTO.

## 2. `sequences` is in the documented order and is not a type the API accepts

SN-ARCH-104 documents the group order as leads → content → sequences → team members.
`SearchRequest::SEARCHABLE_TYPES` is `leads, content, team, timeline, messages, events, activity` —
no `sequences`.

`SEARCH_GROUPS` therefore omits it and requests the three that exist. Asking for an unsupported type
is a 422 that takes every other group down with it, so a fourth group that returns nothing is worse
than a fourth group that is absent.

**Closes when** the API accepts `sequences`. One entry in `SEARCH_GROUPS`, in its documented
position, and the requested-types string follows from it.

## 3. Nothing a result points at is a route yet

A hit renders as a link to `/leads/{id}`, `/content/{id}` or `/team/{id}` — the collection names
`src/lib/routing/resource-id.ts` already treats as top-level. None of the three exists in this repo;
`src/app/leads/grid` is the only leads route there is.

The paths are the canonical ones rather than stubs, so the links are correct in advance and wrong
today: choosing a result reaches a 404. They were not pointed somewhere real instead, because a
palette that lands everybody on the grid is one nobody can tell is unfinished.

**Closes when** the detail routes land. `pathForResult` in `src/lib/search/global-search.ts` is the
one place that names them.

## 4. Nothing supplies `currentMembershipId`

`AppShell` now takes it and hands it to the palette, which scopes what this browser remembers. No
production code renders `AppShell` — there is still no authenticated layout, and no module reads the
`salesnova_session` cookie to say which membership is current.

The same gap is recorded against TASK-LEAD-018, whose grid screen takes the same prop for the same
reason.

**Closes when** the authenticated layout reads the session and passes the current membership down.

## 5. The window between a revoked permission and the next search

Recently-opened items are held in `localStorage`, per membership, and are dropped the moment a search
comes back with a code `refusalForCode` reads as `sign-in` or `permission`. That is the only signal
this side gets.

Between a permission being withdrawn and the next search, a browser that has the palette open at its
zero-query state can still show the name of a lead the reader may no longer open. Following it is
harmless — the detail request is authorised server-side — but the name itself is on screen.

Nothing here closes that. What would is an endpoint the palette could resolve the held ids against on
open, returning only those the reader may still see; without one, the alternative is to hold nothing
at all and lose the feature.

**Closes when** a resolve endpoint exists, or the product accepts the window in writing.

## 6. There is no header for the always-visible search field to sit in

SN-ARCH-104 asks for "one global search field in the header, `⌘K` / `Ctrl+K`". `AppShell` has a skip
link, two navigations and a `main` — no header, on any breakpoint. The palette is therefore reachable
by the shortcut and by nothing else: there is no affordance a reader could see and click.

The criterion is the shortcut, and the shortcut works from anywhere. A header was not invented here
to hang one control on, because what else belongs in it — the organisation switcher, the account
menu, the notification bell — is not this task's to decide.

**Closes when** the shell gains a header. `GlobalSearch` already owns the open state, so the trigger
is a button that sets it; today the same component renders nothing until the shortcut fires.

## 7. Results are reachable by Tab, not by arrow key

Each hit is a real link, so the list is keyboard-reachable and a result can be opened in a new tab.
There is no roving highlight and no Enter-to-open-the-first-hit — arrow keys move the caret inside the
search box, as they would in any text field.

The criteria ask for the shortcut, the grouping and the permission scoping, and all three are met
without it. It is called out because a palette is the one place a reader expects arrow keys to work.

**Closes when** a task asks for it. `Section` in `src/components/search/search-palette.tsx` is where a
roving `tabIndex` would go.
