# TASK-AUTH-003 — open points

Both acceptance criteria have tests behind them in
`salesnova_backend/tests/Feature/Auth/OnboardingActivationSchemaTest.php`. What follows is where
those tests stop short of the sentence the criterion is written in, and scope the surrounding
requirements name that a schema task cannot close.

## "Survives a new session" is proved at the column, not through a session

The dismissal criterion is tested as far as this layer reaches: the state is written, the cache is
flushed, the tenant context is torn down and rebuilt, and the row still reads dismissed. Nothing
about it lives in a session, a cookie or a cache, which is the property the criterion is really
asking for.

What it is not is a round trip — sign in, dismiss, sign out, sign back in, checklist gone. That
needs `POST /api/v1/activation/dismiss` and `GET /api/v1/activation/tasks`, and neither exists:
the route contracts are `TASK-AUTH-006` and the endpoints are `TASK-AUTH-013`. The test that closes
it belongs there, against the live endpoints, and should not be written here against a model.

## Nothing yet acts on an onboarding answer

The industry screen offers the three verticals the preset table names, and the answer lands in
`onboarding_progress.answers`. Nothing reads it. Selecting Real Estate seeds no stages, no custom
fields and no message templates, because the seeding logic is `TASK-AUTH-012` and its own
acceptance criteria cover it.

The same is true of the sequence as a whole: the rows describe an order, and no code walks it yet.

## `current_screen_key` is a soft key

`onboarding_progress.current_screen_key` is a plain `varchar` with no foreign key to
`onboarding_screen_definitions.screen_key`. That is deliberate — a constraint would mean a screen
could not be retired while any member's cursor still pointed at it, and retiring screens without a
migration is the whole point of the sequence being data.

The cost is that a cursor can outlive the screen it names. The sequencer has to treat an unknown
`current_screen_key` as "start from the first unanswered screen" rather than trusting it, and that
is a decision `TASK-AUTH-012` has to make explicitly rather than inherit.

## The activation copy past the first task is authored, not specified

`SN-AUTH-041` names the seven tasks and their completion conditions, and the response example in
`SN-AUTH-040` gives the full shape for `connect_whatsapp` alone — label, description, route, CTA
and estimate. The other six carry copy written here to match its register, and routes taken from
the information-architecture route table.

The estimates in particular are guesses that read as measurements. They are worth a product pass
before the checklist ships, and the seeder is a `upsert` on the natural key, so revising them is
one edit and a re-seed.
