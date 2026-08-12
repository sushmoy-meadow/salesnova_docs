# Issue log

Defects and deferred work found while building something else. One place, shared by both repos and
both developers, because the alternative is what happened up to now: a finding gets a sentence in a
build report, the report scrolls away, and nobody sees it again.

**What belongs here.** Anything noticed but not fixed in the change that found it — a defect outside
the current task, a simplification declined, a latent risk. **What does not:** a criterion of a task
that could not be met, which goes in `tasks/<TASK-ID>-open-points.md` and is that task's business.

**Rules.**

- Log it at the moment it is found, not at the end. A finding you are holding in your head to write
  up later is a finding you will report in prose and never record.
- Fix it instead, if it is small and safe. A one-line fix plus a test costs less than an entry.
- An entry names a **file:line**, what is wrong, what it costs, and what closes it. "Tidy up the
  onboarding page" is not an entry.
- Move the entry to **Closed** with the date and what fixed it. Do not delete it — the trail is
  why the log is worth keeping.
- ISS ids are sequential and never reused.

---

## Open

### ISS-001 · Renaming a workspace leaves its slug reading the old name

`salesnova_backend/app/Services/Organizations/OnboardingOrganizationNaming.php:33`

Signup provisions the organisation before anyone has been asked what to call it, so the slug is cut
from "Untitled workspace". Onboarding's first screen updates `name` and leaves `slug` alone. Every
organisation created through the real flow therefore carries a slug that names nothing.

Costs nothing today — no route, link or export reads `slug` yet. It becomes expensive the moment one
does, and it will be much harder to change then, because by then the slug will be in URLs people
have shared.

**What closes it:** a decision first, not a patch. Either the slug tracks the name (and then
`OrganizationProvisioningService::availableSlug()` must be extracted so the naming handler can reuse
its uniqueness-against-soft-deleted check, and every future consumer must tolerate it changing), or
it is a permanent opaque identifier and the initial cut should stop pretending to be derived from a
name nobody has given yet. Second option looks right; it needs an ADR either way.

**Found:** 2026-08-12, TASK-AUTH-012.

---

### ISS-002 · `industry` is a bare string agreed only by convention

`salesnova_backend/database/migrations/2026_08_03_100000_create_organizations_table.php:26`

The column is `string(64)`, nullable, with no enum and no constraint. Its legal values are written
out independently in four places: the seeder's SINGLE_SELECT options, `Support\Leads\IndustryPresets`,
`OnboardingAnswerValidator`, and the factory. They agree by inspection and nothing enforces it.

This already went wrong once — see ISS-006 — and the failure mode is silent: an organisation ends up
with an industry no preset table knows, and simply never gets seeded.

**What closes it:** a backed string enum under `app/Enums/Organizations/`, cast on the model, with
`IndustryPresets` keyed by the enum rather than by string. Repo rule: backed string enums live in
`app/Enums/{Domain}/` and are cast in the model.

**Found:** 2026-08-12, TASK-AUTH-012 (simplify pass; declined mid-slice because the casing drift made
it a change with its own blast radius rather than a rename).

---

### ISS-003 · The shell's redirect into onboarding has never run in a browser

`salesnova_frontend/src/app/(app)/layout.tsx`

The layout sends a member with an unfinished sequence to `/onboarding`. Nothing renders under
`src/app/(app)/` yet, so there is no page to navigate to that would trigger it. Covered by
`src/app/(app)/layout.test.tsx`, and that is all the evidence there is — a unit test with the
bootstrap call mocked cannot show that the real payload's `onboarding.is_complete` arrives where the
layout reads it.

**What closes it:** the first real page under `(app)/`. Whoever builds it should walk this path in a
browser as part of their demo and say so.

**Found:** 2026-08-12, TASK-AUTH-012.

---

### ISS-004 · Two near-identical "we could not load this" screens

`salesnova_frontend/src/app/onboarding/page.tsx:27` · `salesnova_frontend/src/app/(app)/shell-unavailable.tsx:12`

Same design-system `ErrorState`, same copy shape, different retry: the shell's is a client component
calling `router.refresh()`, onboarding's is a server-rendered link back to its own route. Declined
during the slice because collapsing them needs a prop that selects between the two mechanisms, which
is a design-system decision rather than a tidy-up.

Low cost while there are two. Worth doing before there is a third, and there will be — every
authenticated route needs one.

**What closes it:** one `RouteUnavailable` in the design system taking the retry as either a href or
a callback.

**Found:** 2026-08-12, TASK-AUTH-012 (simplify pass, Reuse lens).

---

### ISS-005 · Onboarding re-reads the screen definitions table on every request

`salesnova_backend/app/Services/Identity/OnboardingSequencer.php:102` ·
`salesnova_backend/app/Services/Leads/OnboardingIndustryPresets.php:73`

Two separate costs, both small, both on the same path:

- The sequence is five global rows that change only on deploy, and every `GET /onboarding/screen`
  and every submit reads them.
- Seeding an industry's custom fields issues one `firstOrCreate` per field inside a loop — three
  round trips where an upsert would be one.

Deliberately left: five rows on a table nobody else contends for is not a bottleneck, and caching
them means an invalidation path that has to survive the "add a screen with no release" property the
task exists to provide. Recording it so it is a measurement next time and not a rediscovery.

**What closes it:** measure first. If it matters, cache the definitions with an explicit bust on
write, and collapse the field loop to `upsert()`.

**Found:** 2026-08-12, TASK-AUTH-012 (simplify pass, Efficiency lens).

---

## Closed

### ISS-006 · `OrganizationFactory` emitted an industry no preset could match — closed 2026-08-12

`salesnova_backend/database/factories/Organizations/OrganizationFactory.php:33`

The factory rolled `REAL_ESTATE`, `INSURANCE`, `EDUCATION`, `FINANCE`; everything else in the system
uses `real_estate`, `insurance`, `education`. So every factory-built organisation had an industry
matching no preset key, and `FINANCE` was not an industry the product offers at all. Any test that
tried to assert seeding behaviour off a default factory organisation would have found nothing seeded
and no error.

Fixed by lowercasing the values and dropping `FINANCE`. The underlying reason it could drift is
ISS-002, still open.

---

### ISS-007 · Every row of the organisation chooser was labelled "Organisation" — closed 2026-08-12

`salesnova_backend/app/DTOs/Auth/MembershipDTO.php` ·
`salesnova_frontend/src/lib/auth/login-request.ts:26`

A member of two organisations was shown two identical buttons and could only tell them apart by
clicking one. `MembershipDTO` never published `organization_name`, though `MembershipDirectory`
already eager-loads the relation.

The reason it stayed invisible is the more useful half: the web app's schema had
`organization_name: z.string().min(1).nullable().default(null)`, added when the field was known not
to be published yet. The default turned a missing field into a legal `null`, the picker's
`?? "Organisation"` turned that into a plausible-looking label, and nothing anywhere failed.

Fixed by publishing `organization_name` on the DTO and removing the `.default(null)` so an absent
field is now a parse error. Null remains legal — an organisation can be soft-deleted out from under
a membership. Covered by a test that the field is read, one that null survives, and one that absent
is refused. Verified in the browser as well as in tests: `/login/organizations` now renders "Conroy
Inc" and "Northwind Realty".

**Carry-over rule:** a `.default()` on a Zod schema at the API seam is a silent-failure generator.
Only use one where the field is genuinely optional in the contract, never to paper over a field the
API has not shipped yet.

---
