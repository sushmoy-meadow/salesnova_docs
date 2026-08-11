# TASK-PERM-007 — open points

Both acceptance criteria are tested behaviourally and both were watched failing before the code
existed. What follows is what this repo could not settle, and what would settle it.

## 1. Nothing saves the grid, because there is no endpoint to save it to

`CapabilityGrid` is a controlled component: it takes a `GridState` and hands back the next one. No
caller exists yet, so nothing loads a member's grid, nothing persists an edit, and no optimistic
update or failure path has been written.

*Closes when* the member-update endpoint lands and the screen that owns it (TASK-TEAM-007) wires
`useOptimisticMutation` around this component. That screen also decides whether these are switches
or checkboxes — see point 6.

## 2. Selecting `OWNER` is offered as an ordinary third radio, and ownership transfer is not that

SN-PERM-004 says there is exactly one owner per organisation and that transfer "is explicit,
audit-logged, and requires re-authentication". This grid renders Owner beside Manager and Rep,
one click away, because the task asks for the three named presets as the default path. Server-side
enforcement will refuse a second owner, but the UI presents the attempt as routine.

*Closes when* the transfer flow exists: either `OWNER` leaves the selectable set here and becomes a
display-only state, or picking it routes through a confirm-and-reauthenticate step.

## 3. "A member cannot grant a capability they do not hold" is unrepresentable with these props

SN-PERM-004 requires it, and says "**Enforced server-side**, not just hidden" — which asks the UI to
hide it as well. `CapabilityGridProps` carries no actor grid, so the component has no information
with which to disable the switches the editor lacks.

*Closes when* a lib predicate (`grantableBy(actorGrid)`) and a matching prop are added, driven by
whoever builds the caller and therefore knows where the actor's own grid comes from.

## 4. The scoping arrays are absent, and one of them fails closed

SN-PERM-003 defines `accessible_subteam_ids` and `accessible_whatsapp_account_ids`. This task's
`spec_refs` deliberately exclude SN-PERM-003 and neither criterion touches it, so their absence is a
scope boundary rather than an oversight. Two consequences are real anyway:

- `accessible_whatsapp_account_ids` fails closed: empty means **no** send access, unlike every other
  scope array. `applyPreset("REP")` therefore produces a member whose grid shows "Send on WhatsApp:
  on" while the server will refuse every send. The capability's description now says so in words,
  which is the most this screen can do about it.
- `GridState` is the type the member screen will consume. Adding the two arrays later widens it and
  changes what `applyPreset` returns, so this boundary defers a breaking change rather than
  avoiding one.

*Closes when* the sub-team and WhatsApp-number pickers are built beside the grid.

## 5. Nothing parses a grid that came from the server

`CapabilityGrid` (the type) is hand-written, and every value in this task originates from
`applyPreset`, so no boundary is crossed here. The moment a server payload reaches it, a missing key
yields `undefined` at `state.capabilities[id]`, and `Switch` treats `undefined` as "uncontrolled" and
starts managing its own state — a toggle that looks live and records nothing.

*Closes when* the consuming task adds a Zod schema and a normaliser in `src/lib/permissions/` that
fills absent keys with `false` and forces `implicit` ones true.

## 6. A switch takes effect on move; these do not

The design system's own criterion is written into `switch.tsx`: "a switch takes effect the moment it
moves, where a checkbox is a choice that a submit confirms." These forty-one controls mutate
parent-held state with no save affordance in sight. If the containing screen has a Save button they
are checkboxes by that rule.

*Closes when* the containing screen exists and its save model is known. Changing the control blind
would swap one wrong announcement for another.

## 7. The owner's grid is `disabled`, which also makes it unreadable by keyboard

The read-only branch disables both fieldsets, which removes forty-one switches and three radios from
the tab order. `role="switch"` and `role="radio"` both support `aria-readonly`, which would keep the
controls focusable and announce "read only" rather than simply dimming them — closer to the truth
for a grid whose purpose is being read to learn what a role means.

*Closes when* `Switch` and `Radio` accept a read-only state. Neither does today, so honouring this
means a design-system change with its own contract test, not a prop added here.

## 8. Eight capabilities are defaulted by interpretation, not by the matrix

Section 1.4 writes its matrix by capability group. Eight capabilities are named by no row:
`leads.view_subteam`, `leads.view_duplicates`, `content.delete_others`, `content.edit_pages`,
`content.set_visibility_subteam`, `view_tracking.manage`, `whatsapp.view_all_conversations`,
`settings.manage_org`. Seven follow their group's row and land with the manager. The eighth,
`leads.view_subteam`, does not — see ADR-0058.

The server builds its own preset grids from the same table. If it reads those eight differently,
the client and the API disagree about what "Manager" means before anything is saved.

*Closes when* the API's preset builder is compared against this one, capability by capability, and
whichever is wrong is corrected. The eight above are the only rows where disagreement is possible.
