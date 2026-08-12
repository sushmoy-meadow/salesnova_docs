# TASK-AUTH-012 — demo record

**Criterion:** "A newly created org walks the full onboarding sequence in a browser, each step served
by the engine and rendered by the data-driven renderer, with progress surviving a refresh."

**Verdict: PASS**, driven 2026-08-12 against `php artisan serve` on :8000 and `npm run dev` on :3000,
SQLite dev database, five screens from `OnboardingScreenSeeder`.

## What was done

Signed in at `/login` as `demo@salesnova.test` with the code from the mail log, chose the freshly
created organisation ("Untitled workspace", one owner membership, no answers), then:

| Step | Screen | Action | What came back |
|---|---|---|---|
| 1 of 5 | What should we call your workspace? | typed "Northwind Realty" | step 2, and the org row renamed |
| 2 of 5 | What do you sell? | chose Real Estate | step 3, and the presets seeded |
| 3 of 5 | How many people will use SalesNova? | **Skip for now** | step 4 |
| 4 of 5 | Where do your leads come from? | Continue past the `/sources` link | step 5 |
| 5 of 5 | Connect your WhatsApp | **Skip for now** | complete, redirected to `/` |

Step 1 offered no skip; every later screen did.

**Progress survives a refresh.** After step 2, a fresh `GET /onboarding` returned step 2 again. After
step 4, navigating away to `/` and back returned step 4 exactly — not the start, not step 5.

**Seeding, read out of the database after choosing Real Estate:** `lead_stage` carries New ·
Contacted · Site Visit · Negotiation · Closed, the last `is_terminal` with outcome `WON`; three
custom fields follow at display orders 10–12 — Budget (NUMBER), Property Type (TEXT), Location
(TEXT). The organisation's `industry` became `real_estate`. Message templates were not seeded; see
the open points.

**A new screen needs no frontend release.** With the sequence already complete, one row was inserted
into `onboarding_screen_definitions` (`calendar`, order 60, an ACTION field pointing at
`/settings/calendar`). No code changed, no server restarted. Reloading `/onboarding` drew "Step 6 of
6 · Connect your calendar" with its own CTA, and skipping it closed the sequence again. The row was
removed afterwards.

## The seam

`GET /api/v1/onboarding/screen` and `POST /api/v1/onboarding/submit`, both carrying
`Authorization: Bearer …` and `X-Organization-Id`, both answering the same `OnboardingScreen`
envelope so an answer never needs a second read to find out what is next.

Completed sequence:

```json
{"success":true,"data":{"screen_key":null,"is_complete":true,
 "progress":{"step":6,"total":6},"skippable":false,"title":null,"subtitle":null,"fields":[]}}
```

## What the demo caught that both gates had passed

1. **React's own action field was being posted as an answer.** A server-action form carries
   `$ACTION_ID_…` in the same `FormData`, and the action swept everything that was not `screen_key`
   or `intent` into `answers`. The API refused it as a field the screen never declared, so step 1
   could not be completed at all. Answers now travel under an `answer:` prefix and the action reads
   only those. Covered by a test in `src/lib/onboarding/screen.test.ts`.
2. **The required asterisk repeated against every radio option** ("Real Estate \*", "Insurance \*").
   Required belongs to the group, not to any one choice; the legend carries it now and the group
   carries `aria-required`.

Neither was visible to `composer gate` or `npm run check`, which is the whole reason this step exists.

## Noticed outside this slice

Both are in `../ISSUE_LOG.md`, which is where they live now — a sentence here is not a record.

- `/login/organizations` labelled every row "Organisation" rather than the organisation's name.
  Fixed the same day: **ISS-007**.
- Nothing renders under `src/app/(app)/` yet, so the shell's redirect into onboarding for a member
  with the sequence still open could not be exercised in the browser. Open: **ISS-003**.
