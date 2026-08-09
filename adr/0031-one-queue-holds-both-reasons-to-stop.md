# ADR-0031 — One queue holds both reasons to stop, a confirmation is a type, and prompts are refused rather than redacted

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

Two governance requirements land on the same code. A capability must not send a message, reassign a
lead, delete a record, spend credits or change a permission unless a person agreed to it; and an
extraction the model was unsure about must reach a review queue instead of the record.

They read as separate features. Built separately they are two tables, two state machines and two
places to be wrong about who agreed to what — and the second one, in practice, is the one nobody
builds a queue for, because "write it only if confident" is a single `if` at the call site.

A third requirement sits beside them: what leaves for the provider carries no more of the tenant's
data than the capability needs. The tree already has `PiiRedactor`, which strips emails and phone
numbers from log lines.

## Decision

**One queue, two reasons to be in it.** A proposal is a row in `ai_proposals` carrying the action,
the payload, the subject and a confidence. A consequential action is held because of what it is; an
extraction is held because of how sure the model was. Both leave the same record of who decided,
when, and whether it was carried out — which is what a review surface, an audit trail and a
"why did this happen" question all need, and none of them care which reason put the row there.

The default is to hold. `AiAction::requiresConfirmation()` names the one case that does not need a
person — an extraction — and holds everything else, so an action added later is held until somebody
decides otherwise rather than the reverse.

**A confirmation is a type, not a boolean.** `ConfirmedAction` has a private constructor and is
minted only by reading `CONFIRMED` back out of storage. An executor cannot be handed one built from
an unsaved model, a status set in memory or a flag a caller passed itself. "No code path exists that
lets a capability act without confirmation" then means something a test can hold: an architecture
test keeps everything outside the proposal service off the `AiProposal` model, and the gate is the
only thing that produces the value an executor requires.

The decision is a compare-and-set on the pending row rather than a check followed by a write. Two
people pressing confirm at the same instant produce one decision, and redeeming the same agreement
twice fails on the second attempt — one confirmation, one execution.

**Prompts are refused, not redacted.** Reusing the log redactor here would strip exactly what
lead-parse exists to read: a pasted enquiry with an email and a phone number in it arrives at the
provider as an enquiry with the contact details removed, and the capability quietly stops working.
The guard instead refuses to send at all when the text carries a credential, a private key or a
payment card, and refuses input past a configured ceiling. Card detection is a Luhn check rather
than a digit-count, because a length rule alone rejects long international phone numbers.

The guard runs after the capability's configuration resolves, so a misconfigured capability is
refused without scanning the text first, and nothing is recorded for a call that was never made.

## Consequences

A capability that wants to act now proposes and waits, so every consequential path acquires a review
step and a surface to review on. That surface does not exist yet; until it does, a proposal is
created and nothing collects it, which is the correct failure — the alternative is acting.

The no-training assertion is deployment-wide configuration, refusing every call while it is unset.
Per-organisation, revocable consent needs organisation state and a settings surface, and is recorded
as open rather than approximated with a global flag pretending to be one.

Refusal over redaction means a capability can be handed input it cannot send, and the caller sees an
exception instead of a degraded answer. That is deliberate: a silently trimmed prompt produces a
confidently wrong extraction, which costs more to find than a refusal does.

Nothing yet writes to the audit trail when somebody confirms a consequential action. The row records
the decider and the time, which is the evidence; wiring it to the event log belongs with the task
that instruments the domain write paths.
