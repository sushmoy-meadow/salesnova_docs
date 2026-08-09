# ADR-0007 — Substrate in V1, AI features in V2

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Founders

## Context

The product's stated ambition is to become AI Native. The temptation is to ship AI features in V1,
because that is what the market rewards announcing.

But useful CRM AI is constrained by the absence of a record of what actually happened, not by model
capability ([`11`](../11-ai-substrate.md) §1). At launch we have no conversation corpus, no outcome
labels and no stage-transition history — because none of it exists until customers use the product.

## Decision

**V1 ships parity AI only** — email lead parsing, sequence drafting, message drafting.

**V1 also ships the complete data substrate**, treated as non-negotiable scope.

## Consequences

- The V1 AI surface is small and honest. Nothing ships that would be embarrassing at the demo stage.
- **Write-time capture becomes a hard V1 requirement** ([`11`](../11-ai-substrate.md) §8): the
  `event` log with correlation and causation, `first_response_at` as a timestamp stamped once,
  stage-transition history, `whatsapp_message.source`, floored view durations with NULL distinct
  from 0, verbatim `source_payload`, terminal outcomes.
- These are unrecoverable. A missing timestamp cannot be backfilled, so **no substrate item may be
  deferred under schedule pressure** — which is why it is stated as a checklist rather than a
  principle.
- V2 sequencing is driven by data readiness rather than ambition
  ([`12`](../12-roadmap.md) §9).
- Governance is settled before it is convenient to compromise: customer data is not training data
  without separate opt-in ([`11`](../11-ai-substrate.md) §SN-AI-040); AI never takes a consequential
  action unconfirmed (§SN-AI-042); the CRM works completely with AI disabled (§SN-AI-034).

## Alternatives

**Ship AI features in V1.** They would operate over empty records and produce confident, useless
output. Users try that twice and then never open the feature again — and that lesson is permanent
for the whole category, including the good V2 version.

**Defer the substrate too, and add it when building V2.** The cheapest-looking option and the most
expensive. It means launching V2 with zero history, discarding the year of conversation data that is
the entire competitive advantage.
