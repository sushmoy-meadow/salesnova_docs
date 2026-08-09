# TASK-SEC-039 — open points

Both acceptance criteria are met and tested. What follows is what a reader of the diff would
otherwise have to reconstruct.

---

## 1. The hole this task closed, and why not the way it was expected to

`Log::build([...])` assembles a channel from an array the config file never saw. The redaction tap
is declared per channel, so an on-demand channel carried none and a call site could build itself an
unredacted sink. `TASK-ARCH-020` recorded this and expected it to need a `LogManager` override.

It does not. The framework names the channel it builds `ondemand`, and it resolves the *driver* from
the array it was handed but the *taps* from `logging.channels.ondemand` — so a channel of that name
in `config/logging.php` reaches every logger `build()` returns, including one whose array declares
`'tap' => []`.

The override was built first and then removed. It works, but it has to replace the `log` singleton,
and the `Log` facade caches whatever it resolved before that replacement lands — so the facade path
and the container path disagree, which is a worse failure than the one being fixed. The config entry
needs no framework subclass, no rebinding, and puts on-demand channels under the same mechanism as
every other channel.

## 2. What is still not covered

- **The framework's emergency logger** is constructed without taps by design, for the case where
  configuration cannot be read. Unchanged from `TASK-ARCH-020`.
- **A `Monolog\Logger` built directly**, bypassing the framework's logging entirely. Nothing in the
  tree does it and it is not a *call site* of the logger, which is what the criterion is about.

## 3. Residuals inherited from `TASK-ARCH-020`, unchanged

Three shapes of free text still reach a log line: a message body already concatenated into the
message string, an unlabelled one-time code, and a phone number split by exactly one dot with
nothing in front of it. All three are argued in full in `docs/tasks/TASK-ARCH-020-open-points.md`
§2, and all three were put to the developer and accepted there on 2026-08-05.

This task changes none of them. Criterion 1 speaks of a payload's *fields*, and every field arrives
under a key, where the permitted-key list handles it whatever the key is called — which is what
`tests/Feature/Security/PersistedLogRedactionTest.php` asserts against the bytes on disk. The three
residuals are values that arrived with no key at all.

## 4. What the criteria were read against

Criterion 1 says "the persisted log record". The append-only event table does not exist yet:
`TASK-TL-001` builds it and depends on this task, so it cannot be a precondition of it. The record
read back is the one the configured channel writes to disk, which is the only thing this repository
persists a log to today.
