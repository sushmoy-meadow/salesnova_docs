# TASK-AUTH-012 — open points

## Starter message templates are not seeded

**Criterion:** "Selecting Real Estate seeds the 5 stages, 3 custom fields and 3 templates listed in
SN-AUTH-032's table."

Stages and custom fields are seeded and verified, in a Pest test and in the browser. **Templates are
not**, and could not be: there is no table to put them in. The content domain owns message templates
and its schema is `TASK-CONT-001` (G2, unclaimed), so seeding them here would mean this task
inventing the content schema on its way past — which is how two domains end up disagreeing about
what a template is.

**What closes it:** `TASK-CONT-001`, then a fourth handler tagged `onboarding.answers` living in the
content domain, implementing `App\Contracts\Identity\OnboardingAnswerHandler` for `screenKey()
=== 'industry'`. The sequencer needs no change — that is the point of the tag. The preset table for
the three templates per industry belongs beside the stages and fields in
`App\Support\Leads\IndustryPresets`, or in a content-owned equivalent if the content domain would
rather hold its own copy.

Everything else in this slice already routes through that seam, so the work is one class and its
registration in `AppServiceProvider`.
