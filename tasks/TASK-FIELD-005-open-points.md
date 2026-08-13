# TASK-FIELD-005 — open points

Stage history (SN-FIELD-007), relative-move reordering (SN-FIELD-008) and the stage-change timeline
event (SN-FIELD-021) are covered by `tests/Feature/Fields/StageConfigurationTest.php` and
`tests/Feature/Fields/StageHistoryTest.php`, and the editor by
`src/components/fields/stage-editor.test.tsx`. What follows is the part of SN-FIELD-020 that has
nowhere to land yet, and the reordering decision this slice had to make.

## 1. Two of SN-FIELD-020's three consequences have no subject

The requirement gives terminal stages three effects: they *drive conversion reporting*, *exclude
leads from "needs follow-up" prompts*, and *break active sequences by default*.

Only the middle one is implemented. `LeadQueryService::applyFollowUps()` now excludes a lead whose
stage value sits in the terminal set, tested by "a terminal lead drops out of the follow-ups
bucket". The other two are not deferred by choice — there is nothing to attach them to:

**Breaking active sequences.** Sequences are F08, gate G4, and the whole domain is unbuilt: there is
no `sequence_enrolments` table (TASK-SEQ-001, pending) and no break engine (TASK-SEQ-005, pending).
TASK-SEQ-005 already lists TASK-FIELD-005 among its dependencies and SN-FIELD-020 among its spec
refs, so the break belongs to it and the direction of the dependency is already recorded correctly.
What this slice owes it is the thing it can supply: `StageConfigurationService::terminalValues()` and
`LeadStageReader::terminalValues()` answer which stage values are terminal, and
`CustomFieldValueRecorder::record()` is the single point every stage transition passes through — the
one place a break hook can be attached without a second writer appearing.

**Driving conversion reporting.** No reporting surface exists in any gate that is built. The stored
shape is what reporting will need — `outcome` is `WON` or `LOST`, it is refused on a non-terminal
stage, and it is cleared when a stage is un-terminalled, so a report cannot read a won-or-lost from
a stage nobody can close in.

**What closes both:** TASK-SEQ-005 for the break; the first reporting task in whichever gate carries
it for the conversion figures. Neither is testable here in any form that would not be a mock
asserting against itself.

## 2. The reordering seam, and why stages got a sub-resource

SN-FIELD-008 requires relative moves so that two managers reordering at once cannot silently
overwrite each other. The generic custom-field CRUD that would have been the obvious home —
TASK-FIELD-003 — is `pending` and blocked, and its endpoints are 501 stubs.

Rather than implement half of that task's contract to get a stage moved, stage options got their own
sub-resource under `custom-fields/stages`: `GET /`, `PATCH /{value}`, `POST /{value}/move`. One
option moves or changes at a time. That is the same shape SN-FIELD-008 asks for and for the same
reason — a posted array of options *is* the clobbering the requirement exists to prevent, so an
endpoint that accepts one would reintroduce it at the seam. It also leaves TASK-FIELD-003 free to
decide its own contract without inheriting one from a slice that only needed stages.

The move itself is shared, not duplicated: `App\Support\RelativeMove` applies UP / DOWN / AFTER to a
list of keys and is used both for option order inside the jsonb `options` column and for field order
across `display_order` rows.

Recorded in [ADR-0073](../adr/0073-stage-options-are-a-sub-resource-and-move-one-at-a-time.md).

## 3. The stage half was demoed in a browser; the lead half has no browser surface

The slice is **not closed.** Full record in `TASK-FIELD-005-demo.md`. In short, driven in a real
browser (Playwright) against `php artisan serve` :8000 and `next dev` :3000, signed in genuinely by
email OTP:

- **Reorder in the UI** — clicked *Move Contacted up*; the list re-rendered `New, Contacted,
  Negotiation, Won` and the DB `options` column matched (`contacted` order 1, `negotiation` order 2).
- **Terminal + outcome** — toggled *Negotiation is terminal*, the outcome selector appeared, chose
  *Lost*; DB read back `is_terminal:true, outcome:"LOST"`.
- **Stage-move backend** (over the API, not the browser) — two `PATCH /leads/{lead}/stage` calls
  appended two `custom_field_value_histories` rows and two `LEAD_STAGE_CHANGED` timeline events with
  from/to/actor; time-in-stage read `1 minute, 34 seconds` fresh, `2 days, 5 hours` backdated, `—`
  for a lead that never moved, on both the detail endpoint and the list.

**What has no browser-drivable surface: moving a lead between stages.** The only built UI for it is
the lead grid, and it could not be reached or used:

1. `/leads/grid` loops `/onboarding ⇄ /welcome` for a fully-onboarded account (ISS-032).
2. Beneath that, the grid is a client component reading the server-only `SALESNOVA_API_URL`, so it
   cannot reach the API from a browser at all, credential or otherwise (ISS-028).

Both are grid defects — another task's surface — not this slice's. But the demo is one journey and
half of it has no working surface, so per `/build-slice` §6 the slice stays `in_progress` until a
lead's stage can be moved in a browser. The Playwright tooling that was missing earlier is now
present; the blocker is the two grid defects, not the tooling.

## 4. What proving the seam caught

`src/lib/fields/stages.ts` prefixed its request path with `/v1`, which `SALESNOVA_API_URL` already
carries, so every stage request went to `/api/v1/v1/custom-fields/stages` and 404'd. The settings
page rendered its "not available right now" state against an API that answered the same request
correctly under curl. Fixed here, and covered by `src/lib/fields/stages.test.ts`, which asserts
against a fixture root that carries the version so the two prefixes can be told apart.

Three other modules have the identical bug and are logged as ISS-031. Both gates were green over all
four, which is the argument for the demo rule stated plainly: no test that injects its own `baseUrl`
can see this class of fault.
