---
doc: 08-ux-flows
status: REVIEW
owner: Design + Product
audience: Designers, frontend engineers, QA
depends_on: [03-information-architecture, 07-design-system]
---

# UX Flows

The paths that matter, specified end to end. Each names its **budget** — the number it must hit —
because these flows are where the product promise is either kept or lost.

---

## Flow 1 — Signup to first message ⭐

### SN-UX-001 — Signup-to-first-message budget

The signup-to-first-WhatsApp-message flow MUST complete with a median time under 5 minutes,
including onboarding, seeding, and the first send. Onboarding MUST present no more than one
required field per step and MUST NOT show any upgrade prompt before the first message is sent.
Every skippable step MUST still leave the user at a usable, non-empty leads list in under 90
seconds.

**Budget: median under 5 minutes.** This is the product thesis expressed as a number.

```
Landing → /signup
   │  email or Google · one field
   ▼
Verify (Google skips)
   │  6-digit OTP · own URL, refresh-safe
   ▼
Complete account
   │  name · organisation name
   ▼
Onboarding  (server-driven, all skippable)
   │  industry ─────► seeds stages, custom fields, 3 message templates
   │  team size
   │  connect a lead source  ← skippable
   │  connect WhatsApp       ← skippable, THE moment
   ▼
Leads list — seeded and usable, never empty
   │  "Add your first lead" · "Import" · "Connect a source"
   ▼
Add a lead  (name + phone, 10 seconds)
   ▼
Lead detail — ContactActionBar above the fold
   ▼
Tap WhatsApp → composer with a seeded template
   ▼
Send → timeline event → first_response_at stamped ⚠️
   ▼
Activation checklist advances: 3 of 7
```

**Design rules**

1. Never more than one required field per step.
2. Industry seeding means the first screen has real structure, not an empty CRM.
3. **No upgrade prompt anywhere in this flow.** A user who has not sent a message has no basis to
   evaluate the offer.
4. WhatsApp connection is last because it needs the phone in hand. It is also the first activation
   task, so the moment is not lost.
5. If they skip everything, they still land somewhere usable in under 90 seconds.

---

## Flow 2 — Lead arrives to first response ⭐

### SN-UX-002 — Lead-arrival-to-first-response budget

A newly arrived lead MUST trigger an assignee notification within 5 seconds of webhook receipt,
with routing evaluated synchronously (under 50 ms) before that notification fires. The
notification's deep link MUST open directly into the lead's composer, not the lead list, and a
routing-rule failure MUST NOT prevent the lead from being created and notified as unassigned.

**Budget: notification within 5 seconds. Full round trip achievable in under 60.**

```
Facebook Lead Ad submitted
   ▼  webhook  (< 200 ms ack)
persist raw → verify signature → parse
   ▼
duplicate check  (< 100 ms)   ── match → FLAG_FOR_REVIEW, still assigned
   ▼
routing rules  (< 50 ms, synchronous)  → assign + enrol + group + fields
   ▼
push + email to the assignee          ← the clock starts
   ▼
Rep taps notification
   ▼  deep link
Lead detail — composer already open, template pre-filled
   ▼
Send
   ▼
first_response_at ⚠️ · unmark new · auto follow-up in 3 days
```

**Design rules**

1. The notification carries the lead's name and source. Enough to decide whether to act now.
2. The deep link opens **the composer**, not the lead list. Every intermediate tap loses leads.
3. Routing is synchronous — the lead is assigned before the rep is told about it.
4. If routing fails, the lead is still created and still notified, as unassigned, to a manager.
   **A failure in the optional part must not swallow the essential part.**
5. Escalation fires at 30 minutes if nobody responds ([`F14`](features/F14-team-and-subteams.md) §4).

---

## Flow 3 — Connecting WhatsApp ⭐

### SN-UX-003 — WhatsApp connection budget and consent

The WhatsApp Coexistence connection flow MUST complete in under 15 minutes and MUST disclose all
tradeoffs (loss of WhatsApp for Windows/Mac/WearOS, verified-badge ineligibility, unsynced group
and disappearing messages) before the QR scan step. Contact sync and history import MUST each be
independently declinable and resumable, and imported contacts MUST be reviewed, never
auto-created as leads.

**Budget: under 15 minutes, over 55% completion within 7 days of signup.**

```
Trigger: onboarding, activation task, banner, or settings
   ▼
Eligibility check   ── ineligible → click-to-chat + honest reason + notify-me
   ▼
What happens screen
   ├─ ✅ Your contacts sync
   ├─ ✅ Up to 6 months of chat history imports
   ├─ ✅ Every message you send from your phone appears here
   ├─ ⚠️ WhatsApp for Windows/Mac and WearOS stop working for this number
   ├─ ⚠️ No verified badge; you can't move to a full Business API number later
   └─ ⚠️ Group chats and disappearing messages don't sync
   ▼
Meta Embedded Signup  (popup)  → number entry → verification
   ▼
QR scan  — clear instructions: WhatsApp Business → Settings → Linked devices
   ▼
Consent, separately
   ├─ Sync contacts?        (skippable, resumable)
   └─ Import history?       (skippable, resumable)
   ▼
CONNECTED — usable immediately
   ▼  background
Contacts → reviewable import list, NOT auto-created
History  → phase 1 → 2 → 3, timeline shows partial state
   ▼
"Your conversations are now in SalesNova" — deep link to the inbox
```

**Design rules**

1. **The warnings come before the QR scan, not after.** We lose the ones who would have churned
   anyway, at zero cost instead of high cost.
2. Both syncs are declinable and both are resumable from settings.
3. The app is usable the instant the connection completes; sync is background.
4. Contact import is **reviewed, never automatic** — a rep's phone contains their dentist and their
   mother.
5. Failure at any step returns to a state with a clear retry, never a dead end.

---

## Flow 4 — Sharing content and getting the alert ⭐

### SN-UX-004 — Content-share and engagement-alert budget

Sharing content to a lead MUST complete in under 30 seconds, and an engagement alert MUST reach
the sharing rep within 5 seconds of a qualifying open (3 s visible, scroll, or interaction).
Re-sharing the same content to the same lead MUST preserve accumulated view/engagement stats
rather than resetting them, and the open event MUST be recorded on every plan regardless of tier.

**Budget: share in under 30 seconds. Alert within 5 seconds of the open.**

```
Lead detail → Share content
   ▼
Picker — recent first, searchable, filterable by folder and label
   ▼
Share sheet
   ├─ channel (default WhatsApp)
   ├─ accompanying message, pre-filled from DEFAULT_SHARE, editable
   └─ link preview
   ▼
Mint  (idempotent on content+lead — re-shares keep their stats)
   ▼
WhatsApp opens, link + message pre-filled
   ▼
Rep sends → timeline: CONTENT_SHARED
   ▼ ───────────────────────────────────────── hours later
Lead opens the link
   ▼
Engagement gate: 3 s visible, or scroll, or interaction
   ▼
View recorded · duration accrues on confirmed ingest
   ▼
Push to the rep, within 5 s:
   "Raj Kumar is reading Acme Residences Brochure"
   ▼  deep link
Lead detail, composer open, timeline showing the view
```

**Design rules**

1. Re-sharing the same asset to the same lead keeps the accumulated stats. Never resets.
2. The alert deep-links to the composer. **The lead is reading it right now.**
3. Duration detail is Pro; **the open event is free on every plan** — it is the hook.
4. The rep's own opens are excluded, and they are told so plainly when it happens.

---

## Flow 5 — The daily follow-up round

### SN-UX-005 — Follow-up queue clearing budget

The follow-up list MUST default to the `today` bucket, not `overdue`, and every row action
(WhatsApp, Complete, Snooze) MUST be completable without navigating to the lead detail screen.
Completing a follow-up MUST optimistically clear the row and prompt for the next follow-up date.

**Budget: clear a 20-item queue in under 10 minutes, without leaving the list.**

```
08:30 morning digest — names, not a count
   ▼
/follow-ups?bucket=today          ← default, NOT overdue
   ▼
Row: name · phone · stage · note · due · [WhatsApp]
   ├─ tap WhatsApp  → composer, log on return
   ├─ tap Complete  → clears, counts update optimistically
   ├─ tap Snooze    → +1 day / +1 week
   └─ tap row       → lead detail
   ▼
On complete → "Set the next one?" with quick-set shortcuts
   ▼
Queue empties → "Done for today" + the overdue count as a next step
```

**Design rules**

1. **Opening on `today`, not `overdue`.** A wall of failure first thing is demoralising and
   unhelpful; the overdue count is right there on its tab.
2. Everything actionable from the row. Opening the lead is optional, not required.
3. Optimistic updates — the row clears immediately and reconciles in the background.
4. Completion prompts the next follow-up, dismissible, remembered for the session.

---

## Flow 6 — Building a manual sequence

### SN-UX-006 — Sequence-creation budget and break-criteria default

A first sequence MUST be creatable and active in under 5 minutes, offered from an
industry-seeded template by default. Break criteria (inbound message, terminal stage) MUST
default to ON, and editing a live sequence MUST prompt whether the change applies to existing
enrolments, showing the affected count.

**Budget: first sequence created and active in under 5 minutes.**

```
Content → Sequences → New
   ▼
Start from a template (industry-seeded) or blank
   ▼
Builder — vertical step list
   ├─ + Step: Share content · Contact lead · Delay · Send template
   ├─ each step: executor USER or SYSTEM (SYSTEM needs WhatsApp)
   ├─ USER steps carry instructions for the rep
   └─ reorder by drag → relative-move API
   ▼
Break criteria — inbound message ON, terminal stages ON, by default
   ▼
Preview — the full timeline against a sample lead, tokens resolved
   ▼
Activate
   ▼
Enrol from a lead, a list, a filter, or a routing rule
   ▼
USER steps appear in /my-tasks, due-date grouped
   ▼
Rep completes → advances → next step scheduled
   ▼
Lead replies → break criteria fire → SEQUENCE_BROKEN, rep notified
```

**Design rules**

1. Templates first. A blank sequence builder is where good intentions die.
2. The `USER`/`SYSTEM` distinction is explained inline, in plain language, not in a help article.
3. **Break criteria default ON.** The safe default is the one that does not spam.
4. Editing a live sequence asks whether the change applies to existing enrolments, showing the count.

---

## Flow 7 — Sending a campaign

### SN-UX-007 — Campaign send gate

A campaign MUST NOT be sendable without an executed, costed preview showing matched/eligible/
excluded counts, GST-inclusive cost, and estimated send duration. Sends above 100 recipients MUST
require the operator to type the recipient count to confirm, and quality-RED campaigns MUST be
blocked from sending.

**Budget: cannot be sent without an executed, costed preview.**

```
Campaigns → New
   ▼
Choose or create a template → Meta approval (state visible)
   ▼
Audience: filter (preferred) · upload · paste
   ▼
Map variables → live preview against a real lead
   ▼
PREVIEW  ← mandatory
   ├─ 1 284 matched · 1 197 eligible
   ├─ excluded: 43 opted out · 31 no WhatsApp · 13 invalid
   ├─ cost ₹1 123.45 incl. GST · balance ₹5 000
   ├─ duration ≈ 4 minutes at 5 msg/sec
   └─ sample rendered message
   ▼
Guardrails
   ├─ quality RED     → blocked
   ├─ quality YELLOW  → warn + confirm
   ├─ >50% of leads   → warn
   └─ quiet hours     → deferred, actual time shown
   ▼
Confirm — type the recipient count above 100
   ▼
Sending — live progress, cancellable
   ▼
Per-recipient status from webhooks
   ▼
Replies land in the inbox and open a free 24-hour window
```

**Design rules**

1. Preview is a gate, not a courtesy. No preview, no send.
2. Cost is shown GST-inclusive — that is the number leaving their account.
3. Guardrails protect the customer's number, and ours. Explain, do not just block.
4. A reply is a conversation, not a metric. That is the whole advantage of Coexistence.

---

## Flow 8 — Hitting a plan limit

### SN-UX-008 — Plan-limit messaging

A plan-limit block MUST be surfaced inline, in context, never as an interstitial, and MUST state
the specific limit, current usage, and the tier that lifts it. At most one upgrade interstitial
MAY appear per session, and completing an upgrade MUST return the user to the action they were
originally attempting.

**Budget: the user understands exactly what they get and why, in one screen.**

```
Action attempted → 423 PLAN_LIMIT_REACHED
   ▼
Inline, in context — not an interstitial
   ├─ "You've used all 5 custom fields. Pro includes 30."
   ├─ [ See Pro ]   [ Not now ]
   ▼
Plan comparison, the triggering feature highlighted
   ▼
Upgrade → prorated → immediate access → return to the original action
```

**Design rules**

1. Specific numbers, always: the limit, current usage, the tier that lifts it.
2. Plan-locked controls stay **visible** with a lock. Permission-denied controls do not — and carry
   no upgrade CTA.
3. One interstitial per session, maximum. Inline locks are information, not interruption.
4. After upgrading, **return to what they were doing.** Not to a dashboard.

---

## Flow 9 — WhatsApp disconnection recovery ⚠️

### SN-UX-009 — Disconnection escalation and gap marking

WhatsApp disconnection risk MUST escalate on a fixed schedule (day 7 warning, day 10 critical,
day 13 disconnected), and reconnection MUST preserve all history with no re-import. A
disconnection gap MUST remain permanently marked on the timeline once it has occurred, even after
reconnection.

**Budget: reconnected before day 13, with no data loss.**

```
Day 7   WARNING   in-app banner + email
        "Open WhatsApp Business on your phone within 6 days"
   ▼
Day 10  CRITICAL  non-dismissible banner + daily push, owner notified
   ▼
Day 13  DISCONNECTED
        full-width alert · timeline shows a gap marker
   ▼
Guided reconnection
   ├─ Step 1: open WhatsApp Business on your phone
   ├─ Step 2: Settings → Linked devices
   └─ Step 3: scan
   ▼
Reconnected — all history preserved, no re-import
   ▼
Gap remains marked: "SalesNova wasn't receiving messages 3–7 Aug"
```

**Design rules**

1. The fix is five seconds of work. The copy must say that, without alarm.
2. Escalation is proportionate — nagging from day 1 trains people to ignore the banner that matters
   on day 12.
3. **The gap is marked permanently.** "Nothing happened" and "we weren't watching" are opposite
   facts and a rep cannot otherwise tell them apart.
4. Reconnection never re-imports and never loses anything.

---

## Flow 10 — Duplicate resolution

### SN-UX-010 — Duplicate-lead resolution

Under the default `FLAG_FOR_REVIEW` policy, duplicate leads MUST NOT be auto-merged; both
records MUST be retained and flagged for manual, side-by-side resolution. A merge MUST record a
`LEAD_MERGED` event carrying full pre-merge state and MUST be undoable for 30 days.

```
Lead arrives → phone or email matches an existing lead
   ▼
Org policy = FLAG_FOR_REVIEW (default)
   ▼
Both created/retained, both flagged, queued
   ▼
/leads/duplicates — side-by-side, field by field
   ├─ per-field winner selection
   ├─ combined timeline preview
   └─ [ Merge ]  [ Not duplicates ]  [ Skip ]
   ▼
Merge → union of groups, fields, shares, follow-ups, conversations
      → LEAD_MERGED event carrying full pre-merge state
      → 30-day undo
```

**Design rules**

1. Never auto-merge on the default policy. Shared phone numbers are common in this market, and a
   bad merge is unrecoverable without the undo.
2. "Not duplicates" is remembered — that pair is never flagged again.
3. Undo restores both records with their original timelines.

---

## Cross-cutting rules

### Optimistic UI

#### SN-UX-011 — Optimistic UI rollback

Optimistic UI updates (follow-up complete, stage change, group assign, inline field edit, message
send, mark read) MUST apply instantly on the client. A failed mutation MUST revert only the
affected element, with an inline error and retry, and MUST NOT surface a full-screen error for a
single failed operation.

Applies to: follow-up complete, stage change, group assign, inline field edit, message send, mark
read.

The change appears instantly; failure reverts **that element only**, with an inline error and a
retry. Never a full-screen error for a single failed cell.

### Offline and flaky connections

#### SN-UX-012 — Offline and flaky-connection handling

Reads MUST be served from cache with a staleness indicator when offline, and writes MUST be
queued and retried with a visible pending state. A connectivity banner MUST appear only after 5
seconds of failure, not immediately, and a queued write MUST survive a page reload without loss.

- Reads served from cache with a staleness indicator
- Writes queued and retried, with a visible pending state
- A connectivity banner appears after 5 seconds of failure, not immediately
- **Nothing is lost.** A queued message survives a page reload.

### Confirmation is proportionate to consequence

#### SN-UX-013 — Confirmation proportionate to consequence

Confirmation UX MUST scale to consequence: no confirmation for small reversible actions (toast
with undo), a dialog for large-reversible or small-irreversible actions, and type-to-confirm for
large-irreversible actions. Any action that spends money MUST show a cost preview before
requiring confirmation.

| Consequence | Treatment |
|---|---|
| Reversible, small | None. Toast with undo. |
| Reversible, large | Confirm dialog |
| Irreversible, small | Confirm dialog with the consequence stated |
| Irreversible, large | Type-to-confirm the count or the name |
| **Spends money** | **Preview with cost, then confirm** |

### Deep links resolve or explain

#### SN-UX-014 — Deep links resolve or explain

Every deep link MUST either resolve to its target or explain why it cannot (deleted, no
permission, plan-locked). A deep link MUST NOT render a blank screen or silently redirect to the
dashboard without explanation.

Every deep link either resolves to its target or explains why it cannot — deleted, no permission,
plan-locked. **Never a blank screen, never a redirect to the dashboard with no explanation.**
