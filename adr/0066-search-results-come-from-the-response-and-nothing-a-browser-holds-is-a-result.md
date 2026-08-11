# ADR-0066 — Search results come from the response, and nothing a browser holds is a result

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-ARCH-104` asks for one global search field, `⌘K` / `Ctrl+K`, returning first results inside
200 ms at p95. It also says, in the same requirement, that search **MUST NOT** leak the existence of
a lead the member cannot view.

Those two sentences pull in opposite directions, and the ordinary way to satisfy the first is to
break the second. A command palette that feels instant usually feels instant because it is not
asking anybody: it filters a list the browser already has — the rows behind the leads grid, a recent
list, a prefetched index — and only falls back to the network for what it cannot answer locally.

Every one of those local sources was fetched under the permissions the reader had when it was
fetched. A rep moved off an account, a sub-team narrowed, a membership deactivated: the server stops
returning that lead immediately, and the browser goes on holding it until something evicts it. A
palette that matches a typed term against what it holds will surface that lead, by name, to somebody
the server would now refuse. That is precisely the leak the requirement names, arriving through the
cache rather than through the query.

This repo has the ingredients for exactly that mistake to hand. TanStack Query holds lead rows for
the grid, and reading them is one `getQueryData` call.

## Decision

**Under a query, the palette renders the current response and nothing else.**

No merge with the query cache, no client-side filter over rows fetched for another screen, no local
index. `runGlobalSearch` groups what came back and drops any result of a type it did not ask for; a
group the server said nothing about is absent rather than filled in from this side. The palette's
own body renders from that outcome alone, so there is no path by which a name the server did not
just send reaches the screen under a search term.

The cost is the 200 ms budget, and it is paid on the server where the requirement already puts it —
PostgreSQL full-text with GIN indexes, per `SN-ARCH-015`. A debounce keeps one round trip per pause
rather than one per keystroke, and a slow answer to a term the reader has already replaced is
discarded rather than rendered.

**A recently-opened list is allowed, under three conditions.**

It is not a cache of search results and never answers a query. It holds only what the reader
actually opened, it is shown only at the zero-query state, and it is scoped by membership id — a
consultant in two organisations has two lists, because one list would carry one organisation's lead
names into the other's palette. It is dropped whole the moment a search comes back with a code the
refusal catalogue reads as `sign-in` or `permission` — `UNAUTHENTICATED` and `TOKEN_EXPIRED`, but
also `FORBIDDEN`, `ORG_MISMATCH`, `NOT_ASSIGNED` and `INSUFFICIENT_ROLE`. That catalogue is read
rather than restated here, so a code added to it later is not one this decision quietly ignores.
An outage is not one of them: an unreachable server has said nothing about who the reader is.

**The upstream request is made on this app's server, through a route handler.**

`ADR-0064` put the access token in an `HttpOnly` cookie that no script can read, and the API root is
a server-side variable. Both facts point the same way: `GET /api/search` reads the session, attaches
the bearer token, and calls the API. The browser sends a term and receives an outcome; which types
are searched is decided on the server side, so the route is not a proxy anyone can aim.

A route handler rather than a server action, and the framework is explicit about why: Next dispatches
server actions **one at a time per client**, and names a route handler as the answer for non-mutation
reads. A search that fires as somebody types is the case that breaks under that rule — every keystroke
queues behind the one before it, and a single slow upstream call stalls the whole sequence. It also
gives the palette a request it can abort, which an action does not.

That in turn puts the search where this repo already keeps server state: `useQuery`, keyed on the
term, with `gcTime: 0` and `staleTime: 0`. The key makes the last term win without a hand-written
race guard, and the two zeroes state the intent above — nothing is held between openings, because
what the reader may see can change in between and only the server knows it has.

## Consequences

**Accepted.** Every keystroke that survives the debounce is a round trip. There is no local fast
path and no offline behaviour: with no connection the palette reports that it could not reach the
server, which is honest, and better than answering from a list whose scoping nobody can vouch for.

**Accepted.** A refused search costs the reader their recently-opened list. Dropping it is cheap to
recover from — the next thing they open is remembered again — and the alternative is holding names
past the only evidence we get that they should not be held.

**Open.** A window remains between a permission being withdrawn and the next search: a browser
sitting on the zero-query state still shows what it last remembered. Following one of those is
harmless, since the detail request is authorised server-side, but the name is on screen. Closing it
needs an endpoint the palette can resolve held ids against when it opens, returning only those the
reader may still see. Recorded as an open point on TASK-ARCH-025.

**Accepted.** `sequences` is in the documented result order and is not a type the API accepts, so it
is not requested. An unsupported type is a 422 that takes every other group down with it, and three
groups that work beat four that do not.
