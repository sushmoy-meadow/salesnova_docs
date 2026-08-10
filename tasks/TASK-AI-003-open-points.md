# TASK-AI-003 — open points

Both acceptance criteria are tested. This file exists because the task's description names write paths
that do not exist in the tree yet, and it is worth being explicit about which of them this build
actually wired and which it only made wire-able.

## What was wired

`LeadAssignmentService::reassign()` — the one core domain write path that exists today. Each lead that
moves produces `LEAD_ASSIGNED` or `LEAD_UNASSIGNED` with the membership it moved from and to, and the
move and its event are one transaction, so there is no state where leads changed hands with nothing
recorded.

## What could not be wired, because it has not been built

| Write path the task names | Owned by | Status |
|---|---|---|
| Lead creation | TASK-LEAD-007 | pending, unclaimed |
| Lead stage change | TASK-LEAD-009 | pending, unclaimed |
| Fuller assignment logic (manual, round-robin, rules) | TASK-LEAD-010 | pending, unclaimed |
| Rule routing decisions, with their reason | TASK-RULE-004 | pending, unclaimed |
| Sequence enrolment and break decisions | TASK-SEQ-004, TASK-SEQ-005 | pending, unclaimed |
| Message send and receive | TASK-WA-009, TASK-WA-011 | pending, unclaimed |

None of these are blocked on anything this task owns. Each of them appends through `EventWriter` and
inherits correlation from `CausationContext` without doing anything — that is what the mechanism is
for, and it is why it was built before the paths rather than after.

## The criterion's literal instance is not the one that is tested

AC1 reads: *a stage change caused by an inbound message produces two correlated events with a shared
correlation_id*. There is no WhatsApp ingestion and no lead stage machine, so the tested chain uses the
real `WHATSAPP_INBOUND` and `LEAD_STAGE_CHANGED` event names appended by the test itself, including one
crossing a serialised-and-rehydrated context the way a queued job does.

**What would close it properly:** once TASK-WA-009 lands webhook ingestion and TASK-LEAD-009 lands stage
transitions, a test that posts a real inbound webhook and asserts the resulting stage change shares the
inbound message's `correlation_id`. TASK-AI-021 is the verification task that should own that assertion.

## Reassignment records no reason of its own

`reassign()` records that a lead moved and between whom, not why — the contract has no reason
parameter, and adding one would make every caller invent a vocabulary. The why is meant to arrive as
causation: the deactivation, rule or bulk action that triggered the move appends its own event and
wraps the call in `CausationContext::within()`. Nothing does that yet, because member deactivation is
an audit-log action and has no event name in the taxonomy. Whoever adds one should wrap the
reassignment call rather than extend the signature.
