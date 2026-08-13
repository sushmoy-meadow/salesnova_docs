# TASK-TL-006 — demo

Run 2026-08-12 against both live servers. API on `127.0.0.1:8000` (`php artisan serve`), web app on
`localhost:3000` (`next dev`, `SALESNOVA_API_URL=http://localhost:8000/api/v1`), Chromium.

Demo data: one organisation on Asia/Kolkata holding **77 timeline events** across four leads —
"Ananya Rao" (63 events, assigned to the owner), "Priya Sharma" (8) and "Priya S" (3), both
unassigned, and "Vikram Iyer" (3, assigned to the rep). Two members:

| Member | Preset | Capabilities that matter |
|---|---|---|
| `demo@salesnova.test` (Mitchell Fritsch) | OWNER | `leads.view_own`, `leads.view_others`, `leads.view_unassigned` |
| `rep@salesnova.test` (Rahul Mehta) | CUSTOM | `leads.view_own` — nothing else |

Both signed in through the real flow: `/login`, the code read out of the mail log, `/login/verify`.

## The criterion

> Two members with different scopes open the org activity feed and each sees only the events their
> permissions allow, paginated against the live query.

**Met.**

**The owner** opens `/insights/activity` and gets 50 rows — the cursor page size — announced as
"50 events", with "Load more" beneath them. Pressing it once brings the total to **74** and the
control is replaced by "You have reached the end of the list." 74 rather than 77 because the
default category set leaves System off; turning the System chip on brings the `LEAD_MERGED`,
`DUPLICATE_DETECTED` and `LEAD_STAGE_CHANGED` events in. Rows from all four leads appear, including
the rep's three.

**The rep** opens the same URL and gets **3 rows**, all on "Vikram Iyer", announced as "3 events",
with no "Load more" and the end-of-list line directly beneath. None of the owner's 71 events appear —
not the 63 on the lead assigned to the owner, not the 11 on the two unassigned leads the rep has no
`leads.view_unassigned` for.

Screenshots in the web app checkout (gitignored): `.playwright-mcp/task-tl-006-owner-feed-final.png`,
`.playwright-mcp/task-tl-006-rep-feed.png`.

## The scoping is in the query, not over the answer

This is the criterion the demo exists to settle, because a post-filtered feed and a scoped one look
identical on a screen when the reader owns most of what is there.

The rep's three events sit at ranks **65, 68 and 74** in the org-wide `occurred_at desc` order. So
the 50 newest events in the organisation are, every one of them, on leads the rep cannot see. A feed
that read a page and then dropped the rows the reader may not have would have handed the rep an
**empty first page with more to come**, and made them press "Load more" twice to reach anything.

What the rep actually gets is all three on the first page, `has_more` false, end of list. The
exclusion happened in SQL, before the limit was applied.

The second read of the same thing: a manager's filtered link handed to somebody who does not share
their scope. Opening `/insights/activity?member=<owner-membership-id>` as the rep returns zero rows —
"Nothing matches these filters · No events match The member in this link." — rather than the owner's
74. Not a 403 and not an error surface: an honest empty answer to a question about events the reader
is not permitted, with the filter named so they can clear it.

Screenshot: `.playwright-mcp/task-tl-006-rep-member-link-denied.png`.

## The other criteria

| Criterion | Verified |
|---|---|
| A member without `leads.view_others` receives zero rows for leads outside their visibility from the feed query itself, never a filtered-down superset | Above. Also `ActivityFeedTest`, which asserts the row count of the first page rather than the meta — the only assertion that separates the two implementations |
| A manager can filter the feed by a specific member and date range and see only that member's permitted events | As the owner: the member filter set to Rahul Mehta returned exactly his 3 events with "Clear 1 filter" beside the bar; `range=2026-08-12..` dropped the 4 August row; `range=2026-08-12..2026-08-12` kept both of that day's events — a single-day range that a start-of-day upper bound would have emptied |

Also exercised live, since a slice closes on its behaviour and not on its criteria list:

- **Chips.** System is off on arrival and the screen offers nothing to clear, because the category
  set is not a filter anybody chose. Turning one on re-queries and writes the chosen set into
  `?categories=`.
- **The address carries the view.** Member, range and categories all round-trip through the query
  string, so a filtered feed survives a reload and can be sent to somebody — which is what makes the
  denied-link case above a real scenario rather than a contrived one.
- **Pagination.** 74 rows arrived as 50 + 24 against the live keyset cursor, with no row repeated
  across the two pages.

## What the demo found

**ISS-020** — and it cost the whole second half of the run. Finishing onboarding does not invalidate
the cached shell payload, so the app layout still believes onboarding is incomplete and sends the
member to `/onboarding`, which believes it is complete and sends them to `/welcome`, which is inside
the app layout. Every route under the app shell answered `ERR_TOO_MANY_REDIRECTS` for the newly
onboarded rep until `php artisan cache:clear`. Nothing to do with this slice; it stands between every
new account and the product, at the one moment every account passes through exactly once.

Two defects were found earlier, while building, and fixed in this task:

1. **Neither timeline reader clamped its page size.** `?limit=100000` was passed to the query as
   given, so a single request could scan a partitioned table end to end. `PaginationContract` now
   publishes the clamp on its own (`cursorLimit`) and both readers ask for it; the regression test
   counts the returned rows rather than reading `meta`, because `meta` was already reporting the
   clamped number while the query used the raw one.
2. **`IdSelection` constrained with `whereIn` over a subquery.** Correct, and it materialised the
   visible-lead set for every feed read. It is now a correlated `whereExists` against the outer
   row's lead id.

## Reproducing it

```bash
(cd salesnova_backend  && php artisan serve)
(cd salesnova_frontend && npm run dev)
```

The sign-in code is in the mail log's subject line:
`grep -oE "Subject: [0-9]{6}" salesnova_backend/storage/logs/laravel.log | tail -1`.

If a freshly onboarded member cannot open any app screen, that is ISS-020 rather than the feed:

```bash
(cd salesnova_backend && php artisan cache:clear)
```
