# TASK-PERM-008 — open points

All three acceptance criteria are tested and green, and the two negative ones were watched failing
before they were trusted. What follows is what this repo cannot close, and what would close it.

## 1. Nothing owns the `PromptStore`, so the session cap is only enforced per call site

`spendInterstitial` makes "one interstitial per session" atomic *within* one store instance, and
`UpgradeInterstitial` defaults to `browserPromptStore()` — which reads the same `sessionStorage` key
from every instance, so in the browser the cap does hold. But nothing in `src/` hands out a single
owner, and a caller passing its own `store` prop opts out of the shared counter entirely.

Per `docs/tasks/RULES.md` client state is Zustand under `src/stores/`, which is where this belongs.

**Closes it:** a `src/stores/upgrade-prompt.ts` (or a `useUpgradePrompt` hook) that owns the one
store and makes the `store` prop a test seam rather than an interface. Deferred because it is a
store-shaped decision that wants a real second caller to design against, and there are no callers of
either component in `src/` yet.

## 2. Server-rendered, the interstitial decides "no" and the client may disagree

`UpgradeInterstitial` decides in a `useState` initializer, which runs during SSR too. `sessionStorage`
throws there, `interstitialShown()` returns `true` by design, and the server renders nothing; the
client then re-runs the initializer with real storage and may render the dialog. React recovers by
client-rendering, but it is a hydration mismatch.

The clean fix is to decide after mount — which `react-hooks/set-state-in-effect` forbids in the
obvious form, so it wants `useSyncExternalStore` over a store that exposes `subscribe`/`getSnapshot`.
That is the same refactor as point 1 and should land with it.

**Closes it:** points 1 and 2 together, as one change.

## 3. Two of the spec's four worked upgrade sentences are not expressible

`upgradeCopy` has two shapes: capped (custom fields, seats) and withheld (export). SN-PERM-013's
history-sync example — *"You're seeing 1 month of conversation history. Pro imports the full 6
months — 2,847 more messages are waiting."* — is a third shape, with two counts and a verb, and is
not implemented. Rendered through the capped shape it produces "You've used all 1 months.", which is
both false and ungrammatical.

**Closes it:** a `"partial-history"` trigger, once the history-sync feature exists to call it. Adding
the shape now would be a sentence with no caller and no live count to fill it.

## 4. "Feature pre-selected" in the plan comparison is not implemented

SN-PERM-012 says the plan CTA leads to "plan comparison, **feature pre-selected**". `PlanComparison`
is `{name, includes}` and carries no feature identity; the only thing tying the modal to the locked
feature is its heading and copy. `LockedControl`'s CTA calls `refusal.onUpgrade()` and the
destination is the caller's.

**Closes it:** the plan comparison screen — it has to exist before a feature can be pre-selected in
it. Worth a ticket against whichever task builds it, because it is a stated requirement with no code
and no test today, and this task should not read as having covered it.

## 5. The permission wall departs from the spec's "tooltip"

SN-PERM-012's treatment column says "shown disabled with a tooltip". This ships a visible `legend`
instead, because a tooltip on a disabled control opens for almost nobody — see ADR-0055. If the
spec means the tooltip literally, the spec and this disagree and the spec should be amended or this
should be changed; it should not sit as an undocumented difference.

**Closes it:** a decision on the spec text. Flagged rather than assumed.

## 6. `fieldset` does not disable everything a caller might pass

`LockedControl`'s permission branch disables via `<fieldset disabled>`, which reaches form controls
only. A `<Link>`, an `<a>`, or a `role="button"` div stays clickable while the component presents it
as locked. Every test passes a `<button>`.

**Closes it:** either a runtime guard, or a documented contract that the child is a form control —
best decided at the first real call site.
