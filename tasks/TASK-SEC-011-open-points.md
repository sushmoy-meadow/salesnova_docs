# TASK-SEC-011 — open points

Webhook signature verification and replay protection. Both acceptance criteria are covered by tests
in `tests/Feature/Security/`. What follows is what the task deliberately did not build, and why.

## 1. What is not here

**No recorder implementation.** `InboundWebhookRecorderInterface` has no adapter — the `inbound_event`
table is migrated by TASK-ARCH-016, which is not done. The guard is complete and tested against a
fake; the first real caller cannot resolve it until that table exists. This is the intended seam,
not an omission: building a recorder against a table that does not exist would have to be rewritten
when it does.

**No HTTP entry point.** Nothing calls the guard yet. The middleware or controller that turns a
`Request` into an `InboundWebhookDTO`, chooses the scheme for the source and returns the fast `200`
belongs to the ingestion task, which owns the queue and the route. The library is what this task
promised.

**No secret storage.** The guard takes the secret as a parameter. Where per-source secrets live —
env, the `lead_source` row, a secrets manager — is a decision for whoever wires the first provider,
and it is not one this task can make well without a second provider to compare against.

**No body-size ceiling.** `hash_hmac` over an unbounded body is a denial-of-service surface, but the
limit belongs at the web server and in the framework's request handling, above anything in this
library. Recorded here so the ingestion task does not assume it was handled below.

## 2. Decisions taken without asking

**The scheme is a parameter, not a binding.** One guard serves every provider, and each one signs
differently. A container binding would have to name a single scheme for a service that must switch
per request.

**A stale timestamp is reported only after the signature verifies.** An unauthenticated caller
otherwise learns which of its two guesses was wrong first. The cost is that a genuine delivery with
a skewed clock and a broken digest reports the digest, which is the right emphasis anyway.

**A missing or non-numeric timestamp is `STALE_TIMESTAMP`, not a separate outcome.** The scheme was
configured to expect one; a delivery without it is outside the window in the only sense that matters.
A fifth refusal case would have to be handled identically everywhere it is read.

**Deduplication is skipped when the payload names no event id.** Providers that send none are
deduplicated downstream on their own natural key. Hashing the body instead would silently collapse
two genuinely identical deliveries that the provider intended as two events.

## 3. Residual risk

`settle()` runs after the replay claim is taken. A crash between them leaves the row with no verdict
and the id claimed, so the provider's retry is refused as a duplicate while the raw payload is on
disk with `outcome` unset. The recovery is a sweep over unsettled rows, which needs the table to
exist — it belongs with TASK-ARCH-016. The far worse ordering, claiming before recording, is closed
and has a regression test.

Timing safety rests on `hash_equals` and on the digest being compared whole. That is a property of
the code, not something a test can observe on a machine with a scheduler; it is a review item on
every change to `HmacWebhookScheme`.
