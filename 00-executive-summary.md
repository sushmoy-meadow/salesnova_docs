---
doc: 00-executive-summary
status: REVIEW
owner: Product
audience: Executive, investor, stakeholder
reading_time: 12 minutes
---

# SalesNova — Executive Summary

## 1. In one paragraph

SalesNova is a lead-response CRM for small sales teams in India and South-East Asia. It captures
leads from Facebook, IndiaMART, WordPress and a dozen other sources within seconds, routes them to
the right rep, and gets that rep into a WhatsApp conversation faster than anything else on the
market. **V1 is a full-parity web replacement for Privyr, plus the one capability Privyr
structurally cannot deliver: the CRM can see the WhatsApp conversation.** That single difference
converts a manual filing cabinet into a system that knows what is actually happening in the
pipeline — and it costs us nothing in messaging fees to provide.

---

## 2. Why now

Privyr won a real market with a sharp insight: for a field sales rep in Mumbai or Manila, the job
is *lead arrives → WhatsApp them in under two minutes, from my own number*. Not pipeline
management. Not forecasting. Speed to first message.

Everything else about Privyr is ordinary. Its customers tolerate that because nothing else
collapses that loop as well.

But the architecture that makes Privyr fast also makes it blind. Because the rep sends from their
own phone, **the product's knowledge ends the instant the message is sent.** Privyr records the
*intent* to send — it never sees the reply, the negotiation, the objection, or the silence. Every
subsequent field in the CRM is manual data entry by a busy rep, which means in practice it is
mostly empty. Privyr sells "WhatsApp Monitoring" as a paid add-on, but it requires abandoning the
personal number for a Business API number — which destroys the very thing that made the product
work.

**Meta's Coexistence capability resolves that trade-off.** Since 2025, a single number can run the
WhatsApp Business app *and* the Cloud API simultaneously, mirrored in both directions:

- The rep keeps their number, their app, their habits. Nothing about their day changes.
- Their contact list syncs into the CRM at onboarding.
- Up to **six months of prior chat history** imports on consent.
- Every message they send from their phone mirrors into SalesNova via the `smb_message_echoes`
  webhook — including edits and deletions.
- Every inbound reply lands in the timeline automatically.

The rep gets a CRM that fills itself in. The manager gets a pipeline that reflects reality. Nobody
had to change how they work.

**And the economics are asymmetric in our favour.** Meta charges only for API-initiated template
messages. Inbound messages are free. Messages sent from the Business app are free and never open a
billable window. Replies inside the 24-hour service window are free. History and contact sync are
free. **Full conversation visibility therefore carries zero Meta cost** — our only marginal expense
is storage and compute. We can include on our free tier what Privyr sells as a premium add-on.

---

## 3. The market

**Beachhead: India and South-East Asia.** Head-on with Privyr, in the market it built for.

| | |
|---|---|
| **Primary ICP** | Solo agents and 2–20 person sales teams in real estate, insurance, education/coaching, healthcare and financial services |
| **Behavioural signature** | Buys leads from paid ads or marketplaces; sells over WhatsApp; works from a phone; response time decides the outcome |
| **Trigger to buy** | "I'm losing leads because nobody called them back" |
| **Where they are now** | Privyr, a spreadsheet, a WhatsApp Business app with 3,000 unlabelled chats, or an enterprise CRM nobody logs into |
| **Why enterprise CRM loses here** | HubSpot and Salesforce are built around email and pipeline hygiene. This market runs on WhatsApp and speed. The mismatch is structural, not a feature gap. |

Full segmentation, competitor teardown and go-to-market in
[`01-market-and-positioning.md`](01-market-and-positioning.md).

---

## 4. What V1 is

**Full web parity with Privyr, plus Coexistence.** Responsive web only; native mobile apps are
deliberately deferred.

| Pillar | Included in V1 |
|---|---|
| **Leads** | Spreadsheet and table views, custom fields, lead stage with time-in-stage, groups, polymorphic timeline, follow-ups in four buckets, duplicate detection and merge, bulk operations, CSV import/export |
| **Content** | Messages with personalisation tokens, files, block-composed landing pages, folders and labels, sequences with manual and automated steps |
| **Sharing & tracking** | Per-recipient tracked links, branded public viewer, **view tracking with dwell duration**, per-view records, owner exclusion |
| **Automation** | Lead routing rules, distribution (broadcast and round-robin), sequence enrolment, auto-follow-ups |
| **Acquisition** | Server-driven integration registry, Facebook/Instagram Lead Ads, LinkedIn, WordPress, IndiaMART, first-party lead forms, AI email lead parsing, Zapier |
| **WhatsApp** | **Coexistence** — contact sync, history import, two-way message mirroring, conversation timeline, health monitoring. Plus click-to-chat, templates and campaigns. |
| **Team** | Per-member capability grid with role presets, sub-teams, invites, team performance dashboard with first-response time |
| **Agency** | White-label branding, managed and sponsored accounts, audited impersonation |
| **Platform** | Passwordless auth, server-driven onboarding and activation, notification matrix with lead escalation, analytics, Razorpay + Stripe billing |

**Explicitly not in V1:** native iOS/Android apps, a browser extension, WhatsApp chat-assistant AI
agents, embedded third-party BI. Each is scoped and dated in
[`02-product-scope.md`](02-product-scope.md) — deferred, not dropped.

---

## 5. How we win

**1. We see the conversation; they don't.** This is not a feature we ship faster — it is a
capability Privyr's architecture forecloses. Matching it means asking their customers to give up
their personal number.

**2. We give away what they charge for.** WhatsApp monitoring, view tracking and lead distribution
are Privyr add-ons and gated tiers. Conversation sync costs us nothing in Meta fees, so it goes in
the base product. Their free tier only lets you contact *your single most recent lead* — a demo,
not a product. Ours will be genuinely usable.

**3. We fix what they shipped broken.** The recon documents ~18 real defects: non-atomic creates
that strand records, `500` responses on empty collections, form preview that only prevents
submission client-side, tracking beacons on `unload` (which does not fire reliably on the mobile
browsers their users actually have), sequential IDs that leak business volume to any recipient,
and seven third-party trackers loaded onto public lead-capture forms. Every one is specified as
fixed here.

**4. We build the V2 substrate now.** An immutable event log, a unified conversation-plus-activity
stream, lead-stage history and an embedding-ready content store are nearly free to add in V1 and
prohibitively expensive to retrofit. They are what makes an AI-native V2 possible rather than
cosmetic. See [`11-ai-substrate.md`](11-ai-substrate.md).

---

## 6. Business model

**Posture: match Privyr's price, beat decisively on value.** We are not competing on being cheap —
V2's inference costs are real, and a low anchor is very hard to raise later.

| | Free | Pro | Business |
|---|---|---|---|
| Team members | 3 | up to 20 | unlimited |
| Lead engagement | usable cap, not a teaser | unlimited | unlimited |
| **WhatsApp conversation sync** | **included** | **included** | **included** |
| View tracking with duration | included | unlimited | unlimited |
| Sub-teams, advanced analytics, white-label | — | — | included |
| Metered | — | outbound templates and campaigns at cost-plus | same, volume-tiered |

Indicative structure only — final numbers, gating and the per-limit matrix are in
[`01-market-and-positioning.md`](01-market-and-positioning.md), and Privyr's own list price needs
direct confirmation before we anchor against it (public sources disagree, quoting between
$22 and $35 per user per month).

**Billing rails:** Razorpay for India — UPI AutoPay and e-mandate are how Indian SMBs actually pay
for software, and RBI rules constrain card-based recurring billing. Stripe for international. Note
that 18% GST applies to both Meta's messaging charges and any BSP platform fee.

---

## 7. Principal risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Coexistence regional availability** — rollout is phased and country-gated | High | Confirm India/SEA eligibility with the provider *before* committing the wedge to marketing. Click-to-chat is the fallback and works everywhere on day one. |
| **The 13-day disconnect** — if the user doesn't open their Business app for 13 days, the API link drops silently | High | Proactive health monitoring, in-app and email nudges from day 7, and a one-tap reconnect. Specified in [`F12`](features/F12-whatsapp-coexistence.md). |
| **WhatsApp provider dependency** — BSP outage, rate change or policy shift | Medium | Provider-port abstraction from day one; no BSP-specific code above the port. Migration is a swap, not a rewrite. |
| **Full-parity scope is large** — ~14 service domains, ~180 endpoints | Medium | Prescriptive specs with testable acceptance criteria, heavy AI-assisted implementation, and phased release gates. |
| **Meta policy risk** — Coexistence terms could tighten | Medium | Product remains valuable without it: parity CRM plus click-to-chat is already a complete Privyr replacement. The wedge is upside, not a dependency. |
| **Privyr responds** | Low–Medium | They can add Coexistence, but it cannibalises their WhatsApp Business API add-on revenue and their Ultimate tier. Incumbents are slow to undercut themselves. |

---

## 8. What we measure

**Product (leading indicators)**

| Metric | Why it matters | Target |
|---|---|---|
| Time-to-first-message on a new lead | The entire product promise, in one number | Median < 5 min |
| Coexistence connection rate at activation | Whether the wedge actually lands | > 55% of new orgs |
| Conversations auto-captured per active rep per week | Proof the CRM is filling itself in | > 40 |
| Week-4 rep retention | Whether it survives contact with real work | > 60% |

**Business (lagging indicators)**

| Metric | Target |
|---|---|
| Free → paid conversion | > 8% within 30 days |
| Net revenue retention | > 105% |
| CAC payback | < 6 months |
| Gross margin after Meta and BSP fees | > 80% |

Instrumentation is specified alongside the features that produce these numbers — three of them
(**first-response time, time-in-stage, view duration**) can only be captured at write time and
cannot be backfilled. They are in the first migration.

---

## 9. Sequencing

Four gates. Each is a real decision point, not a status update.

| Gate | What must be true | Deliverable |
|---|---|---|
| **G1 — Foundations** | Auth, org model, permissions, leads, timeline, follow-ups working end to end | Internal dogfood |
| **G2 — The loop** | Content, tracked sharing with duration, sequences, one live lead source | Design-partner alpha |
| **G3 — The wedge** | Coexistence onboarding, sync, echo ingest, conversation timeline, health monitor | Closed beta, WhatsApp story provable |
| **G4 — Commercial** | Billing, plans, team and agency, remaining integrations, analytics | Public launch |

Dates and dependencies in [`12-roadmap.md`](12-roadmap.md). Team size is not the constraint;
specification quality and Meta/BSP onboarding lead time are.

---

## 10. The ask

Approve the scope in [`02-product-scope.md`](02-product-scope.md) and resolve the one open
strategic decision — **the WhatsApp provider path** (ride a BSP for speed, or register as a Meta
Tech Provider for margin and control of the onboarding UX). That decision does not block
engineering, because the channel layer is specified behind a provider port. It blocks the go-live
date and the unit economics.

Criteria, options and a recommendation: [`13-open-decisions.md`](13-open-decisions.md).

---

## Appendix — how "just clone Privyr" became this

We reverse-engineered Privyr thoroughly: 14 backend services, 96 routes, 180 endpoint templates,
live request and response schemas, write-path payloads, all 82 enum groups, and the complete
English i18n dictionary — effectively their functional specification in prose.

Two things fell out of that work.

**First, they have genuinely good ideas worth taking.** Dual policy objects on every record so the
UI never hardcodes permissions or paywalls. One fat bootstrap call. Server-driven onboarding and
activation, so growth changes are a data edit rather than a release. A server-declared integration
registry. `executor: USER` sequence steps — "automation" that queues a task for a human, which is
how a rep sends from their own WhatsApp. Owner-excluded view tracking, enforced at render time.
Server-defined editor vocabularies, so a new custom field appears in the form builder with no
frontend deploy. All of these are adopted here, with attribution.

**Second, the blind spot is architectural, not incidental.** No amount of feature work closes it
while the rep sends from a phone the product cannot observe. Coexistence is the only path through,
and it arrived after Privyr's architecture had already set.

That is the whole thesis: **take the parts they got right, fix the parts they shipped broken, and
build on the one thing their foundation cannot support.**
