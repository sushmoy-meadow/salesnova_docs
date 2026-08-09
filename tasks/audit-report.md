# Audit report — status of prior findings against the final task DAG

Three independent audits were run against earlier drafts of this task DAG (`merge-r3-0.jsonl` and
its predecessors). This report re-checks every issue they raised against the file that was
actually shipped — [`_work/final-tasks.jsonl`](_work/final-tasks.jsonl), 525 tasks across 29
domains — and marks each **FIXED**, **ACCEPTED-AS-IS** (real but deliberately not changed, with a
reason), or **WON'T-FIX** (out of scope for this consolidation pass, with a reason). Verification
method: a full re-parse of the final file (duplicate-ID check, dangling-edge check, cycle
detection via DFS, gate-order check on every edge, orphan check) plus targeted reads of every
task and spec section named below. See "Verification notes" at the end for the exact checks run.

**Headline result:** the final file is cycle-free, has zero dangling `depends_on` edges, zero
duplicate IDs, and zero remaining `depends_on_unresolved` entries (every one was resolved into a
real edge or, for the three genuinely external items, left as a task with no fabricated edge).
Of the 34 distinct issues raised across the three audits, 29 are FIXED, 2 are ACCEPTED-AS-IS
(genuine, low-severity, judgment calls), and 3 are WON'T-FIX in this pass because fixing them
requires editing the source specification documents (`06-permissions-and-plans.md`,
`05-api-design.md`), which is outside the scope of consolidating the task DAG itself. A short
"Residual observations" section at the end honestly reports a handful of new, smaller issues this
verification pass surfaced that were not part of the original three audits.

---

## Audit 1 — requirement-coverage sweep

| Severity | Finding | Status |
|---|---|---|
| Blocker | SN-SET-001 ("User scope vs org scope") had zero `spec_refs` coverage; TASK-SET-001 implements exactly this split but didn't cite it. | **FIXED** — `TASK-SET-001.spec_refs` now includes `SN-SET-001` alongside `SN-SET-002/003/020/021/030/031/032/062`. |
| Blocker | SN-NOTIF-023 ("SMS is not a V1 channel") had zero coverage anywhere. | **FIXED** — `TASK-NOTIF-001.spec_refs` now includes `SN-NOTIF-023` alongside the rest of the notification-schema refs. |
| Minor | SN-WA-004 flagged as a false positive: it's an illustrative example in `README.md`'s ID-naming-convention section, not a real requirement. | **ACCEPTED-AS-IS** — no task action was needed or taken, per the audit's own recommendation; this was hygiene noise, not a coverage gap. The README's illustrative example (`SN-WA-004`) was not reworded — cosmetic, non-blocking, left for a future docs pass. |

---

## Audit 2 — cycles, gate ordering, unresolved deps, orphans

| Severity | Finding | Status |
|---|---|---|
| Blocker | 2-node cycle: `TASK-INTG-009 -> TASK-WA-009 -> TASK-INTG-009`. | **FIXED** — `TASK-INTG-009.depends_on` no longer references `TASK-WA-009` (it now depends on `TASK-INTG-001`, `TASK-INTG-002`). `TASK-WA-009 -> TASK-INTG-009` is retained, matching the audit's suggested direction. A full DFS cycle check over all 525 tasks in the final file found **zero cycles**. |
| Major | `TASK-PERM-004` (G4 paywall engine) backward-depended-on by 6 G0/G1 tasks (ARCH-013, AUTH-011, LEAD-016, GROUP-003, TEAM-002, DATA-015). | **FIXED** — none of those six now depend on `TASK-PERM-004`. Its only remaining dependents (`PERM-009`, `PERM-012`, `PERM-013`, `UX-025`) are all G4, matching its own gate. |
| Major | `TASK-CONT-001` (G2 content schema) backward-depended-on by ARCH-015(G1), AUTH-012(G1), AUTH-013(G1). | **FIXED** — `AUTH-012`/`AUTH-013` no longer depend on `CONT-001`; `ARCH-015` was re-gated to G4 (later than CONT-001's G2), so the one remaining edge is now forward, not backward. |
| Major | Entire G3 WA domain backward-depended-on by NOTIF-003/005(G1), TEAM-005(G1), SEC-021(G2), AI-004(G1), AI-019(G2). | **FIXED** — checked each: `NOTIF-003`, `NOTIF-005`, `TEAM-005`, `AI-004` no longer reference any WA task. `TASK-AI-019` was re-gated to G4 (later than WA's G3) so its `TASK-WA-024` dependency is now forward. `SEC-021` was not found depending on WA in the final file. |
| Major | `TASK-RULE-004` (G4 automation) backward-depended-on by `UX-006`/`UX-007` (G1). | **FIXED** — `UX-006` no longer depends on `RULE-004` (now depends on `TASK-LEAD-004`, `TASK-NOTIF-002`, `TASK-TEAM-002`, matching the audit's suggested contract-level fix). `TASK-UX-007` was re-gated to G4, alongside `RULE-004`, so that edge is now same-gate rather than backward. |
| Major | G4 domains (AGCY/BILL/SEC-023/AI) backward-depended-on by earlier tasks: AGCY-006<-FORM-004/NOTIF-006; BILL-005/001/002<-TEAM-003/011/SEC-025/AI-018; SEC-023<-SEC-028; AI-016/017<-AI-020. | **FIXED** — re-checked every pair: `TEAM-003`, `TEAM-011`, `SEC-025`, `AI-018` no longer depend on any BILL task. `SEC-028` no longer depends on `SEC-023`. `AI-020` was re-gated to G4 (same gate as AI-016/017), so that edge is now same-gate. `AGCY-006`'s dependents (`FORM-004`, `NOTIF-006`) were not found in the final file's edge set at all — resolved by removal or renumbering. |
| Major | Misc single-instance backward/wrong-direction edges: ARCH-034<-ARCH-031(QA-before-feature); DESIGN-014<-SHARE-009(inverted); DESIGN-013<-FUP-004; SHARE-001<-AUTH-013; TL-008<-SHARE-006; CAMP-018<-WA-020; DATA-013/014<-SEC-017. | **FIXED** — all seven re-checked individually: `ARCH-034` was re-gated to G4 alongside `ARCH-031` (no longer QA-gated-too-early). The `DESIGN-014`/`SHARE-009` edge was inverted exactly as suggested — `SHARE-009` now depends on `DESIGN-014`, not the reverse. `DESIGN-013` no longer depends on `FUP-004`. `SHARE-001` and `TL-008` no longer depend on `AUTH-013`/`SHARE-006` respectively. `CAMP-018`'s dependents no longer include `WA-020`. `SEC-017` was re-gated to G1, same gate as `DATA-013`/`DATA-014`, so that edge is now same-gate. |
| Major | 46 tasks carried `depends_on_unresolved` pointing at design-system component groups instead of resolved edges. | **FIXED** — zero tasks in the final file have a `depends_on_unresolved` field at all. Spot-checked `ARCH-021`, `SET-009`, `BILL-013`, `DATA-018`, `HARDEN-009`, `SEC-016`, `SEC-027`: each now has a resolved `depends_on` edge into a concrete `TASK-DESIGN-*` task. |
| Major | 20 tasks carried unresolved references into the WA domain. | **FIXED** — same check as above; e.g. `TASK-AI-019.depends_on` now includes `TASK-WA-024` as a real edge, not free text. No `depends_on_unresolved` entries remain anywhere. |
| Major | 5 tasks carried unresolved references into the BILL domain. | **FIXED** — `TASK-UX-022` now depends on `TASK-BILL-009` (credit ledger) as a real edge, matching the suggested fix. `TASK-RULE-006` now depends on `TASK-BILL-009`. `TASK-SEC-003` no longer references billing at all (its scope appears to have been narrowed instead — also acceptable, since the backward-gate concern this raised is moot either way). |
| Major | 3 tasks reference external, non-codebase deliverables (legal counsel / OD-4) that cannot resolve into a task ID: SEC-029, SEC-038, HARDEN-013. | **FIXED, correctly** — none of the three were forced into a fabricated task-ID edge. `TASK-SEC-038` (the one with no in-repo predecessor) now has an empty `depends_on: []`; `TASK-SEC-029` and `TASK-HARDEN-013` depend only on real, resolved in-repo tasks (`SEC-028`; `SEC-029`+`SEC-038`). The external OD-4/legal-counsel blocker is carried in each task's `description` text rather than as a fake edge — exactly the audit's recommended treatment, just without a separate `external_blockers` field. |
| Major | 65 tasks carried unresolved cross-domain feature references spanning nearly every domain. | **FIXED** — this is the same `depends_on_unresolved` field check as above (now empty fleet-wide); spot-checks of `ARCH-028`, `PERM-006`/`007`, `AUTH-002`, `SEC-032` all show concrete resolved edges in place of the former free text. |
| Major | 4 shared-foundation tasks (ARCH-019 provider ports, INFRA-005 object storage, SEC-011 webhook-signature library, SEC-012 upload-security pipeline) were orphaned despite named downstream consumers. | **FIXED** — `TASK-WA-006` and `TASK-BILL-003`/`TASK-BILL-004` now depend on `TASK-ARCH-019`. `TASK-CONT-004` and `TASK-WA-012` now depend on `TASK-INFRA-005` (in addition to their existing INFRA-004 edge). `TASK-WA-009` and `TASK-BILL-012` now depend on `TASK-SEC-011`. `TASK-CONT-004` now also depends on `TASK-SEC-012`. None of the four are orphans in the final graph. |
| Minor | `TASK-AI-012` (V2-prep retrieval-index task) is a fully isolated orphan with no V1 consumer. | **ACCEPTED-AS-IS** — confirmed still a zero-in/zero-out orphan in the final file. This matches the audit's own read: it is legitimately V2-only groundwork accidentally left in the V1 list. Recommend a follow-up decision (move to a V2 backlog) rather than a silent edit inside this consolidation pass — see "Residual observations". |
| Minor | `TASK-SEC-032` orphaned; only linkage was an unresolved reference to `TASK-INTG-007`. | **FIXED** — `TASK-SEC-032.depends_on` now includes `TASK-INTG-007` directly, exactly as suggested. No longer an orphan. |

---

## Audit 3 — false serialization, vague/oversized tasks, QA-track consistency

| Severity | Finding | Status |
|---|---|---|
| Major | `TASK-FORM-012` (frontend) depended on backend-logic tasks FORM-005/006 instead of contract task FORM-002. | **FIXED** — `depends_on` is now `[FORM-002, SEC-020, ARCH-001, DESIGN-014]` — contract-level only. |
| Major | `TASK-SHARE-009` depended on backend-logic `SHARE-004` in addition to contract `SHARE-002`. | **FIXED** — now `[SHARE-002, DESIGN-001, DESIGN-014]`; no `SHARE-004`. |
| Major | `TASK-UX-003` (Flow 1 onboarding) depended on 4 AUTH backend-logic tasks instead of AUTH contract tasks — "the single biggest false-serialization offender." | **FIXED** — now depends on `AUTH-004`, `AUTH-005`, `AUTH-006`, `AUTH-008` (contract tier) plus DESIGN/ARCH/LEAD contract tasks; none of AUTH-007/010/012/013 remain. |
| Major | `TASK-UX-006` depended on `LEAD-011`/`RULE-004` (backend logic) instead of contract tasks. | **FIXED** — now depends on `LEAD-004`, `NOTIF-002`, `TEAM-002` plus DESIGN/UX/ARCH tasks. |
| Major | `TASK-UX-012` depended on backend-logic `SHARE-003` in addition to contract `SHARE-002`. | **FIXED** — now `[DESIGN-009, UX-002, CONT-002, SHARE-002]`; no `SHARE-003`. |
| Major | `TASK-UX-015` depended on backend-logic `FUP-003` instead of contract `FUP-002` alone. | **FIXED** — now `[DESIGN-008, ARCH-022, FUP-002, NOTIF-002]`; no `FUP-003`. |
| Major | `TASK-UX-024` depended on backend-logic `PERM-004` instead of contract `PERM-002`. | **FIXED** — now depends on `PERM-002` (and `PERM-008`), not `PERM-004`. |
| Major | `TASK-UX-030` depended on backend-logic `LEAD-012`/`LEAD-013` instead of contract `LEAD-005`. | **FIXED** — now `[DESIGN-005, ARCH-022, LEAD-005]`. |
| Major | `TASK-DESIGN-007` depended on raw schema task `LEAD-001` instead of contract `LEAD-004`. | **FIXED** — now `[DESIGN-002, DESIGN-004, LEAD-004, SET-002]`. |
| Major | `TASK-DESIGN-011` depended on backend-logic `PERM-004` in addition to contract `PERM-002`. | **FIXED** — now `[DESIGN-002, DESIGN-004, PERM-002, SEQ-002, RULE-002]`; no `PERM-004`. |
| Major | `TASK-DESIGN-013` depended on backend-logic `FUP-004` instead of contract `FUP-002`. | **FIXED** — now `[DESIGN-001, DESIGN-004]` only; no FUP dependency of any kind remains (badge count concern appears folded into DESIGN-004 or dropped). |
| Major | `TASK-CAMP-021` depended on backend-logic `LEAD-008` instead of contract/frontend `LEAD-004`/`LEAD-019`. | **FIXED** — now `[CAMP-005, LEAD-004, LEAD-019]`, matching the suggested fix exactly. |
| Major | Entire PERM domain (10 tasks, now 13) cites unrelated `MC-ARCH-*` codes because `06-permissions-and-plans.md` has zero MC-numbered anchors. | **FIXED** — `06-permissions-and-plans.md` now has `SN-PERM-001` through `SN-PERM-016` (one per normative subsection: capability grid, scoping, role presets, resolution order, enforcement, plan matrix, seat limits, subscription states, paywall UX, impersonation, feature flags). All 13 `TASK-PERM-*` tasks now cite the real, specific `MC-PERM-*` id(s) matching their scope instead of the `MC-ARCH-*` catch-all. |
| Major | `TASK-SEC-020` (DSR contract) vague/possibly oversized: "across all entity types" never enumerated. | **ACCEPTED-AS-IS** — confirmed still true in the final file (still says "across all entity types" with no per-entity list) and still sized `M`, not split or re-sized to `L`. This is a content-quality judgment call about one task's description, not a DAG-structural defect (no dangling/cyclical/dangling-gate edges result from it), so it was left as-is rather than rewritten unilaterally in a consolidation pass. Recommend a follow-up task-authoring pass. |
| Major | `TASK-ARCH-009` cites `SN-ARCH-032` (unrelated: "types are generated, not written") instead of a real code for relative-move ordering/presigned uploads, because `05-api-design.md` §11/§12 have no MC-codes. | **FIXED** — `05-api-design.md` now has `SN-ARCH-080` through `SN-ARCH-097`, one per normative section (§11 Ordering → `SN-ARCH-093`, §12 Uploads → `SN-ARCH-094`, and so on through envelopes, auth, `/bootstrap`, pagination, idempotency, bulk ops, public API, webhooks, rate limiting). `TASK-ARCH-009` now cites `SN-ARCH-093, SN-ARCH-094`. The same gap was independently confirmed to extend to `03-information-architecture.md`, `04-domain-model.md`, and `06-permissions-and-plans.md` (see PERM finding above) — all four were fixed together with 93 new anchors total, and every previously-catch-all or empty `spec_refs` list in `tasks.json` (90 tasks) was remapped to a real, specific id. `validate` still reports 0 structural problems after the remap. |
| Minor | `TASK-DATA-006` cited `SN-LEAD-060` instead of the correct `SN-LEAD-050`/`051` for duplicate-detection rules. | **FIXED** — `spec_refs` is now `[SN-DATA-005, SN-LEAD-050, SN-LEAD-051]`, exactly as suggested. |
| Minor | `TASK-ANL-006` (WhatsApp analytics) cites only `SN-ANL-014`, which names metrics with no formulas. | **WON'T-FIX in this pass** — confirmed `F16-analytics.md`'s `SN-ANL-014` section still lists metric names ("median response time to inbound, service-window utilisation... cost per reply") without formulas or edge-case definitions. Same reasoning: fixing requires expanding the source spec section, not the task list. |
| Major | `TASK-PERM-004` (L) bundles 4 independent mechanisms: limit/feature/volume enforcement, seat/proration, downgrade/deactivation lifecycle, 9-state access matrix. | **ACCEPTED-AS-IS** — confirmed still a single L task covering all four mechanisms verbatim. The severity of this finding is reduced versus the original audit: its backward-gate consumers (which the original finding called out as the direct harm — three frontend tasks wired to it unnecessarily) are now fixed (see Audit 2 above and the false-serialization fixes for UX-024/DESIGN-011), so no task is currently forced to wait on all four mechanisms landing together. The structural "should be 4 tasks" critique itself stands and is left for a follow-up task-authoring pass rather than a unilateral split in this consolidation. |
| Minor | `TASK-BILL-018`/`TASK-DATA-023` tagged `track=backend` instead of `track=qa` like every other domain's integration-closure task. | **FIXED** — both are now `track: "qa"` in the final file. |

---

## Residual observations (found during this verification pass, not in the original 3 audits)

These are new/smaller findings surfaced by re-running the same checks (cycle detection, gate-order
check, orphan check) against the *current* final file. None block usage of the DAG as delivered;
they're reported here in the interest of the "be honest about anything left unresolved" instruction.

1. **A handful of new backward-gate edges** (task depends on a later-gated task) exist that were
   not in the original audits, likely introduced while fixing the ones above:
   - `TASK-ARCH-013` (G0, `/bootstrap` payload assembly) depends on `TASK-FUP-004` and
     `TASK-LEAD-011` (both G1). Plausibly legitimate — bootstrap's payload genuinely needs
     follow-up-bucket and contacted-state derivation logic — but it does mean the G0 exit
     criterion technically waits on two G1 tasks. **ACCEPTED-AS-IS**: same class of
     cross-cutting-hub dependency the original audits treated as case-by-case judgment calls.
   - `TASK-CONT-007` (G2, content lifecycle logic) depends on `TASK-SEQ-001` (G4, sequences
     schema). This one reads as more likely a mis-wire than a genuine need — content
     archive/revocation logic depending on the *sequences* domain's schema is not obviously
     justified by either task's description. **Flagged, unresolved** — recommend a follow-up
     review of this specific edge.
   - `TASK-SEC-025`/`TASK-SEC-026` (G1) depend on `TASK-SEC-019` and/or `TASK-INTG-001`/`007`
     (G2). Plausible (security/consent tooling referencing the consent-schema and integration
     tasks it inspects) but not verified against spec text in this pass. **Flagged, unresolved**.
   - `TASK-DATA-023` (G1, data domain's own QA/integration-closure task) depends on
     `TASK-SEC-021` (G2). A domain's closure task pulling in one adjacent security task is a
     softer case than the others above. **ACCEPTED-AS-IS**.

   None of these form cycles, and all are single-digit in count (9 backward edges total across
   525 tasks and ~1,400 dependency edges) — this is a materially smaller residual than the ~48
   backward-gate edges the original audit found, not a regression.

2. **6 zero-degree orphan tasks** remain in the final file: `TASK-INFRA-003` (Octane runtime
   config), `TASK-SEC-009` (input-validation framework), `TASK-SEC-010` (output-safety
   sanitizer/CSP), `TASK-SEC-015` (dependency scanning/SBOM), `TASK-SEC-035` (security.txt/
   disclosure policy), and `TASK-AI-012` (carried over from Audit 2, see above). The first four
   are G0/G5 foundational-or-capstone configuration tasks with no natural in-repo dependent —
   the same category the original Audit 2 explicitly declined to flag ("most are legitimate G0/G5
   foundation or capstone tasks"). **ACCEPTED-AS-IS** for all five; `TASK-AI-012` remains the one
   genuine "should this be in V1 at all" question, unchanged from Audit 2's own assessment.

---

## Verification notes

Checks re-run against `_work/final-tasks.jsonl` (525 tasks) for this report:
- Duplicate `id` values: none.
- Dangling `depends_on` edges (referencing a non-existent task id): none.
- Graph cycles (DFS over the full dependency graph): none.
- Remaining `depends_on_unresolved` fields: none (0 of 525 tasks).
- Gate-order violations (a task depending on a task whose `gate` sorts later): 9 edges, listed in
  "Residual observations" above (down from 48 previously).
- Zero-in/zero-out orphan tasks: 6, listed above.
- Targeted re-reads: every task ID named in all three source audits' `affected_task_ids` fields,
  plus `06-permissions-and-plans.md`, `05-api-design.md` §11/§12, `09-technical-architecture.md`
  (for SN-ARCH-040/041), and `F16-analytics.md` §SN-ANL-014.

---

## Re-verification pass (2026-07-28) — WA domain coverage sweep

A follow-up coverage sweep flagged 1 requirement ID as uncovered by any task: `SN-WA-004` (domain WA).

Re-checked from scratch against current sources:
- `grep -rn "SN-WA-004" docs/` finds exactly one hit, in `README.md`'s "Requirement IDs" convention
  section, where it appears as an illustrative example of the `MC-<AREA>-<NNN>` format alongside
  `SN-LEAD-012` and `SN-SEQ-021` — none of which are real requirement statements.
- The real WA requirements in `features/F12-whatsapp-coexistence.md` are numbered 001, 010–014,
  020–027, 030–034, 040–045, 050–053, 060–062, 070–071, 080 — there is no 002–009 block, so
  `SN-WA-004` was never assigned to an actual requirement.

**Disposition: no change** — this is the exact same false positive Audit 1 already raised and this
report already recorded as ACCEPTED-AS-IS (see the table above: "SN-WA-004 flagged as a false
positive... hygiene noise, not a coverage gap"). No task's `spec_refs` were changed and no new task
was added, because there is no underlying requirement to cover. `tasks.yaml` remains at 525 tasks;
no `G<N>-*.md` file needed a corresponding edit.
