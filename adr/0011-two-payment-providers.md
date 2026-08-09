# ADR-0011 — Razorpay for India, Stripe elsewhere

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Founders

## Context

Our beachhead is India ([ADR-0001](0001-beachhead-market.md)), expanding into SEA. Indian recurring
billing is constrained by RBI mandate rules — registration, e-mandate/AutoPay flows, and pre-debit
notification before each charge.

More decisively: **UPI AutoPay is how Indian SMBs actually pay for software.** Much of our ICP does
not use a credit card for subscriptions at all. A checkout that assumes a card is a checkout most of
our market abandons.

## Decision

**Razorpay for Indian customers, Stripe for international, both behind a `PaymentProvider` port
([`F19`](../features/F19-billing.md) §SN-BILL-003). Provider selected by billing country.**

## Consequences

- UPI AutoPay is available and presented first — the highest-converting method in this market by a
  wide margin.
- GST-compliant invoicing is native rather than built by us, including the 18% that applies to
  Meta's messaging charges as imported OIDAR services.
- Stripe covers everywhere else with mature subscription primitives.
- **One subscription shape in our domain model**, regardless of provider. Privyr ships
  `user_subscription` and `user_subscription_v3` simultaneously — a migration visible in their
  public API contract. The port is what prevents that.
- We accept: two integrations, two webhook handlers, two reconciliation paths, two sets of failure
  modes to learn. This is real ongoing cost.
- Currency follows billing country and changing it requires support — an accepted limitation rather
  than a feature gap.
- Card data never touches our infrastructure under either provider; PCI scope stays at SAQ-A
  ([`F19`](../features/F19-billing.md) §SN-BILL-024).

## Alternatives

**Stripe only.** One integration. Rejected: it serves Indian recurring payments poorly, UPI AutoPay
support is not comparable, and GST invoicing becomes ours to build. This would cost us conversions
in the market we chose to win first.

**Razorpay only.** Adequate for India, weak internationally, and SEA expansion is already on the
roadmap.
