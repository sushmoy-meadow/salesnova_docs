---
doc: F08-sequences
status: REVIEW
owner: Product + Engineering
area_code: SEQ
depends_on: [04-domain-model, F06-content, F12-whatsapp-coexistence]
---

# F08 — Sequences

Multi-step follow-up programmes. The mechanism that lets a rep run a disciplined process without
being disciplined.

---

## 1. The central idea

### SN-SEQ-001 — `executor` is the switch ⭐

Every step declares who performs it:

| `executor` | Behaviour |
|---|---|
| **`USER`** | Becomes a task in the rep's queue. Sent from **their own WhatsApp**. Nothing happens until they act. |
| **`SYSTEM`** | Dispatched automatically via the API at the scheduled time. |

**This one enum is Privyr's best idea in the whole product**, and it is central to ours.

A "manual" sequence is not a degraded automated one — it is a **guided to-do queue**. It requires
no WhatsApp Business API, no template approval, no per-message cost, and it sends from the number
the lead recognises. That is why Privyr can sell "automation" to a solo agent with nothing but the
WhatsApp app on their phone, and it remains the right architecture for this market.

`SYSTEM` steps are the upsell, not the baseline.

### SN-SEQ-002 — Three sequence types

`MANUAL` (all `USER`) · `AUTOMATED` (all `SYSTEM`) · `MIXED`

`AUTOMATED` and `MIXED` require a connected WhatsApp account; `MANUAL` requires nothing.

---

## 2. Structure

### SN-SEQ-010 — Ordered steps with delays

| Field | Purpose |
|---|---|
| `order` | Execution order, including delay steps |
| `display_number` | UI numbering. **Separate.** Delay steps get `0` so they render *between* numbered steps |
| `delay_seconds` | Wait before this step |
| `delay_display_unit` | So "1 day" redisplays as days, not 24 hours |

> The `order` / `display_number` split is lifted from Privyr's `order` /
> `display_serial_number`. It is a small thing that makes the builder read correctly: a user thinks
> in "step 1, wait 2 days, step 2", not "step 1, step 2, step 3".

### SN-SEQ-011 — Four action types

| Action | Executor | Effect |
|---|---|---|
| `SHARE_CONTENT` | `USER` or `SYSTEM` | Mint and send a tracked link |
| `CONTACT_LEAD` | `USER` only | Prompt the rep to call/message, with instructions |
| `DELAY` | — | Wait |
| `SEND_WHATSAPP_TEMPLATE` | `SYSTEM` only | Send an approved template |

`CONTACT_LEAD` carries free-text `instructions` shown to the rep. It is how a manager encodes
"ask about their timeline, don't quote a price yet" into the process.

### SN-SEQ-012 — Limits

Max **20** steps. Max **1** active enrolment per (sequence, lead). Served in `app_constraints`.

### SN-SEQ-013 — Visibility

`PRIVATE` · `SUBTEAM` · `ORG`, same model as content. Creating requires `sequences.manage`;
enrolling a lead requires only lead access.

> Managers design the process; reps run it. Splitting those two permissions is what makes the
> feature usable in a team rather than a manager-only toy.

---

## 3. Break criteria ⭐

### SN-SEQ-020 — Sequences stop when a real conversation starts

```json
{"on_inbound_message": true,
 "on_outbound_message": false,
 "on_content_view": false,
 "on_stage_change": ["Converted", "Lost"],
 "on_follow_up_completed": false}
```

**`on_inbound_message` and terminal-stage breaks default to ON.**

> **This is the difference between a sequence engine that feels helpful and one that feels like
> spam.** A lead who replies "yes, call me tomorrow" must not receive step 3's "just checking if
> you saw this" the next morning. Privyr's recon shows no break-criteria mechanism at all — which
> is precisely why reps in this segment distrust automation and run sequences manually anyway.
>
> Build it in V1, not as a follow-up.

### SN-SEQ-021 — Breaking is visible and reversible

A break writes a `SEQUENCE_BROKEN` timeline event with the reason. The rep can resume from the same
step or restart.

### SN-SEQ-022 — Terminal stages break by default

Reaching a stage flagged `is_terminal` ([`F03`](F03-custom-fields-and-groups.md) §SN-FIELD-020)
breaks every active enrolment.

### SN-SEQ-023 — Opt-out breaks unconditionally

A WhatsApp opt-out breaks every active enrolment for that lead immediately, regardless of criteria.
Not configurable — it is a policy requirement, not a preference.

---

## 4. Enrolment

### SN-SEQ-030 — Four paths

`MANUAL` (from lead detail) · `BULK` (from a list or filter) · `RULE`
([`F09`](F09-automation.md)) · `API` (V1.5)

### SN-SEQ-031 — Bulk enrolment previews

`/preview` returns: how many are eligible, how many are already enrolled, how many have opted out,
how many are in a terminal stage, and the **estimated cost** if any `SYSTEM` steps send templates.

### SN-SEQ-032 — Re-enrolment is explicit

A lead who completed a sequence **MAY** be re-enrolled, but it requires explicit confirmation and
is recorded as a new enrolment. Automatic re-enrolment by a rule **MUST NOT** happen.

> Otherwise a lead who re-submits a form receives the intro sequence twice, which is the single
> most common complaint about every marketing automation tool ever built.

### SN-SEQ-033 — Removal

Removing a lead sets `status = REMOVED`, cancels pending steps, writes a timeline event. Completed
steps and their history remain.

---

## 5. Execution

### SN-SEQ-040 — `USER` steps land in a task queue

```
/my-tasks
```

Grouped by due date, mirroring the follow-up buckets. Each task shows the lead, the step, the
instructions and a **one-tap action** — open WhatsApp with the message pre-filled, or share the
content.

**`/my-tasks` and `/follow-ups` are separate surfaces.** A follow-up is the rep's own decision; a
sequence task is the process. Merging them makes it impossible to tell whether the queue represents
personal judgement or organisational instruction. They are visually consistent and cross-linked.

### SN-SEQ-041 — `USER` steps are completable or skippable

Complete (records what was sent, advances) · Skip (advances with a reason) · Snooze (delays the
step, not the sequence).

**Skipping is always available.** A rep who cannot skip a step that does not apply will abandon the
sequence entirely.

### SN-SEQ-042 — `SYSTEM` steps run server-side

Queued jobs, dispatched at `due_at`. Never a browser.

> ⚠️ **Privyr defect.** Their AI sequence generation registers steps one at a time from the
> browser, with the UI telling the user to "keep this window open". A closed laptop leaves a
> half-created sequence. Server-side, resumable, transactional.

### SN-SEQ-043 — `SYSTEM` steps re-check preconditions at dispatch

Immediately before sending, the system **MUST** re-verify: not opted out, WhatsApp account
`CONNECTED`, template still `APPROVED`, service window state, credit balance, break criteria not
met.

A failed precondition marks the step `FAILED` with a reason and writes a timeline event. **It does
not silently skip.**

> Everything can change between scheduling and dispatch — often days apart. The lead opts out, the
> number hits the 13-day disconnect, Meta pauses the template. Checking at schedule time only is a
> reliable way to send messages you should not have sent.

### SN-SEQ-044 — Rate limiting

`SYSTEM` sends respect the account's `throughput_mps` (5/sec on Coexistence) and quiet hours.
Steps scheduled inside quiet hours are **deferred to the next permitted time, not dropped**.

### SN-SEQ-045 — Failure handling

3 retries with exponential backoff for transient errors. Permanent errors (invalid number, opt-out,
template rejected) fail immediately with the reason. After a permanent failure the **enrolment
pauses** and notifies the owner rather than continuing to the next step.

**Acceptance criteria**

- `AC-SEQ-020.1` — Given an enrolment with `on_inbound_message: true` and a step due tomorrow, when the lead sends a WhatsApp message today, then the enrolment breaks and the step does not dispatch.
- `AC-SEQ-023.1` — Given three active enrolments for a lead, when they opt out, then all three break within 60 s.
- `AC-SEQ-043.1` — Given a step scheduled 3 days ago against a now-disconnected account, when dispatch runs, then it fails with `WA_NOT_CONNECTED` and a timeline event is written.
- `AC-SEQ-044.1` — Given a step due at 22:30 local with quiet hours 21:00–08:00, when the scheduler runs, then it dispatches at 08:00 the next day.

---

## 6. The builder

### SN-SEQ-050 — Vertical step list, relative-move reordering

```
POST /api/v1/sequences/{id}/steps/{step_id}/move
     {"position": "AFTER", "relative_to": "…"}
```

Never a full index array ([`05`](../05-api-design.md) §11).

### SN-SEQ-051 — Editing a live sequence

Editing a sequence with active enrolments **MUST** show how many are affected and let the author
choose:

| Option | Effect |
|---|---|
| **Apply to new enrolments only** | Default. Existing enrolments run the old definition. |
| Apply to all | Existing enrolments adopt the change from their current position |

> Silently changing what is already running is the fastest way to send the wrong message to a
> thousand people. Making it a choice — with the count visible — is the whole safeguard.

### SN-SEQ-052 — Preview

Before activating: the full timeline of what a lead enrolled today would receive and when, rendered
against a sample lead with tokens resolved.

### SN-SEQ-053 — `DRAFT` / `ACTIVE` / `PAUSED` / `ARCHIVED`

**`PAUSED` is a first-class state.** Pausing halts dispatch for all enrolments without breaking
them; resuming continues.

> Privyr's help flow steers users to "pause" via workarounds because the state does not properly
> exist — and deleting a manual sequence there destroys its `SHARE_CONTENT` timeline activities and
> breaks the associated links. Deletion should never be the only way to stop something.

---

## 7. Reporting

Per sequence: enrolled · active · completed · broken (by reason) · per-step completion and drop-off
· content view rate per step · median time to completion · conversion rate of enrolled leads to a
terminal `WON` stage.

**Per-step drop-off is the one that changes behaviour.** If 60% of leads break at step 3, step 3 is
wrong — and that is a finding a manager will act on, unlike an aggregate completion percentage.

---

## 8. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Sequences | 1 | 25 | unlimited |
| Steps per sequence | 5 | 20 | 20 |
| `MANUAL` sequences | ✅ | ✅ | ✅ |
| `AUTOMATED` / `MIXED` | ❌ | ✅ | ✅ |
| Active enrolments | 50 | unlimited | unlimited |

Manual sequences are on Free deliberately. They cost us nothing, they are the feature that makes a
solo agent effective, and they are the natural on-ramp to the automated tier.
