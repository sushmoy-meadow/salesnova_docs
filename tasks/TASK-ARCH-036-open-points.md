# TASK-ARCH-036 — open points

Three of the four acceptance criteria are met and tested. The fourth is met in structure and needs
one thing this repository cannot produce.

## The sign-off is recorded, not given

The criterion is that the deviations are "marked approved by the team lead". ADR-0057 carries an
**Approval** line under each of the three, and each says the same thing: recorded for team-lead
sign-off, and merging the record is the approval.

That is as far as an unattended build can honestly go. Writing a name and a date under "approved by"
would manufacture the exact artefact the bible's closing sentence exists to require, and a forged
approval is worse than a missing one — it stops anybody asking.

**What would close it:** the team lead reads ADR-0057 and merges it, or replies on the pull request.
If a named countersignature is wanted in the file rather than in the history, the three Approval
lines are where it goes.

## The bible is the company's, and it is annotated in place

The pointers at Sections 4, 9 and 13 are edits to the shared checkout, which is the same copy the
other repositories read. That is deliberate — a project-local addendum would not be found by
somebody reading Section 9 — but it does mean a document owned at company level now carries a
SalesNova-specific note in four places.

The notes are pointers rather than rewrites: each says what this project does differently, why in
one clause, and where the record is. Nothing normative in the bible was changed.

**What would close it:** if the company would rather its standard stayed unannotated, the four notes
move to a `SALESNOVA-DEVIATIONS.md` beside it and the bible keeps one line at the head pointing
there. The test asserting a pointer at each of the three sections would have to move with them.

## Deviation 2 is worth raising upstream, not just recording

Section 4's worked example imports an Eloquent model across domains, which contradicts the
boundaries the same document argues for elsewhere. Recording it as a SalesNova deviation is accurate
but treats a company-standard bug as a local preference.

**What would close it:** an edit to the bible's Section 4 example so it goes through an interface,
after which this deviation stops being one and ADR-0057 §2 becomes a note that the example was
corrected. That is a conversation with whoever owns the bible, not a task on this backlog.
