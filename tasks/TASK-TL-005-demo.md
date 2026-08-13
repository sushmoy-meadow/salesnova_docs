# TASK-TL-005 — demo

Run 2026-08-12 against both live servers. API on `127.0.0.1:8000` (`php artisan serve`), web app on
`localhost:3000` (`next dev`, `SALESNOVA_API_URL=http://localhost:8000/api/v1`), Chromium. Demo data:
one organisation on Asia/Kolkata, an owner membership (`demo@salesnova.test`), the lead "Priya
Sharma" carrying a seeded history — three backdated notes, a `LEAD_MERGED` system event, a
`WHATSAPP_INBOUND` message and a `WHATSAPP_FAILED` one whose payload holds `error_code: 131047`.

Signed in through the real flow: `/login`, the code read out of the mail log, `/login/verify`.

## The criterion

> A user logs a manual activity from the lead timeline and it appears in the timeline in correct
> order with its author and timestamp.

**Met.** Typed a note into the composer on `/leads/{id}/timeline` and pressed "Log activity". The
composer cleared itself and the entry arrived at the head of the stream under "Today":

```
Note | Mitchell Fritsch · 20:01 | Priya called back — she wants the brochure sent to her work address.
```

Author, time and position all came back from the server — the screen re-reads the stream after every
accepted write rather than dropping a row in at the top, because the server owns the order and a
backdated entry does not belong at the head.

Screenshot: `.playwright-mcp/task-tl-005-timeline.png` in the web app checkout (gitignored).

## The other criteria

| Criterion | Verified |
|---|---|
| **AC-TL-011.1** — a call logged with `occurred_at` two days ago sorts by `occurred_at` and displays the logged-on date | Logged a CALL dated 10 August, 15:40, outcome connected, 12 minutes. It rendered under "Last Monday" — between "Today" and "9 July 2026" — reading `Mitchell Fritsch · 15:40 · Logged 12 August 2026`, with `Outcome: Connected` and `Minutes: 12` beside it |
| **AC-TL-013.1** — a `WHATSAPP_INBOUND` event and an owner-role session: delete returns 403 and the event persists | The 403 is `ManualActivityTest`, green. In the browser the owner's own session offers the inbound message a Pin control and nothing else — no Edit, no Delete — as it does for the merge event and the three seeded system notes. The affordance and the policy agree |
| **AC-TL-004.1** — a WhatsApp send failing with 131047 renders a human-readable reason | "More than 24 hours have passed since this lead last replied, so only an approved template can reach them now," in a danger banner above the message body, in a `role="alert"` region |

Also exercised live, since a slice is closed on its behaviour and not on its criteria list:

- **Edit.** Opened the editor on the reader's own note; it filled from the entry as it then read, saved,
  and came back marked `· Edited`.
- **Delete.** Asked first — "Delete this entry? It leaves the timeline for everyone on the account,
  and nothing keeps a copy" — and removed it on confirmation.
- **Pin cap.** Pinned three entries; a "Pinned" section appeared above the day groups and every
  remaining Pin control went disabled, each pointing at the one sentence that says why.
- **Filters.** The System chip is off on arrival, and turning it on brought "Merged with a duplicate
  record" into the stream and wrote the chosen set into the query string
  (`?categories=MESSAGES,CALLS_MEETINGS,NOTES,CONTENT,WHATSAPP,SEQUENCE,SYSTEM`), so a filtered
  timeline survives a refresh and can be sent to somebody.

## What the demo found

Three defects that both gates were green through:

1. **The composer read a picked date and time on the browser's clock, not the account's.** Typing
   15:40 produced an entry that read 15:40 in the browser's zone and 15:10 on the timeline beside it,
   because display had been made timezone-explicit and the write had not. `toManualActivity` now
   resolves the wall clock in the account's zone, trying both offsets in force around that day: the
   hour that happens twice takes the earlier, and the hour that never happens moves forward. Four
   tests, two of them on a zone that changes its offset.
2. **A system event printed its working payload.** `LEAD_MERGED` carries `survivor` and `duplicate`
   as nested records, and the card rendered `survivor: [object Object]` under the entry. It now shows
   only the details it has a vocabulary for. The other half — that the entry consequently says
   nothing about what was merged — is ISS-014.
3. **Call outcomes read as enum constants.** `Outcome: CONNECTED` in the stream and `connected` in
   the composer's dropdown, from two different transformations of the same value. Both now read from
   one label map.

And one that cost more than all three to find, logged as **ISS-012**: the shell's service worker
serves `/_next/static` cache-first from a cache no build ever versions. In development Turbopack
reuses chunk paths, so the browser kept running a bundle several edits old — hydrating a stale client
tree onto a correct server render — through a dev-server restart and a `rm -rf .next`. Unregistering
the worker and deleting its caches fixed it instantly.

Also logged: **ISS-013** (the pinned rail and the pin cap both scan the lead's timeline, with no index
mentioning `is_pinned`) and **ISS-015** (an unauthenticated API request without `Accept:
application/json` answers 500 rather than 401).

## Reproducing it

```bash
(cd salesnova_backend  && php artisan serve)
(cd salesnova_frontend && npm run dev)
```

The sign-in code is in the mail log's subject line:
`grep -oE "Subject: [0-9]{6}" salesnova_backend/storage/logs/laravel.log | tail -1`.

If the timeline renders text that does not match the source, it is ISS-012 rather than the code —
unregister the service worker and delete its caches before diagnosing anything else:

```js
navigator.serviceWorker.getRegistrations().then((r) => r.forEach((w) => w.unregister()));
caches.keys().then((k) => k.forEach((key) => caches.delete(key)));
```
