# ADR-0058 — A capability that narrows is not a grant, and no preset switches it on

Accepted · 2026-08-10 · @sushmoy

## Context

The capability grid is written as forty-one booleans and read as forty-one grants: true means the
member may do the thing. Section 1.4 then describes the three role presets as a matrix over
*capability groups* — "Leads — view others, unassigned: Owner ✅ Manager ✅ Rep ❌" — and eight of
the forty-one capabilities are never named by a row at all. Reading the matrix therefore means
choosing a default for those eight, and the obvious rule is "follow the group's row", which puts
each of them with the manager.

That rule is wrong for exactly one capability. `leads.view_subteam` is defined as "Narrows
`view_others` to their sub-teams only". Its truth *subtracts*. Applying the group rule set it true
for Manager and — because the owner preset is "everything true" — for Owner as well, which produced
two contradictions with the spec's own prose: 1.2 says "a manager sees everything including the
unassigned pool", and 1.4's rules say "the owner's capabilities cannot be reduced". The all-true
grid was reducing the owner.

Nothing caught it. The tests asserted that Manager's withheld set was exactly the three owner-only
capabilities and that Owner's granted set was all forty-one — both of which the bug satisfied,
because the bug *was* the reading those assertions encoded.

## Decision

A capability whose truth takes something away is marked on the capability itself, alongside the
existing mark for one that is always true, and the preset builder reads both marks before it reads
the matrix:

- `implicit` → true under every preset, and the grid may not switch it off.
- `narrowing` → false under every preset, and the grid may still switch it on by hand.

`leads.view_subteam` is the only capability carrying `narrowing` today. A member who should be
confined to their sub-teams is a `CUSTOM` role, built by hand, which is what `CUSTOM` is for.

The distinction lives on the capability rather than in the preset lists because it is a fact about
what the capability means, not about what any one role is entitled to. A preset list that had to
remember to exclude it would be a list that forgets.

## Consequences

- A fourth preset, or a change to any existing one, cannot reintroduce the bug: the mark outranks
  whatever the preset says.
- "Owner has everything" is no longer literally true of the grid, and the test that asserted it now
  asserts `CAPABILITIES.length - 1` with the reason written beside it. Anyone reading the owner row
  of section 1.4 will meet that discrepancy and needs the explanation to hand.
- The server builds its own preset grids. If it applies the group rule verbatim it will disagree
  with this client on one boolean, and the client's grid is the thing the user sees before saving.
  Reconciling that is the API's side of the same decision, recorded as an open point.
- The mark is a third state in a structure that reads as a boolean. Two flags is the limit; a third
  would mean the grid is no longer a set of booleans and should be modelled as something else.

## Alternatives

**Exclude it in each preset's list.** Three lists, each of which must remember. The manager list is
already "everything except three things"; adding a fourth exception that is not an owner-only
capability muddles what that list means, and the owner preset has no list to add it to.

**Invert the capability** so that true means "sees everything" — i.e. rename it to something
additive. That contradicts the API contract, which is already built and names the field
`leads.view_subteam` with the narrowing meaning. A client that renames a server field to make its
own defaults tidier has moved the confusion, not removed it.

**Leave it true for Manager and Owner and let the server correct it.** The screen would then show a
manager as confined to their sub-teams while the server treats them as seeing everything, which is
the failure mode the whole grid exists to prevent: the UI is where somebody decides what a role
means.
