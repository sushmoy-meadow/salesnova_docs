# ADR-0005 — Match price, beat on value

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Founders

## Context

Three postures were available against an established incumbent: undercut on price, match and
differentiate on capability, or price above and position as premium.

Our market is price-sensitive and our differentiator ([ADR-0004](0004-whatsapp-coexistence.md)) is
substantial rather than cosmetic.

## Decision

**Price at parity with Privyr. Compete on capability.**

## Consequences

- The sales argument is "same price, sees your conversations" — which is a clean comparison a buyer
  can evaluate in one sentence.
- We avoid a price war we would win only until the incumbent responds, and we avoid signalling that
  the product is a cheaper substitute rather than a better one.
- Margin is preserved for the infrastructure Coexistence needs — which is real: webhook ingestion at
  volume, message storage, real-time delivery.
- **Discipline required:** at parity pricing, the value difference has to be visible during the
  trial, not explained in a sales call. This is why activation targets are explicit
  ([`12`](../12-roadmap.md) §8) and why the onboarding flow is budgeted in minutes
  ([`08`](../08-ux-flows.md) flow 1).
- Free-tier design carries more weight, since it is the acquisition lever price is not
  ([OD-6](../13-open-decisions.md)).
- WhatsApp message costs are passed through at cost plus GST, shown inclusive
  ([`F13`](../features/F13-whatsapp-campaigns.md)). Marking up messaging would undercut the trust
  the whole position depends on.

## Alternatives

**Undercut significantly.** Attracts the least committed customers, invites a response from a
better-capitalised incumbent, and frames a genuinely better product as a budget option.

**Premium pricing.** Defensible on capability, but wrong for a beachhead in a price-sensitive market
where we have no brand yet. Revisit when the AI capabilities land in V2 and the gap is undeniable.
