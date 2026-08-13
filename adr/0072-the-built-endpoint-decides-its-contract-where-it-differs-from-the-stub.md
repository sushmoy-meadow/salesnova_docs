# ADR-0072 — The built endpoint decides its contract where it differs from the stub

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

Route contracts land before engines here. `TASK-TL-003` and `TASK-LEAD-010` published
`POST /leads/{lead}/merge`, the duplicate-review routes and both timeline streams as `501` stubs
with their request shapes fixed, and
[0063](0063-lead-merge-winners-are-explicit-field-lead-pairs.md) and
[0064](0064-timeline-and-activity-streams-use-one-cursor-contract.md) recorded those shapes.
`TASK-LEAD-012`, `TASK-TL-005` and `TASK-TL-006` then built the engines behind them — on a branch
cut before the stubs landed, so each was built as a new controller carrying a contract of its own.

Merging the two branches put the disagreements side by side:

| | Stub, as published | Built, as shipped |
|---|---|---|
| merge body | `survivor_lead_id` + `winner_selections[].field/.lead_id` | `duplicate_lead_id` + `field_winners{field: 'survivor'\|'duplicate'}` |
| duplicate detail | `GET /leads/{lead}/duplicates` | `GET /leads/duplicates/{lead}` |
| timeline filter | `category` | `categories[]` |
| feed filters | `member_id`, `event_type`, `occurred_after`, `occurred_before`, `group_id` | `member_id`, `categories[]`, `from`, `to` |

Both sides were green on their own branches, because each tested the contract it had written. The
only thing that noticed was the stub's own contract tests, which failed on merge and were amended to
assert what ships — recorded as ISS-025 and ISS-027 at the time, so the amendment is not the only
trace of it.

What that leaves is a general question with a specific answer overdue: when a stub reserved a route
and the implementation arrived with a different shape, which one is the contract.

## Decision

**Where a built endpoint's contract differs from the stub that reserved its route, the built
contract wins, and the decision that recorded the stub is superseded in the part that disagrees.**

Applied here, the shipped contract stands as published:

- `POST /leads/{lead}/merge` takes `duplicate_lead_id` and `field_winners`, a map from field name to
  `'survivor'` or `'duplicate'`. **The survivor is the route's own lead** and is not named in the
  body, so the URL and the body cannot disagree about which record is being kept.
- The lead timeline filters on `categories[]`, and the activity feed on `member_id`,
  `categories[]`, `from` and `to`.

The rule is narrow, and it is not a licence to change a published contract by building something
else. It applies where the implementation has met the requirement and the stub has not, and it
obliges the supersession to be written down — which is the whole of the cost it imposes.

## Consequences

0063 and 0064 are marked superseded in the parts above and stay where they are. Neither is wrong
about everything: 0064's cursor contract is untouched and still binding — `cursor` and `limit`, no
`page`, `per_page` or `offset`, ordered by `occurred_at, id` descending — and so is 0063's
thirty-day undo window on `POST /leads/{lead}/merge/undo`.

0063's stated reason for rejecting the map shape is answered rather than overruled. It rejected the
map because "the project's request contract generator exposes wildcard Laravel arrays as list
schemas", and a `#[BodyParameter]` attribute on the request states the map type directly, so the
generated spec carries `additionalProperties` with the two-value enum. The shape is documented
exactly, which is the thing the ADR wanted and could not get.

A capability the stub promised can be lost this way, and one was. The feed's `group_id` filter is in
no request and no reader, so a client written against the published spec would send it and silently
get an unfiltered feed. This decision does not bless that: it is open as ISS-027 and needs
building. The same entry holds the smaller question of whether `from`/`to` or
`occurred_after`/`occurred_before` are the better names, which is a rename of a shipped query
parameter and gets cheaper the sooner it is settled.

The real cost is the precedent: a contract test can be amended to follow the code, and a contract
test that follows the code is not a contract. The guard is that the amendment is only legitimate
alongside a superseding record like this one. A test quietly edited to go green, with nothing
written down, is the failure this is meant to make visible rather than routine.

ISS-026 — two timeline stacks wired in side by side, with `{event}` resolving to different entities
on sibling routes — is a different problem and is untouched by any of this.

## Alternatives

**Reshape the implementation onto the stub's contract.** Rejected. It is real rework on code that is
built, tested and demoed, and it would have been rework in service of a decision whose own stated
reason no longer holds. It also moves the frontend callers for no gain the reader can see.

**Leave the code and the record disagreeing.** Rejected for the reason ISS-025 gives: the code looks
right and the decision record looks wrong, which is the dangerous way round. The next person to read
0063 implements against a contract no endpoint serves.

**Split the difference — the stub's shape where the ADRs argue substantively, the implementation's
where the difference is only naming.** Rejected. It leaves one contract assembled from two sources
and still needs a record explaining which half came from where, which is this document plus a
migration nobody asked for.
