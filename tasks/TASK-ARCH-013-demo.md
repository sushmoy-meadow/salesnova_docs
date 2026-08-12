# TASK-ARCH-013 — demo

Run 2026-08-11 against both live servers. API on `127.0.0.1:8123` (`php artisan serve`), web app on
`localhost:3000` (`next dev`, `SALESNOVA_API_URL=http://127.0.0.1:8123/api/v1`), Chromium at
1440×900. Demo data: one organisation, an owner membership, a `pro` plan whose subscription is
`TRIAL_ENDING` with one seat, 16 new leads, 4 overdue follow-ups.

## The criterion

> A signed-in member loads the app and the navigation rail, warning banners and sidebar counts all
> render from a single live `/bootstrap` response, with no client-side stitching.

**Met.** Signed in through the real flow — `/login`, an emailed code read out of the mail log,
`/login/verify` — then loaded `/leads/grid`, which is now inside the authenticated shell. One request
to `GET /api/v1/bootstrap` produced all of it:

- **Rail:** Leads · Follow-ups · Content · Team · Settings, in the order the payload sent them.
  Nothing in the web app holds a list of destinations any more.
- **Counts:** "Leads, 16 waiting" and "Follow-ups, 4 waiting" — read from the same response's
  `counts` map, through the `badge_source` key each item names.
- **Warnings:** the trial-expiry banner (not dismissible) and the seat-limit banner (dismissible),
  both drawn by the one shared banner component.

Screenshot: `.playwright-mcp/task-arch-013-shell.png` in the web app checkout (gitignored).

## The other criteria

| Criterion | Verified |
|---|---|
| Every field returned with real values | `GET /bootstrap` returns all 13 with live data; `inbox.unread` and `activation.completed` have no domain to read from yet — see the open points |
| `X-Bootstrap-Stale: true` after a navigation-relevant mutation | Live `PUT /members/{id}/capabilities` answered `200` with the header |
| A server-side flag toggle reshapes the rail with no deploy | Turned `whatsapp_coexistence` on for the organisation with the running build untouched; the next fetch carried `inbox`, and the browser drew it. Turned it off, and it went |
| Each documented warning type through one banner | Expiry and seat limit rendered live; all four shapes are covered by `shell.test.tsx`, which asserts one component draws them and counts the alert/status split |

## What the demo found

Three defects that both gates were green through, each fixed with a test:

1. **The web app sent `captcha_token: null`.** The contract publishes it optional, not nullable, so
   the API answered `422` and sign-in was impossible against a deployment with no bot protection.
   The key is now omitted when there is no token.
2. **`ShellStateObserver` read memberships through the ambient tenant scope.** A flag rolled out
   from a console command or an admin surface carries no tenant, so the observer cleared nobody's
   cached payload and the rail kept its old shape for the full five-minute TTL. It now scopes by the
   row's own `organization_id` and nothing else.
3. **Two `main` landmarks.** The lead grid brought its own, and the shell owns one.

## Reproducing it

```bash
(cd salesnova_backend && php artisan migrate:fresh --seed && php artisan serve --port=8123)
(cd salesnova_frontend && SALESNOVA_API_URL=http://127.0.0.1:8123/api/v1 npx next dev)
```

Local `.env` needs `TENANT_CACHE_STORE=database` unless Redis is running; the default is `redis` and
the first tenant-cached write fails with `Class "Redis" not found` without it. The mail log carries
the sign-in code in the subject line: `grep -o "[0-9]\{6\} is your" storage/logs/laravel.log`.
