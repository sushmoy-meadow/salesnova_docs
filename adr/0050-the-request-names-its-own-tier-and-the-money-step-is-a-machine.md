# 0050 — The request names its own tier, and the money step is a machine

- **Status:** Accepted
- **Date:** 2026-08-10
- **Task:** TASK-UX-001
- **Relates to:** `SN-UX-013` (confirmation proportionate to consequence), `SN-A11Y-*` (the one
  shared live region), ADR-0044 (the live region is in the page before there is anything to say)

## Context

`SN-UX-013` is a table: reversible and small gets a toast with an undo, reversible and large gets a
dialog, irreversible and small gets a dialog that states the consequence, irreversible and large
gets type-to-confirm, and anything that spends money shows the cost first. Five rungs.

A table in a spec becomes a rule somebody has to remember, and the way it fails is not the missing
dialog. It is the dialog on everything — every action guarded the same way, until people learn to
dismiss dialogs without reading them and the one that mattered goes the same way. The money row
fails differently and worse: a cost preview is one `&&` away from being skipped, and the reader
finds out what it cost afterwards.

## Decision

**The tier vocabulary is one vocabulary.** `ConfirmationRequest["kind"]` is literally the tier
name — `confirm`, `confirm-consequence`, `type-to-confirm`, `cost-preview` — so there is no table
translating a request into a tier and therefore nothing for the two to drift apart on. `tierFor()`
maps a consequence onto the same words. `toast-undo` is the one rung with no request shape, because
it has no dialog to describe: it is raised after the fact through `toast()`, and that is the whole
of what it is.

**Every rule is asked of the tier, never re-derived from the request.** `isDestructive(tier)`
decides the red button and `needsCostPreview(tier)` decides the extra step. A component that instead
wrote `kind === "type-to-confirm" || kind === "irreversible"` would answer a sixth rung with silence
and render a primary button on something that deletes; asked of the tier, a new rung is a compile
error in one file.

**What a tier needs arrives with it.** The request union has no money variant without a `cost` and
no type-to-confirm without a `phrase`. An un-previewed purchase is a build failure rather than a
screen that renders a step short of what it promised — which is the one way this gets skipped that
no test would catch.

**The money gate is a machine, not a convention.** `useConfirmationFlow` starts a purchase on its
cost, and `confirm()` does nothing until `acknowledgeCost()` has been called. The confirm button is
not disabled at that step, it is *not in the page*. A caller who wires the confirm button straight
through gets a button that does not work — a bug they find, rather than a charge the reader finds.
The amount stays on screen at the step that spends it, because a reader who has to go back to check
the number was not shown it.

**The toast is not a dialog.** It takes no focus, traps none, steals no keystroke and locks no
scroll — the action already happened, and interrupting somebody to tell them so is the ceremony
tier one exists to avoid. Its sentence goes through the shared live region rather than a region of
its own, so it is said once. It stays five seconds, or ten while an undo is still on offer: an undo
the reader notices as it disappears is worse than no undo, because they saw that it was possible
and could not reach it. Using the undo removes the toast before running the handler, so it cannot
fire twice, and the stack holds three — a stack that grows with every archived lead ends up
covering the list being archived from.

## Consequences

- Adding a rung to the ladder is a compile error in `isDestructive`, `needsCostPreview` and
  `tierFor`, and nowhere else. Adding one to the *union* without adding it to `CONFIRMATION_TIERS`
  will not type-check at all.
- A screen cannot describe a purchase and be shown the plain confirm; the two do not have the same
  type. It also cannot choose the tier by hand — it describes the consequence and is given one.
- `request` is the identity of the interaction. It must be the same object while the reader is
  deciding: a literal built inline in the parent's render resets the typed phrase on any unrelated
  re-render. Recorded on the prop, and the reason the double-press guard is held against the
  request rather than as a flag.
- Tier one has a library and, until the first screen calls `toast()`, no producer. Wiring it into
  `useOptimisticMutation`'s success path is the obvious composition and is deliberately left until
  something needs it.
