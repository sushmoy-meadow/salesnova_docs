# TASK-LEAD-007 — demo

Run 2026-08-14 against both live servers. API on `127.0.0.1:8000` (`php artisan serve`) with a
`queue:work` beside it so sign-in codes flush, web app on `localhost:3000` (`next dev`,
`SALESNOVA_API_URL=http://localhost:8000/api/v1`), Chromium at 1280×800 and 375×667. Demo account:
one organisation with `phone_country_code = IN`, an owner membership, onboarding answers seeded across
every screen key so the shell lets the app load. Signed in through the real flow — `/login`, the
six-digit code read from the mail log, `/login/verify`.

## The criterion

> A lead is created, edited and re-read through the detail screen in a browser, with phone parsing
> and contactability validation visible in the UI on invalid input.

**Met, end to end in the browser.**

- **Contactability, visible.** `/leads/new` with a name and nothing else refused to submit and showed
  "Add at least one way to reach this lead — email, phone or WhatsApp" — the client's own refine, no
  request sent (AC-LEAD-002.1).
- **Phone parsing, visible.** Name "Amira Khan", phone typed as the national "98765 43210". `POST
  /api/v1/leads` returned the created lead and the screen navigated to `/leads/{id}`, where Phone read
  **+919876543210** — parsed against the org's `IN` region (AC-LEAD-004.1). A phone-only lead: WhatsApp
  came back filled with the same number and the detail screen showed the WhatsApp contact action, the
  inference (AC-LEAD-005.1) surfaced in the UI.
- **Created.** The detail screen rendered header ("Amira Khan" + a "New" badge), the ContactActionBar
  (Call `tel:+919876543210`, WhatsApp `wa.me/919876543210`, SMS `sms:+919876543210`) above the fold,
  the follow-up section, the info block, the collapsed source ("Source: MANUAL"), the notes editor and
  the timeline.
- **Edited and re-read.** Typed a note in the info block, saved, reloaded the page from the server: the
  note came back verbatim. A second reload confirmed it is the server's copy, not the field's.
- **New badge clears on dwell, not on read.** Staying on the lead two seconds then reloading cleared
  the "New" badge; the explicit dwell interaction fired and the `GET` itself never mutated (SN-LEAD-023).

## The other criteria

| Criterion | Verified |
|---|---|
| AC-LEAD-002.1 — a lead needs a contact method | `LeadCreationTest` (422 `VALIDATION_FAILED`), and the live name-only refusal above |
| AC-LEAD-004.1 — national number parsed to E.164 against the org country | `LeadCreationTest` (+919876543210 / IN), and the live create above |
| AC-LEAD-004.2 — an unparseable number is refused, nothing written | `LeadCreationTest` (422 `INVALID_PHONE`, zero rows) |
| AC-LEAD-005.1 — source_payload kept verbatim and apart from notes | `LeadCreationTest` (14 keys survive, notes null) |
| Contact actions reachable without scrolling, long timeline, both breakpoints | Live, on a lead seeded with 18 timeline entries — see below |
| AC-LEAD-022.1 | `DwellInteractionAndTimeInStageTest`, and the live dwell above |

### Contact actions on a long timeline

Seeded eighteen timeline entries on the demo lead. **Mobile (375×667):** the ContactActionBar pins to
the top of the viewport — measured at 0, 2000 and 4000px of scroll, all three action links stayed
fully within the viewport. **Desktop (1280×800):** the bar sits above the fold at load with the long
timeline below it. The mobile treatment changed from the shipped `sticky bottom-0` to `sticky top-0`
for this to hold — see *What the demo found*, and [ADR-0074](../adr/0074-the-mobile-contact-bar-pins-to-the-top-because-the-foot-is-the-tab-bars.md).

## What the demo found

Both gates were green through all of these. Each is fixed with a test, or recorded where the fix
belongs to another task.

1. **Create was rejected for a missing `Idempotency-Key`.** The create is behind
   `EnsureIdempotencyKey`; the client sent none, so the first real submit answered "This operation
   needs an Idempotency-Key header." `createLeadAction` now sends a fresh `crypto.randomUUID()` per
   attempt — a replayed double-tap dedupes against the same key, a new lead gets a new one.
2. **The notes cell was not implemented — every save answered 501.** `LeadCellUpdateController` served
   only the stage cell; notes, groups and follow-up all threw `NOT_IMPLEMENTED`. Without a working
   write there is no "edited" to demo. Fixed for notes: the controller short-circuits the notes route
   to `LeadWriter::updateNotes()` (a blank box stores null, `source_payload` is left untouched),
   covered by `LeadNotesUpdateTest`. Groups and follow-up remain 501 — ISS-033.
3. **The "mark seen" POST sent a type the contract does not define.** The client sent `type: "VIEW"`;
   the interaction endpoint accepts only `NOTE|CALL|MEETING|MESSAGE`, so the dwell 422'd and the badge
   never cleared. The endpoint records no timeline entry regardless of type — its only effect is
   clearing `is_new` — so the client now sends `NOTE`, the plainest of the accepted set. The contract
   having no view-shaped type is noted in ISS-033.
4. **The mobile contact bar did not stay reachable on a long timeline.** `sticky bottom-0` does not pin
   from the bar's position high in the page, and the mobile foot is already the fixed `BottomNav`'s.
   Changed to `sticky top-0 … sm:static`; [ADR-0074](../adr/0074-the-mobile-contact-bar-pins-to-the-top-because-the-foot-is-the-tab-bars.md)
   records the reversal, and TASK-DESIGN-007's open-points points at it.

Open points that are not this slice's to close — the info block's identity/contact fields have no
edit route, the collapsed source cannot show the structured payload, and the hand-written client
schema is deliberate — are in `TASK-LEAD-007-open-points.md`. The grid's `/v1` double-prefix, found
in passing, is appended to ISS-031.

## Reproducing it

```bash
(cd salesnova_backend  && php artisan serve)
(cd salesnova_backend  && php artisan queue:work)   # or the sign-in code is never logged
(cd salesnova_frontend && npm run dev)
```

The mail log carries the sign-in code in the subject line:
`grep -o "[0-9]\{6\} is your" storage/logs/laravel.log`. Seed a fully-onboarded owner and a lead with
a long timeline with the two scripts kept in the session scratchpad; without every onboarding screen
key answered the shell loops `/onboarding ⇄ /welcome` (ISS-032).
