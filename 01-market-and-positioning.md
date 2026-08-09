---
doc: 01-market-and-positioning
status: REVIEW
owner: Product
audience: Executive, product, marketing, sales
depends_on: [00-executive-summary]
---

# Market, ICP & Competitive Positioning

> **On the numbers in this document.** Competitor pricing is compiled from public listings and
> review sites in July 2026. Directory pricing for this category is unreliable — Privyr's own list
> price is quoted between $22 and $35 per user per month across sources, and their pricing page
> renders tier prices dynamically. **Every price here is marked with a confidence level, and
> anything marked `UNVERIFIED` must be confirmed directly before we anchor public positioning or
> a sales deck against it.**

---

## 1. The market we are actually in

Not "CRM". CRM is a category with a $90B incumbent and no room. We are in a narrower, better-defined
market:

> **Software that helps a small sales team respond to a purchased lead over WhatsApp, fast enough
> to win it.**

Three structural facts define it:

**Leads are bought, not earned.** The customer runs Facebook/Instagram lead ads, buys IndiaMART
enquiries, or has a WordPress form on a site that gets paid traffic. Every lead has a known cost —
typically ₹150–₹800 in India. That cost is the emotional centre of the business.

**The channel is WhatsApp, and the number is personal.** Not email. Not a call centre dialler. Not a
shared business inbox. WhatsApp, from the rep's own phone, because that is what the lead will
actually reply to and because reps take their number with them when they change jobs.

**Speed is the entire game.** Response within five minutes versus within an hour is the difference
between a conversation and a dead lead. Everything else — pipeline stages, forecasting, reporting —
is secondary to the market and is where most CRMs mistakenly start.

A product that optimises for pipeline hygiene loses here on principle, not on execution. That is why
HubSpot, Salesforce and Zoho CRM have not taken this segment despite trying.

---

## 2. Ideal customer profile

### 2.1 Primary ICP — the wedge

| Attribute | Definition |
|---|---|
| **Size** | 1–20 sales people. Sweet spot 3–10. |
| **Verticals** | Real estate (agents and brokerages, not developers), insurance agencies, education and coaching, health/wellness clinics, financial services distributors |
| **Geography** | India first, then Indonesia, Philippines, Malaysia, Singapore, UAE, Bangladesh |
| **Ad spend** | ₹25,000–₹500,000/month on lead generation |
| **Current tooling** | Privyr, or a spreadsheet, or nothing but the WhatsApp Business app |
| **Buyer** | Owner or sales head. Often the same person who runs the ads. |
| **Decision speed** | Days, not quarters. Self-serve trial → card. No procurement. |
| **Price sensitivity** | High in absolute terms, low relative to lead cost. ₹2,000/user/month is one and a half leads. |

### 2.2 The trigger

Nobody buys a CRM because they want a CRM. They buy when a specific thing goes wrong:

> *"I paid for forty leads last month and I have no idea what happened to half of them."*

Variants: a rep left and took their pipeline with them; a lead complained they were never called
back; the owner discovered the team was quoting different prices; the ad agency asked for
conversion data nobody had.

Every one of these is an **observability** failure, not a workflow failure. That is important — it
is precisely what Coexistence addresses and what Privyr cannot.

### 2.3 Secondary ICP — expansion, not launch

Marketing agencies managing lead generation for 5–50 client businesses. They need white-label,
sponsored billing and impersonation — all specified in
[`F15`](features/F15-agency-and-white-label.md) — and they are a genuine distribution channel because
they onboard many accounts at once. **Not a V1 launch target**; the product must first be good for
the end customer, or the agency has nothing to resell.

### 2.4 Explicitly not our customer

- Enterprises with a procurement process or a Salesforce contract
- B2B teams selling on email with long, multi-stakeholder cycles
- Businesses whose leads are inbound-organic rather than paid
- Anyone who needs quote-to-cash, inventory or field service
- Real-estate *developers* running 200-person call centres — that is Sell.Do's and LeadSquared's
  market and it is a different product

Saying no to these keeps the product sharp. Every one of them will ask for features that make it
worse for the primary ICP.

---

## 3. The job to be done

> *When a lead I paid for arrives, help me get into a real WhatsApp conversation with them before
> my competitor does — and then remember everything that happened, without me typing it in.*

Two clauses. Privyr does the first well and the second not at all. **The second clause is our
product.**

Decomposed into the jobs the software must actually do:

| # | Job | Where it's specified |
|---|---|---|
| 1 | Get the lead into the system within seconds of the form submit | [`F10`](features/F10-integrations.md) |
| 2 | Tell the right rep immediately, on a device they're holding | [`F17`](features/F17-notifications.md) |
| 3 | Put them one tap from a personalised WhatsApp message | [`F06`](features/F06-content.md), [`F12`](features/F12-whatsapp-coexistence.md) |
| 4 | Let them send something worth opening, and tell me if it was opened | [`F07`](features/F07-sharing-and-tracking.md) |
| 5 | Remember the conversation without anyone logging it | [`F12`](features/F12-whatsapp-coexistence.md) ⭐ |
| 6 | Make sure nobody is forgotten | [`F04`](features/F04-follow-ups.md), [`F08`](features/F08-sequences.md) |
| 7 | Show the owner what's really happening | [`F16`](features/F16-analytics.md), [`F14`](features/F14-team-and-subteams.md) |

Job 5 is the one nobody in this market currently does without forcing a number migration.

---

## 4. Competitive landscape

The market splits into three clusters that do not compete cleanly with each other — which is
precisely the gap we occupy.

### Cluster A — Mobile-first lead CRMs (per-user pricing)

Sell to the *rep*. Optimise for speed to first contact. Use the rep's own number via click-to-chat.
Weak on conversation visibility, analytics and automation depth.

| Product | Price | Confidence | Notes |
|---|---|---|---|
| **Privyr** | $25–$35/user/mo | `LOW` — sources conflict | The direct competitor. Full teardown in §5. |
| **TeleCRM** | ₹599/user/mo | `MEDIUM` | Budget option, telecalling-oriented. Reviews consistently cite WhatsApp reliability problems and shallow reporting. |

### Cluster B — WhatsApp Business inboxes (flat workspace pricing)

Sell to the *business*. Shared team inbox on a **dedicated business number**, broadcasts, chatbots.
Real WhatsApp depth, but they are messaging tools with a contact list bolted on — not CRMs. Crucially,
**they require the business to run a separate WABA number**, so the rep's personal conversations stay
invisible.

| Product | Price | Confidence | Notes |
|---|---|---|---|
| **Interakt** | ~₹999/mo | `MEDIUM` | Entry-level, India-focused |
| **AiSensy** | ~₹1,500/mo | `MEDIUM` | Broadcast/campaign oriented |
| **Wati** | ~₹2,500/mo | `MEDIUM` | The most credible multi-agent inbox in the cluster |
| **Gallabox** | ~₹7,400/mo | `LOW` | Upper end |

All are per-workspace, plus Meta conversation costs, plus 18% GST.

### Cluster C — Full CRMs (flat or enterprise pricing)

Sell to the *sales manager*. Real pipeline, reporting and automation. Heavy to adopt; WhatsApp is an
integration rather than the spine.

| Product | Price | Confidence | Notes |
|---|---|---|---|
| **Kylas** | ₹38,997/quarter, unlimited users | `MEDIUM` | Flat-rate is genuinely attractive to growing teams |
| **Zoho CRM / Bigin** | ~₹800/user/mo + WhatsApp add-on | `MEDIUM` | Combined with Wati ≈ ₹3,300/agent/mo |
| **Sell.Do**, **LeadSquared** | Custom | `HIGH` (that it's custom) | Enterprise real estate. Different market. |

### 4.1 The gap

```
                    Conversation visibility
                              ▲
                              │
   Cluster B                  │
   (Wati, AiSensy,            │        ◆ SalesNova
    Interakt)                 │          rep's own number
   business number ●          │          + full visibility
   full visibility            │
                              │
   ──────────────────────────-┼──────────────────────────▶
                              │              CRM depth
                              │
                    ● Privyr  │  ● Kylas, Zoho
                      rep's   │    CRM depth,
                      number, │    no WhatsApp spine
                      no      │
                      visibility
```

**Nobody currently offers conversation visibility on the rep's own number.** Cluster B has
visibility but demands a business number, which breaks the rep's actual workflow. Cluster A keeps
the rep's number but is blind. Coexistence is what makes the top-right quadrant reachable, and it
only became available in 2025 — after every incumbent here had already set its architecture.

---

## 5. Privyr teardown

Our direct competitor. Assessed from the reverse-engineering study in
[`requirements/privyr/`](../requirements/privyr/) plus their public pricing page.

### 5.1 What they get right

Genuinely good work that we adopt rather than reinvent:

| Strength | Our treatment |
|---|---|
| **Dual policy objects** — `access_policy` and `subscription_access_policy` on every record | Adopted. [`06`](06-permissions-and-plans.md) |
| **One fat bootstrap call** returning user + permissions + flags + limits | Adopted. [`05`](05-api-design.md) |
| **Server-driven onboarding and activation** — growth changes are data edits, not releases | Adopted. [`F01`](features/F01-identity-and-onboarding.md) |
| **Server-declared integration registry** — new integration = seed row + parser | Adopted. [`F10`](features/F10-integrations.md) |
| **`executor: USER` sequence steps** — automation that queues a human task | Adopted, and central. [`F08`](features/F08-sequences.md) |
| **Owner-excluded view tracking**, enforced at render time | Adopted, and strengthened. [`F07`](features/F07-sharing-and-tracking.md) |
| **Server-defined editor vocabularies** — form builder derives fields from the CRM schema | Adopted. [`F11`](features/F11-lead-forms.md) |
| **`423 Locked` / `425 Too Early`** for plan gating vs feature flags | Adopted. [`05`](05-api-design.md) |
| **Price-before-you-spend** — a `/preview` sibling on every bulk operation | Adopted, and made mandatory. [`05`](05-api-design.md) |

### 5.2 Their pricing, as published

| Tier | Price | Team | Key limits |
|---|---|---|---|
| **Free Forever** | $0 | up to 3 | **Engagement limited to your single most recent lead.** 10 templates, 10 groups, 10 custom fields, 2 distribution recipients, 100-row CSV export |
| **Pro** | $25–$35/user/mo `UNVERIFIED` | up to 20 | Unlimited engagement and templates, 100 groups, 25 custom fields, 50-lead bulk actions, 10,000-row export, custom branding |
| **Ultimate** | Custom, sales-led | 20+ | Sub-teams, advanced analytics, white-label apps, dedicated account manager |

**Metered on top:** $0.10 per distributed lead.
**Sold as paid add-ons even on Pro:** WhatsApp auto-responder, WhatsApp campaigns, contact import.
**WhatsApp monitoring:** contact sales.

### 5.3 Their five exploitable weaknesses

**1. The blind spot.** Structural, not fixable without breaking their own value proposition. Covered
at length in [`00`](00-executive-summary.md) §2.

**2. A free tier that is a demo, not a product.** "Contactable leads: most recent lead only" means a
free user cannot run their business for a single day. It converts by frustration. That works when
you are the only option and is a liability the moment there is an alternative.

**3. WhatsApp sold as add-ons.** Auto-responder, campaigns and monitoring are all extra, on top of
$25–35/user. For a customer whose entire business is WhatsApp, the headline price is not the real
price — and they discover this after adopting.

**4. Advanced analytics is behind a sales call.** `/analytics` renders a marketing wall with a
"book a call" CTA. Every owner wants a funnel view; making them talk to sales for it is a
monetisation choice they will resent, and a self-serve competitor wins the comparison instantly.

**5. Shipped defects a careful competitor simply doesn't have.** Documented in the recon, verbatim
from their production source:

| Defect | Consequence |
|---|---|
| Tracking beacon on `unload`, not `pagehide` | Dwell time silently lost on mobile Safari and Android Chrome — their own core audience |
| Beacon fires before the hit registers, without advancing the watermark | Duration inflates quadratically when the hit endpoint is slow |
| Globally sequential IDs returned to recipients | Two requests a day apart reveal their total share and view volume to an outsider |
| Lead form create is two non-atomic calls | A failure between them leaves a form with no QR code |
| `?preview=1` enforced client-side only | The same URL still accepts a crafted POST |
| `GET …/get-leads` returns `500` on a form with zero leads | An empty collection is not an error |
| Seven third-party trackers on public lead-capture forms | The form owner has no control; a consent liability in several jurisdictions |
| A `GET` that mutates the record | Opening a lead clears its "new" flag as a side effect of a read |
| AI sequence generation registers step-by-step from the browser | *"Keep this window open"* — closing the tab leaves a half-built sequence |

Each is specified as fixed here, in the feature doc for the relevant area.

### 5.4 What they will do about us

The realistic response is to add Coexistence themselves. It would take them a quarter or two of
engineering, and it **cannibalises their WhatsApp Business API add-on revenue and weakens the
Ultimate tier's monitoring pitch**. Incumbents are structurally slow to undercut their own
highest-margin line. We should assume they eventually do it, and make sure that by then we are
ahead on the substrate — the event log and conversation corpus that V2's intelligence needs, which
they cannot backfill.

---

## 6. Positioning

### 6.1 Statement

> **For** small sales teams in India and South-East Asia who buy leads and sell over WhatsApp,
> **SalesNova** is a lead-response CRM
> **that** keeps every conversation from every rep's own WhatsApp number inside the CRM,
> automatically.
> **Unlike** Privyr, which goes blind the moment a rep taps send, and unlike WhatsApp inbox tools,
> which make you abandon your personal number,
> **SalesNova** requires no change to how your team already works.

### 6.2 Messaging hierarchy

**Primary:** *Your team's WhatsApp conversations, finally inside your CRM. Without changing their
number.*

**Supporting:**
- Every lead, from every source, in seconds
- Know who opened your brochure — and for how long
- Nobody falls through the cracks
- Six months of chat history imported on day one

**Proof points, in order of persuasiveness:**
1. Connect in under five minutes, keep your number, see your history appear
2. Median time-to-first-message across our customers
3. Conversations auto-captured per rep per week — the number they never had

### 6.3 The demo that sells this

Connect a WhatsApp number via Coexistence live, on the call. Six months of chats populate the
timeline while the prospect watches. **That moment is the product.** Everything in
[`F12`](features/F12-whatsapp-coexistence.md) should be built so that this takes under five minutes
and cannot fail in front of a customer.

---

## 7. Pricing and packaging

### 7.1 Strategy

**Match Privyr's price. Beat them decisively on what's included.** Three reasons:

1. Undercutting sets an anchor that is very hard to raise, and V2's inference costs are real
   per-user costs.
2. Our differentiator — conversation sync — has **zero Meta cost**. Giving it away costs us
   infrastructure, not margin, and it is the single most compelling thing we have.
3. Their add-on model means their effective price is already above their headline. We can be
   cheaper *in practice* while matching *on paper*.

### 7.2 Proposed tiers

> `PROPOSED` — final numbers pending confirmation of Privyr's list price. Structure is the decision;
> the digits are a parameter.

| | **Free** | **Pro** | **Business** |
|---|---|---|---|
| **Price (India)** | ₹0 | ₹2,199/user/mo · ₹1,799 annual | ₹3,999/user/mo · ₹3,299 annual |
| **Price (intl.)** | $0 | $26/user/mo · $21 annual | $47/user/mo · $39 annual |
| **Team members** | 3 | up to 25 | unlimited |
| **Leads** | 250 total | unlimited | unlimited |
| **Fully contactable** | ✅ all 250 | ✅ | ✅ |
| **Lead sources** | unlimited | unlimited | unlimited |
| **WhatsApp conversation sync** | ✅ **1 number** | ✅ **up to 5 numbers** | ✅ **unlimited** |
| **Chat history import** | ✅ | ✅ | ✅ |
| **Content templates** | 25 | unlimited | unlimited |
| **Tracked sharing** | ✅ | ✅ | ✅ |
| **View duration stats** | ✅ | ✅ | ✅ |
| **Custom fields** | 10 | 30 | 100 |
| **Groups** | 20 | 200 | unlimited |
| **Sequences** | 1 | unlimited | unlimited |
| **Automation rules** | 1 | unlimited | unlimited |
| **Lead distribution** | — | ✅ unlimited recipients | ✅ |
| **Analytics** | basic counts | **full funnel + team dashboard** | + custom dashboards |
| **Sub-teams** | — | — | ✅ |
| **White-label / agency** | — | — | ✅ |
| **CSV export** | 500 rows | 25,000 rows | unlimited |
| **Support** | docs + community | in-app chat | priority + onboarding |

**Metered, at cost-plus, with a visible ledger:**
- Outbound WhatsApp template messages (campaigns, automated sequences, auto-responder)
- Lead distribution via WhatsApp or email

**Not metered, ever:** inbound messages, echoed messages the rep sent from their own phone, replies
inside the 24-hour service window, history and contact sync. These cost us nothing, and charging for
them would undermine the entire positioning.

### 7.3 The three deliberate breaks with Privyr

**A free tier that actually works.** 250 leads, fully contactable, with conversation sync on one
number. Someone can run a small business on it. We monetise growth, not frustration — and every
free user's tracked share links carry our branding.

**WhatsApp visibility is included at every tier.** Their premium add-on is our baseline. This is the
comparison-page line that wins deals.

**Analytics is self-serve.** The funnel view and team dashboard are in Pro, not behind a sales call.
An owner who can see their funnel on a trial converts themselves.

### 7.4 GST and payment mechanics

- **18% GST** applies in India to both Meta's messaging charges (treated as imported OIDAR
  services) and to our platform fee. Prices are displayed **exclusive** of GST for business
  customers, with GSTIN capture at checkout.
- **UPI AutoPay** via Razorpay is the primary recurring instrument for India. RBI e-mandate rules
  constrain card-based recurring billing, and UPI AutoPay is how Indian SMBs actually pay for
  software — this is not a nice-to-have.
- Annual billing is discounted ~18% and is the default presentation.

Full mechanics: [`F19`](features/F19-billing.md).

---

## 8. What pricing means for engineering

Gating decisions reach into the schema, so they are settled here and consumed there.

| Decision | Engineering consequence |
|---|---|
| Every limit is per-plan | Limits **MUST** be served from the API in an `app_constraints` object, never hardcoded in the client. [`06`](06-permissions-and-plans.md) |
| Metered outbound messaging | A credit ledger with balance, reservations and a visible transaction history. [`F19`](features/F19-billing.md) |
| Free tier has a hard lead cap | Cap enforcement at ingest, with a specified behaviour when a lead arrives over the cap — it **MUST NOT** be silently dropped |
| Conversation sync at every tier | Coexistence is **not** behind a paywall check; only *outbound API sends* are |
| Number count varies by plan | `whatsapp_account` count is a plan-constrained resource |
| Seat caps with soft upsell | Hard `max_team_members` plus a soft `upgrade_prompt_threshold`, both server-supplied |

---

## 9. Go-to-market, in brief

Full plan is out of scope for this document; the shape that the product must support:

1. **Design partners (10–15 orgs)** — recruited from Privyr's public review complaints and from
   real-estate and insurance communities. Free Business tier for 12 months in exchange for weekly
   feedback and a case study.
2. **Comparison-led SEO** — "Privyr alternative", "WhatsApp CRM for real estate India". The
   comparison page writes itself: our included column versus their add-on column.
3. **Agency channel** — after V1 stabilises. Agencies onboard many accounts at once; this is what
   [`F15`](features/F15-agency-and-white-label.md) exists for.
4. **Product-led loop** — every tracked share link and every hosted lead form a free user sends
   carries SalesNova branding, to a recipient who is exactly our ICP's peer.

**Product requirements this imposes:** self-serve signup with no sales contact, a trial that reaches
value in under ten minutes, an import path off Privyr (CSV at minimum), and a Coexistence connect
flow that survives being demoed live.

---

## 10. Risks to this positioning

| Risk | Assessment |
|---|---|
| **Coexistence isn't available in a target country** | Confirm India, Indonesia, Philippines, Malaysia, Singapore and UAE eligibility with the provider before marketing commits. Known exclusions include Nigeria and South Africa; the rollout is phased. If a market is excluded, we sell the parity product there and the wedge elsewhere. |
| **Customers don't trust us with their conversations** | Real and underrated. Requires explicit consent at connect, plain-language data handling, per-member visibility controls, and the ability to disconnect and delete. Specified in [`10`](10-nfr-security-compliance.md). |
| **"Match price" is wrong for India** | ₹2,199/user is a genuine stretch against TeleCRM at ₹599. Mitigated by a usable free tier and by anchoring against *lead cost*, not against competitor price. Monitor conversion by segment and be prepared to introduce a lower "Starter" tier rather than discount Pro. |
| **Privyr's list price is lower than we assume** | Directly undermines the pricing table. **Confirm before launch.** |
| **Cluster B moves down-market into CRM** | Wati or AiSensy adding real CRM depth is plausible. Our defence is the rep's-own-number architecture, which is a positioning choice they have already made against. |
