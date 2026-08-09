# ADR-0026 — Provider ports are scaffolded ahead of their adapters, and carry only what can be typed

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

Six external dependencies each get a port so that no vendor SDK appears above it and the provider
stays a configuration value. The ports are needed in G0 — the WhatsApp company is undecided, the
payment rails are a G4 concern, and the LLM is deliberately swappable — but every adapter that
implements one is built in G2, G3 or G4.

That gap creates three questions the spec does not answer.

**How much of each signature to write now.** The spec sketches three of the six ports in full:
eleven methods for the WhatsApp channel, eight for payments, three for the LLM. Between them they
name around twenty payload types — `WhatsAppAccount`, `SendResult`, `Subscription`, `Money`,
`Prompt` — none of which exist, all of which belong to modules that have not been built.

**What a webhook arrives as.** Both sketches take a framework request object.

**What the binding resolves to when nothing implements the port.**

## Decision

**A port declares only the methods whose types exist today.** Where a spec sketch names a method
that needs a payload type from an unbuilt module, that method arrives with the adapter task that
owns the type. Nothing declared now contradicts the sketch — the names and intent are the spec's.

**A webhook reaches a port as a decoded payload array, not as a request object.** Ingestion persists
the raw payload before anything parses it and the parse then runs on a queue, where there is no
request to read.

**No contract may import a type the application does not own.** Not a vendor SDK, and not a
framework class either. Enforced by a test over `app/Contracts`.

**Nothing is defaulted.** Each port's driver comes from an environment variable with no fallback,
and resolving a port that names no driver throws.

**Each port gets its own resolver, not a shared one.** A shared helper carries the config lookup and
the two refusals; the `match` that names drivers stays per port, and every one of them returns null
today.

**Lead-source parsing is left out of the container.** Its implementations are selected per inbound
source rather than per deployment, so the one-driver-per-port mechanism does not fit it.

**The bindings live in their own service provider, not in `AppServiceProvider`.** `EventWriter` is
bound there because it has exactly one implementation and always will; these six are the opposite
case, and the file that holds them is the one an adapter task edits.

## Consequences

The ports are usable as type declarations immediately, which is what makes a caller written in G1
survive the adapter landing in G4. They are not usable as a complete description of a provider, and
reading one is not a substitute for the feature spec.

The refusal is deliberately loud and deliberately late — at resolve time, not at boot — so a
deployment that never touches WhatsApp does not have to name a WhatsApp provider to start.

Six near-identical resolvers is repetition that will be flagged. It is kept because each `match` is
the one place its adapter task adds an arm, and folding them together would put every port's drivers
in a file six separate pieces of work have to edit.

The rule that a contract imports nothing foreign is stricter than "no vendor SDK". It costs the
convenience of typing a port against a framework collection or request, and it buys a guarantee that
holds without anyone maintaining a list of which vendors count.
