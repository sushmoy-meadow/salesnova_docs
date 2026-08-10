# 0055 — A 403 cannot be sold to, because there is nothing to build the offer from

- **Status:** Accepted
- **Date:** 2026-08-10
- **Task:** TASK-PERM-008
- **Relates to:** `SN-PERM-007` (constraints are server-served), `SN-PERM-012` (three walls),
  `SN-PERM-013` (specific copy), `SN-PERM-014` (frequency caps), ADR-0019 (policy objects carry
  booleans, reasons ride beside them), ADR-0038 (a wall is named by why it is shut)

## Context

Three refusals — `403` permission, `423` plan, `425` flag — look identical to the code that renders
them and must never look identical to the reader. The failure mode is one-directional and expensive:
showing an upgrade prompt to a member whose own admin restricted them reads as an insult, and it is
the single easiest mistake to make, because "locked" and "locked" are the same word.

The obvious defence is a rule — *don't render a CTA on a 403* — enforced by review. That rule has to
hold on every screen anyone writes from now on.

## Decision

**The refusal union makes the mistake unrepresentable.** A permission refusal is
`{ kind: "permission" }` and carries no feature, no tier and no price. There is nothing an upgrade
call to action could be constructed from, so a 403 that renders one is a compile error rather than a
rule somebody has to remember on the screen they are writing. The plan refusal is the only one
carrying a `LockedFeature`, and it carries `onUpgrade` as a required field — a plan wall with no way
out is a dead end, which ADR-0038 already refused for error surfaces.

**The copy generator has no argument list that produces generic copy.** `upgradeCopy` requires the
limit, the usage, the tier and the gain. "Upgrade for more features." is not a string it can return.
Every number comes from `app_constraints` plus a live count, per SN-PERM-007 — nothing in this repo
knows what any limit is, and the tier is named by the plans payload rather than typed as a literal.

**A plan that caps a feature and a plan that withholds it are different sentences.** The trigger is
a discriminant on `LockedFeature`, not a branch on the numbers. Free's export ceiling is zero, and
read as a cap that renders "You've used all 0 export rows" — false, and an argument against
upgrading rather than for it. The withheld shape says what is waiting instead.

**Showing the interstitial and recording that it was shown are one call.** `spendInterstitial` asks
and writes together, because the gap between the two is where the cap fails: two prompts mounting in
the same commit both read "not yet shown" before either writes, and the session's one interruption
gets spent twice.

**Frequency is a policy in `src/lib/`, not a habit of the components.** "One interstitial per
session" only means anything if every entry point asks the same counter; a component deciding for
itself would be right alone and wrong in aggregate. `mayInterrupt` takes the occasion and a store
and answers once.

**The two counters live in different storages because they expire differently.** The
once-per-session flag belongs in `sessionStorage` and should die with the tab. The seven-day
dismissal has to outlive it, so it is in `localStorage`, keyed per feature. Both are behind one
`PromptStore` so a test can supply neither.

**Unreadable storage counts as already shown.** Erring towards silence costs a conversion; erring
the other way interrupts on every screen the reader visits, which is exactly the funnel behaviour
SN-PERM-014 exists to prevent.

**Inline lock badges never consult the frequency machine.** They are information rather than
interruption. A badge that disappeared for seven days after a dismissal would hide the capability
the plan wall exists to advertise — the frequency rules cap the interrupting, not the informing.

## Consequences

- A screen cannot accidentally sell to a restricted member; it has to be given a plan refusal to do
  it, and a plan refusal cannot be built without real numbers.
- Every caller of the plan wall must obtain a live count before it can render one. That is the
  requirement, but it is a real cost: a screen that only knows a limit was hit cannot show the wall
  until it also knows the usage.
- The number grouping is fixed to `en`, matching the only other formatter in the repo, rather than
  to the reader's locale. `en-IN` was the first choice and was wrong: it renders the Business export
  ceiling as `1,00,000`, which reads as a typo to the SEA half of the beachhead. Following the org's
  locale is the right answer and needs an org locale to follow.
- Dismissal is "closing the modal", with no separate decline control. A reader who shut it has
  answered, and asking them to answer again in a form we find easier to record is the behaviour
  being capped.
- The permission treatment disables through a `fieldset` and states its reason in a visible
  `legend`, rather than in the tooltip SN-PERM-012 names. The tooltip was written first and does not
  work: a disabled control takes no focus and browsers suppress pointer events over it, so it opens
  for almost nobody, and `Tooltip` attaches its description to the element it wraps — the fieldset,
  not the control. A reason only a hovering mouse can reach is not a reason the reader was given.
  This is a deliberate departure from the spec's wording, in favour of what the spec's wording was
  for.
- `fieldset` disables form controls and nothing else. A link or a `role="button"` div handed to
  `LockedControl` stays clickable while the component presents it as locked. The callers are all
  ahead of us, so this is a constraint to enforce when they arrive, not a bug today.

## Alternatives

- **A `canUpgrade` boolean on one refusal type.** One type, three meanings, and the boolean is
  exactly the thing a tired author sets wrong. The union costs more characters and removes the
  question.
- **Copy templates keyed by feature.** Rejected: a template per feature is a place for a limit to be
  written down in the client, which SN-PERM-007 forbids outright.
- **A single storage for both counters.** Simpler, and wrong in both directions: a session flag in
  `localStorage` silences the product forever, and a seven-day dismissal in `sessionStorage`
  forgets by lunchtime.
