# Cutting the lanes

How work is divided between the two developers, and the procedure for re-cutting it when a domain
finishes. Written to be followed literally.

Run it when the vertical owner finishes their domain, when a demo target changes, or when either
queue has drifted far enough that `mine` no longer describes what somebody is actually doing.

## The two roles

**Vertical owner.** Takes one product domain end to end — backend, frontend, the demo-gated slices
and the QA closer — and finishes it before starting the next. This is the person whose output a
stakeholder can be shown. One domain at a time, in sequence, no exceptions: a half-built domain
demos as nothing.

**Pathfinder.** Builds the **backend only** for the domain *after* the one the vertical owner is in,
so the owner never waits on a schema or a route contract. Never takes frontend work, never takes
slices, never takes the domain currently in progress.

The split is deliberately lopsided. The owner carries roughly twice the task count because a
vertical includes every layer; the pathfinder's are larger schema-and-contract pieces.

## Why not just use `next`

`next` ranks by fan-out, which is how much live work a task releases. It is the right question once
a goal is chosen and the wrong question for choosing one. A schema is depended on by everything
above it and always scores high; a demo-gated slice is a leaf, because nothing depends on a demo,
so it always scores zero. Scheduling by fan-out alone therefore builds the stack bottom-up forever
and never produces anything showable — this project reached 73 done tasks and 0 of 98 slices
demoable that way.

So: **`demo` picks the goal, `next` orders the work inside it.** Fan-out is a tiebreaker, never a
target selector.

## Procedure

### 0. Make the backlog true before scheduling it

Scheduling a stale graph produces a starved frontier — shipped work still marked `pending` holds
its dependents shut and hides the tasks that are genuinely ready.

```bash
node salesnova_docs/tasks/cli/tasks.js progress --by track
node salesnova_docs/tasks/cli/tasks.js validate
```

Anything with shipped artifacts and an open status gets closed **against its acceptance criteria,
not its filename** — read the criteria, find the test or the artifact that satisfies each, and only
then set the status. A task whose criteria are half-met is not closeable; say so and leave it.

Do this first. Every later step reads the graph.

### 1. Pick the demo target

```bash
node salesnova_docs/tasks/cli/tasks.js demo
```

Take the nearest slices and note the tasks listed as in the way of more than one — those buy the
most per unit of work. The target is a **domain**, not a task: the owner takes all of it.

### 2. Map the domain before assigning any of it

List every live task in the domain, and trace the full transitive prerequisite chain of each — the
gating task is frequently in another domain and will not appear in a domain filter. The chain
`SET-001 → SET-002 → DESIGN-007 → LEAD-017` gated the entire lead table view from three domains
away and was invisible until it was walked.

```bash
node salesnova_docs/tasks/cli/tasks.js blocked --domain <DOMAIN>
node salesnova_docs/tasks/cli/tasks.js graph <TASK-ID>
```

Every prerequisite you find is part of the lane, whatever domain it carries.

### 3. Cut the lanes

To the **vertical owner**: every live task in the target domain — backend, frontend, slices, QA
closer — plus any out-of-domain prerequisite that is frontend or full-stack.

To the **pathfinder**: the backend of the *next* domain, plus any out-of-domain backend
prerequisite the owner's lane will need.

```bash
node salesnova_docs/tasks/cli/tasks.js claim <TASK-ID...> --as <handle>
```

### 4. Clear out-of-lane work

Anything either developer holds that is in neither lane gets released. A long queue of
out-of-sequence work is what pulls a vertical owner off the demo.

```bash
node salesnova_docs/tasks/cli/tasks.js release <TASK-ID...> --as <handle>
```

Released is **not** cancelled — it returns to the unclaimed pool. Say that plainly in the report,
because `mine` will get dramatically shorter and that reads as work being deleted.

### 5. Resolve cross-lane dependencies into an order

A pathfinder task gated by an owner task is fine, but only if the pathfinder has ready work to do
first. Check every cross-lane edge and state the starting order explicitly rather than leaving it
to be discovered.

### 6. Report

Both queues, split ready vs blocked, with the phase order for the owner and the recommended
starting three for the pathfinder. Name every cross-lane dependency. List what was released and
that it is unassigned rather than cancelled.

## Rules

- **Never hand-edit `tasks.json`.** Every change goes through `claim`, `release` or `status`.
- **Always pass `--as <handle>`.** From the workspace root there is no git config to infer from, so
  an omitted handle resolves to nobody and the command does nothing useful.
- **Do not silently undo an explicit human assignment.** If somebody assigned a task by name and it
  no longer fits the lane, leave it and flag it — reversing it quietly loses a decision.
- **Assigning is not starting.** A queue may hold two phases; the owner still works them in order.
- **Re-cut, do not top up.** When a domain finishes, run this again rather than adding tasks
  piecemeal — incremental additions drift back toward fan-out ordering.

## Recording the outcome

The lane split lives in `tasks.json` as the `owner` field and nowhere else. Commit the docs repo
with a one-line message and push, so the other developer can pull before starting:

```bash
(cd salesnova_docs && git add -A && git commit -m "chore: <what changed>" && git push origin main)
```
