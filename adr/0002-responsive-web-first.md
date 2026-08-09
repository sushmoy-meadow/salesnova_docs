# ADR-0002 — V1 is responsive web only

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Founders

## Context

Our users work primarily from phones. Privyr ships iOS and Android apps. The obvious inference is
that we need native apps at launch.

But the wedge ([ADR-0004](0004-whatsapp-coexistence.md)) is a server-side capability: seeing the
conversation. It is delivered by webhooks and a backend, not by a native shell.

## Decision

**V1 is responsive web only. Native iOS and Android ship in V1.5.**

## Consequences

- The wedge reaches customers months earlier. That is the entire argument.
- Mobile web **must not be a degraded desktop experience** — it is the primary surface and is
  designed first ([`07`](../07-design-system.md) §9).
- No app-store review cycle. We ship fixes the day we write them, which matters most during beta.
- We lose: native push reliability (mitigated by Web Push plus email fallback,
  [`F17`](../features/F17-notifications.md)), address-book access (mitigated by WhatsApp contact
  sync, which is better anyway), and app-store presence as a trust signal.
- Web Push on iOS requires the user to add the site to their home screen. This is a real funnel cost
  and is why email is a mandatory fallback channel, not a nice-to-have.
- Offline resilience must be deliberate ([`09`](../09-technical-architecture.md) §SN-ARCH-035) —
  queued writes surviving a reload is table stakes on a bad connection.

## Alternatives

**Native apps at launch.** Doubles the surface area at exactly the moment the product is least
validated, and delays the differentiator to build a shell around it.

**PWA marketed as an app.** Most of the cost of native positioning with a fraction of the benefit,
and iOS limitations make the promise hard to keep.
