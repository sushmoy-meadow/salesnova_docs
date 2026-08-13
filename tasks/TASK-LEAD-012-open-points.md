# TASK-LEAD-012 — open points

What this slice could not close, and what would close it. Everything else it was asked for is built
and tested; the demo is in `TASK-LEAD-012-demo.md`.

## Detection is not yet on the inbound path

SN-LEAD-050 wants duplicate detection to run at lead creation — manual, import or integration —
before assignment. `LeadDuplicateResolver` does exactly that and is tested against all three policies,
but nothing calls it yet: `POST /leads` is still a 501 stub and there is no import or integration
ingest to hang it from. The demo drove the resolver directly, on a lead that had just been created.

**What closes it:** the lead-creation endpoint calling `resolve()` before assignment and honouring
`assignmentMayProceed` on the outcome, plus the same call on the import and integration paths as each
arrives.

## A merge cannot union what does not exist yet

SN-LEAD-052 lists five things a merge unions. Three of them have no table in this schema yet — groups,
content shares, and WhatsApp conversations — so the merge unions the two it can (custom-field values
and follow-ups) and moves the timeline and the follow-ups across.

**What closes it:** each of those three, as its own domain lands, published as a contract under
`app/Contracts/{Domain}/` in the shape `LeadTimeline` and `LeadFollowUpMerge` already use, and called
from `LeadMergeService::merge()` and its undo. The undo already records what it moved, so the shape
extends without changing.

## The earliest-pending follow-up rule

Recorded as ISS-010 rather than here, because it is a limitation of the `follow_up` table rather than
of this slice: there is no cancelled state and no soft delete, so nothing can be retired in a way an
undo could reverse. The merge keeps every follow-up instead.
