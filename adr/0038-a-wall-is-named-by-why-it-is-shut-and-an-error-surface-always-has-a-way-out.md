# 0038 — A wall is named by why it is shut, and an error surface always has a way out

- **Status:** Accepted
- **Date:** 2026-08-09
- **Supersedes in part:** [0037](0037-the-contract-registry-is-a-compile-error-and-the-pointer-states-are-not-props.md)
- **Task:** TASK-DESIGN-005

## Context

`TASK-DESIGN-005` built the ten layout components and the six-state data surface that
`SN-DS-040` requires, including the three denial treatments of `SN-ARCH-103` §6.1 — 403 quiet and
inline, 423 an upgrade modal comparing plans, 425 coming soon and not a failure.

Two things published in ADR-0037 did not survive contact with the implementation, and one new
decision had to be made about who owns the page while an overlay is open.

## Decision

### 1. `ErrorState` requires its retry. ADR-0037 said it was optional; that was wrong.

ADR-0037 argued: *"`ErrorState` makes its retry optional: a revoked invitation has nothing to try
again, and offering the button anyway teaches the user to distrust it."*

The example was right and the conclusion did not follow from it. A revoked invitation is not an
`ErrorState` at all — it is a page-level dead end, rendered by `InviteDeadEnd` as the whole body of
`/invite/[token]` with its own `h1`. `ErrorState` is the *data surface* error: it sits where a list
or a detail panel would have been, inside a screen that is otherwise working. Every failure of that
shape has something to try again, because something was being loaded when it failed.

Making `retry` optional therefore bought nothing real and cost the requirement: `SN-DS-043` names
four parts, and an optional fourth is one that gets left out. It is required, and the
`@ts-expect-error` test proves a caller cannot drop it.

The three cases that genuinely have no retry — permission, plan, flag — are the access walls, which
are a different component with different props.

### 2. `AccessWall` takes a semantic kind, not an HTTP status.

The first implementation took `status: 403 | 423 | 425` and looked the treatment up from it. That
put wire-protocol knowledge inside a presentational component, and it did not survive three checks:

- `api-envelope.ts` deliberately discards `response.status` and hands back a semantic `code`, so
  nothing in the repo could actually supply the prop.
- The commonest source of "coming soon" is a feature flag evaluated on the client, which has no
  status code — a screen would have had to fabricate `425` to render it.
- The status leaked outward into every screen's view-state union.

`AccessWall` now takes `kind: "permission" | "plan" | "not-yet"`. The status mapping stays in
`src/lib/design-system/data-surface-state.ts` as `accessWallKindFor`, for the data layer to call —
the layer that already owns wire concerns.

### 3. The treatment policy is the prop type, not a table beside it.

An earlier draft carried `tone`, `isError`, `offersUpgrade` and `comparesPlans` per wall in lib. The
component read none of them; it branched on whether `plans` and `onUpgrade` happened to be passed.
Two statements of one rule, and the enforcing one was the accident.

`AccessWallProps` is now a discriminated union: the `plan` member requires `plans`, `onUpgrade` and
`onClose`, and the other two members cannot be given them. A plan wall that cannot compare plans, or
that has no way out, does not compile. The policy table is deleted.

This matters beyond tidiness. Composed through `DataSurface`, the old shape produced a 423 modal
with no plan list, no upgrade button, a dead Close button and a trapped focus ring, with the page
behind it locked — the acceptance criterion passed only because the test called `AccessWall`
directly. `DataSurface` now carries `wall: AccessWallProps` whole rather than picking fields off it,
so the composed wall is the same wall a screen would have rendered by hand.

### 4. The page behind an overlay is owned by a module, not by each overlay.

`useDialogBehaviour` locks body scroll and listens for Escape. Held per instance, two stacked
overlays closing out of order left `overflow: hidden` with nothing open — the page dead until
navigation — and one Escape dismissed every open overlay at once. Both are now held in a
module-level stack: the lock is taken on the first open and released on the last close, and Escape
reaches only the top.

## Consequences

- `ErrorState` cannot be used for a dead end. That is the intent; dead ends are page-level and own
  their own markup.
- Whatever maps API failures to view state must call `accessWallKindFor`. `ApiFailure` does not
  carry a status today, so that mapper is owed alongside the first screen that renders a wall —
  recorded in `../tasks/TASK-DESIGN-005-open-points.md`.
- The wall's default copy moved out of lib into the component, as defaults a caller can override.
  Status-keyed copy could never name *which* feature is locked, which `SN-DS-034` asks for. It also
  keeps every user-facing string in a React component, where the externalisation task can reach it.
- The six state names are `degraded` and `denied`, not the spec's `partial-degraded` and
  `permission-denied`. `denied` spans permission, plan and flag; `permission-denied` names only the
  first of three. Recorded rather than silently renamed.
