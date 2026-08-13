# TASK-AUTH-013 — demo

Run 2026-08-12 against both live servers. API on `127.0.0.1:8000` (`php artisan serve`), web app on
`localhost:3000` (`next dev`, `SALESNOVA_API_URL=http://localhost:8000/api/v1`), Chromium. Demo data:
one organisation on Asia/Kolkata, an owner membership (`demo@salesnova.test`), the seven activation
definitions from `ActivationTaskSeeder`, and the lead "Priya Sharma" carrying the history TL-005 left
behind — notes, a `LEAD_MERGED` event, a `WHATSAPP_INBOUND` and a `WHATSAPP_FAILED`. The two `CALL`
rows that demo logged were removed first, so "Send your first message" started honestly unticked.

Signed in through the real flow: `/login`, the code read out of the mail log, `/login/verify`.

## The criterion

> The activation checklist widget shows live derived state, and completing a real activation action
> ticks its item without a manual refresh.

**Met.** `/welcome` opened on **1 of 7 done**, with "Add your first lead" already carrying its Done
badge — nobody ticked it; the account has two leads. "Send your first message" offered "1 min" and an
"Open a lead" link.

A real message was then logged from the other end of the app: the TL-005 composer on
`/leads/{id}/timeline`, type Message, "Sent Priya the pricing sheet she asked for.", "Log activity".
Coming back to the checklist screen — a navigation, not a reload; nothing was refreshed — it read:

```
2 of 7 done
Send your first message · Reach a lead from their detail screen and it is logged for you. · Done
```

and the live region announced "2 of 7 done" on its own. The counter moved because a `MESSAGE` row now
exists, and for no other reason: the derivation reads the account's tables on every request, so the
same navigation before the write returned 1 and after it returned 2 with nothing else changed.

Screenshots in the web app checkout (gitignored): `.playwright-mcp/task-auth-013-before.png`,
`-ticked.png`, `-dismiss-confirm.png`, `-after-dismissal-new-session.png`.

## The other criteria

| Criterion | Verified |
|---|---|
| Completion counters change only when the underlying real state changes, never via a direct mark-complete write | There is no control to mark anything complete: a row carries either a Done badge or a CTA to the screen where the work happens, and nothing else. The API agrees — `POST /activation/tasks` is 405, and the only write in the feature is the dismissal. `ActivationChecklistTest` holds the other half: deleting the lead unticks "Add your first lead" again, which no stored flag would do |
| Dismissal persists across sessions and is never re-shown | Dismissed, then signed out of that session by signing in again from `/login` with a fresh code — a new session cookie, a new bootstrap. `/welcome` redirected to `/leads` without drawing the checklist. The row reads `dismissed_at=2026-08-12 15:25:33`, stamped with the membership that made the decision |
| Dismissing the checklist removes it and it does not reappear on next login | "Dismiss checklist" asked first — "Dismiss the setup checklist? It will not come back, for you or for anyone else on this account." — and on confirmation the widget stopped drawing itself and moved the reader on rather than leaving them on an empty screen. Every later arrival at `/welcome` redirects away |

## What the demo found

1. **`/leads` does not exist yet, and three things point at it.** The seeded CTA for "Send your first
   message", the shell's own navigation rail, and this widget's own `onDismissed` destination all
   lead to a 404. The address is the one the IA gives, so the routes are right and the screen is
   simply unbuilt — but the checklist currently hands a new account a link to nowhere, and dismissing
   it lands them on a 404. Logged as **ISS-016**. Nothing here changes when that screen arrives.
2. **The in-document tick could not be exercised through the browser harness.** Returning to a tab is
   the other way the widget re-reads, and the Playwright MCP server switches tabs without Chromium
   firing `visibilitychange` or `focus` — a listener installed on the page recorded neither across a
   switch away and back, so TanStack Query never saw the transition it refetches on. The path is held
   by unit test instead (`activation-checklist.test.tsx` drives `focusManager`), and the demo used
   the other one: `refetchOnMount: "always"` with `gcTime: 0`, which is what a reader arriving back
   at the screen gets. Logged as **ISS-017**, against the harness rather than the app.

## Reproducing it

```bash
(cd salesnova_backend  && php artisan db:seed --class=ActivationTaskSeeder && php artisan serve)
(cd salesnova_frontend && npm run dev)
```

The sign-in code is in the mail log's subject line:
`grep -oE "Subject: [0-9]{6}" salesnova_backend/storage/logs/laravel.log | tail -1`.

The dismissal is permanent by design, so the dev organisation was put back afterwards — otherwise
`/welcome` is unreachable for every later demo. To reset both halves between runs:

```bash
(cd salesnova_backend && php artisan tinker --execute="\App\Models\Identity\ActivationChecklistState::withoutGlobalScopes()->get()->each->forceDelete(); \App\Models\Timeline\TimelineEvent::withoutGlobalScopes()->where('event_type','MESSAGE')->get()->each->forceDelete();")
```

If a screen renders text that does not match the source, it is ISS-012 rather than the code —
unregister the service worker and delete its caches before diagnosing anything else:

```js
navigator.serviceWorker.getRegistrations().then((r) => r.forEach((w) => w.unregister()));
caches.keys().then((k) => k.forEach((key) => caches.delete(key)));
```
