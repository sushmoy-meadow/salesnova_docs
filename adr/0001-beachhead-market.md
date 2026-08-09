# ADR-0001 — Beachhead market: India + SEA

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Founders

## Context

SalesNova competes directly with Privyr. Privyr's strength is concentrated in India and Southeast
Asia among small sales teams — real estate, insurance, education, financial services — whose work
runs on WhatsApp and Facebook Lead Ads.

We could differentiate by geography (build the same product for an underserved market) or compete
head-on where the incumbent is strongest.

## Decision

**Beachhead is India, then Southeast Asia — Privyr's own territory.**

## Consequences

- The product must be excellent on mid-range Android over patchy 3G, in direct sunlight, one-handed.
  This drives [`07-design-system.md`](../07-design-system.md) §1 and every performance budget in
  [`10`](../10-nfr-security-compliance.md) §1.
- WhatsApp is not a channel among several. It is **the** channel, which is what makes
  [ADR-0004](0004-whatsapp-coexistence.md) decisive rather than incremental.
- Billing must handle UPI AutoPay, RBI mandate rules and GST ([ADR-0011](0011-two-payment-providers.md)).
- India DPDP compliance and an India primary region are requirements, not options.
- Price sensitivity is high; the unit economics of a free tier matter
  ([OD-6](../13-open-decisions.md)).
- We inherit an educated market. Buyers already understand the category and can compare us directly
  — which is an advantage only if we are genuinely better on the axis they care about.

## Alternatives

**A less contested geography.** Slower validation, and the WhatsApp-first behaviour that makes this
product make sense is strongest exactly where Privyr already is. Winning elsewhere would not prove
we can win here.

**Global from day one.** Diffuse. Every localisation, payment and compliance decision becomes a
committee question with no forcing constraint.
