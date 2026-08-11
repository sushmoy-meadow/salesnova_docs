# TASK-AUTH-006 — open points

Both acceptance criteria have tests behind them in
`salesnova_backend/tests/Feature/Auth/OnboardingContractTest.php`. This task defines contracts, so
what those tests prove is the published shape and the refusals — not the behaviour behind them,
because the four controllers answer 501 by design.

## "Always returns either the next screen or is_complete=true" is proved as a shape

`OnboardingScreen` is one schema for both answers: `is_complete` is required, `screen_key`, `title`
and `subtitle` are nullable, and `GET /onboarding/screen` and `POST /onboarding/submit` are asserted
to answer the same `$ref`. `OnboardingScreenDTO::nextScreen()` and `::complete()` are the only two
ways to build it, and each has a test, so the completion shape has one definition rather than being
re-derived per caller.

What is not proved is the word *always*. Nothing yet walks the sequence, so no test can submit an
answer and see the next screen arrive, or submit the last one and see completion. That is
`TASK-AUTH-012` (the sequencer) and `TASK-AUTH-013` (the endpoints), and the round-trip test belongs
there, against live routes.

## The counters are a shape, not a count

`ActivationChecklist` publishes `completed`, `total`, `is_dismissed` and `tasks`, and a test asserts
the three counters stay identical to the ones `BootstrapActivation` already carries — the checklist
repeats them so a client can draw the badge without a second request, and repeating them is only
safe while they agree.

Nothing computes them. Each `ActivationTask.is_complete` is answered by the thing the task is about
at read time, and that resolution is `TASK-AUTH-013`.

## The four routes authorize nothing yet

`OnboardingProgressPolicy` and `ActivationChecklistStatePolicy` exist and expose only instance-scoped
`view` and `update`. None of the four routes binds a model, so authorizing here would mean resolving
or creating the row first, which is the endpoint work. The routes sit inside `auth:sanctum` and
`tenant`, and a test asserts an anonymous caller gets 401 before the 501 — that is the whole guard
this layer can offer. `TASK-AUTH-013` adds the policy calls.

Dismissal in particular is gated on `settings.manage_org` in the policy and on nothing at the route,
so the first test that a non-administrator cannot dismiss the checklist has to be written there.

## `answers` is deliberately shapeless

`OnboardingSubmitRequest` declares `answers` as an array and nothing beneath it, which the
undeclared-field sweep reads as "no shape was declared here, so do not check the contents". The keys
are whichever fields the screen row carries, and naming them in a rule would put the sequence back
in code — the thing the schema task went out of its way to avoid.

The cost is that a typo inside `answers` is accepted at the boundary. It has to be rejected against
the screen definition being answered, by the sequencer, and `TASK-AUTH-012` owns that check.
