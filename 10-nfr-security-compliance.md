---
doc: 10-nfr-security-compliance
status: REVIEW
owner: Engineering + Legal
audience: Engineering, SRE, legal counsel, enterprise buyers
legal_review: REQUIRED
depends_on: [09-technical-architecture, 06-permissions-and-plans]
---

# Non-Functional Requirements, Security & Compliance

> ⚠️ **Legal review required.** §5 (India DPDP) and §6 (GDPR) state our understanding of obligations
> as of this writing. Data-protection rules in India were still settling into force during the
> drafting period, and the notified rules govern — not this document. **Counsel MUST review §5–§7
> before launch and again before any change to data residency, retention or sub-processors.**
>
> §1–§4 and §8–§10 are engineering requirements and are not conditional on that review.

---

## 1. Performance

### SN-NFR-001 — Budgets are requirements, not aspirations

Measured at p95, on a mid-range Android device over a 3G-equivalent connection — **not on a
developer's laptop on office wifi**. That is the ICP's actual hardware and network
([`07`](07-design-system.md) §1).

| Surface | Budget |
|---|---|
| App shell first paint | < 1.5 s |
| **Lead list, 1 000 leads** | **< 800 ms** |
| Lead detail | < 500 ms |
| Search results | < 200 ms |
| Any list API endpoint | < 300 ms server time |
| `/bootstrap` | < 400 ms |
| Inline save round-trip | < 300 ms |
| **Public share viewer, full render** | **< 1.2 s** |
| **Public lead form, interactive** | **< 1.0 s** |
| Analytics dashboard | < 2 s |

### SN-NFR-002 — Bundle budgets, enforced in CI

App shell ≤ 180 KB gz · route chunk ≤ 60 KB gz · **share viewer ≤ 50 KB gz** · **lead form
≤ 40 KB gz** · **web fonts: 0 bytes**.

A pull request that exceeds a budget fails. Raising a budget is a reviewed decision with a stated
reason, not a merge-conflict resolution.

### SN-NFR-003 — Event-path latency

| Path | Budget |
|---|---|
| **Webhook received → `200` returned** | **< 200 ms** |
| **Lead ingested → notification delivered** | **< 5 s p95, < 10 s p99** |
| Inbound WhatsApp → visible in app | < 5 s |
| Content viewed → alert delivered | < 10 s |
| Rule evaluation in the ingest path | < 50 ms |

> The second row is the product. Privyr's entire value proposition is speed-to-lead; ours is the
> same promise plus visibility into what happens next. A notification that arrives in 90 seconds
> has already lost the customer the deal.

### SN-NFR-004 — Scale targets for V1

| | |
|---|---|
| Organisations | 10 000 |
| Members per org | 500 (p99: 20) |
| **Leads per org** | **500 000** |
| Timeline events per org | 5 000 000 |
| Inbound leads | 100 000 / day sustained, 10× burst |
| WhatsApp messages | 1 000 000 / day |
| Concurrent SSE connections | 20 000 |

Load testing at 2× these numbers is a launch gate. **Burst handling matters more than sustained
throughput** — a Facebook campaign going live produces a spike, and dropping that spike is
indistinguishable from being down.

### SN-NFR-005 — Degradation is graceful and honest

Under load, in this order: analytics rollups defer → bulk operations queue → exports queue →
**ingestion and sending never degrade**.

When something is degraded the UI says so. A silently stale dashboard is worse than a labelled one.

---

## 2. Availability & reliability

### SN-NFR-010 — Targets

| Surface | Target | Monthly budget |
|---|---|---|
| API | 99.9% | 43 min |
| **Webhook ingestion** | **99.95%** | 22 min |
| **Public viewer and forms** | **99.95%** | 22 min |
| Workers | 99.9% | 43 min |
| Analytics | 99.5% | 3.6 h |

### SN-NFR-011 — No lead is lost to our downtime

Meta, Razorpay and most integration partners retry failed webhook deliveries. Our ingestion
endpoint **MUST** return a non-2xx on failure so those retries happen, and **MUST NOT** return
`200` for a payload it failed to persist.

> Returning `200` on failure is the most damaging bug available in this codebase: it converts a
> recoverable outage into permanent, silent, unattributable data loss. The customer never learns the
> lead existed, and neither do we.

### SN-NFR-012 — RPO and RTO

**RPO 5 minutes** (WAL archiving) · **RTO 1 hour** for the API · **RTO 4 hours** for full service
including workers and analytics.

Verified in the monthly restore drill ([`09`](09-technical-architecture.md) §SN-ARCH-023). The drill
is timed, and the time is recorded against these numbers.

### SN-NFR-013 — Incident response

| Severity | Definition | Ack | Comms |
|---|---|---|---|
| **SEV1** | Data loss, breach, or total outage | 15 min | Status page immediately, hourly |
| SEV2 | Major feature down; ingestion or sending degraded | 30 min | Status page, 4-hourly |
| SEV3 | Minor feature degraded | 4 h | In-app if user-visible |

A public status page exists from launch. **Post-incident reviews for SEV1 and SEV2 are published to
affected customers** — blameless, factual, with what changed.

---

## 3. Security

### SN-SEC-001 — Authentication

Passwordless OTP and Google SSO only ([`F01`](features/F01-identity-and-onboarding.md)). **No
password to phish, leak, reuse or store.**

15-minute access tokens · 30-day rotating refresh tokens · **refresh-token reuse detection revokes
the family** · OTP: 6 digits, 10-minute expiry, 5 attempts, single-use, rate-limited per identifier
and per IP.

### SN-SEC-002 — Authorisation, in four layers

Per [`06`](06-permissions-and-plans.md) §1.6: route middleware → policy → **query scope** →
field-level. The query scope is the one that actually protects the data; the others are defence in
depth.

**A cross-tenant reference returns `404`, never `403`** — `403` confirms the record exists.

### SN-SEC-003 — Tenant isolation is the top-severity bug class

Any cross-tenant leak is SEV1 regardless of blast radius. Controls per
[`09`](09-technical-architecture.md) §SN-ARCH-020. The isolation test suite is a **blocking** CI
stage.

### SN-SEC-004 — Encryption

TLS 1.3 in transit, HSTS with preload · AES-256 at rest for database and object storage ·
**column-level encryption for integration credentials, OAuth tokens and WhatsApp session data**,
keyed in a managed KMS with annual rotation.

### SN-SEC-005 — Secrets

A managed secret manager. Never in code, a repository, an image, an environment file in version
control, a log line, or an error message. Secret scanning runs on every commit and blocks the merge.

**Any exposed secret is rotated immediately, before the root cause is understood.**

### SN-SEC-006 — Input validation at every boundary

Schema validation on every request body, query parameter and webhook payload. Reject unknown fields
rather than ignoring them. Parameterised queries throughout; **no string-concatenated SQL, ever**,
enforced by static analysis.

File uploads: content-type verified against actual bytes, extension allowlist, size limits at the
signing step, **served from a separate origin with `Content-Disposition: attachment` for
non-renderable types**.

### SN-SEC-007 — Output safety

React escapes by default; **any `dangerouslySetInnerHTML` requires review and a sanitiser**.
User-supplied page content is sanitised server-side against an allowlist on write, not on read.

Strict CSP on the public surface: no inline script, no `eval`, explicit source allowlist. The
authenticated app carries a CSP too, with a documented and shrinking exception list.

### SN-SEC-008 — Rate limiting is layered

| Layer | Limit |
|---|---|
| Per IP, unauthenticated | 60 req/min |
| **OTP generation** | **3 per identifier per 15 min, 10 per IP per hour** |
| Per membership, authenticated | 600 req/min |
| **Public lead form submit** | **5 per IP per minute + Turnstile** |
| **Share viewer tracking** | **1 report per 10 s per session** |
| Bulk operations | 10 per member per hour |
| Exports | 1 per member per hour, 3 per org per hour |
| Public API | Per-plan, published in headers |

### SN-SEC-009 — Webhook security

Signature verification before anything else · replay protection via a timestamp window and event-id
dedup · **an unverified payload is persisted and rejected, not processed** (kept for debugging, and
because a spike of them is itself a signal).

### SN-SEC-010 — Audit logging

Every write records actor, action, target, before/after, IP, user agent, timestamp — and
`impersonator_membership_id` where applicable ([`F15`](features/F15-agency-and-white-label.md) §3).

**Append-only. Not editable or deletable through any interface, including admin.** Retained 2 years.
Owner-visible in settings.

Always audited: permission changes · exports · impersonation · integration connect/disconnect ·
billing changes · deletions · settings changes · login from a new device.

### SN-SEC-011 — Bulk export is the exfiltration path

Rate-limited, audited, owner-notified above threshold ([`F20`](features/F20-import-export.md) §2).
We cannot prevent a rep with legitimate access from exporting their leads. We can make it
**immediately visible and permanently recorded**, which is the achievable control.

### SN-SEC-012 — Dependencies and supply chain

Automated vulnerability scanning on every build · criticals patched within 48 h, highs within 7 days
· lockfiles committed · dependency additions reviewed · **an SBOM generated per release**.

### SN-SEC-013 — Penetration testing

Third-party test before launch and annually thereafter, plus after any change to the authentication
or authorisation model. Criticals and highs remediated before launch.

### SN-SEC-014 — Vulnerability disclosure

A published `security.txt` and disclosure policy from day one. Acknowledge within 48 h. Do not
threaten researchers.

### SN-SEC-015 — The public surface is a separate threat model

The share viewer and lead forms are unauthenticated, indexed, linked from WhatsApp and SMS, and
opened by people who are not our users.

Therefore: separate deployment, no CRM code, no third-party scripts, strict CSP, no authenticated
API access, own rate limits, and **opaque non-sequential identifiers**.

> Privyr leaks a globally sequential `hitcountPK` of 6,749,871 and `hit_id` of 3,829,825 to every
> link recipient. That publishes their platform volume and growth rate to anyone who opens two links
> a week apart. Ours are opaque and scoped.

---

## 4. Privacy by design

### SN-PRIV-001 — Collect only what the product needs

No behavioural profiling of our users. No third-party analytics on the public surface. No selling,
sharing or enriching customer data. **Customer data is never used to train models without explicit,
separately-obtained opt-in consent** ([`11`](11-ai-substrate.md)).

### SN-PRIV-002 — PII never reaches logs

Redaction at the logger, not the call site — phone numbers, emails, names, message bodies, OTP
codes, tokens. A rule that depends on every developer remembering is a rule that fails.

### SN-PRIV-003 — PII never reaches notification payloads

Push notifications carry a reference, not content ([`F17`](features/F17-notifications.md)). Push
payloads traverse Google and Apple infrastructure and appear on lock screens.

### SN-PRIV-004 — Retention is defined and enforced

| Data | Retention |
|---|---|
| Leads and activity | Life of account + 90 days |
| **Raw webhook payloads** | **90 days** |
| **Raw parsed emails** | **90 days** |
| WhatsApp message content | Life of account |
| Audit log | 2 years |
| **Access logs** | **90 days** |
| Export files | 24 hours |
| Import files | 7 days |
| Deleted-account data | 30-day grace, then purged (backups ≤35 days) |
| Invoices | 8 years (Indian statutory) |

Enforced by scheduled jobs, monitored. **A retention policy nobody runs is a liability, not a
policy.**

### SN-PRIV-005 — Two data roles, and we are usually the processor

For our **customers' data** (their leads, their conversations) we are a **processor / data
fiduciary acting on instruction**. Our customer decides purpose and means.

For our **users' data** (their account, their billing) we are the **controller / data fiduciary**.

The distinction determines who answers a data-subject request, and it must be reflected in both the
DPA and the product: a lead's erasure request is answered by **our customer**, using the tooling we
provide ([`F20`](features/F20-import-export.md) §SN-DATA-023).

---

## 5. India — DPDP Act, 2023 ⚠️

> **Counsel MUST verify against the notified rules in force at launch.** The obligations below are
> our working understanding and drive product requirements; they are not legal advice, and the
> compliance-rule detail (timelines, thresholds, Consent Manager mechanics) was subject to change
> during the drafting period.

### SN-COMP-001 — Notice and consent

A clear, plain-language notice at collection stating what is collected, why, and how to withdraw.
**Available in English and Hindi at minimum.**

Product consequence: our **public lead forms** ([`F11`](features/F11-lead-forms.md)) collect personal
data from a third party on our customer's behalf. The form **MUST** support a configurable consent
notice and record consent with the submission — timestamp, notice version, and IP.

### SN-COMP-002 — Withdrawal is as easy as giving

Withdrawal of consent must be no harder than granting it. Product consequence: WhatsApp opt-out is
honoured instantly and across every send path ([`F13`](features/F13-whatsapp-campaigns.md) §3).

### SN-COMP-003 — Data principal rights

Access · correction · erasure · grievance redressal · nomination.

Product consequence: a customer must be able to **find every record for a given phone number or
email, correct it, and erase it** — including timeline events and message history. Search by
identifier across all entity types is a compliance requirement, not a convenience feature.

### SN-COMP-004 — Breach notification

Notify the Data Protection Board and affected data principals. **Assume the shortest timeline
counsel identifies and build to it.**

Product consequence: we must be able to determine, quickly and accurately, **which records were
affected and which organisations they belong to**. This is why `organization_id` is on every table
and why access logs are retained.

### SN-COMP-005 — Children's data

Processing a child's data requires verifiable parental consent, and behavioural advertising to
children is prohibited.

Product consequence: our **education-sector customers collect data about minors**. Lead forms MUST
support a date-of-birth or guardian-consent field configuration, and our DPA must place the
verification obligation on the customer, who has the relationship.

### SN-COMP-006 — Reasonable security safeguards

The Act requires them of both fiduciary and processor, and a breach caused by their absence carries
significant penalties. §3 is the implementation of this obligation.

### SN-COMP-007 — Localisation

Primary region in India ([`09`](09-technical-architecture.md) §SN-ARCH-070). Cross-border transfer
rules and any restricted-country list must be checked against the notified rules before adding a
region or a sub-processor.

---

## 6. GDPR ⚠️

We will have EU-resident users. Compliance is required regardless of establishment.

### SN-COMP-010 — Lawful basis

Contract for account data · legitimate interest for product operation · **consent for marketing**.
Documented per processing activity in a Record of Processing Activities.

### SN-COMP-011 — Data Processing Agreement

Offered to every customer, with sub-processors listed publicly and **30 days' notice before adding
one**. Standard Contractual Clauses for transfers.

### SN-COMP-012 — Data subject rights

Access, rectification, erasure, restriction, portability, objection — served **within 30 days**.

Portability is satisfied by the full account export ([`F20`](features/F20-import-export.md) §2),
which is why that export is available in every subscription state.

### SN-COMP-013 — Breach notification within 72 hours

To the supervisory authority, and to data subjects where there is high risk.

### SN-COMP-014 — DPIA

Required before launch, and again before any V2 AI feature that processes personal data at scale.

---

## 7. Platform policy

### SN-COMP-020 — WhatsApp Business Messaging Policy ⚠️

**Non-compliance risks the number, the WABA and the customer relationship — not just a warning.**

| Requirement | Where enforced |
|---|---|
| Opt-in before the first business-initiated message | [`F13`](features/F13-whatsapp-campaigns.md) §3 |
| Opt-out honoured immediately, on every path | §SN-CAMP-032 |
| Template categories used honestly | §SN-CAMP-003 |
| 24-hour service window respected | [`F12`](features/F12-whatsapp-coexistence.md) §5 |
| No prohibited content categories | Template authoring + ToS |
| Quality rating monitored, RED blocks sending | §SN-CAMP-035 |

Our terms of service must place the opt-in obligation on the customer **and** we must enforce what
is technically enforceable. Both. A BSP that only does the first one is the one whose customers get
banned.

### SN-COMP-021 — Coexistence terms

Coexistence carries its own conditions and constraints
([`F12`](features/F12-whatsapp-coexistence.md) §2). They **MUST** be re-verified against Meta's
current documentation before implementation and re-checked each quarter — the feature is recent and
still evolving.

### SN-COMP-022 — Meta Platform Terms

Facebook Lead Ads access requires app review, adherence to Platform Terms, and annual Data Use
Checkup. Token handling, permitted use and deletion obligations apply to lead data received through
the API.

**Product consequence:** a lead deleted by our customer must not persist in a cache or export we
retain beyond the permitted period.

### SN-COMP-023 — Google API Services

Gmail-based lead parsing ([`F10`](features/F10-integrations.md) §5) falls under the Limited Use
requirements and **may require an annual third-party security assessment**. Scope must be as narrow
as the feature allows, and the assessment cost budgeted.

### SN-COMP-024 — Payment compliance

PCI-DSS SAQ-A only — card data never touches our infrastructure
([`F19`](features/F19-billing.md) §SN-BILL-024). RBI mandate rules for Indian recurring payments,
including pre-debit notification. GST registration and compliant invoicing.

---

## 8. Accessibility

### SN-NFR-020 — WCAG 2.1 AA, with AAA body text

Per [`07`](07-design-system.md) §10. **The public surface is held to the same standard** — it is
opened by people who did not choose our product and cannot work around its defects.

Keyboard navigable throughout · visible focus · screen-reader tested on NVDA and VoiceOver ·
automated axe checks in CI plus manual review of each new flow · **colour is never the only carrier
of meaning**, which matters for our lead-stage and health-badge colour coding.

---

## 9. Internationalisation

### SN-NFR-030 — English at launch, structured for more

All user-facing strings externalised from day one — retrofitting i18n is a multi-week rewrite, and
externalising strings costs nothing when done from the start.

Hindi, then Bahasa Indonesia and Vietnamese, sequenced by market ([`12`](12-roadmap.md)).

**Already required regardless of UI language:** E.164 phone handling with local display formatting ·
per-member timezones ([`F04`](features/F04-follow-ups.md)) · locale-aware dates in the UI and
**ISO-8601 in every API response** · INR and USD formatting · Devanagari-capable font stack
([`07`](07-design-system.md) §4).

---

## 10. Operational readiness — launch gate

Every item is blocking.

- [ ] Tenant isolation suite green
- [ ] Third-party penetration test complete; criticals and highs remediated
- [ ] Load test at 2× §1.4 targets passed
- [ ] **Backup restore drill executed and timed against RPO/RTO**
- [ ] Monitoring and alerting live for every metric in [`09`](09-technical-architecture.md) §SN-ARCH-052
- [ ] Incident runbooks written for: ingestion failure, WhatsApp mass disconnection, payment provider outage, database failover
- [ ] Status page live
- [ ] **Legal review of §5–§7 complete**
- [ ] DPA, privacy policy and terms of service published
- [ ] `security.txt` and disclosure policy published
- [ ] Retention jobs running and verified
- [ ] PII redaction verified by inspecting real log output
- [ ] Accessibility audit passed on all ten flows in [`08`](08-ux-flows.md)
- [ ] Performance budgets enforced and passing in CI
