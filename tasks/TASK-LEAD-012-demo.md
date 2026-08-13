# TASK-LEAD-012 — demo

Run 2026-08-12 against both live servers. API on `127.0.0.1:8000` (`php artisan serve`) with a
`queue:work` beside it, web app on `localhost:3000` (`next dev`, `SALESNOVA_API_URL` from
`.env.local`), Chromium. Demo data: one organisation, an owner membership, a `pro` subscription, and
two leads sharing `priya@example.com` and `+919876543210` — "Priya Sharma" (1 July, three timeline
entries) and "Priya S" (12 August, two) — flagged by running `LeadDuplicateResolver::resolve()` on
the arriving one under the default `FLAG_FOR_REVIEW` policy.

## The criterion

> A user reviews a detected duplicate pair in the UI, merges it choosing a winner per conflicting
> field, and undoes the merge within the retention window — all against the live engine.

**Met.** Signed in through the real flow — `/login`, the code read out of the mail log,
`/login/verify` — finished onboarding, then loaded `/leads/duplicates` inside the authenticated
shell:

- **Queue:** one row, "Review Priya Sharma against Priya S", from `GET /api/v1/leads/duplicates`.
- **Comparison:** `GET /api/v1/leads/duplicates/{duplicate}` returned seven fields. Name and Notes
  came back `conflicting: true` and rendered as a radio group each; Email, Phone and Country agreed
  and rendered as text with no control; Display name and WhatsApp were empty on both. **Merge stayed
  disabled until both groups had a winner** — the fourth criterion, live.
- **Merge:** kept the survivor's name and the duplicate's notes. `POST /api/v1/leads/{survivor}/merge`
  with `{"duplicate_lead_id": "…", "field_winners": {"name": "survivor", "notes": "duplicate"}}`
  answered `{"survivor_lead_id":"…","merged_lead_id":"…","undo_expires_at":"2026-09-11T12:52:02+00:00"}`
  — thirty days to the second. In the database: survivor named "Priya Sharma" with the duplicate's
  notes, its timeline holding all seven entries in occurrence order (three of its own, three moved
  across including the `DUPLICATE_DETECTED` one, and the `LEAD_MERGED` entry), the duplicate
  soft-deleted with the full `pre_merge_state` on it, both marked `RESOLVED`.
- **Undo:** the affordance appeared only after the merge answered. `POST
  /api/v1/leads/{survivor}/merge/undo` restored the survivor's own notes, untrashed the duplicate,
  moved its three entries back, cleared the undo state and put both records back to `PENDING`.

Screenshot: `.playwright-mcp/task-lead-012-merge-screen.png` in the web app checkout (gitignored).

## The other criteria

| Criterion | Verified |
|---|---|
| AC-LEAD-050.1 — detection at creation, before assignment | `LeadDuplicateDetectionTest`, and the demo pair was flagged and left unassigned by the live resolver |
| AC-LEAD-052.1 — timelines combined chronologically | `LeadMergeTest` (5 + 7 = 12 in order); the demo survivor held all seven entries in order |
| AC-LEAD-052.2 — undo inside the window restores both timelines | `LeadMergeTest` (day 29), and the live undo above |
| Explicit winner per conflicting field before submit | `duplicate-merge-screen.test.tsx`, and the live merge button stayed disabled until both were answered |

## What the demo found

Three defects that both gates were green through, each fixed with a test:

1. **`feature_flags` was published as `[]`.** An organisation with no flags got an empty PHP array,
   which encodes as a list, and the web app reads it as a map — so the whole shell failed at the
   seam with "we could not reach the server", on every screen. `BootstrapDTO` now re-boxes its three
   keyed maps as objects on the way out — beside `jsonSerialize` rather than in it, because the
   generator prefers that method's return over the public properties and reads a cast as a string,
   which published the whole payload as an empty schema. The same defect is still open in the list
   envelope: ISS-011.
2. **The web app addressed `/v1/leads/…` under a root that already ends in `/api/v1`.** Every call
   this slice makes would have landed a level below the endpoint.
3. **The screen fetched from the browser.** The access token is an `HttpOnly` cookie and the API root
   is server-side only, so a client component calling the seam directly can never reach it. The four
   calls now happen in server actions and the screen is handed them as functions.

## Reproducing it

```bash
(cd salesnova_backend  && php artisan migrate:fresh --seed && php artisan serve)
(cd salesnova_backend  && php artisan queue:work)   # or the sign-in code is never logged
(cd salesnova_frontend && npm run dev)
```

The mail log carries the sign-in code in the subject line:
`grep -o "[0-9]\{6\} is your" storage/logs/laravel.log`. The shell payload is cached per
organisation, so `php artisan cache:clear` after finishing onboarding, or the next page still
redirects back to it.
