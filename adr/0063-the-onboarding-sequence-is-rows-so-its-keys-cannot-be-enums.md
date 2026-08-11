# ADR-0063 — The onboarding sequence is rows, so its keys cannot be enums

Accepted · 2026-08-11 · @sushmoy

## Context

The onboarding sequence and the activation checklist are both specified as seed
data: the server decides which screen comes next, the client renders whatever it
is handed, and a growth experiment on the first-run experience is meant to be a
database change rather than a release on either side of the wire.

That collides with two habits this repository has otherwise held to without
argument.

The first is that every closed vocabulary is a backed string enum under
`app/Enums/{Domain}/`, cast on the model and usually pinned by a `CHECK`
constraint. Applied here it would put the list of screen keys — and the list of
activation task keys — in PHP. Adding a screen would then be a code change, a
release and a migration, which is the exact cost the data-driven design exists
to remove. The rule and the requirement cannot both hold.

The second is smaller but sharper: the checklist's dismissal needs an owner.
Nothing in the specification says whether dismissing it retires the checklist
for the person who clicked or for the whole workspace, and the two are different
products. The schema has to choose.

## Decision

**Screen keys and activation task keys are open string vocabularies.** They are
`varchar(64)` columns with a unique index and no enum, no `CHECK` constraint and
no PHP counterpart. The rows are the list. Nothing under `app/` is permitted to
name more than one of them, and a test walks the tree asserting exactly that —
one key can turn up innocently, since `industry` is also an organisations
column, but a file that knows two of them is a file holding the sequence.

The order is a `display_order` integer rather than the position of a case in an
enum, seeded in tens so a screen can be inserted between two others without
rewriting the rest.

**Dismissal belongs to the organisation.** `activation_checklist_states` carries
one row per organisation with a nullable `dismissed_at`, and the policy asks for
`settings.manage_org` before it may be set. A member who cannot configure the
workspace cannot retire its checklist for everybody else.

**No table records that a task is done.** The definitions carry the label, the
route, the call to action and an estimate, and nothing else; whether a task is
complete is asked of the thing the task is about, when the list is read. There
is no column to flip, so the checklist cannot claim a lead exists when it does
not, and the schema test asserting the absence of every plausible completion
column is what keeps it that way.

**The field *type* is the one closed set, and it is an enum.** A screen key
names something only the sequence cares about, so the client never branches on
it — it renders whatever the row describes. The type of a field is the opposite:
the client has to choose a widget, and it can only choose one it already ships.
`TEXT`, `SINGLE_SELECT` and `ACTION` are therefore a PHP enum published as a
closed set in the contract, and the seeder writes the enum's values rather than
its own copies of the strings. Adding a fourth type is a release on both sides,
which is exactly the cost that adding a screen was designed to avoid, and the
two being different is the whole point rather than an inconsistency.

## Consequences

A misspelled key now fails at read time rather than at insert time, which is the
price of the vocabulary being open. The seeders are the only writers of
definition rows in practice, and they upsert on the natural key, so re-running
them corrects copy without disturbing ids or the rows a member's progress points
at.

Deriving completion on every read costs one query per task per checklist render.
That is the deliberate trade: a stored flag would be cheaper and would drift, and
a checklist that lies about what the account contains is worse than a slow one.
Caching it is available later, and it can be invalidated by the same events that
would have flipped the flag.

Per-member dismissal, if the product ever wants it, is an added
`membership_id` and a widened unique index — but the decision here is that the
first ask should be argued rather than assumed, because a solo agent and a
twenty-seat team want opposite things from the same button.
