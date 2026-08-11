# ADR-0047 — Causation is ambient, because a parameter gets dropped at the boundary

**Status:** Accepted
**Date:** 2026-08-10

## Context

The event log's `correlation_id` and `causation_id` are the reason it exists: without them there is a
pile of timestamped facts and no way to say that this message caused that reply which caused that
stage change. `EventWriter::append()` derives both from a reference to the causing event, which the
caller supplies.

Which means the caller has to be holding it. An inbound WhatsApp message is received by a webhook
controller, handed to a service, which queues work, which runs on a worker minutes later and changes
a lead's stage. For the chain to survive, every signature between the webhook and the stage change
has to carry a `?EventReferenceDTO $causedBy` — through code whose author has no interest in the
event log and every reason to leave the argument off a new overload.

A parameter that must be threaded through code that does not care about it is a parameter that gets
dropped, and it gets dropped hardest at the queue boundary, which is exactly the link most worth
having. The failure is silent: the chain does not break loudly, it just becomes two unrelated chains,
and nobody notices until someone tries to answer a question with the log a year later.

## Decision

**Causation is ambient.** `CausationContext::within($cause, $work)` marks a block of code as reacting
to a named event. Any `append()` inside that block which does not name its own cause inherits it, and
the correlation follows. Nothing in between has to know.

**A cause the caller names wins.** A write path that knows exactly what it is answering says so on the
DTO, and whatever is further up the stack does not re-parent it.

**The store is `Illuminate\Support\Context`, not a property on the service.** Three reasons, in order:
the queue serialises it into the job payload and restores it on the worker, which is the boundary this
decision is about; it is cleared between requests, so a reused Octane worker cannot attribute one
tenant's work to the previous request's chain; and the tree already uses it for the trace id, so this
is one mechanism rather than a second one that behaves almost the same.

**What is stored is three strings, not the DTO.** A job serialised by the running release is
unserialised by the next one. A renamed property on a serialised object fails the entire context
payload; three named keys degrade to a missing link.

**An event that names no organisation is refused.** Every other guard in the writer protects a read;
this one protects the corpus. A fact with no tenant cannot be scoped by any later reader, and no
backfill can work out whose it was.

## Consequences

A chain can now be established by code that never mentions it, which is the point and also the risk:
work that runs inside a `within()` block for unrelated reasons will inherit a cause it has nothing to
do with. The block is therefore drawn around the reaction, not around the request.

Cross-tenant inheritance is refused rather than trusted. If an ambient cause outlives one tenant's
work — which would mean something forgot to clear it — the append throws `ORG_MISMATCH` instead of
writing a chain that walks into another organisation's events.
