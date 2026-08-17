# Open points — the pending-state sweep

Not a task's open points. This sweep had no backlog task and the CLI has no create command, so it
is filed here until whoever owns `tasks.json` gives it an id.

## What the sweep was

Every control that fires a write now reports that it is working, and refuses a second press while
it is. The primitives were never the problem — `Button`, `IconButton`, `Chip`, `ListItem` and the
form controls have shipped a correct `loading` state since the foundation tasks. The gap was the
call sites: of 43 `Button`/`IconButton` usages, 19 passed `loading`. The rest passed nothing, or
passed `disabled`, which greys a control out with no spinner and no `aria-busy` — the failure
ADR-0037 names, where a busy control reads as a broken one.

Three shapes were fixed:

- Server Components rendering `<form action={fn}>` with a bare submit and no feedback for the whole
  round trip. `useFormStatus` had zero occurrences repo-wide; a `SubmitButton` composition now reads
  the nearest enclosing form, which is what makes one row of the organisation picker spin without
  the other eleven doing the same.
- `disabled={busy}` with no `loading`.
- A boolean pending where a key belongs, so acting on one row deadened its siblings and none of them
  spun.

`src/components/pending-state.test.ts` holds the result. It is a source-text scan in the style of
`motion.test.ts`, not a parser, and its reach is stated in its own opening comment.

## Found by driving it in a browser

The unit tests all passed and the sweep still had a hole in it. Throttled to Slow 3G against a live
API, the organisation picker showed the row that was pressed waiting correctly — and left every
other row live. Pressing a second row mid-flight sent a second choice, and the reader landed in
whichever answer came back last. That is worse than a stuck button: it is the wrong organisation,
silently.

The cause was one form per row. `useFormStatus` reads the nearest enclosing form and cannot see a
sibling form waiting, so per-row forms buy per-row feedback at the cost of any coordination between
them. Both the sign-in picker and the account menu's switcher were built that way.

Both now use one form for the whole list, with the organisation carried on the button as
`name`/`value` rather than in a hidden input. The pressed row spins; the rest go `disabled` without
claiming to be working. This is the same mechanism the onboarding screen already used for its two
answers to one question, applied to a list of answers instead of a pair.

Worth keeping in mind for the next list of this shape: **a form per row is the right instinct for
feedback and the wrong one for a decision the rows share.**

The second hole was the confirmation dialog. It was taught to hold itself open and report the wait,
and the activation checklist answered it with `mutate()` — which hands back nothing. The dialog
awaited a non-promise, resolved at once and shut on the press, so the reader was returned to an
unchanged checklist with no sign anything was happening. Widening the callback to accept a promise
does nothing if the caller does not hand one over.

It now awaits, and a test that fails against `mutate()` holds it there. The other two callers were
checked: the timeline card already awaited, and the AI settings switch deliberately does not — it
moves optimistically and carries the wait on the switch itself, so a dialog lingering over it would
be reporting a wait that is already visible somewhere better.

## Left undone, deliberately

### Reads that refetch under the reader

Three controls stay live during a refetch and show stale content while they do. None of them is a
write, so none can double-charge, and each was judged not worth the churn in this pass:

- `search-palette` never reads `isFetching`, so results from the previous query stay on screen with
  nothing saying newer ones are coming.
- `table-frame` sort headers keep taking presses during the refetch a press causes.
- "Try again" on `app/error.tsx` and `shell-unavailable.tsx` stacks refreshes if pressed repeatedly.
  `app/error.tsx`'s button was converted to `Button` anyway — not for the wait, which is synchronous,
  but because it was a hand-rolled primary missing the focus ring.

**Closes with:** a pass over the read path, once someone has decided whether a refetching table
should go quiet or stay live. The two answers are both defensible and the codebase currently gives
both.

### `new-lead-dwell.tsx` discards the result of a write

`recordLeadSeen` is fired from a timer and its result is dropped. Not click-driven, so no amount of
pending state helps, but it is a write whose failure nobody hears about.

**Closes with:** a decision about whether a dwell record is worth reporting at all. If it is not,
say so at the call site — right now it reads as an oversight.

### `OfflineWriteQueue` has no consumer

No mutation routes through it, so the "a queued write shows a visible pending state" requirement is
unmet no matter what this sweep did. The queue is built and tested; nothing calls it.

**Closes with:** the first mutation to route through it, at which point the queued state needs a
surface of its own — a control that is waiting on the network is not the same as one waiting on a
server that answered.

### `filter-bar` keeps its controls live on purpose

Left alone. The decision is recorded at `activity-feed-screen.tsx:191`: the control the reader just
used must not go dead under their hands.

### `invite-dead-end.tsx` is still hand-rolled

The last of the five screens `TASK-DESIGN-004-open-points.md` listed. It is a `Link` styled as a
button — a navigation, not a write — so it needs no pending state, but it still lacks the
focus-visible ring the primitives give for free.

**Closes with:** the AUTH task that owns the invite screens, converting it to `ActionControl`.

## Decided without asking

### `SubmitButton` is not in the component inventory

It ships no story and is not registered. It is a composition over `Button`, which already owns the
six states, and the directory holds twelve other unregistered compositions on the same reasoning.
Registering it would trip the inventory/story equality assertion and force a states story that
duplicates `Button`'s.

### `useAsyncAction` takes the action at call time, not at hook time

`run(action)` rather than `useAsyncAction(action).run()`. It matches the `write(value, run)` shape
already used in the stage editor, and it keeps `run` stable without holding the action in a ref.

### It is built on `useState`, not `useTransition`

The first version used `useTransition`, which is the established idiom in five other files. A
`startTransition(async fn)` whose fn rejects never settles, so the button span forever. The test
that caught it is still there.

### A thrown write is not caught

`try`/`finally` with no `catch`: the wait ends either way, and a failure is the caller's to report.
Every action in this app answers with a result value rather than throwing, so a throw here is a bug
and should surface as one rather than be absorbed.
