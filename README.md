# SalesNova — Product & Engineering Specification

**The single source of truth for SalesNova V1.**

This tree is the product plan, the design brief, and the engineering contract. If something is not
written here, it is not in scope. If something here is wrong, fix it here first and then fix the code.

---

## 0. Where this sits

The specification, the decision record and the delivery backlog are all one thing across every
deployable, so they are kept in one repository rather than copied into each. Clone it beside the
code:

```
salesnova/
  salesnova_docs/       ← you are here
  salesnova_backend/    Laravel API
  salesnova_frontend/   Next.js app
```

Each code repo keeps only what is genuinely its own: `docs/tasks/RULES.md`, the architectural
constraints its builder works against, and a shim at `docs/tasks/cli/` that runs the CLI living
here. Both shims resolve the sibling path above, and `SALESNOVA_DOCS` overrides it if the checkout
sits elsewhere.

This arrangement exists because the alternative was tried. A copy of `tasks.json` in each repo drifted
23 statuses apart, which left the frontend unable to see that endpoints its screens depended on were
already built; the ADR sequences forked and two different decisions were both numbered 0016. One copy,
one sequence.

---

## 1. What SalesNova is

A lead-response CRM for small sales teams in India and South-East Asia — real estate, insurance,
education, coaching, and the long tail of businesses that buy leads from Facebook, IndiaMART and
their own websites and then chase them on WhatsApp.

**V1 is a full-parity web replacement for [Privyr](https://privyr.com), plus one thing Privyr
structurally cannot do: see the WhatsApp conversation.**

Privyr's insight — and the reason its customers tolerate a fairly ordinary CRM — is that it is the
shortest path from a Facebook Lead Ad to a WhatsApp message sent *from the rep's own number*. That
architecture is still correct for this market. But it has a permanent blind spot: once the rep taps
"send", the product goes dark. Everything after that moment is manual data entry, so the CRM
degrades into a filing cabinet.

Meta's **Coexistence** capability closes that gap. A number can run the WhatsApp Business app and
the Cloud API at the same time, mirrored both ways. The rep keeps their number and their habits;
SalesNova sees the conversation. See [`features/F12-whatsapp-coexistence.md`](features/F12-whatsapp-coexistence.md).

---

## 2. Decisions already locked

These are settled. Reopening one is a change request, not a discussion.

| Decision | Value | Where it's argued |
|---|---|---|
| Beachhead market | India + SEA — head-on with Privyr | [`01-market-and-positioning.md`](01-market-and-positioning.md) |
| V1 platform | Responsive web only (native mobile deferred) | [`02-product-scope.md`](02-product-scope.md) |
| V1 scope | Full web parity with Privyr | [`02-product-scope.md`](02-product-scope.md) |
| Differentiator | WhatsApp Coexistence | [`features/F12-whatsapp-coexistence.md`](features/F12-whatsapp-coexistence.md) |
| Pricing posture | Match Privyr's price, beat on value | [`01-market-and-positioning.md`](01-market-and-positioning.md) |
| AI in V1 | AI-ready substrate + parity AI only | [`11-ai-substrate.md`](11-ai-substrate.md) |
| Backend | Laravel 13 + PostgreSQL | [`09-technical-architecture.md`](09-technical-architecture.md) |
| Frontend | Next.js 16 | [`09-technical-architecture.md`](09-technical-architecture.md) |
| Billing rails | Razorpay (India) + Stripe (international) | [`features/F19-billing.md`](features/F19-billing.md) |
| Product name | SalesNova | — |

**Still open**, tracked with criteria and owners in [`13-open-decisions.md`](13-open-decisions.md):
the WhatsApp provider path (BSP vs. direct Meta Tech Provider) — deliberately deferred behind a
provider port so it blocks nothing but the go-live date.

---

## 3. How to read this, by role

**Executives and stakeholders** → [`00-executive-summary.md`](00-executive-summary.md), then
[`01-market-and-positioning.md`](01-market-and-positioning.md) and
[`12-roadmap.md`](12-roadmap.md). About 30 minutes.

**Product managers** → everything numbered `00`–`06`, then the feature specs for your area.

**Designers** → [`03-information-architecture.md`](03-information-architecture.md),
[`07-design-system.md`](07-design-system.md), [`08-ux-flows.md`](08-ux-flows.md), then the feature
specs — each carries its own UX requirements and state inventory.

**Engineers** → [`04-domain-model.md`](04-domain-model.md),
[`05-api-design.md`](05-api-design.md), [`06-permissions-and-plans.md`](06-permissions-and-plans.md),
[`09-technical-architecture.md`](09-technical-architecture.md), then your feature spec. Read
[`10-nfr-security-compliance.md`](10-nfr-security-compliance.md) before you touch anything
recipient-facing or anything that sends a message.

**AI coding agents** → read the feature spec end to end before writing code. Every requirement has
a stable ID and testable acceptance criteria. Do not infer behaviour that is not specified — raise
it as a gap against this tree instead.

---

## 4. The tree

### Strategy and scope
| Doc | Contents |
|---|---|
| [`00-executive-summary.md`](00-executive-summary.md) | The one-pager. Vision, wedge, scope, metrics. |
| [`01-market-and-positioning.md`](01-market-and-positioning.md) | ICP, Privyr teardown, competitive landscape, pricing and packaging. |
| [`02-product-scope.md`](02-product-scope.md) | What's in V1, what's explicitly out, phasing, release gates, success metrics. |

### Foundations — read before any feature work
| Doc | Contents |
|---|---|
| [`03-information-architecture.md`](03-information-architecture.md) | Navigation, route table, screen inventory, state conventions. |
| [`04-domain-model.md`](04-domain-model.md) | Entities, ERD, enums, invariants, indexes, migrations. |
| [`05-api-design.md`](05-api-design.md) | Conventions, envelopes, pagination, errors, auth, idempotency. |
| [`06-permissions-and-plans.md`](06-permissions-and-plans.md) | Capability grid, role presets, dual-policy computation, plan limits. |

### Features
| Doc | Area |
|---|---|
| [`features/F01-identity-and-onboarding.md`](features/F01-identity-and-onboarding.md) | Signup, passwordless auth, session, onboarding, activation |
| [`features/F02-leads.md`](features/F02-leads.md) | The core entity, lists, detail, bulk ops, duplicates |
| [`features/F03-custom-fields-and-groups.md`](features/F03-custom-fields-and-groups.md) | Typed custom fields, lead stage, groups |
| [`features/F04-follow-ups.md`](features/F04-follow-ups.md) | Next steps, buckets, auto-scheduling |
| [`features/F05-timeline-and-activity.md`](features/F05-timeline-and-activity.md) | Per-lead timeline, account feed, activity taxonomy |
| [`features/F06-content.md`](features/F06-content.md) | Messages, files, pages, page builder, folders, labels |
| [`features/F07-sharing-and-tracking.md`](features/F07-sharing-and-tracking.md) | Link minting, the public viewer, view + duration tracking |
| [`features/F08-sequences.md`](features/F08-sequences.md) | Steps, executors, delays, enrolment, break criteria |
| [`features/F09-automation.md`](features/F09-automation.md) | Lead rules, distribution, round-robin, condition builder |
| [`features/F10-integrations.md`](features/F10-integrations.md) | Registry, Facebook, WordPress, IndiaMART, email parsing, ingest pipeline |
| [`features/F11-lead-forms.md`](features/F11-lead-forms.md) | First-party hosted forms, QR, public form contract |
| [`features/F12-whatsapp-coexistence.md`](features/F12-whatsapp-coexistence.md) | **The wedge.** Onboarding, sync, echoes, health, conversation view |
| [`features/F13-whatsapp-campaigns.md`](features/F13-whatsapp-campaigns.md) | Templates, campaigns, delivery status, opt-out |
| [`features/F14-team-and-subteams.md`](features/F14-team-and-subteams.md) | Members, invites, capability grid UI, sub-teams, team dashboard |
| [`features/F15-agency-and-white-label.md`](features/F15-agency-and-white-label.md) | Agency accounts, sponsorship, impersonation, branding |
| [`features/F16-analytics.md`](features/F16-analytics.md) | Dashboards, source stats, response time, content performance |
| [`features/F17-notifications.md`](features/F17-notifications.md) | Alert matrix, digests, lead escalation |
| [`features/F18-settings.md`](features/F18-settings.md) | User and org preferences, personalisation |
| [`features/F19-billing.md`](features/F19-billing.md) | Plans, Razorpay + Stripe, metered credits, dunning |
| [`features/F20-import-export.md`](features/F20-import-export.md) | CSV import, async export, phonebook |

### Design
| Doc | Contents |
|---|---|
| [`07-design-system.md`](07-design-system.md) | Brand direction, tokens, components, responsive rules |
| [`08-ux-flows.md`](08-ux-flows.md) | Critical journeys, end to end |

### Engineering
| Doc | Contents |
|---|---|
| [`09-technical-architecture.md`](09-technical-architecture.md) | Stack, module boundaries, queues, storage, deployment |
| [`10-nfr-security-compliance.md`](10-nfr-security-compliance.md) | SLOs, threat model, DPDP/PDPA, retention |
| [`11-ai-substrate.md`](11-ai-substrate.md) | V2 foundations laid in V1; parity AI features |
| [`meadowkart_backend_architecture_bible_by_claude.md`](meadowkart_backend_architecture_bible_by_claude.md) | The company backend standard — *how* to build, where this tree says *what* |

### Planning
| Doc | Contents |
|---|---|
| [`12-roadmap.md`](12-roadmap.md) | Six gates to V1, exit criteria, beta plan, V1.5 and V2 sequencing |
| [`13-open-decisions.md`](13-open-decisions.md) | **LIVE** — unresolved choices with criteria, owners, deadlines |
| [`adr/`](adr/README.md) | The decisions already made, with the reasoning that produced them |
| [`tasks/`](tasks/README.md) | The 526-task delivery DAG and the CLI over it |

The four items on the critical path in [`13-open-decisions.md`](13-open-decisions.md) are:
**OD-1** the WhatsApp provider path, **OD-2** approval of the visual direction, **OD-3**
re-verification of the Coexistence constraints, and **OD-4** legal review of DPDP, GDPR and
platform policy. Everything else is scheduled around them.

---

## 5. Conventions

### Requirement IDs

Every normative statement carries a stable ID: `MC-<AREA>-<NNN>`.

```
SN-LEAD-012   Leads
SN-WA-004     WhatsApp
SN-SEQ-021    Sequences
```

IDs are **permanent**. If a requirement is dropped, mark it `WITHDRAWN` and leave the ID in place —
never reuse it. Tests, tickets and commit messages reference these IDs.

### Normative language

Interpreted per RFC 2119:

- **MUST** / **MUST NOT** — required. A build that violates this is broken.
- **SHOULD** / **SHOULD NOT** — strongly recommended; deviation needs a written reason in the PR.
- **MAY** — genuinely optional.

Anything not expressed in these terms is context, not a requirement.

### Acceptance criteria

Written as Given/When/Then and testable without a human judgement call:

> **AC-LEAD-012.1** — Given a lead with `is_new_lead = true` and the org preference
> `unmark_on_view = true`, when a member with `CLIENT.FULL_ACCESS` opens the lead detail,
> then `is_new_lead` becomes `false` and a `LEAD_VIEWED` event is appended to the timeline
> within 2 seconds.

### Status

Each doc carries a status in its front matter:

| Status | Meaning |
|---|---|
| `DRAFT` | Being written. Do not build from it. |
| `REVIEW` | Complete and awaiting sign-off. Safe to plan against, not to build. |
| `APPROVED` | Signed off. Build from this. |
| `SUPERSEDED` | Replaced. Header links to the replacement. |

### Traceability

Where a requirement derives from observed Privyr behaviour, it cites the source:

> Source: [`requirements/privyr/features/02-clients-leads.md §9`](../requirements/privyr/features/02-clients-leads.md)

Where we deliberately diverge, it says so and gives the reason. **"Privyr does X" is never a
justification on its own** — the recon notes are evidence, not a specification, and they document
a number of shipped defects we should not reproduce.

---

## 6. Source material

The `requirements/privyr/` tree is a reverse-engineering study of Privyr: 14 backend services, 96
routes, 180 endpoint templates, live request/response schemas, write-path contracts, all 82 enum
groups, and the complete English i18n dictionary.

**Use it as evidence, and read the warnings.** It documents roughly 18 defects in Privyr's shipped
implementation — non-atomic creates, `500`s on empty collections, client-side-only preview
enforcement, `unload` instead of `pagehide` for tracking beacons, sequential IDs leaking business
volume. Each feature spec here says explicitly which Privyr behaviours we copy and which we fix.

> ### ⚠️ PII in the source tree
>
> `requirements/privyr/screenshots/*.png` contain **live customer data** from a production Privyr
> account — real names, phone numbers, email addresses and team member details.
>
> They **MUST NOT** be reproduced in this specification, pasted into tickets, shared outside the
> team, or committed to any public repository. The exceptions — `builder-*.png`,
> `public-lead-form.png` and `viewer-*.png` — were captured on a throwaway account and are safe.
>
> No screenshot from that set is embedded anywhere in this tree, and none should be.

---

## 7. Changing this specification

1. Open a PR against this tree. Spec changes are reviewed like code.
2. If the change alters a requirement that is already `APPROVED`, note the affected requirement IDs
   in the PR description so QA and open tickets can be re-checked.
3. Material scope changes need product sign-off recorded in [`12-roadmap.md`](12-roadmap.md).
4. Architectural changes need an ADR in [`adr/`](adr/).

---

## 8. Delivery — the task DAG

This specification is the source of truth for *what* to build; [`tasks/`](tasks/README.md) is the
working backlog for *who builds it and in what order*. It turns the specs above into a
dependency-linked DAG of 525 implementable tasks across all 29 domains (AGCY, AI, ANL, ARCH, AUTH,
BILL, CAMP, CONT, DATA, DESIGN, FIELD, FORM, FUP, GROUP, HARDEN, INFRA, INTG, LEAD, NOTIF, PERM,
RULE, SEC, SEQ, SET, SHARE, TEAM, TL, UX, WA) that human developers and coding agents can pick up
row by row, each carrying `spec_refs` back into this tree. Start at
[`tasks/README.md`](tasks/README.md).

---

*Owner: Product · Last structural revision: 2026-07-27*
