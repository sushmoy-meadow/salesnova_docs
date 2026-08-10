# TASK-UX-001 — open points

The confirmation-pattern component system is built and every acceptance criterion has a test behind
it. What follows is what this repo could not close, and what would close it.

## 1. Tier one has no producer

`tierFor()` returns `toast-undo` and `toast()` exists, but nothing in `src/` calls it — no screen has
been built yet that archives a lead or saves a note. The ladder's cheapest rung is a library with no
consumer, so "no confirmation for small reversible actions" is proven as a decision and not as a
behaviour anybody has seen.

**Closes when:** the first list screen with a reversible row action lands (TASK-LEAD-*), and calls
`toast({ message, undo })` from its mutation's success path. The obvious composition is an optional
`undo` on `useOptimisticMutation` — deliberately not added here, because a hook parameter with no
caller is an abstraction ahead of its use.

## 2. The request must be a stable object, and only a docstring says so

`useConfirmationFlow` treats `request` identity as the identity of the interaction: a different
object means a different action, and resets the acknowledged cost step and the typed phrase. A
caller that builds the request inline in its render (`request={{ kind: "type-to-confirm", … }}`)
therefore wipes the reader's typing on any unrelated parent re-render. The requirement is recorded
on `ConfirmationDialogProps.request`; nothing enforces it.

**Closes when:** either the first real caller confirms a `useMemo`'d or module-level request reads
naturally, or — if it does not — the reset moves onto the `open` transition, which is a boolean the
caller cannot accidentally churn. Not decided here, because with no callers there is nothing to
judge the ergonomics against.

## 3. `Toaster` adds the button chain to the root client chunk

Mounting `<Toaster />` in `src/app/providers.tsx` is the right altitude — the store is
provider-less on purpose, and `/signup` and `/invite/[token]` must be able to raise a toast. But it
puts `Button` → `button-classes` → `interactive-state` → `Spinner` into the root client chunk of
every route, and `Toaster` renders `null` on every first paint because `toasts` always starts empty.
Importing `IconButton` directly rather than `DismissButton` keeps `surface-action` and its
`next/link` out; the rest remains.

**Closes when:** a bundle budget exists to measure it against. The fix if it matters is
`dynamic(() => import(…), { ssr: false })` — safe here specifically because the sentence reaches the
reader through `Announcer`'s live region rather than through the toast, so late hydration costs
nothing that a screen reader would notice.

## 4. `max-w-md` reaches past the token layer

`toaster.tsx` sizes the toast with `max-w-md`, which resolves to Tailwind's stock
`--container-md: 28rem`. It compiles only because `globals.css` clears the colour, type, spacing,
radius and shadow namespaces but not `--container-*`. Pre-existing rather than introduced here —
`SURFACE_STATE_LAYOUT` does the same — but it is the gap the token layer exists to close.

**Closes when:** a design-system pass decides whether the container namespace gets cleared and given
project measures the way `--container-content` and `--container-sidebar` already were, or is
declared out of scope on purpose.

## 5. No visual regression coverage

The tests assert structure, roles, names, disabled states and lifetimes through jsdom. That the
toast is legible on `bg-text-primary`, that the fixed stack clears the mobile tab bar at
`bottom-64`, and that the cost panel reads as sunken inside a raised overlay are all unverified
here.

**Closes when:** the Playwright suite exists (TASK-QA-*) and takes the five tiers as fixtures.
