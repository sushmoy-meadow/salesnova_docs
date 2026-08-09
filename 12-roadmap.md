---
doc: 12-roadmap
status: REVIEW
owner: Product
audience: Everyone
depends_on: [02-product-scope, 10-nfr-security-compliance]
---

# Roadmap & Delivery Plan

Six gates to V1, then V1.5 and V2. **Gates are capability checkpoints, not dates** — each has an
exit criterion that is demonstrable, and the next gate does not start until the previous one is
demonstrated.

Team size is not the constraint ([user decision](README.md)); dependency order is. This plan is
sequenced by what unblocks what, and parallelised wherever the dependency graph allows.

---

## 1. Gate map

```
G0  Foundation ────────────────────────────────────┐
     tenancy · auth · bootstrap · CI · design system │
                                                     ▼
G1  The Core Loop ─────────────────────────────────┐
     leads · fields · follow-ups · timeline · team  │
                                                    ▼
G2  Acquisition & Content ─────────────────────────┐
     integrations · forms · content · sharing       │
                                                    ▼
G3  The Wedge ─────────────────────────────────────┐   ← the differentiator
     WhatsApp Coexistence · inbox · health          │
                                                    ▼
G4  Scale & Commerce ──────────────────────────────┐
     sequences · automation · campaigns · billing   │
     · analytics · agency (security-gated)          │
                                                    ▼
G5  Hardening ─────────────────────────────────────┐
     pen test · load · a11y · legal · runbooks      │
                                                    ▼
                                              ▶ V1 LAUNCH
```

---

## 2. G0 — Foundation

**Exit criterion:** a member of two organisations can log in, switch between them, and see a
correctly-scoped empty state — with the tenant isolation suite green in CI.

| Deliverable | Spec |
|---|---|
| Repository, environments, CI pipeline | [`09`](09-technical-architecture.md) §7 |
| Postgres schema groups 1–3, partitioning, migration discipline | [`04`](04-domain-model.md) §14 |
| **Multi-tenancy: global scope, four enforcement layers, isolation test suite** | [`10`](10-nfr-security-compliance.md) §SN-SEC-003 |
| Passwordless OTP + Google SSO | [`F01`](features/F01-identity-and-onboarding.md) |
| Membership, capabilities, role presets | [`06`](06-permissions-and-plans.md) §1 |
| `/bootstrap` | [`05`](05-api-design.md) §6 |
| API envelopes, error catalogue, OpenAPI generation, typed client | [`05`](05-api-design.md) §2 |
| Horizon queues and supervisors | [`09`](09-technical-architecture.md) §SN-ARCH-011 |
| Design system foundations, component library, Storybook | [`07`](07-design-system.md) |
| Audit log, structured logging with PII redaction | [`10`](10-nfr-security-compliance.md) §SN-SEC-010 |
| **`event` log with correlation/causation** | [`11`](11-ai-substrate.md) §SN-AI-010 |

> ⚠️ **Blocked until the design direction is approved** ([`13`](13-open-decisions.md) OD-2): the
> component library's visual layer. Structure, states and behaviour proceed regardless
> ([`07`](07-design-system.md) §4 onward is direction-independent).

---

## 3. G1 — The Core Loop

**Exit criterion:** a rep can receive a manually-created lead, contact it via click-to-chat, log
what happened, set a follow-up, and complete it tomorrow from the follow-up list. A manager sees it
in the team dashboard.

This is the minimum product that is useful to one person. Everything after it multiplies this loop.

| Deliverable | Spec |
|---|---|
| Leads: entity, two list projections, detail, inline edit, bulk | [`F02`](features/F02-leads.md) |
| **`ContactActionBar` — click-to-chat, call, email** | [`07`](07-design-system.md) §6 |
| Custom fields, stages with `is_terminal`, groups | [`F03`](features/F03-custom-fields-and-groups.md) |
| Follow-ups, buckets, reminders | [`F04`](features/F04-follow-ups.md) |
| Timeline, manual logging, activity feed, SSE | [`F05`](features/F05-timeline-and-activity.md) |
| Team, invitations, sub-teams, team dashboard | [`F14`](features/F14-team-and-subteams.md) |
| Notifications: push, email, preferences, quiet hours | [`F17`](features/F17-notifications.md) |
| Settings: profile, org, personalisation | [`F18`](features/F18-settings.md) |
| Import and export | [`F20`](features/F20-import-export.md) |
| Onboarding and activation checklist | [`F01`](features/F01-identity-and-onboarding.md) §5 |

**Parallel tracks:** leads+fields | follow-ups+timeline | team+settings | notifications | import/export

---

## 4. G2 — Acquisition & Content

**Exit criterion:** a Facebook Lead Ad submission appears in the app, routed and notified, within 5
seconds — and the rep can share a brochure and get an alert when it is opened.

| Deliverable | Spec |
|---|---|
| Integration registry, connection lifecycle, health monitoring | [`F10`](features/F10-integrations.md) §1, §6 |
| **Ingestion pipeline: persist → verify → ack → process → idempotent → replayable** | [`F10`](features/F10-integrations.md) §2 |
| Facebook Lead Ads, incl. token expiry handling | [`F10`](features/F10-integrations.md) §3 |
| Remaining V1 integration set | [`F10`](features/F10-integrations.md) §4 |
| Generic webhook + AI email parsing fallback | [`F10`](features/F10-integrations.md) §5 |
| Lead forms + **public forms deployment** | [`F11`](features/F11-lead-forms.md) |
| Content: messages, files, pages, folders, labels | [`F06`](features/F06-content.md) |
| Sharing, **share viewer deployment**, tracking, alerts | [`F07`](features/F07-sharing-and-tracking.md) |
| Duplicate detection on ingest | [`F02`](features/F02-leads.md) §SN-LEAD-060 |

> The two public deployments land here. Both carry their own CSP, rate limits and performance
> budgets, and **neither may import from the CRM bundle** — enforced in CI.

---

## 5. G3 — The Wedge ⚠️

**Exit criterion:** a rep connects their existing WhatsApp Business number in under 15 minutes,
keeps using their phone exactly as before, and every message in both directions appears on the
lead's timeline within 5 seconds.

**This gate is the product.** G1 and G2 make a competent Privyr clone. G3 makes something Privyr
cannot ship without rebuilding their messaging architecture.

| Deliverable | Spec |
|---|---|
| **Provider decision resolved** ([`13`](13-open-decisions.md) OD-1) | — |
| **Re-verify every constraint in [`F12`](features/F12-whatsapp-coexistence.md) §2** | [`F12`](features/F12-whatsapp-coexistence.md) |
| `WhatsAppChannelProvider` port | [`F12`](features/F12-whatsapp-coexistence.md) §10 |
| Embedded Signup + QR onboarding, granular consent | [`F12`](features/F12-whatsapp-coexistence.md) §3 |
| Four webhook streams — **`smb_message_echoes` is the product** | [`F12`](features/F12-whatsapp-coexistence.md) §4 |
| Contact sync as reviewable import | §SN-WA-023 |
| History sync, phased, **triggering nothing** | §SN-WA-025 |
| Two send paths, service window, opt-out, 5 msg/sec queue | §5 |
| **Health monitoring and 13-day escalation — launch blocker** | §6 |
| Inbox | §7 |
| Timeline gap markers, conversation rendering | [`F05`](features/F05-timeline-and-activity.md) §SN-TL-026 |

> ⚠️ **Do not begin implementation until §2 is re-verified against Meta's current documentation.**
> Coexistence shipped in May 2025 and is still evolving. Building against a stale constraint list is
> the most expensive mistake available in this plan.
>
> **Click-to-chat from G1 remains the fallback.** Coexistence is upside, not a dependency
> ([`F12`](features/F12-whatsapp-coexistence.md) §9). If G3 slips, V1 still ships.

---

## 6. G4 — Scale & Commerce

**Exit criterion:** an org can run a costed WhatsApp campaign to a filtered segment, enrol leads in
a manual sequence, route inbound leads by rule, pay by UPI AutoPay, and see it all in analytics.

| Deliverable | Spec |
|---|---|
| Sequences, **`executor: USER \| SYSTEM`**, `/my-tasks`, break criteria | [`F08`](features/F08-sequences.md) |
| Automation rules, routing, round-robin, distribution, CAPI | [`F09`](features/F09-automation.md) |
| Templates, campaigns, **costed preview**, compliance guardrails | [`F13`](features/F13-whatsapp-campaigns.md) |
| Billing: Razorpay + Stripe behind `PaymentProvider`, GST, credits, dunning | [`F19`](features/F19-billing.md) |
| Plan enforcement, `423`/`425`, paywall UX | [`06`](06-permissions-and-plans.md) §2–3 |
| Analytics dashboards, rollups, **"The leak"** | [`F16`](features/F16-analytics.md) |
| Agency & white-label | [`F15`](features/F15-agency-and-white-label.md) |

> ⚠️ **[`F15`](features/F15-agency-and-white-label.md) impersonation requires a dedicated security
> review before merge** — consent gating, time-boxing, the audit trail, and
> `impersonator_membership_id` on every write. It is the highest-privilege code path in the product.
> If the review slips, ship G4 without agency; nothing else depends on it.

---

## 7. G5 — Hardening

**Exit criterion:** every box in [`10`](10-nfr-security-compliance.md) §10 is ticked.

Third-party penetration test · load test at 2× targets · **backup restore drill timed against
RPO/RTO** · accessibility audit across all ten flows in [`08`](08-ux-flows.md) · **legal review of
DPDP, GDPR and platform policy** · DPA, privacy policy, terms published · incident runbooks · status
page · retention jobs verified · performance budgets green in CI · PII redaction verified against
real log output.

**No feature work in G5.** A hardening gate that admits features is not a hardening gate.

---

## 8. Beta

Between G4 and launch, in two stages.

| | Who | Purpose |
|---|---|---|
| **Closed beta** | 20–30 orgs, India, real estate + insurance | Does the core loop work daily? Does Coexistence survive real phones? |
| **Open beta** | 200+ orgs, India + SEA | Load, edge cases, onboarding funnel, activation rate |

**Closed beta requires G3 complete.** Testing this product without Coexistence tests a competitor's
product, not ours.

Success signals: >55% connect WhatsApp within 7 days ([`08`](08-ux-flows.md) flow 3) · median
signup-to-first-message under 5 minutes · day-7 retention above 40% · **zero cross-tenant
incidents** · Coexistence disconnection rate under 5% monthly.

---

## 9. After V1

### V1.5 — depth in the same market

Native mobile apps (iOS + Android) · dark theme · Hindi, then Bahasa Indonesia and Vietnamese ·
public API GA with documentation · scheduled exports and reports · advanced analytics · additional
regional integrations by demand · second region if demand or regulation requires it.

> Mobile apps are V1.5, not V1, because responsive web ships the wedge months earlier. The wedge is
> what wins the market; a native shell around a product nobody has validated is not.

### V2 — AI Native

Sequenced by data readiness, not by ambition. Each needs a corpus that only accumulates after
launch ([`11`](11-ai-substrate.md) §4).

```
Conversation summary and state          ← needs ~1 month of messages
Automatic stage inference               ← needs stage history + outcomes
Reply suggestions in the rep's voice    ← needs the rep's own sent corpus
Deal risk and silence detection         ← needs timing + outcomes
Next-best-action ranking                ← needs all of the above
Objection intelligence, coaching        ← needs team-scale corpus
Natural-language query over the CRM     ← needs the event log (exists from G0)
Forecasting                             ← needs a full sales-cycle of outcomes
```

**Every one of these depends on a V1 write-time capture requirement**
([`11`](11-ai-substrate.md) §8). That checklist is the actual V2 roadmap; the list above is its
consequence.

---

## 10. Sequencing principles

1. **Tenant isolation is G0 and never revisited under deadline pressure.** Retrofitting it is not
   possible; it is architecture.
2. **The wedge before the polish.** G3 outranks any G4 feature. If something must slip, it slips
   from G4.
3. **Public surfaces ship with their security posture, not after it.** No "we'll add the CSP later".
4. **Write-time capture is never deferred** ([`11`](11-ai-substrate.md) §8). A missing timestamp is
   permanent.
5. **Every gate exits on a demonstration**, not a status report. Someone performs the exit criterion
   on a real device.
