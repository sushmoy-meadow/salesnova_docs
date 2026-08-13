# TASK-AUTH-014 — demo

Run 2026-08-12 against both live servers. API on `127.0.0.1:8000` (`php artisan serve`), web app on
`localhost:3000` (`next dev`, `SALESNOVA_API_URL=http://localhost:8000/api/v1`), Chromium. Demo data:
one organisation with a single owner membership (`demo@salesnova.test`) on a subscription reading
`status=ACTIVE, seats=20`. Signed in through the real flow: `/login`, the code read out of the mail
log, `/login/verify`.

The shell screen used throughout is `/leads/{id}/timeline` — the banner is rendered by `AppShell`, so
any authenticated screen shows it, and the timeline is the one that exists (`/leads` and
`/follow-ups` are still 404, ISS-016).

## The criterion

> A warning raised server-side appears in the global banner on the next bootstrap, and clears from
> the banner once the underlying condition is resolved.

**Met.** The screen opened with no banner at all — a healthy account carries no client boundary
above the page, because `AppShell` mounts `WarningsBanner` only when the payload has something to
say (`task-auth-014-healthy.png`).

The condition was then raised server-side, through the model rather than the query builder so the
observer that invalidates the cached shell fired the way a real write does:

```php
$s = Subscription::withoutGlobalScopes()->first();
$s->status = SubscriptionStatus::PAYMENT_OVERDUE;
$s->save();
```

On the next navigation to a shell screen — no reload of the app, no cache flush by hand — the banner
was there (`task-auth-014-payment-overdue.png`):

```
PAYMENT_FAILED
We could not take your last payment. Update your payment method to avoid losing access.
[Update payment → /settings/billing]
```

Resolving it is the same move in reverse: `status = ACTIVE`, `save()`, next navigation, and the
banner is gone with nothing else on the page changed (`task-auth-014-cleared.png`). The DOM was read
rather than the screenshot — `[data-warning]` went `[]` → `["PAYMENT_FAILED"]` → `[]` across the
three states.

## The other criteria

| Criterion | Verified |
|---|---|
| Adding a new banner producer requires no changes to the rendering contract, only a new entry generator | Not demonstrable in the browser without editing code mid-run, so it is held by test: `BootstrapWarningsTest` binds an anonymous `ShellWarningProducer`, tags it `shell.warnings`, and asserts its entry reaches the payload unchanged — no controller, DTO, resource or component touched. The live run shows the same shape from the other side: two producers, one channel, one list, two banners drawn by the same component (`task-auth-014-two-banners.png`) |
| A non-dismissible warning cannot be closed by the user through any UI affordance | With `seats=1` alongside the overdue payment, both banners drew at once. `PAYMENT_FAILED` (`dismissible: false`, raised against a service-loss consequence) rendered **zero** buttons — its only control is the link to billing. `SEAT_LIMIT_REACHED` (`dismissible: true`) rendered exactly one, `aria-label="Dismiss"`. There is no hidden affordance to find: `onDismiss` is passed `undefined` for a pinned warning, so the control is not rendered at all rather than disabled |

Dismissal was then exercised end to end. Clicking Dismiss on the seat banner removed it and left the
pinned one in place; `sessionStorage["salesnova.shell.dismissed-warnings"]` read
`{"state":{"codes":["SEAT_LIMIT_REACHED"]},"version":0}`. A navigation later the dismissal still held
(`task-auth-014-dismissed-persists.png`) — the defect that made this task worth its second half: the
shell remounts on every click, and dismissal kept in component state lasted one page view.

It lasts the session and not longer. With the seat condition still unresolved, clearing that one key
and navigating again brought `SEAT_LIMIT_REACHED` straight back. Restoring `seats = 20` then cleared
it for real, from the server end, with nothing dismissed.

Screenshots in the web app checkout (gitignored): `.playwright-mcp/task-auth-014-healthy.png`,
`-payment-overdue.png`, `-two-banners.png`, `-dismissed-persists.png`, `-cleared.png`.

## What the demo found

Nothing new against this task. Two things worth restating:

1. **`/follow-ups` 404s**, like `/leads` before it — the rail links to screens that are not built
   yet, which is ISS-016 and not a banner problem. The demo used the timeline screen instead.
2. **The seeded action routes are unbuilt too.** `/settings/billing` and `/settings/team` are the
   addresses the IA gives and the CTAs are correct; the screens arrive with their own tasks. The
   banner's contract is the label and the route, and both are what the producer set.

## Reproducing it

```bash
(cd salesnova_backend  && php artisan serve)
(cd salesnova_frontend && npm run dev)
```

The sign-in code is in the mail log's subject line:
`grep -oE "Subject: [0-9]{6}" salesnova_backend/storage/logs/laravel.log | tail -1`.

Raise and resolve each condition from the API checkout:

```bash
# payment — non-dismissible
php artisan tinker --execute="\$s=\App\Models\Permissions\Subscription::withoutGlobalScopes()->first(); \$s->status=\App\Enums\Permissions\SubscriptionStatus::PAYMENT_OVERDUE; \$s->save();"
# seats — dismissible
php artisan tinker --execute="\$s=\App\Models\Permissions\Subscription::withoutGlobalScopes()->first(); \$s->seats=1; \$s->save();"
```

Save through the model, not `->update()` on the builder: a mass update fires no model events, so
`ShellStateObserver` never runs and the cached shell keeps the old answer for up to the 300s
bootstrap TTL. That is the cache behaving correctly, not the warning failing to appear.

The dev organisation was put back afterwards — `status=ACTIVE`, `seats=20`, confirmed no banners on
the last navigation:

```bash
php artisan tinker --execute="\$s=\App\Models\Permissions\Subscription::withoutGlobalScopes()->first(); \$s->status=\App\Enums\Permissions\SubscriptionStatus::ACTIVE; \$s->seats=20; \$s->save();"
```
