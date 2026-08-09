# TASK-TL-004 — open points

The single acceptance criterion — "every write path in the codebase that logs an event goes through
this single service, not ad-hoc inserts" — is enforced by a rule in `tests/Unit/ArchitectureTest.php`
rather than demonstrated by callers, because there are no callers yet. That is worth stating plainly
rather than letting the green suite imply more than it proves.

---

## 1. What the criterion can and cannot mean today

No domain write path in the tree emits an event. `TASK-AI-003` is the task that instruments emission
across the core write paths, and `TASK-LEAD-*`, `TASK-FUP-*` and the WhatsApp tasks are where the
paths themselves get built. So the criterion is satisfied in the only way it can be at this point:
the rule holds now with zero offenders, and it fails the suite the first time anything outside the
timeline domain reaches the `event` table or its model.

The rule is a text scan, and its limits are the usual ones. It sees `App\Models\Timeline\Event` and
`table('event')`. It would not see a raw `DB::statement('insert into event ...')`, an alias assigned
at runtime, or a write from a package. A companion test feeds it four hand-written shapes so the
detector itself is under test rather than trusted.

## 2. Where the shape was decided without the task that owns the contract

`TASK-AI-002` defines the internal event-log write and query API contract, is still pending, and does
not depend on this task — so the two can disagree. This task chose:

- `append(AppendEventDTO): EventReferenceDTO`, one method, no update or delete to call.
- The result carries `id`, `organization_id`, `correlation_id` and `occurred_at` — enough to hang the
  next link off and nothing that would let a caller change what was written.

If AI-002 specifies something else, this is the code that moves. It is one class behind an interface,
which is most of why the interface is there.

## 3. Three questions the task left open, and the answers taken

**No ambient correlation id.** The obvious convenience is a "current chain" the writer remembers
between calls, so callers do not have to thread a reference through. That is request state living in
a singleton, which is exactly the shape Octane makes unsafe — the next request on the same worker
inherits it. The caller passes the causing event or nothing, and a chain's first event is its own
correlation.

**`origin` is a parameter, not derived from the event name.** The taxonomy pins an origin for every
category except Follow-up, which is manual or system depending on who set it. Deriving would have to
guess there, and a wrong origin is a fact the log states rather than a display bug.

**The database still does not constrain `event_name`, and the model does not either.** The column
takes any string and the enum is closed only on the way in, through the writer's signature. Casting
the column to `EventName` was tried and reversed: Laravel's enum cast calls `from()` on read as well
as write, and that raises a `ValueError`, which is an `Error` rather than an `Exception` and so
reaches no handler. During a rolling deploy a new node writes a name an old node cannot read, and
the reader fatals. Open storage plus a closed write boundary is coherent; open storage plus a strict
read cast is not.

## 3a. A defect in the schema this task found and fixed

`occurred_at` is `timestamptz(6)` but the model carried no `$dateFormat`, so Eloquent serialised it
through the framework default of `Y-m-d H:i:s` and every append silently truncated to whole seconds.
For a table whose stated purpose is establishing that this caused that, two events in the same
second were unorderable, and nothing survived from which to recover the order. Fixed by giving the
model a microsecond format, with a test that appends the two events in the reverse of the order they
happened — a truncating column leaves both timestamps equal and hands back insertion order, which is
the answer the test asserts against.

## 3b. What the review pass declined

- **A batch `appendMany`.** Several callers in the taxonomy will fan out — a campaign send, a bulk
  import — and each event is currently its own round trip. Declined because there are no callers at
  all yet and the shape of the batch belongs with the first real one. What was changed is the test
  that would have blocked it: it now asserts every public method appends, rather than that `append`
  is the only method, so adding one does not mean editing a guarantee about immutability.
- **Bypassing Eloquent with a raw insert.** Roughly 3–15% of the call is model lifecycle overhead.
  Declined: it would move the enum, json and date handling out of the casts and into the service by
  hand, on a path with no measurement behind it.
- **Dropping the `(organization_id, causation_id)` index.** One lens wanted it partial, another
  wanted it gone; the disagreement is the answer. Chains are collected by correlation in one range
  scan, so the index earns its keep only for "direct children of this event", which no read path asks
  for yet. `TASK-INFRA-007` owns index discipline and is the right place to settle it.
- **Removing the model-level refusal now that the database refuses too.** Its only consumer is its
  own test, but deleting it changes behaviour: an accidental `->delete()` would surface as a driver
  error instead of the error envelope. Kept.
- **Generalising `PushSubjectInterface` so a caller passes a subject instead of retyping
  `aggregateType`/`aggregateId`.** A real duplication — the push payload and the event log can
  disagree about a resource's type after a rename — but it is a change to another module's published
  contract, and this task is not where that gets decided.

## 4. Not built here

- **The query side.** This is the writer. Reading the log — by correlation, by aggregate, by window —
  is `TASK-AI-002`'s contract and has no implementation yet.
- **Retention.** `TASK-INFRA-007` owns partition lifecycle.
- **`timeline_event`.** `TASK-TL-002`. Every user-visible activity writes to both logs, and nothing
  here writes the human-readable one.
