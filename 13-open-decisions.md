---
doc: 13-open-decisions
status: LIVE
owner: Product
audience: Everyone — this is the working list
review_cadence: weekly
---

# Open Decisions

Everything not yet decided, with **who decides, what it blocks, and when it must be resolved**.

This document is **LIVE** — it is maintained, not archived. A decision leaves this list by becoming
an [ADR](adr/README.md), and the row is replaced by a link.

> A specification's quality is partly measured by how honestly it distinguishes what has been
> decided from what has not. Every item below is a real gap, stated plainly, rather than a guess
> written confidently enough to look settled.

---

## 1. Critical path

### OD-1 — WhatsApp provider: BSP or direct Meta Tech Provider ⚠️

**Decides:** Founders + Engineering lead · **Blocks:** [G3](12-roadmap.md#5-g3--the-wedge) ·
**Needed by:** before G3 starts · **Deliberately deferred** at the user's direction

|                          | BSP (AiSensy, Interakt, 360dialog, Gupshup…) | Direct Meta Tech Provider        |
| ------------------------ | -------------------------------------------- | -------------------------------- |
| Time to first message    | Weeks                                        | Months (review, approval, infra) |
| Per-message cost         | Meta + BSP markup                            | Meta only                        |
| Coexistence support      | **Varies — must be verified per provider**   | Full, first-party                |
| Control over the roadmap | Theirs                                       | Ours                             |
| Operational burden       | Low                                          | High                             |
| Margin at scale          | Compressed                                   | Ours                             |
| Switching cost later     | Real but bounded                             | —                                |

**Why deferral is safe:** the `WhatsAppChannelProvider` port
([`F12`](features/F12-whatsapp-coexistence.md) §10) is specified with 12 methods and no vendor
concepts above it. Both options implement the same interface.

**Why it cannot be deferred past G3:** onboarding UX, error-code mapping, throughput negotiation and
per-message economics all differ, and all are user-visible.

**Recommendation:** start on a BSP that demonstrably supports Coexistence today; evaluate direct
registration once monthly message volume makes the markup material. Ship the wedge first.

**To resolve it, we need:** written confirmation of Coexistence support from 2–3 candidate BSPs ·
their per-message and platform pricing for India · their webhook completeness (all four streams,
including `smb_message_echoes`) · their India data-residency position.

---

### OD-2 — Visual direction: approve or replace green/amber ⚠️

**Decides:** Founders + Design · **Blocks:** all visual design, G0 component library ·
**Needed by:** immediately

[`07-design-system.md`](07-design-system.md) §3 proposes a deep green primary with a warm amber
accent, argued from the ICP: not-blue for recall in a category where everything is blue, and amber
because it survives direct sunlight on a mid-range Android screen.

**This is a proposal, not a decision.** §4 onward is direction-independent, so engineering proceeds
either way — but every screen built before this is settled will be re-skinned.

---

### OD-3 — Re-verify Coexistence constraints ⚠️

**Decides:** Engineering · **Blocks:** [G3](12-roadmap.md#5-g3--the-wedge) · **Needed by:** before
G3 implementation begins

Not a judgement call — a verification task, listed here because it is a hard gate and easy to skip.

Every constraint in [`F12`](features/F12-whatsapp-coexistence.md) §2 **MUST** be re-checked against
Meta's current documentation: the 5 msg/sec throughput cap · the 13-day app-activity requirement ·
companion-device unlinking · what does and does not sync · history sync depth and phasing ·
country availability · rollout status · template restrictions.

Coexistence shipped in May 2025 and is still evolving. **Re-check quarterly thereafter**
([`10`](10-nfr-security-compliance.md) §SN-COMP-021).

---

### OD-4 — Legal review of DPDP, GDPR and platform policy ⚠️

**Decides:** External counsel · **Blocks:** launch ·
**Needed by:** [G5](12-roadmap.md#7-g5--hardening), engaged much earlier

[`10-nfr-security-compliance.md`](10-nfr-security-compliance.md) §5–§7 state our working
understanding. **Counsel must confirm or correct it**, and some answers change the product — notably
consent capture on lead forms, children's-data handling for education customers, breach-notification
timelines, and cross-border transfer for SEA.

Engage before G2, since lead forms are built there.

---

## 2. Product

### OD-5 — Exact price points

**Decides:** Founders · **Blocks:** [G4](12-roadmap.md#6-g4--scale--commerce) billing, pricing page ·
**Needed by:** before beta

Posture is decided — match price, beat on value ([`01`](01-market-and-positioning.md)). The numbers
are not. Needs: current Privyr INR pricing per tier · competitor scan (Kylas, Telecrm, Sell.Do,
LeadSquared at the low end) · a floor from unit economics including WhatsApp pass-through and 18%
GST.

### OD-6 — Free tier: permanent or trial-only

**Decides:** Founders · **Blocks:** [`06`](06-permissions-and-plans.md) §2 plan matrix ·
**Needed by:** before beta

Currently specified as a permanent Free tier with Coexistence and view tracking included and
`history_sync_months: 1` as the upgrade hook. That is a strong acquisition position in a
price-sensitive market and a real cost — Coexistence inbound is free from Meta, but our
infrastructure is not.

Alternative: 14-day trial only, no permanent free tier.

### OD-7 — Custom domains for white-label

**Decides:** Product + Engineering · **Blocks:** [`F15`](features/F15-agency-and-white-label.md)
scope · **Needed by:** G4

[`F15`](features/F15-agency-and-white-label.md) scopes white-label to branding on shared surfaces
and explicitly excludes full application white-label. Custom domains for the **share viewer and lead
forms** sit between the two: high perceived value to agencies, and real cost — certificate
automation, DNS verification, per-domain CSP, deliverability.

**Recommendation:** V1.5, unless agency demand in beta says otherwise.

### OD-8 — SMS as a notification channel

**Decides:** Product · **Blocks:** nothing · **Needed by:** V1.5

Excluded from V1 ([`F17`](features/F17-notifications.md)) — cost, DLT registration overhead in
India, and push plus email covering the need. Revisit if beta shows push permission rates are low
enough to break the 5-second response promise.

### OD-9 — Public API general availability

**Decides:** Product · **Blocks:** nothing in V1 · **Needed by:** V1.5

[`05`](05-api-design.md) §13 specifies the API with six non-negotiables. Whether it is
publicly documented and supported at V1 launch, or after, is open. **The design does not change
either way** — only the support commitment does.

---

## 3. Technical

### OD-10 — Hosting and managed services

**Decides:** Engineering · **Blocks:** G0 environments · **Needed by:** immediately

Cloud provider, managed Postgres, managed Redis, object storage and CDN — all specified generically
in [`09`](09-technical-architecture.md). Constraints that narrow it: an India primary region
([`09`](09-technical-architecture.md) §SN-ARCH-070), S3-compatible storage, PITR support, and a
CDN with good India and SEA presence.

### OD-11 — Second region

**Decides:** Engineering + Founders · **Blocks:** nothing in V1 · **Needed by:** on demand

Designed for, not built ([`09`](09-technical-architecture.md) §SN-ARCH-071).
`organization.region` exists from G0 so this stays additive. Triggered by a real regulatory
requirement or material SEA latency complaints — not by anticipation.

### OD-12 — LLM provider for V1 parity AI

**Decides:** Engineering · **Blocks:** [`F10`](features/F10-integrations.md) §5 email parsing ·
**Needed by:** G2

Behind `LlmProvider` ([`11`](11-ai-substrate.md) §SN-AI-030), so this is a configuration choice.
The **binding requirement** is a zero-retention, no-training API tier
([`11`](11-ai-substrate.md) §SN-AI-040) — verified contractually, not assumed.

### OD-13 — Meadow family relationship

**Decides:** Founders + Design · **Blocks:** component library setup ·
**Needed by:** with OD-2

Shared design system across the Meadow family, or a sibling with shared tokens
([`07`](07-design-system.md) §13.2)? Cheap to decide now, expensive to change after G1.

---

## 4. Brand

Parallel to engineering; none blocks G0.

| #         | Decision                                            | Owner    | Needed by                                                                 |
| --------- | --------------------------------------------------- | -------- | ------------------------------------------------------------------------- |
| **OD-14** | Logo and wordmark                                   | Design   | G1 — appears in nav, viewer, forms, emails                                |
| **OD-15** | Illustration style for empty states                 | Design   | G1 — empty states are a teaching surface ([`07`](07-design-system.md) §7) |
| **OD-16** | Dark theme in V1 or V1.5 (**recommendation: V1.5**) | Design   | Token structure decided at G0; the theme itself later                     |
| **OD-17** | Domain and trademark clearance for "SalesNova"      | Founders | Before public beta                                                        |

---

## 5. Resolved — see ADRs

| Decision              | Outcome                                   | Record                                              |
| --------------------- | ----------------------------------------- | --------------------------------------------------- |
| Beachhead market      | India + SEA                               | [ADR-0001](adr/0001-beachhead-market.md)            |
| V1 platform           | Responsive web only                       | [ADR-0002](adr/0002-responsive-web-first.md)        |
| Stack                 | Laravel 13 · Postgres · Next.js 16        | [ADR-0003](adr/0003-technology-stack.md)            |
| **WhatsApp strategy** | **Meta Coexistence**                      | [ADR-0004](adr/0004-whatsapp-coexistence.md)        |
| Pricing posture       | Match price, beat on value                | [ADR-0005](adr/0005-pricing-posture.md)             |
| V1 scope              | Full web parity with Privyr               | [ADR-0006](adr/0006-v1-full-parity.md)              |
| AI in V1              | Substrate + parity AI only                | [ADR-0007](adr/0007-ai-substrate-first.md)          |
| Application shape     | Modular monolith                          | [ADR-0008](adr/0008-modular-monolith.md)            |
| Multi-tenancy         | Shared schema, `organization_id`          | [ADR-0009](adr/0009-shared-schema-multitenancy.md)  |
| Machine log           | `event` separate from `timeline_event`    | [ADR-0010](adr/0010-separate-event-log.md)          |
| Billing rails         | Razorpay (India) + Stripe (international) | [ADR-0011](adr/0011-two-payment-providers.md)       |
| Real-time transport   | SSE, not WebSockets                       | [ADR-0012](adr/0012-sse-over-websockets.md)         |
| Public surfaces       | Separate deployment                       | [ADR-0013](adr/0013-separate-public-surface.md)     |
| Authentication        | Passwordless only                         | [ADR-0014](adr/0014-passwordless-authentication.md) |

---

## 6. How this list is worked

**Weekly review.** Every item is either progressing, blocked on a named person, or explicitly parked
with a revisit date.

**Adding an item:** anyone, at any time. A decision that is being made implicitly, by whoever writes
the code first, belongs here instead.

**Resolving an item:** write the ADR, link it in §5, remove the row. **The reasoning is the point** —
in eighteen months someone will ask why, and "it was decided in a meeting" is not an answer.
