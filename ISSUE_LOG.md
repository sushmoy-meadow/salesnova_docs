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

### ISS-008 · The lead grid addresses the API a level below where it lives

`salesnova_frontend/src/lib/leads/lead-query.ts:17` ·
`salesnova_frontend/src/lib/leads/lead-cell-update.ts` ·
`salesnova_frontend/src/lib/leads/saved-views.ts`

`QUERY_PATH = "/v1/leads/query"` is appended to `SALESNOVA_API_URL`, which already ends in
`/api/v1` — so the request goes to `/api/v1/v1/leads/query`, which is a 404. Everything the lead
grid, its inline edits and its saved views ask for is addressed this way. `fetchBootstrap` gets it
right (`/bootstrap`), which is why the shell works and the grid does not.

Not visible in either gate: the unit tests pass the path through a fake fetcher and assert on the
string they wrote, and no test brings the two halves together. The same three files are also client
components calling the seam from the browser, where the access token (an `HttpOnly` cookie) and the
API root (a server-side variable) both are not — see the third defect in
`tasks/TASK-LEAD-012-demo.md`, which is the same shape of mistake.

Left alone because it is another task's surface and the fix is two changes, not one: dropping the
prefix, and moving the calls behind server actions or a route handler the way
`app/(app)/leads/duplicates/duplicate-actions.ts` now does.

**What closes it:** drop the `/v1` from all three, move the calls server-side, and demo the grid
against a live API — the only check that would have caught either half.

**Found:** 2026-08-12, TASK-LEAD-012 (demo).

---

### ISS-009 · An undone merge leaves a `LEAD_MERGED` entry and nothing that says it was undone

`salesnova_backend/app/Services/Leads/LeadMergeService.php`

The merge appends a `LEAD_MERGED` timeline entry carrying both pre-merge snapshots. The undo restores
every field, both timelines and the retired record, but leaves that entry standing — so a lead whose
merge was undone reads as one that is still merged.

Deliberate as far as it goes: the merge did happen, and deleting the evidence of a data-affecting
operation is worse than an incomplete story. What is missing is the other half of the story, and it
cannot be written today — `App\Enums\Timeline\EventName` has no undo case, and the taxonomy is
enforced by a database trigger, so adding one is a migration rather than an enum line.

**What closes it:** a `LEAD_MERGE_UNDONE` case in the taxonomy, its trigger updated, and the undo
appending one that names the record that came back.

**Found:** 2026-08-12, TASK-LEAD-012 (demo).

---

### ISS-010 · Follow-ups cannot honour "keep the earliest pending" on merge

`salesnova_backend/app/Services/FollowUps/LeadFollowUpMergeService.php`

SN-LEAD-052 says a merge keeps the earliest pending follow-up. The merge moves all of the retired
record's follow-ups onto the survivor instead, because `follow_up` has neither a cancelled state nor
soft deletes — there is no way to retire the later ones that an undo could reverse.

Costs a survivor that carries two follow-ups where the specification wants one. Nothing is lost, and
the undo puts them back exactly, so the conservative reading is the safe one until the table can
express the other.

**What closes it:** a cancelled state (or soft deletes) on `follow_up`, then a merge that retires all
but the earliest pending and an undo that restores them.

**Found:** 2026-08-12, TASK-LEAD-012.

---

### ISS-011 · Every empty meta map in a list response encodes as `[]`, not `{}`

`salesnova_backend/app/Traits/ApiResponse.php` — `responseList`, `responseCursorList`

The same defect the bootstrap payload had, in the one place every list response is shaped. `counts`,
`applied_filters` and `sort` are keyed maps published as objects with `additionalProperties`, and
they default to `[]` — so a list with no counts sends a JSON array where its own contract promises an
object, and a client reading either by key fails at the seam. Nothing has hit it yet only because no
list endpoint ships a client that reads those blocks by key.

The bootstrap fix does not transfer: casting inside the trait would be read by the generator as the
*schema*, and it types a cast expression as `string`, so the three blocks would be published as
scalars. Bootstrap escaped that because its controller declares the response type with an attribute,
which keeps the cast off the inference path; a list response has no such attribute.

**What closes it:** either an attribute-declared response type for lists, so the trait is free to
cast, or a JSON-encoding step below the generator's reach that boxes the three known map keys.
Whichever is chosen, a test that asserts on the raw body — `"counts":{}` — and not on the decoded
array, which cannot tell the two apart.

**Found:** 2026-08-12, TASK-LEAD-012 (gate).

---

### ISS-012 · The service worker serves `/_next/static` cache-first from a cache that is never versioned

`salesnova_frontend/public/sw.js:57` · `sw.js:5`

Every `/_next/static/**` request is answered from `salesnova-shell-v1` if anything is there, and only
fetched when it is not. The cache name is a literal that no build touches, and `activate` deletes
only caches whose name is *not* the current one — so nothing ever evicts a chunk once cached.

In production this is survivable by accident: Next hashes chunk filenames, so a new build asks for
new URLs. In development it is not. Turbopack reuses stable chunk paths, so a browser that has once
loaded `/_next/static/chunks/src_*.js` keeps running that copy through every edit, restart and
`rm -rf .next`. It cost most of an hour of this task's demo: the page hydrated with a client bundle
several commits behind its own server render, and every diagnosis pointed at the dev server, which
was serving the right file the whole time.

**What closes it:** version `SHELL_CACHE` from the build id so a deploy orphans the previous cache
(and `activate` then evicts it, which it already knows how to do), and skip `/_next/static` entirely
when the worker is running against a dev origin. Until then, a stale browser is fixed by unregistering
the worker and deleting its caches — not by restarting anything.

**Found:** 2026-08-12, TASK-TL-005 (demo).

---

### ISS-013 · The pinned rail and the pin cap both scan the lead's whole timeline

`salesnova_backend/app/Services/Timeline/LeadTimelineReader.php:113` ·
`app/Services/Timeline/ManualActivityService.php:118` ·
`database/migrations/2026_08_10_000000_create_timeline_event_tables.php:80`

Reading a timeline runs a second query for the pinned entries, and pinning one runs a third to count
what is already pinned. Both filter on `is_pinned`, and the three indexes on the table are all
`(organization_id, …, occurred_at)` — none mentions it. Each is therefore an index scan of every
event on the lead to find at most three rows.

Invisible at demo scale and not urgent: the cap keeps the result tiny, and `lead_id` narrows the scan
before `is_pinned` is considered. It becomes real on a lead with thousands of events, which is what
an imported history looks like.

**What closes it:** a partial index — `(organization_id, lead_id, occurred_at) where is_pinned` —
which both queries would use and which stays small because at most three rows per lead qualify. The
migration writes its own `create index` statements for the portable path, so it must be added in both
places.

**Found:** 2026-08-12, TASK-TL-005 (simplify pass).

---

### ISS-014 · A merged lead's timeline entry says nothing about what was merged

`salesnova_frontend/src/components/timeline/timeline-entry-card.tsx:200` ·
`salesnova_backend/app/Services/Timeline/TimelineEntryPresenter.php`

System events publish their whole working payload as `extras`. `LEAD_MERGED` carries `survivor` and
`duplicate`, each a nested record, and the card rendered them as `survivor: [object Object]`.

Fixed in this task by rendering only the keys the screen has a vocabulary for, which are the manual
activity extras. So the entry no longer lies — but it now reads "Merged with a duplicate record" and
nothing else, where the payload knows which record it was and who it became.

**What closes it:** the presenter deciding what a system event *says* rather than handing over what
it *worked from* — a sentence per event name, built from the payload on the API side where the shape
is known. That is also what ISS-009 will need when the undo entry is written.

**Found:** 2026-08-12, TASK-TL-005 (demo).

---

### ISS-016 · Three things send a new account to `/leads`, which does not exist

`salesnova_backend/database/seeders/ActivationTaskSeeder.php` ·
`salesnova_backend/app/Services/Platform/Bootstrap/NavigationBuilder.php:61` ·
`salesnova_frontend/src/app/(app)/welcome/activation-screen.tsx`

The web app has `/leads/grid`, `/leads/duplicates` and `/leads/{id}/timeline`, and no `/leads`. Three
separate things address it anyway: the seeded CTA for "Send your first message" and "Add your first
lead", the shell's own navigation rail, and the activation screen's `router.replace("/leads")` once
the checklist is gone. All three are addressing the screen the IA names, so none of them is wrong —
but until it is built, a new account's first move off the checklist is a 404, and dismissing the
checklist lands them on one.

The activation half is the sharpest: the checklist exists to give somebody who has just signed up
somewhere to go, and every route on it that is not yet built is a dead end wearing a button.

**What closes it:** the lead list screen at `/leads`. Nothing in this feature changes when it
arrives — the routes are already correct.

**Found:** 2026-08-12, TASK-AUTH-013 (demo).

**Also:** it is the whole rail, not just `/leads` (TASK-AUTH-014 demo, 2026-08-12). The five
destinations it publishes are `/leads`, `/follow-ups`, `/content`, `/settings/team` and `/settings`,
and **none of them resolves today** — the app's built screens are the two lead sub-routes, the lead
timeline, `/welcome`, `/settings/ai` and the auth flow. `/follow-ups` was confirmed 404 in the
browser. Same cause and same fix as above: the addresses are the IA's, and each closes when its own
screen lands. Worth knowing before a demo — the rail is not a way to move around the app yet, so any
slice needing a second shell screen has only the lead timeline to use.

---

### ISS-017 · The Playwright MCP harness switches tabs without firing `visibilitychange`

Test tooling, not the product.

A page kept in a background tab and brought forward again receives neither `visibilitychange` nor
`focus`: a listener installed on the page recorded an empty array across a switch away and back,
while `document.visibilityState` read `visible` throughout. TanStack Query's `focusManager`
refetches on the transition into focus, so nothing it drives can be demonstrated through the
harness — the query simply never sees the event.

It bites any slice whose demo is "do the thing in one tab, watch the other one catch up", which is
most live-state work. TASK-AUTH-013 fell back to the mount-time refetch, which is the same code path
a returning reader takes, and left the focus path to a unit test that drives `focusManager` directly.

**What closes it:** either a harness that emulates occlusion (`Emulation.setPageVisibility` has no
CDP equivalent, so realistically a second browser window rather than a second tab), or a standing
note that focus-driven refresh is unit-tested and not demo-tested.

**Found:** 2026-08-12, TASK-AUTH-013 (demo).

---

### ISS-018 · `activation.completed` in the cached shell lags the writes that move it

`salesnova_backend/app/Services/Caching/TenantCache.php` ·
`salesnova_backend/app/Observers/Platform/ShellStateObserver.php`

The activation endpoint derives its counts on every read, so the checklist widget is never stale.
The same three numbers also ride the bootstrap payload, which `TenantCache` holds for
`BOOTSTRAP_TTL` (300s) and `ShellStateObserver` invalidates only on the models it watches. Creating a
lead, logging a message or sending an invitation moves the real count immediately and the cached one
up to five minutes later.

Dismissal is not affected — `ActivationChecklistState` is observed, so the shell learns about it at
once. Only the derived completion count drifts, and only for the shell's copy.

This is the same staleness the `leads.new` badge already accepts, and deliberately so: invalidating
the whole tenant's shell on every timeline write would cost far more than the number is worth. It is
logged because the two copies of the same three numbers can visibly disagree — the widget saying
"2 of 7" beside a shell that still believes 1 — and the next person to see that should find it here
rather than treat it as a bug in the derivation.

**What closes it:** either the shell dropping `activation` and asking the endpoint for it, or
`ShellStateObserver` extended to the three signal-bearing models — which trades a five-minute lag for
an invalidation on every lead and timeline write.

**Found:** 2026-08-12, TASK-AUTH-013.

---

### ISS-019 · The bootstrap DTO shapes its own JSON, and one controller unwraps it

`salesnova_backend/app/DTOs/Platform/Bootstrap/BootstrapDTO.php:72` ·
`salesnova_backend/app/Http/Controllers/Client/BootstrapController.php:32`

`toResponsePayload()` re-boxes `capabilities`, `feature_flags` and `counts` as objects so an empty
map encodes as `{}` rather than `[]`. That is wire shaping, in a DTO the rules require to be
HTTP-unaware, and its name says so out loud. It also makes `BootstrapController` the only controller
in the tree that unwraps a DTO before responding — everywhere else the DTO goes straight to
`responseData()`.

The tree already solves the same problem the other way: `TimelineEntryDTO` types the field `object`
and casts once where it is built, so nothing downstream has to remember.

Left alone deliberately: the docblock records a real incident (an organisation with no flags set
failed at the seam and took the whole shell with it) and a generator quirk (`jsonSerialize` would
publish three maps as scalars), and the change touches the published contract for no behaviour gain
while a slice was mid-flight.

**What closes it:** type the three fields `object` on the DTO, cast in `BootstrapAssembler::build()`,
delete `toResponsePayload()` and the controller's call to it. `BootstrapContractTest` already asserts
the published shape, so it will say immediately whether the schema survived.

**Found:** 2026-08-12, TASK-AUTH-014 (simplify pass, declined).

---

### ISS-021 · A test that revokes a token it already used proves nothing

`salesnova_backend/tests/Feature/Auth/SignOutTest.php:63` ·
`salesnova_backend/tests/Feature/Auth/SessionRotationTest.php:145`

Within one test method, the auth guard keeps the user it resolved for the first request. So a test
that authenticates with a token, revokes it, and then asserts the token no longer works is answered
from the cached user and passes whether or not the revocation did anything. Verified directly: after
a sign-out that expired the access token, a follow-up request carrying **no token at all** still
answered 200.

`Auth::forgetGuards()` between the two requests restores the intended meaning, and `SignOutTest`
carries it with a comment saying why. The reason `SessionRotationTest` never hit this is accidental —
its revocation happens inside a request that answers 401, and a failed resolution leaves nothing
cached.

It costs exactly what a false green costs: the assertion most worth having in an auth suite — "this
credential is dead now" — is the one this silently disables.

**What closes it:** a `signedOut()` helper in `tests/Pest.php` that forgets the guards and returns
the test instance, used everywhere a test asserts a credential has stopped working; and a sweep of
the auth suite for the pattern, since any other instance of it is currently vacuous.

**Found:** 2026-08-12, TASK-AUTH-021.

---

### ISS-022 · Renaming the organisation through onboarding leaves the old name in the shell

`salesnova_backend/app/Observers/Platform/ShellStateObserver.php:44` ·
`salesnova_backend/app/Providers/AppServiceProvider.php:228`

The half of ISS-020 that its fix did not cover. The first onboarding screen's handler renames the
organisation, and `Organization` is not among the models the shell-state observer watches, so the
cached payload keeps the old `organization.name` for the rest of `BOOTSTRAP_TTL` — 300 seconds of
the shell header naming an organisation the member has just renamed.

Milder than ISS-020 was: a wrong name for five minutes rather than a product that cannot be reached.
It is left open rather than fixed with the rest because the fix is not the one-line addition the
others were. `ShellStateObserver::invalidate()` reads `organization_id` off the row and treats its
absence as "this is platform-wide, flush every tenant". An `Organization` has no such column — its
own key *is* the organisation — so adding it to the watched list would flush every tenant's shell
state on every organisation write, which is worse than the staleness it fixes.

**What closes it:** teach the observer to ask the model which organisation it belongs to rather than
reading one attribute name, so a model that *is* the tenant answers with its own key. Then add
`Organization` to the list.

**Found:** 2026-08-13, TASK-AUTH-021.

---

### ISS-023 · A `done` task shipped one half of its delivery requirement, and nothing noticed

`salesnova_backend/app/Services/Auth/SignupService.php:191` ·
`salesnova_backend/app/Services/Auth/OtpService.php:71`

Fixed in TASK-AUTH-021 — recorded because the fix is not the interesting part.

`TASK-AUTH-007` requires that "dispatch of the actual email/SMS MUST run through a queued job". The
login OTP does: `OtpService` dispatches `SendVerificationCode` directly. Signup instead announces
`SignupCodeIssued` and leaves delivery to a listener, which is the better seam — and no listener was
ever written. The task closed `done`. Signup issued a code, the screen asked for six digits, and
nothing anywhere would ever send them.

The whole suite passed throughout, because the signup tests read the code **off the event**
(`tests/Pest.php::completeSignup` listens for `SignupCodeIssued`) rather than off the delivery. A
test that reads the value out of the announcement can never tell whether anyone is listening to it.
It took walking the flow in a browser to find, which is the argument for demo-gating in one line.

Fixed by `app/Listeners/Auth/DeliverSignupCode.php` with four tests behind it in
`tests/Feature/Auth/SignupCodeDeliveryTest.php`, which assert the queued job rather than the event.

**What is still open:** the class of bug, not this instance. Announce-and-listen seams have no
compile-time or test-time proof that anything listens, and there is now one event
(`SignupCodeIssued`) whose listener exists only because somebody walked the flow. Worth an
architecture test that every published domain event has at least one listener, or an explicit
written-down exemption where it does not.

**Found:** 2026-08-13, TASK-AUTH-021 (demo).

---

### ISS-024 · The ADR index lists three files that do not exist, and reuses three numbers

`salesnova_docs/adr/README.md`

Rows for `0062-bulk-records-retain-source-evidence-and-tenant-links.md`,
`0063-lead-merge-winners-are-explicit-field-lead-pairs.md` and
`0064-timeline-and-activity-streams-use-one-cursor-contract.md` are all dead links — no such files
are in `adr/`. The three numbers are then used a second time, by the ADRs that do exist at 0062,
0063 and 0064, so the index carries two rows for each.

The cost is that "ADR-0063" no longer addresses one thing, which is the entire reason
`salesnova_docs/adr/` is one sequence shared by both repos. Anything citing 0062–0064 now needs the
title read alongside it to know which is meant, and a `spec_refs` entry cannot say so at all.

Either the three missing decisions were written and lost, or the index rows were added ahead of the
files and never removed. Nothing in the tree distinguishes those, which is why this needs whoever
wrote them rather than a patch.

**What closes it:** find or discard the three, then renumber whichever pair survives at each of
0062, 0063 and 0064 so that every number addresses one file. A `validate`-style check that every
index row resolves to a file, and every file appears once, is what stops it recurring.

**Found:** 2026-08-13, while indexing ADR-0070.

**Updated 2026-08-13, on merging `origin/main`.** Half of this resolved itself and the other half
got worse. The three files do now exist — they arrived with the LEAD and TL work, so the index rows
were written ahead of them rather than pointing at anything lost. The doubling at 0062, 0063 and
0064 is untouched by that and still needs renumbering.

What is new is that it happened again while this was open: 0069 was taken by
`0069-subteam-scope-keeps-uuid-jsonb-storage.md` and, independently, by the Google redirect
decision. Two developers picking the next free number from two checkouts will keep colliding until
something allocates it. The Google and refresh-proxy ADRs were moved down to 0070 and 0071 to clear
it, because the other side was already published; every reference to them moved with them. That is a
third instance, not a fix — a number nobody allocates is the defect.

---

### ISS-026 · Two parallel timeline stacks are both wired in, and a route reaches across them

`salesnova_backend/app/Providers/AppServiceProvider.php` — `EventWriter` and `TimelineEventWriter`
bound side by side · `app/Models/Timeline/Event.php` · `app/Models/Timeline/TimelineEvent.php`

The merge brought together two independent answers to the same problem. Sakib's contract work built
`TimelineEvent` + `TimelineEventWriter` + `TimelineEventWriterService` with an `EventName` taxonomy
enforced by a database trigger; sushmoy's slice built `Event` + `EventWriter` + `EventReaderService`
+ `LeadTimelineReader` + `TimelineEntryPresenter`. Both are in the tree, both are bound in the
container, and both have passing tests. `LeadAssignmentService` writes through the first;
everything the lead timeline screen reads comes from the second.

The seam is visible in one place already. `POST /leads/{lead}/timeline/{event}/attachments/sign`
resolves `{event}` to a `TimelineEvent` model by implicit binding, while its four sibling routes on
the same path resolve the same segment as a plain id looked up through the entry reader. Sibling
routes on one resource addressing two different entities is a contract that cannot be explained to
a client.

Costs nothing while the sign endpoint is a 501 stub. It becomes a correctness problem the moment
that endpoint is built, because an id valid for one stack is not necessarily valid for the other.

**What closes it:** pick one. The read path, the presenter and the frontend are all on `Event`, so
that is the likely survivor; what `TimelineEvent` carries and `Event` does not — the trigger-enforced
taxonomy, the partition runway, the attachment columns — has to move across rather than be dropped.
That is a task, not a tidy-up, and it should land before anything else is built on either.

**Found:** 2026-08-13, merging `feature/sakib` into `feature/pre-develop`.

---

### ISS-027 · The activity feed publishes no group filter, and two date filters were renamed under it

`salesnova_backend/app/Http/Requests/Client/Timeline/ActivityFeedIndexRequest.php:20` ·
`salesnova_backend/app/Services/Timeline/ActivityFeedReader.php`

TASK-TL-003 published `GET /insights/activity` with `member_id`, `event_type`, `occurred_after`,
`occurred_before` and `group_id`. The implementation ships `member_id`, `categories[]`, `from` and
`to`. Three of those are renames of the same capability; `group_id` is not — there is no group
filtering anywhere in the reader, and no other parameter reaches it.

Two separate costs. The missing filter is a capability the contract promised and nothing delivers,
so a client written against the published spec would send `group_id` and silently get an unfiltered
feed. The renames are cheaper but not free: `from`/`to` on a feed do not say what they bound, where
`occurred_after`/`occurred_before` do, and the published names are now the vaguer pair.

Both were found by sakib's contract test failing on merge. It has been amended to assert what ships,
which is what let the merge close — that amendment is the reason this entry exists rather than a red
test carrying the information.

**What closes it:** the group filter implemented and tested, on whichever task owns the feed's
filtering. The naming is a smaller call and belongs to the two developers, not to a merge — if
`occurred_after`/`occurred_before` win, they are a rename of a shipped query parameter and need the
frontend's feed call moved with them.

> **Still open after
> [ADR-0072](adr/0072-the-built-endpoint-decides-its-contract-where-it-differs-from-the-stub.md),
> 2026-08-13.** That decision settles which side's *shape* is the contract and explicitly declines
> to settle either half of this: the missing filter is a capability nothing delivers, and the naming
> is the two developers' call. Recorded so the supersession is not mistaken for blessing the gap.

**Found:** 2026-08-13, merging `feature/sakib` into `feature/pre-develop`.

---

### ISS-028 · The lead grid cannot reach the API from a browser at all

`salesnova_frontend/src/components/leads/lead-grid-screen.tsx:1` ·
`salesnova_frontend/src/lib/auth/api-envelope.ts:48`

`LeadGridScreen` is a `"use client"` component and calls `fetchLeadQuery(request)` with no
`baseUrl`. `resolveApiRoot` then falls back to `process.env.SALESNOVA_API_URL`, which carries no
`NEXT_PUBLIC_` prefix and so is not inlined into the client bundle. In a browser the value is
`undefined` and the function throws `SALESNOVA_API_URL is not configured` before any request is
made. Every inline cell write — `updateLeadCell` — sits behind the same envelope and fails the same
way.

Two distinct faults are stacked here and the first hides the second. Even given a base URL, nothing
on the client attaches a credential: `requestEnvelope` sends `accept: application/json` and whatever
the caller passes, and the only source of an `authorization` header is `requireOrganizationSession()`
in `src/lib/auth/session-gate.ts`, which reads a cookie the browser cannot read and therefore runs on
the server alone. So the grid would 401 the moment it was given a root.

The cost is that the lead grid renders its chrome, its column menu and its pagination, and lists
nothing — in tests it is fully exercised because Vitest passes a `fetcher` and a `baseUrl` directly,
which is why both gates are green over it. It is the built surface every lead-facing slice is
demoed against, so this blocks their demos and not only its own.

**What closes it:** a decision on the transport, then the wiring. Auth already established the shape
in [ADR-0071](adr/0071-the-refresh-cookie-is-set-on-our-own-origin-so-the-auth-routes-are-proxied.md)
— the browser talks to our own origin and a route handler forwards with the credential — and
`src/app/api/health` and `src/app/api/search` are the two that exist. Extending that to the lead
query and the cell writes keeps the token out of the bundle and needs no new env var. The
alternative, publishing `NEXT_PUBLIC_SALESNOVA_API_URL` and holding a token client-side, contradicts
0071 and should not be taken without superseding it.

**Found:** 2026-08-13, building TASK-FIELD-005, proving the seam.

---

### ISS-029 · The lead list publishes no ETag, so every inline edit is unconditional

`salesnova_backend/app/Services/Leads/LeadQueryService.php` ·
`salesnova_backend/app/Support/Http/EntityTagger.php` ·
`salesnova_frontend/src/lib/leads/lead-cell-update.ts:60`

`EnsureOptimisticConcurrency` requires `If-Match` on a cell write but accepts `*`.
`EntityTagger::for()` hashes *all* of a model's attributes, and the lead query selects a subset of
columns for speed, so a tag computed from a list row could never match the one the middleware
recomputes from the full record. The list therefore publishes `etag: null` on every row and the web
app sends `If-Match: *`.

The cost is that the concurrency check is present and inert exactly where it was meant to bite: two
reps editing the same lead's stage in the grid both succeed, last write wins, and neither is told.
The middleware is doing its job — nothing is bypassed — but no caller is in a position to give it
anything to compare.

**What closes it:** either a tag derived from a stable subset of columns the list can select and the
detail endpoint can reproduce (`updated_at` and the primary key would do), or the list selecting
enough to compute the full-attribute hash. The first is cheaper and is the one to cost first. Until
then `If-Match: *` is honest about what the client knows, and is commented as such at the call site.

**Found:** 2026-08-13, building TASK-FIELD-005.

---

### ISS-030 · The AI settings page fetches without a credential

`salesnova_frontend/src/app/settings/ai/page.tsx`

`fetchAiSettings` is called from a server component but is not given the headers from
`requireOrganizationSession()`, so the request reaches the API unauthenticated and the page renders
its degraded state permanently. Same root as the second half of ISS-028 — `requestEnvelope` attaches
no credential of its own — but on the server, where the fix is one call and already used elsewhere
(`src/app/settings/custom-fields/stages/page.tsx` does it).

Not fixed here because it is another task's screen and the fix wants that task's tests around it.

**What closes it:** thread `const { headers } = await requireOrganizationSession()` into the fetch,
with a test that the header is sent. Worth a sweep for other server-side callers with the same gap
while it is being done.

**Found:** 2026-08-13, building TASK-FIELD-005.

---

### ISS-031 · Three modules version the API path a second time and 404 on every request

`salesnova_frontend/src/lib/ai/ai-settings.ts:13` ·
`salesnova_frontend/src/lib/leads/lead-query.ts:17` ·
`salesnova_frontend/src/lib/leads/saved-views.ts:14`

`.env.example` documents `SALESNOVA_API_URL` as "root of the SalesNova API, **including its version
prefix**", and the local value is `http://localhost:8000/api/v1`. The original callers agree —
`login-request.ts` posts to `/auth/logout`, `bootstrap.ts` gets `/bootstrap`. These three prepend
`/v1` themselves, so the request goes to `/api/v1/v1/...` and the API answers 404. Every screen they
back renders its degraded state, permanently, on a correctly configured environment.

`src/lib/fields/stages.ts` had the same bug and is fixed, which is how this was found: the stage
settings page rendered "The stage list is not available right now" against a live API that answered
the same request correctly under curl.

Nothing caught it because every test injects `baseUrl` and asserts the URL it was given —
`lead-cell-update.test.ts:72` asserts `https://api.test/v1/leads/lead_1/assignee` and passes, since
the fixture root has no version in it. The test and the environment disagree about what `baseUrl`
means and neither is written down anywhere the other can see.

**What closes it:** drop the `/v1` from the three constants, and change their tests to use a fixture
root that carries the version (`https://api.test/api/v1`) so the assertion can tell the two apart.
`src/lib/fields/stages.test.ts` does it that way and is the pattern. Not fixed here because each
belongs to a task with its own tests around it, and the fix has to move the test fixture with it.
Worth a grep for `"/v1/` at the same time — the four found are all of them today.

**Found:** 2026-08-13, building TASK-FIELD-005, proving the seam.

**Update 2026-08-14 (TASK-LEAD-007):** a fifth instance —
`salesnova_frontend/src/lib/leads/lead-cell-update.ts:38,45` builds `/v1/leads/${leadId}/…` the same
way. So "the four found are all of them today" was one short; the grep missed it because its path is
assembled in a helper rather than a top-of-file constant. It backs the grid's inline edits
(TASK-LEAD-018), so every grid cell edit 404s on a correctly configured environment. The detail
screen's notes edit does not go through it — it uses `lead-detail.ts`, which versions the path
correctly — so this slice's demo was unaffected. Same fix and same test-fixture move as the other
four.

---

### ISS-032 · Onboarding and the app shell disagree on completeness, looping /onboarding ⇄ /welcome

`salesnova_frontend/src/app/(app)/layout.tsx:75` ·
`salesnova_frontend/src/app/onboarding/page.tsx`

With a membership whose onboarding answers cover every screen in the sequence — `screenFor(...)`
returns `is_complete: true`, confirmed directly against the backend — a browser hitting any `(app)`
route enters an infinite redirect: `/onboarding → /welcome → /onboarding → …`, ending in
`ERR_TOO_MANY_REDIRECTS`. The `(app)` layout redirects to `/onboarding` when
`bootstrap.onboarding.is_complete` is false; the `/onboarding` page redirects away to `/welcome`
when it reads complete. The two are reading the same fact and reaching opposite answers in the same
instant, so each bounces the request straight back to the other.

The cost is that a fully-onboarded member cannot reach the app at all — every route is a loop. It
did not surface until now because the seeded orgs the app is usually demoed against sit on one side
of the disagreement or the other consistently; this account landed exactly on the seam by having its
onboarding completed mid-session.

**What closes it:** one source of truth for "onboarding complete" that both the layout and the
onboarding page read, so they cannot disagree — most likely the layout and the page must derive it
from the same bootstrap read in the same request rather than each computing its own. Worth checking
whether `/welcome` is even the right post-onboarding destination, since the layout does not treat it
as exempt. Not this slice's code; found while trying to reach the lead grid for the FIELD-005 demo.

**Found:** 2026-08-13, building TASK-FIELD-005, proving the seam.

---

### ISS-033 · The inline-edit cell controller answers only the stage cell; the rest are 501

`salesnova_backend/app/Http/Controllers/Client/Leads/LeadCellUpdateController.php`

`LeadCellUpdateController` backs six PATCH routes — assignee is its own controller, and this one
serves stage, groups, follow-up, notes and custom-fields. Only the stage route was implemented:
`stageDefinition()` throws `NOT_IMPLEMENTED` for any route name other than `customer.leads.stage.update`,
and the recorder it delegates to only handles dropdown custom fields. So groups, follow-up and
notes each returned a 501 "The remaining cells are not built yet." for anyone who tried them.

The cost is that TASK-LEAD-018 (grid inline editing of assignee, stage, groups, follow-up, notes and
custom fields) was closed with only two of its six cells actually writable — the others answer 501
against a live server. Nothing failed because no test drove a non-stage cell to a 200, and the grid's
own tests inject the path (ISS-031) and never reach the API.

**Fixed here for notes only:** the detail screen's "edited and re-read" demo needs a working write,
and notes is the info-block field it edits, so `LeadCellUpdateController` now short-circuits the notes
route to `LeadWriter::updateNotes()` (a blank box stores null, the structured `source_payload` is left
untouched), covered by `LeadNotesUpdateTest`. **Still open:** the groups, follow-up and custom-field
cells remain 501, and the grid that depends on them is marked done. Each needs its own writer and a
test that drives it to a 200 — most naturally reopened under TASK-LEAD-018 or a follow-up to it.

A smaller sibling smell, not fixed: the dwell interaction (SN-LEAD-023) has no view-shaped type in the
contract. `LeadInteractionRequest` reuses the manual-activity type enum (`NOTE|CALL|MEETING|MESSAGE`),
so the client's "mark seen" POST borrows `NOTE` — the endpoint records no timeline entry regardless of
type, so it is harmless, but a reader will reasonably expect a `VIEW`.

**Found:** 2026-08-14, building TASK-LEAD-007, proving the seam.

---

## Closed

### ISS-025 · ADR-0063 specifies a merge request shape that the shipped endpoint does not accept

`salesnova_docs/adr/0063-lead-merge-winners-are-explicit-field-lead-pairs.md:14` ·
`salesnova_backend/app/Http/Requests/Client/Leads/LeadMergeRequest.php`

The ADR is Accepted and says `POST /leads/{lead}/merge` takes `survivor_lead_id` and a
`winner_selections` array of `{field, lead_id}` pairs. What shipped takes `duplicate_lead_id` and
`field_winners`, a map from field name to `'survivor'|'duplicate'` — which is the shape the ADR's
Alternatives section explicitly rejected.

The reason it gave for rejecting it no longer holds: "the project's request contract generator
exposes wildcard Laravel arrays as list schemas, making the map shape either inaccurate or
undocumented". A `#[BodyParameter]` attribute on the request states the map type directly, and the
generated spec now carries `additionalProperties` with the two-value enum, so the map is documented
exactly. The implementation also removed the ADR's stated follow-up burden — the survivor is the
route's own lead, so it cannot disagree with the URL, and the duplicate is verified as flagged
against it.

So the code looks right and the decision record looks wrong, which is the dangerous way round: the
next person to read 0063 will implement against a contract no endpoint serves. Found only because
sakib's contract test asserted the ADR's shape and failed on merge; that test now asserts what ships.

**What closes it:** an ADR superseding 0063 that records the map shape, the attribute that makes it
expressible, and the survivor-from-the-route decision. 0063 marked Superseded rather than edited.
Note ISS-024 — 0063 is one of the three doubled numbers, so this needs the renumbering settled first
or the supersession will name an ambiguous target.

**Found:** 2026-08-13, merging `feature/sakib` into `feature/pre-develop`.

> **Closed 2026-08-13 by
> [ADR-0072](adr/0072-the-built-endpoint-decides-its-contract-where-it-differs-from-the-stub.md).**
> The shipped shape is now the recorded one, and 0063 is marked superseded in that part rather than
> edited. The ambiguity this entry warned about — 0063 being one of ISS-024's doubled numbers — was
> sidestepped rather than solved: the supersession links the file, not the bare number, so it names
> one document. ISS-024 stays open.

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

**Closed 2026-08-13, TASK-AUTH-021 (demo).** Walked in a browser against live services, in both
directions and more than once: a brand-new account finishing signup was sent to `/onboarding` by
this layout; after the five screens it reached `/welcome`; and switching to a second organisation
whose sequence was untouched sent it back to `/onboarding` again. The real payload's
`onboarding.is_complete` does arrive where the layout reads it.

It also found what the mocked test could not — the cached payload was not invalidated when the
sequence completed, so the two sides disagreed and the browser looped. That is ISS-020, fixed with
it.

---

### ISS-015 · An unauthenticated API request with no `Accept: application/json` answers 500

`salesnova_backend` — `GET /api/v1/bootstrap` (any guarded route)

With the header, an anonymous request answers `401` as it should. Without it, Laravel treats the
request as a browser navigation and redirects to a `login` route that an API-only application does
not define, so the guard raises `RouteNotFoundException` and the handler answers `500 INTERNAL_ERROR`
— with the exception class and file in `details.debug` when debug is on.

Nothing in the web app hits it: every call goes through the envelope helpers, which set the header.
It is what anyone pasting an API URL into a browser gets, and it is what an integrator's first curl
gets — a 500 that reads like the server is broken rather than a 401 that reads like a missing token.

**What closes it:** the exception handler's `shouldReturnJson` forced true for the `api/*` prefix, so
an unauthenticated request answers `401` whatever it asked for. One test per branch: with and without
the header.

**Closed 2026-08-13, TASK-AUTH-021 (demo).** Found again from the other end: the web app's *reads*
did not set the header either — `requestEnvelope` only attached one on requests that sent a body — so
a session the API had withdrawn reached the shell as a 500 and rendered as "the server is
unavailable" rather than sending the reader to sign in with a reason. That is this task's third
acceptance criterion failing, which is how it stopped being a curl-only curiosity.

Fixed on both sides. Backend: `redirectGuestsTo(fn () => null)` in `bootstrap/app.php`, so the guard
raises the refusal plainly instead of looking up a route this application does not define — the
renderer was already wired for `api/*` and never saw the exception, because building the redirect
threw first. Web app: `accept: application/json` is now stated on every request, not only the ones
carrying a body.

Covered by `tests/Feature/ErrorEnvelopeTest.php` — "refuses an unauthenticated call that did not ask
for JSON, rather than looking for a login page". Verified against the running API: `curl` with no
`Accept` header now answers `401 UNAUTHENTICATED`.

**Found:** 2026-08-12, TASK-TL-005 (demo).

---

### ISS-020 · Finishing onboarding locks the account out of every app screen for five minutes

`salesnova_backend/app/Observers/Platform/ShellStateObserver.php:56` ·
`salesnova_backend/app/Providers/AppServiceProvider.php:228` ·
`salesnova_frontend/src/app/(app)/layout.tsx:46`

The app layout sends a member to `/onboarding` when the cached shell payload says onboarding is
incomplete; `/onboarding` sends them to `/welcome` when the sequencer says it is complete. `/welcome`
is inside the app layout. So the two disagree the moment the last screen is answered, and the browser
bounces between them until it gives up with `ERR_TOO_MANY_REDIRECTS`. Nothing recovers it — not a
reload, not signing out and in — until `BOOTSTRAP_TTL` (300s) expires or the cache is cleared.

The sequencer derives completion from `OnboardingProgress`, which no observer watches, so the write
that completes the flow invalidates nothing. `ShellStateObserver` covers `Subscription`,
`FeatureFlagOverride`, `FeatureFlag`, `Membership` and `ActivationChecklistState` only. The first
screen's handler renames the organisation, and `Organization` is unwatched too — the same gap, one
step earlier.

Reproduced 2026-08-12 on a second seeded member: five screens answered in the browser, then every
route under the app layout looped. `php artisan cache:clear` fixed it instantly, which is what
identifies the cache rather than the data as the cause — `OnboardingProgress` held all five answers
throughout, and `IdentityProgressReader::onboarding()` reported `is_complete: true` while the shell
still said false.

This is ISS-018's mechanism with a much worse consequence: a stale count reads wrong for five
minutes, a stale onboarding flag makes the product unusable for five minutes, at the one moment every
account passes through exactly once.

**What closes it:** observe `OnboardingProgress` (and `Organization`) for shell state, or have the
app layout treat a `/onboarding` bounce as authoritative and re-read the sequencer rather than the
cached payload. The redirect pair should also be made unable to cycle regardless of what either side
believes.

**Found:** 2026-08-12, TASK-TL-006 (demo).

**Closed 2026-08-13, TASK-AUTH-021 (demo).** `OnboardingProgress` gets its own observer,
`app/Observers/Identity/OnboardingProgressObserver.php`, registered in `AppServiceProvider::boot()`.
The sequencer's `advance()` persists with `$progress->save()`, a model write, so the observer fires
and the payload is dropped the moment the last screen is answered.

Not added to `ShellStateObserver`'s list, which was the first attempt: that one drops every member's
key plus two organisation-wide ones, so a five-screen run would have issued six sweeps over every
membership in the organisation to invalidate the one key the writer holds. The progress row names
its own membership, so the observer forgets exactly that.

Covered by `tests/Feature/Platform/BootstrapInvalidationTest.php` — "drops the cached payload when
the onboarding sequence is finished". The test moves `answers`, not `completed_at`: completion is
derived from what has been answered against the screens as they stand, and a first attempt that
stamped `completed_at` passed while proving nothing.

Re-ran in the browser afterwards on a second organisation: five screens answered, then straight into
the shell with no bounce. The `Organization` half of this entry is **not** closed — see ISS-022.

---

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

### ISS-034 · The bulk seam double-prefixed `/v1`, so every bulk call 404'd server-side — closed 2026-08-14

`salesnova_frontend/src/lib/leads/bulk-operations.ts`

`BULK_ROOT` was `/v1/leads/bulk`. The seam is invoked only from a server action, where the base URL
is `SALESNOVA_API_URL` and already ends in `/api/v1`, so the first live preview 404'd on
`/api/v1/v1/leads/bulk/delete/preview`. The unit tests never caught it: they pass an explicit
`baseUrl` without a version and asserted the doubled path, so the `/v1` looked deliberate.

Fixed by dropping the `/v1` — `BULK_ROOT` is now `/leads/bulk`, matching the convention already
spelled out in `src/lib/fields/stages.ts`, the other server-invoked seam. The three URL assertions in
`bulk-operations.test.ts` were corrected to the single-prefix path.

**Carry-over rule:** a seam's `/v1` prefix belongs only where the seam is called from the browser,
where the base carries no version. A server-action seam must start its path at the resource. The two
contexts read the same in a unit test with a version-less `baseUrl` — only a live request tells them
apart, which is why the demo is the gate.

**Found:** 2026-08-14, building TASK-LEAD-014, exercising the bulk-delete demo in a browser.

---

### ISS-035 · The lead grid renders no rows in a browser — its list fetch is unauthenticated and off-contract

`salesnova_frontend/src/components/leads/lead-grid-screen.tsx:147` ·
`salesnova_frontend/src/lib/leads/lead-query.ts`

The grid's rows come from `fetchLeadQuery` called inside a client `useQuery`, with no options. Two
independent faults keep it from ever returning data in a real browser:

- **No auth.** The call carries no bearer token — the token lives in the server session, unreachable
  from client code — so the request is a bare `POST` to `:8000` and comes back `401`.
- **Off-contract body.** For the common unfiltered list, `toLeadQueryRequest` omits `filters`
  entirely, but the query endpoint's `ComplexQueryRequest` requires `filters.conditions` with
  `min:1`. So even authenticated, the default grid load is a `422`.

The net effect is that the lead grid (TASK-LEAD-007) shows "The lead grid could not be loaded" for
every real visit; it passes its own tests only because they inject a mock fetcher with a `baseUrl`
and never touch the API. The list load looks like it wants to be a server action (like the page's own
`fetchStages`), so that the token and the version-carrying base are both in scope — the same shape the
bulk actions in this slice use.

Not fixed here — it is TASK-LEAD-007's seam, not this slice's. Worked around for the TASK-LEAD-014
demo by priming the grid's query cache with the real seeded rows (see the demo record), which leaves
the bulk preview/execute running for real against the backend.

**Found:** 2026-08-14, building TASK-LEAD-014, trying to reach the grid for the bulk demo.

---

### ISS-036 · The import upload/commit steps validate the file and batch-id in the controller, not the FormRequest

`salesnova_backend/app/Http/Controllers/Client/Leads/LeadImportController.php:39` ·
`salesnova_backend/app/Http/Requests/Client/Leads/LeadImportRequest.php`

`LeadImportController` hand-checks that `upload` carries a file and that a commit carries an
`import_batch_id`, returning `VALIDATION_FAILED` itself. Both are conditional-on-step required-field
rules, which the repo otherwise keeps in the FormRequest. A `Rule::requiredIf` keyed on the route
step (`$this->route('step')`) would move them there and keep the controller purely transport.

Left as-is: the branch is small and reads clearly, the request would still need to know the route
step, and the two checks respond through the same `ApiResponse` trait. Noted so the next hand at this
controller can lift them if the wizard grows more per-step rules.

**Found:** 2026-08-14, TASK-LEAD-015 simplify pass (altitude lens).
