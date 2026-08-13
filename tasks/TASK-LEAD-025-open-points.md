# TASK-LEAD-025 — open points

One acceptance criterion could not be tested here because the feature it exercises is not built.

## AC6 — a saved view is not visible outside its scope

> A saved view created by one member is not visible to a member outside its scope.

**Cannot be tested yet.** The saved-view CRUD endpoints are stubs: every one of
`SavedViewIndexController`, `SavedViewStoreController`, `SavedViewShowController`,
`SavedViewUpdateController` and `SavedViewDestroyController` returns
`501 NOT_IMPLEMENTED` ("Saved-view assembly is not available yet"). A view cannot be
created, so its scoping cannot be asserted — the criterion has nothing to run against.

**What closes it.** The saved-view assembly task (the backend behind those five routes)
must land first; it is tracked as **ISS-041** in the issue log. Once a member can create
a scoped view, this criterion becomes a straightforward tenancy/visibility test in the
shape of `tests/Feature/Permissions/LeadVisibilityTest.php`: create a view scoped to one
member (or subteam), assert a member outside that scope does not receive it from
`GET /api/v1/leads/saved-views`.

## The other five criteria are covered

- **AC1** (grid edit → table + detail, no refresh): exercised in a browser against both
  live servers — see `TASK-LEAD-025-demo.md`.
- **AC2** (four system-view counts match the database): `tests/Feature/Leads/LeadQueryEngineTest.php`.
- **AC3** (assignment is both a timeline event and an audit row, same actor and time):
  `tests/Feature/Leads/AssignmentAgreesAcrossRecordsTest.php`.
- **AC4** (first response stamps once, a second does not re-stamp):
  `tests/Feature/Leads/FirstResponseFromInteractionTest.php`.
- **AC5** (a dwell hover records nothing; opening the row does):
  `tests/Feature/Leads/DwellInteractionAndTimeInStageTest.php`.
