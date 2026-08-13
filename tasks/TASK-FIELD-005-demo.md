# TASK-FIELD-005 — demo record

Both servers up: `php artisan serve` on :8000, `next dev` on :3000, sqlite. Driven in a real browser
with Playwright, signed in genuinely as a seeded owner (email OTP, the six-digit code read from the
`log` mailer's subject line — the body is PII-redacted, the subject is not).

## What the demo proved

**Signed in for real.** `/login` → email → `/login/verify` → six-digit code → session cookie set by
the app, landed in the shell. No minted cookie; the whole auth seam ran.

**An admin reorders stages in the UI.** On `/settings/custom-fields/stages`, starting order
`New, Negotiation, Contacted, Won`. Clicked **Move Contacted up**. The list re-rendered to
`New, Contacted, Negotiation, Won` with no error. The write went browser → `moveStageAction` server
action → `POST /custom-fields/stages/contacted/move {"move":"UP"}` → API → jsonb `options` column.
Read back from the DB immediately after: `contacted` at `order:1`, `negotiation` at `order:2`.

**Marking a stage terminal with outcome LOST is reflected immediately.** Toggled the **Negotiation is
terminal** switch on; the **Negotiation outcome** selector appeared (SN-FIELD-020 — outcome only
exists for a terminal stage), defaulting to Won. Selected **Lost**. Read back from the DB:
`negotiation` now `is_terminal:true, outcome:"LOST"`. No reload — the editor showed the change as it
landed.

**The stage-change backend, exercised live over the API earlier the same session:**
`PATCH /leads/{lead}/stage` twice → two rows appended to `custom_field_value_histories`
(from→to), two `timeline_event` rows `{"from":null,"to":"contacted"}` and
`{"from":"contacted","to":"negotiation"}` carrying the actor's membership, and time-in-stage read
back as `1 minute, 34 seconds` fresh, `2 days, 5 hours` on a backdated transition, and `—` on a lead
that never moved — on both the detail endpoint and the list query.

Screenshot: `salesnova_frontend/stage-editor-demo.png`.

## What the demo could NOT prove in a browser, and why the slice stays open

The demo criterion's middle and last clauses — *a lead moved between stages* and *time-in-stage
readable afterwards* — have exactly one built UI surface, the lead grid, and it could not be driven:

1. `/leads/grid` is unreachable for this account: the `(app)` layout redirects to `/onboarding`
   when `bootstrap.onboarding.is_complete` is false, and after seeding a complete onboarding the
   `/onboarding` page and the layout disagree — `/onboarding → /welcome → /onboarding`, an infinite
   redirect (`ERR_TOO_MANY_REDIRECTS`). Logged as ISS-032. Not this slice's code.
2. Beneath that, the grid cannot reach the API from a browser at all: `LeadGridScreen` is a client
   component that reads the server-only `SALESNOVA_API_URL`, so its query throws before any request
   and its inline stage write carries no credential. Logged as ISS-028. Also not this slice's code.

Either blocker alone stops the lead half. Both are defects in the grid (another task's surface), not
in this slice — the stage-move backend answers correctly under curl, and the stage-config UI works
end to end in the browser. But the demo is one journey, and half of it has no browser-drivable
surface, so per `/build-slice` §6 the slice is **not done**: it stays `in_progress` until the grid
can move a lead's stage in a browser.
