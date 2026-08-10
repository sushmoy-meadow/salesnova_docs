# Task DAG restructure - 2026-08-10

Applied to `tasks.json` on 2026-08-10 on the owner's instruction. Backup of the previous state: `tasks.json.bak-20260810`.

## Why

The DAG paired every UI task with its domain's **contract** task and never with the **implementation** that serves it. 192 of 219 unowned backend tasks had no frontend consumer at all. That is what allowed TASK-AUTH-016 (signup screens) to be closed while all four signup endpoints returned 501: the plan permitted it. Each domain then relied on a single large integration task at the very end to join the halves, so no slice was demoable until nearly all of it was built.

## What changed

1. **98 backend+frontend slices.** 121 tasks were absorbed into 98 surviving rows. A slice keeps the lowest-numbered member's id, carries `track: "fullstack"`, and lists the absorbed ids in `absorbed`. Every slice leads with a demo criterion: it is not done until a person can exercise it in a browser against the live implementation.

2. **Absorbed tasks became tombstones**, not deletions: `status: "merged"` plus `merged_into`. Every existing reference in the gate files, the audit report, the repo shims and the 42 open-points filenames still resolves. 149 dependency edges were rewired onto the surviving slice ids.

3. **77 tasks deferred** - the whole infra track (20), the HARDEN domain (7 more), and 54 QA-verification/audit/gate-demo tasks. 21 dependency edges pointing at them were removed so they gate nothing. The 29 `Integrate ... end-to-end` tasks stayed **active**: that wiring is the visible output, and deferring it would have recreated the AUTH-016 failure across every domain.

4. **20 capstones re-specified.** Acceptance criteria went from 1.4 to 5.5 per task, and "no mocks remain" was replaced with observable outcomes. Their job was also re-framed: now that each slice demos alone, the capstone proves the slices *compose*.

## Status vocabulary

`pending` | `in_progress` | `done` | `deferred` (off the critical path, scheduled after feature development) | `merged` (tombstone; work lives in `merged_into`).

`cli/tasks.js` was updated: `deferred` is a settable status, `merged` is refused by the `status` command, both are excluded from progress percentages and the blocked list, and a parked dependency no longer gates readiness.

## The 98 slices

| Slice | Gate | Size | Absorbed | Title |
|---|---|---|---|---|
| `AGCY-003` | G4 | M | AGCY-007 | agency-client relationship lifecycle and the agency console UI |
| `AGCY-004` | G4 | L | AGCY-008, AGCY-009 | impersonation session engine, client-side permission management and in-session banner |
| `AGCY-005` | G4 | L | AGCY-006, AGCY-010 | sponsorship billing, white-label branding cascade, and their UI |
| `AI-016` | G4 | M | AI-019 | AI sequence-generation drafting and the AI review/drafting UI surfaces |
| `ANL-003` | G4 | M | ANL-011 | overview dashboard with the leak query, and the overview UI |
| `ANL-004` | G4 | M | ANL-012 | lead analytics engine and lead analytics UI |
| `ANL-005` | G4 | M | ANL-013 | content analytics engine and content analytics UI |
| `ANL-006` | G4 | M | ANL-014 | WhatsApp analytics engine and WhatsApp analytics UI |
| `ANL-008` | G4 | M | ANL-015 | activity feed endpoint and activity feed UI |
| `ANL-009` | G4 | M | ANL-016 | personal analytics with anonymised comparison, and its UI |
| `ARCH-013` | G0 | M | ARCH-029 | /bootstrap payload assembly, wired into navigation, warnings and counts |
| `ARCH-014` | G1 | M | ARCH-030 | SSE real-time channel, delivered into the running frontend |
| `AUTH-012` | G1 | M | AUTH-018 | server-driven onboarding sequence engine and its screen renderer |
| `AUTH-013` | G1 | M | AUTH-019 | activation checklist derivation and widget |
| `AUTH-014` | G1 | M | AUTH-020 | bootstrap.warnings producer and the global banner that renders it |
| `BILL-005` | G4 | L | BILL-011, BILL-013 | seat/plan proration, cancellation/reactivation, and the billing settings UI |
| `BILL-006` | G4 | M | BILL-017 | 14-day no-card trial with self-serve extension, and the trial banner UI |
| `BILL-008` | G4 | M | BILL-015 | GST-compliant invoicing with GSTIN capture, and the invoice history UI |
| `BILL-009` | G4 | M | BILL-016 | prepaid credit ledger with auto-topup caps, and the top-up UI |
| `BILL-010` | G4 | M | BILL-014 | payment-method summary sanitisation, hosted checkout, and the checkout/pre-debit UI |
| `CAMP-006` | G4 | L | CAMP-009, CAMP-020 | template authoring validation, variable binding with live preview, and the template builder UI |
| `CAMP-011` | G4 | L | CAMP-012, CAMP-021 | audience resolution, costed preview engine, and the campaign builder UI |
| `CAMP-013` | G4 | L | CAMP-014, CAMP-022 | campaign dispatch engine, per-recipient delivery status, and the monitoring UI |
| `CAMP-016` | G4 | L | CAMP-017, CAMP-023 | opt-out enforcement, quality guardrails, and the compliance UI |
| `CAMP-018` | G4 | M | CAMP-024 | prepaid billing/credits with ledger reconciliation, and the credits UI |
| `CAMP-019` | G4 | M | CAMP-025 | campaign and cross-campaign reporting rollups, and the analytics dashboard |
| `CONT-003` | G2 | M | CONT-009 | message roles/render-time personalisation and the message editor UI |
| `CONT-004` | G2 | M | CONT-010 | file upload/processing pipeline and the upload widget |
| `CONT-005` | G2 | L | CONT-011 | page block persistence with block-type registry, and the page builder UI |
| `CONT-006` | G2 | M | CONT-008 | folders/labels taxonomy with search/filter, and the content library list |
| `CONT-007` | G2 | M | CONT-012 | visibility promotion, copy-on-edit, archive/delete lifecycle and its UI |
| `DATA-003` | G1 | L | DATA-004, DATA-005, DATA-018 | CSV/XLSX import - parsing, mapping, transformation-accurate preview, async execution and the five-step wizard |
| `DATA-008` | G1 | M | DATA-019 | import batch tagging with 7-day undo, and the batch history/undo UI |
| `DATA-009` | G1 | M | DATA-020 | guided vCard phone-contact import and its UI |
| `DATA-010` | G1 | L | DATA-011, DATA-021 | export generation engine, async signed-URL export job, and the export request UI |
| `DATA-016` | G1 | M | DATA-022 | self-serve account deletion with grace period, and the deletion/erasure settings UI |
| `FIELD-003` | G1 | L | FIELD-004, FIELD-006 | custom field CRUD, autofill/date-reminder logic, and the fields settings UI |
| `FIELD-005` | G1 | M | FIELD-007 | stage history, relative-move reordering, and the stage configuration UI |
| `FORM-003` | G2 | M | FORM-010 | form/field CRUD with invariant enforcement, and the form builder UI |
| `FORM-004` | G2 | M | FORM-011 | post-submit configuration, branding and sharing, with the form settings UI |
| `FORM-005` | G2 | L | FORM-006, FORM-012 | public submission endpoint with anti-abuse, and the tracker-free public form page |
| `FORM-007` | G2 | M | FORM-013 | per-form analytics aggregation and its dashboard UI |
| `FORM-009` | G2 | M | FORM-014 | form status lifecycle and the form list/status management UI |
| `FUP-003` | G1 | L | FUP-008, FUP-009 | follow-up set/complete/snooze logic, row actions and quick-set UI |
| `GROUP-003` | G1 | L | GROUP-005, GROUP-006 | group CRUD/merge/counts, groups settings UI and inline assignment |
| `INTG-004` | G2 | L | INTG-005, INTG-012 | Facebook/Instagram Lead Ads connection lifecycle, backfill/delayed-delivery detection, and the connection UI |
| `INTG-006` | G2 | M | INTG-013 | WordPress/generic-webhook/OAuth parsers and their connection UIs |
| `INTG-007` | G2 | M | INTG-014 | lead-via-email ingestion with allowlist, and the email settings/review UI |
| `INTG-010` | G2 | M | INTG-015 | per-connection health monitoring with silence alerting, and the health dashboard |
| `LEAD-007` | G1 | L | LEAD-020 | lead CRUD with phone parsing, and the lead detail screen |
| `LEAD-012` | G1 | L | LEAD-013, LEAD-021 | duplicate detection, merge engine with 30-day undo, and the review/merge UI |
| `LEAD-014` | G1 | M | LEAD-022 | bulk operations engine and bulk action UI |
| `LEAD-015` | G1 | L | LEAD-023 | CSV import engine and import wizard UI |
| `LEAD-016` | G1 | M | LEAD-024 | export engine and export request UI |
| `NOTIF-004` | G1 | M | NOTIF-009 | quiet hours/digest scheduling engine and the preferences matrix UI |
| `NOTIF-005` | G1 | M | NOTIF-011 | notification catalogue, deep-link routing and deep-link handling |
| `NOTIF-006` | G1 | L | NOTIF-007, NOTIF-010 | channel delivery adapters, in-app notification centre backend and UI |
| `RULE-003` | G4 | L | RULE-009 | condition engine with dynamic field/value vocabulary, and the shared rule builder UI |
| `RULE-004` | G4 | M | RULE-013 | synchronous priority-ordered evaluation pipeline and the execution log viewer |
| `RULE-005` | G4 | M | RULE-010 | routing actions and the routing rule actions UI |
| `RULE-006` | G4 | M | RULE-011 | distribution actions and the distribution rule UI |
| `RULE-007` | G4 | L | RULE-008, RULE-012 | WhatsApp auto-responder and Meta CAPI dispatch, with the guided setup UI |
| `SEC-021` | G2 | L | SEC-022, SEC-027 | cross-entity identifier search/correction/erasure, consent capture, and the DSR/consent management UI |
| `SEQ-003` | G4 | L | SEQ-009 | sequence builder domain rules and the builder UI |
| `SEQ-004` | G4 | M | SEQ-010 | enrolment engine and the enrolment UI |
| `SEQ-006` | G4 | M | SEQ-011 | USER-step task queue and the My Tasks queue UI |
| `SEQ-008` | G4 | M | SEQ-012 | live-sequence edit propagation and the impact dialog/reporting UI |
| `SET-003` | G1 | M | SET-010 | user preferences write path with admin locks, and the personalisation UI |
| `SET-004` | G1 | L | SET-007, SET-009 | profile management with email-change OTP, security settings backend, and the profile/security UI |
| `SET-005` | G1 | M | SET-011 | org lead-settings logic and the org lead-settings UI |
| `SET-006` | G2 | M | SET-012 | branding management with live preview, and the branding UI |
| `SET-008` | G1 | M | SET-013 | bootstrap settings payload assembly and the settings screen tree |
| `SHARE-003` | G2 | M | SHARE-008 | idempotent share minting with branded URLs, and the share sheet UI |
| `SHARE-004` | G2 | L | SHARE-009 | public viewer rendering with owner exclusion, and the public viewer shell |
| `SHARE-005` | G2 | L | SHARE-010 | engagement-gated bot-filtered view/duration tracking, and client-side tracking |
| `SHARE-006` | G2 | M | SHARE-011 | real-time view alerts with CONTENT_VIEWED timeline events, and the engagement dashboards |
| `TEAM-003` | G1 | M | TEAM-007 | member invitation lifecycle and the members list/invite UI |
| `TEAM-004` | G1 | M | TEAM-008 | sub-team management/scoping and the sub-teams UI |
| `TEAM-005` | G1 | M | TEAM-009 | team dashboard aggregation and the team dashboard UI |
| `TEAM-006` | G1 | M | TEAM-010 | lead escalation sweep job and escalation settings UI |
| `TL-005` | G1 | L | TL-009 | manual activity logging and the lead timeline UI |
| `TL-006` | G1 | M | TL-011 | timeline read/query with permission scoping, and the org-wide activity feed UI |
| `TL-008` | G3 | M | TL-010 | WhatsApp conversation rendering data and the in-timeline conversation UI |
| `UX-003` | G1 | L | UX-004 | Flow 1 - signup to first message, wired to live backend |
| `UX-006` | G4 | M | UX-007 | Flow 2 - lead arrival to first response, wired to live backend |
| `UX-009` | G3 | L | UX-010 | Flow 3 - WhatsApp connection, wired to live backend |
| `UX-012` | G2 | M | UX-013 | Flow 4 - share content and alert, wired to live backend |
| `UX-015` | G1 | M | UX-016 | Flow 5 - daily follow-up round, wired to live backend |
| `UX-018` | G4 | L | UX-019 | Flow 6 - manual sequence builder, wired to live backend |
| `UX-021` | G4 | L | UX-022 | Flow 7 - WhatsApp campaign sending, wired to live backend |
| `UX-024` | G4 | M | UX-025 | Flow 8 - plan-limit paywall, wired to live backend |
| `UX-027` | G3 | M | UX-028 | Flow 9 - WhatsApp disconnection recovery, wired to live backend |
| `UX-030` | G2 | M | UX-031 | Flow 10 - duplicate resolution, wired to live backend |
| `WA-007` | G3 | L | WA-008, WA-021 | WhatsApp onboarding - eligibility, Embedded Signup, granular consent, and the onboarding wizard UI |
| `WA-009` | G3 | M | WA-023 | message/echo webhook ingestion and WhatsApp timeline rendering |
| `WA-015` | G3 | L | WA-016, WA-017, WA-022 | health-state computation, escalation notifications, reconnection flow and the health banner UI |
| `WA-018` | G3 | L | WA-024 | inbox conversation query with CRM-context aggregation, and the lead-centric inbox UI |
| `WA-019` | G3 | M | WA-025 | click-to-chat fallback with manual logging, and the click-to-chat entry points |

## Deferred (77)

| Task | Gate | Track | Owner | Title |
|---|---|---|---|---|
| `AGCY-012` | G4 | qa | - | QA verification of agency & white-label acceptance criteria |
| `AI-021` | G4 | qa | - | Verify AI substrate write-time-capture and governance checklist |
| `ANL-018` | G4 | qa | - | QA verification of analytics performance and correctness |
| `ARCH-032` | G0 | qa | - | QA: verify tenant isolation suite green in CI |
| `ARCH-033` | G0 | qa | sakib | QA: verify API contract conformance |
| `ARCH-034` | G4 | qa | - | QA: verify IA cross-cutting states, responsive breakpoints and search  |
| `ARCH-035` | G2 | qa | - | QA: verify webhook ingestion pipeline resilience |
| `AUTH-023` | G0 | qa | sushmoy | QA: verify auth/signup/invite against acceptance criteria |
| `AUTH-024` | G1 | qa | - | QA: verify onboarding/activation/banners |
| `BILL-019` | G4 | qa | - | QA billing acceptance criteria and PCI/data-retention checks |
| `CAMP-027` | G4 | qa | - | QA verification of WhatsApp campaigns acceptance criteria |
| `CONT-014` | G2 | qa | - | QA: verify content domain acceptance criteria |
| `DATA-024` | G1 | qa | - | QA import/export/deletion acceptance criteria |
| `DESIGN-015` | G0 | infra | sakib | Enforce frontend performance budgets in CI |
| `DESIGN-016` | G0 | infra | sushmoy | Enforce tokens-only lint rule (no raw hex/spacing) |
| `DESIGN-018` | G0 | qa | sushmoy | Verify accessibility and performance conformance of the component libr |
| `DESIGN-019` | G0 | qa | - | Demonstrate the G0 foundation gate exit criterion |
| `DESIGN-020` | G2 | qa | - | Demonstrate the G2 acquisition & content gate exit criterion |
| `DESIGN-021` | G3 | qa | - | Demonstrate the G3 wedge gate exit criterion |
| `FIELD-009` | G1 | qa | - | QA: verify custom fields and stage behaviour |
| `FORM-016` | G2 | qa | - | QA verification of lead-forms acceptance criteria |
| `FUP-011` | G1 | qa | - | QA: verify follow-ups against acceptance criteria |
| `GROUP-008` | G1 | qa | - | QA: verify groups behaviour |
| `HARDEN-001` | G0 | infra | sakib | Enforce performance and bundle budgets in CI |
| `HARDEN-002` | G5 | qa | - | Build load-testing suite at 2x V1 scale targets |
| `HARDEN-003` | G4 | backend | - | Implement graceful, honest degradation under load |
| `HARDEN-005` | G2 | backend | - | Enforce non-2xx-on-failure webhook ingestion guarantee |
| `HARDEN-007` | G5 | infra | - | Write incident runbooks and launch the public status page |
| `HARDEN-008` | G5 | qa | - | Run WCAG 2.1 AA accessibility audit and remediate |
| `HARDEN-010` | G5 | qa | - | Verify the full operational-readiness launch-gate checklist |
| `HARDEN-011` | G3 | backend | - | Resolve WhatsApp provider decision (BSP vs direct Meta Tech Provider) |
| `HARDEN-013` | G5 | qa | - | Complete legal review of DPDP, GDPR and platform policy; publish DPA/p |
| `HARDEN-014` | G0 | infra | sakib | Select hosting and managed services; provision India primary region |
| `INFRA-001` | G0 | infra | sakib | Build CI/CD pipeline with blocking quality gates |
| `INFRA-002` | G0 | infra | sakib | Provision the four delivery environments |
| `INFRA-003` | G0 | infra | sushmoy | Configure Laravel Octane runtime and stateless-request review checklis |
| `INFRA-004` | G0 | infra | sakib | Configure Horizon queue supervisors with per-queue priority and provid |
| `INFRA-005` | G0 | infra | sushmoy | Provision S3-compatible object storage with per-tenant isolation |
| `INFRA-006` | G0 | infra | sakib | Implement backup, PITR strategy and monthly restore-drill automation |
| `INFRA-007` | G0 | infra | sushmoy | Enforce migration discipline: expand/contract, concurrent indexing and |
| `INFRA-008` | G0 | infra | sushmoy | Build observability stack: metrics, alerting and uptime SLO dashboards |
| `INFRA-009` | G0 | infra | sakib | Enforce feature-flag lifecycle lint in CI |
| `INFRA-010` | G0 | infra | sushmoy | Scaffold regional data-residency structure |
| `INFRA-011` | G0 | qa | sakib | QA: verify observability alerts and restore drill against targets |
| `INFRA-012` | G2 | infra | - | Provision inbound email receiving infrastructure for lead-via-email in |
| `INTG-017` | G2 | qa | - | QA verification of integrations acceptance criteria |
| `LEAD-027` | G1 | qa | - | QA: verify lead model/list/detail/assignment/contacted-state |
| `LEAD-028` | G1 | qa | - | QA: verify duplicate/merge/bulk/import/export |
| `NOTIF-013` | G1 | qa | - | QA verification of notifications acceptance criteria |
| `PERM-010` | G4 | qa | - | QA: verify permissions, plans and paywall against acceptance criteria |
| `RULE-015` | G4 | qa | - | QA: verify automation acceptance criteria |
| `SEC-008` | G0 | infra | sakib | Stand up secrets management and commit-time secret scanning |
| `SEC-015` | G0 | infra | sushmoy | Set up dependency vulnerability scanning and per-release SBOM generati |
| `SEC-018` | G1 | qa | - | Verify security control suite against section-3 acceptance bar |
| `SEC-029` | G2 | qa | - | Verify DPDP and GDPR data-subject-rights and consent compliance |
| `SEC-034` | G0 | infra | sakib | Pin India-primary-region data localisation |
| `SEC-035` | G5 | infra | - | Publish security.txt and vulnerability-disclosure policy |
| `SEC-036` | G5 | qa | - | Run third-party penetration test and remediate findings |
| `SEQ-014` | G4 | qa | - | QA: verify sequence acceptance criteria |
| `SET-015` | G2 | qa | - | QA verification of settings scope, defaults and security behaviour |
| `SHARE-013` | G2 | qa | - | QA: verify sharing & tracking acceptance criteria against Privyr-defec |
| `TEAM-012` | G1 | qa | - | QA verification of team & sub-teams acceptance criteria |
| `TL-014` | G1 | qa | - | QA: verify manual timeline and activity-feed behaviour |
| `TL-015` | G3 | qa | - | QA: verify WhatsApp-in-timeline rendering and gap markers |
| `UX-005` | G1 | qa | - | QA Flow 1 against its budget |
| `UX-008` | G4 | qa | - | QA Flow 2 against its budget |
| `UX-011` | G3 | qa | - | QA Flow 3 against its budget |
| `UX-014` | G2 | qa | - | QA Flow 4 against its budget |
| `UX-017` | G1 | qa | - | QA Flow 5 against its budget |
| `UX-020` | G4 | qa | - | QA Flow 6 against its budget |
| `UX-023` | G4 | qa | - | QA Flow 7 against its budget |
| `UX-026` | G4 | qa | - | QA Flow 8 against its budget |
| `UX-029` | G3 | qa | - | QA Flow 9 against its budget |
| `UX-032` | G2 | qa | - | QA Flow 10 correctness |
| `UX-033` | G5 | qa | - | Accessibility audit across all ten UX flows |
| `WA-005` | G3 | qa | - | Re-verify Meta Coexistence constraints against current provider docume |
| `WA-027` | G3 | qa | - | QA verification of WhatsApp Coexistence acceptance criteria |

## Known items left open

- **9 gate inversions remain** (earlier-gate tasks depending on later-gate tasks). They were diagnosed, not fixed - fixing them changes scope and needs a product decision. The serious one is `ARCH-013` (G0 /bootstrap) depending on `FUP-004` and `LEAD-011` (both G1), which makes the G0 exit criterion unsatisfiable.
- **`UX-006` moved G1 -> G4.** Flow 2 (lead arrival to first response) was merged with its integration task, whose `RULE-004` dependency is G4. The core loop flow is now scheduled in G4. If routing rules are not actually required for Flow 2, drop that dependency and move the slice back to G1.
- **Duplicated import/export work across two domains.** `LEAD-015`/`LEAD-023` (CSV import engine + wizard) overlap `DATA-003`/`DATA-018` (import execution + five-step wizard), and `LEAD-016`/`LEAD-024` overlap `DATA-010`/`DATA-021` for export. Both survived as separate slices because de-duplicating them crosses domain boundaries and changes scope. Worth resolving before either is scheduled.
- **Sushmoy has almost no ready work left.** 9 of his 11 pending tasks were deferred (7 infra, plus DESIGN-018 and AUTH-023); the remaining 2 are blocked on sakib. He needs reassigning onto G1 slices.
- **210 residuals from completed tasks are still recorded only in 42 loose markdown files.** The `residuals` array recommendation was accepted in principle but not implemented in this pass.

## Residuals (added 2026-08-10)

The 42 `TASK-*-open-points.md` files were parsed into a `residuals` array on the task that produced each one. 208 document sections were reviewed; **44 were records** (what was decided, declined, or changed during the run - no open work) and are not residuals. That leaves **164 residual records, 162 of them open**. An earlier count of 226 in the audit was a raw heading count and overstated it.

| Type | Open | Closes by |
|---|---|---|
| `decision_needed` | 42 | a recorded decision / ADR |
| `blocked_on_unbuilt` | 38 | automatically, when every task in `closes_when` is done |
| `known_gap` | 38 | code, or promotion to a task |
| `deferred_verification` | 30 | `TASK-DESIGN-023`, the browser verification harness |
| `spec_defect` | 14 | a spec fix - **blocks its gate** |

**`TASK-DESIGN-023`** was created to absorb the deferred verifications: 30 residuals across 11 tasks all say the same thing - the assertion exists as a rule in jsdom and has never been observed in a browser. It is one Playwright harness, not 30 tasks, and it is `deferred` with the rest of the verification work.

### The 6 spec defects that block G0

- `R-TASK-ARCH-020.1` (TASK-ARCH-020) — 1 A message body that has already become prose
- `R-TASK-ARCH-020.2` (TASK-ARCH-020) — 2 A one-time code with no label
- `R-TASK-ARCH-020.3` (TASK-ARCH-020) — 3 A phone number split by exactly one dot, with nothing in front of it
- `R-TASK-DESIGN-001.1` (TASK-DESIGN-001) — §3.3 names a disabled contrast floor, and §3.2 gives it no token
- `R-TASK-DESIGN-006.10` (TASK-DESIGN-006) — The date-range filter's two inputs are uncontrolled between renders
- `R-TASK-DESIGN-006.11` (TASK-DESIGN-006) — The grid's cell inputs are keyed by the last committed value
- `R-TASK-DESIGN-013.3` (TASK-DESIGN-013) — `md` is "collapsible" in the specification and is not collapsible here
- `R-TASK-AUTH-011.3` (TASK-AUTH-011) — Reactivation is not in the route contract the frontend was given
- `R-TASK-AUTH-017.5` (TASK-AUTH-017) — Expired and cancelled are indistinguishable
- `R-TASK-TL-001.1` (TASK-TL-001) — Where the schema departs from the column table
- `R-TASK-TL-001.4` (TASK-TL-001) — `id` is not unique on its own

`node cli/tasks.js gate-exit G0` reports these; the gate cannot be declared clear while they are open.

### Residuals that may already be closeable

Six `blocked_on_unbuilt` residuals name only tasks that are already `done` - they were probably closed by work that landed after the open-points file was written, and nobody went back to check. `validate` flags them:

- `R-TASK-ARCH-019.3` — waits on TASK-AI-007, all done
- `R-TASK-DESIGN-014.2` — waits on TASK-UX-001, all done
- `R-TASK-AI-006.1` — waits on TASK-AI-008, all done
- `R-TASK-AI-007.1` — waits on TASK-AI-008, all done
- `R-TASK-AI-013.1` — waits on TASK-AI-018, TASK-AI-011, TASK-AI-003, all done
- `R-TASK-AI-018.3` — waits on TASK-AI-011, all done

That flag existing at all is the point of the array: those six were invisible before.
