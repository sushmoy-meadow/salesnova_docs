# TASK-UX-002 — open points

## 1. No route follows a deep link yet, so both criteria are proved at the framework

**What is closed.** Every reason a deep link can fail produces a title, a sentence naming what the
reader was trying to open, a remedy and a way out — asserted for all eight, rendered through
`ErrorState`, and additionally through `DataSurface` as `{ kind: "error", … }` so a screen gets the
refusal without branching around its other five states. `wayOutFor` is asserted never to return `/`
for any reason, which is the "silent redirect to the dashboard" the criterion forbids. An
unrecognised error code resolves to `unexpected` rather than to nothing, so the guarantee is total
rather than a list of codes somebody remembered.

**What is not.** No route in this repo receives a deep link. The three flows that will — the
lead-arrival notification, the share-open alert and the reconnection path — are not built, so
nothing yet *calls* `refusalForCode`. The framework cannot make a page that ignores it behave.

**What would close it:** the first deep-linked route, plus a test that follows a link to a deleted
target and lands on the explanation. Until then the enforcement is a source guard over
`src/lib/routing/` that no module there reaches for `next/navigation` — a redirect from inside the
framework being the exact failure it exists to prevent. A repo-wide version of that guard would be
wrong: `src/app/signup/signup-actions.ts` redirects on purpose, and it should.

## 2. `/login` and `/settings/plan` do not exist

Two of the eight ways out point at routes that are not built. `/login` is the sign-in path the
information architecture names, and `/settings/plan` is where the plan comparison will live — but
today both are 404s, which means the sign-in refusal currently produces the dead end this task was
written to remove.

Nothing else in the repo constructs a `next=` parameter yet either, so the round-trip contract
(sign in, then land where the link pointed) has no other half.

**What would close it:** the auth screens and the plan comparison. When `/login` lands it must read
`next` and honour it; a sign-in that drops the parameter turns a working deep link into a dashboard
bounce one step later.

## 3. The plan wall names a tier only if the caller passes one

`explainRefusal` takes an optional `tier` and words the remedy around it — "The Growth plan includes
it" — falling back to a generic comparison sentence when no tier is given. Nothing supplies it yet.
The status contract says a `423` names the required tier, so it should arrive in the failure
`details`, but no endpoint this repo calls returns one and the generated client has no type for it.

**What would close it:** the first `423` from a real endpoint. The plumbing is one field; the reason
it is open is that guessing the key name now would be a schema written against nothing.

## 4. `ErrorState` pulls the whole button module into the client bundle

Not this task's code, found while reviewing it. Next's client-entry collector walks the static
server graph, so any route reaching `ErrorState` registers `Button` and `IconButton` as client
entries — through `ActionControl`, which branches on `"href" in action` at render time. Every deep
link refusal takes the `href` branch and needs only `next/link` and the class table, both already
server-safe, so roughly 9.5 KB of source ships to the browser for a surface that never presses
anything.

The fix is in the design system, not here: split the `href` renderer out of `ActionControl` into its
own module. That changes what `EmptyState`, `ErrorState` and `AccessWall` all import, which is
wider than this task and belongs with whoever owns the surface primitives.

## 5. A flaky test found and fixed in passing

`src/components/offline/announcements.test.tsx` read the live region immediately after the
indicator appeared. The sentence reaches the region through the store, one commit behind the
component that queued it, so the assertion passed or failed on timing — it failed in roughly one
full run in three. It now awaits the region. Recorded here because the failure predates this task
and would otherwise read as something this change caused.
