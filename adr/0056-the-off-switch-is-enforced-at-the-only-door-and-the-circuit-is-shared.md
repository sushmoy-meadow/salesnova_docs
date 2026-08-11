# ADR-0056 — The off-switch is enforced at the only door, and the circuit is shared

**Status:** Accepted
**Date:** 2026-08-10

## Context

ADR-0051 settled what the client does with an answer: one gate, `off` hides, `over-cap` and
`provider-down` disable and say why, and an entry point is handed a boolean rather than a reason. It
did not say where the answer comes from, and the server half has three questions of its own.

An organisation can switch AI off entirely and the product must remain fully functional. The way
that requirement is normally broken is not dramatic — one capability out of thirty checks a
different flag, or checks none, and an organisation that paid for AI to be absent finds it running
on the one path somebody forgot.

Separately, a provider that has stopped answering costs every caller a full timeout. Thirty seconds
per request is how one slow dependency becomes a slow product, and it is the difference between an
outage that degrades and an outage that hangs.

## Decision

**The switch is a column on the organisation, read through a port.** `organizations.ai_enabled`
defaults to true; the AI module reads it through `App\Contracts\Organizations\AiSwitch` rather than
by querying the table, because the setting belongs to the organisation and the module boundary is
not suspended for a boolean. The implementation answers false for an organisation it cannot find —
a mistyped id should not be the one caller that gets past the gate.

**`AiAvailability` is the only thing that decides, and `LlmService` is where it is enforced.**
`LlmService` is already documented as the only way into the model, which makes it the one place a
check cannot be forgotten: a capability written next quarter is gated by having been written at all.
The check runs before the prompt is scanned and before anything is recorded — nothing left the
process and nothing was spent, so a usage row would describe a call that never happened, and the
usage log is what a bill is argued from.

**A build that named no model answers `off`, not `provider-down`.** From the reader's side these are
not the same sentence: `provider-down` implies it would be working otherwise and invites a retry. A
deployment with no model configured is as settled as an organisation that chose to have none, and a
control disabled for the life of the deployment is furniture — it invites a click, explains nothing,
and leaves the manual path looking like second best. Both render as hidden, so both answer `off`.

**The circuit is global, not per-organisation.** There is one provider. A per-tenant counter makes
every tenant pay its own run of timeouts to learn what the first one already found out. The failure
count and the cooldown share a lifetime, so a trickle of failures across an afternoon never
accumulates into an outage nobody is having — only a run inside one window opens it. One success
clears the count outright rather than decrementing it: the provider answering is better evidence
than a stale count that has not expired.

**Storing a proposal asks only the organisation's switch.** A proposal in hand came from a call that
already went out and was already paid for; refusing to store it because the provider has since
stopped answering discards work for nothing. Deciding an existing proposal — confirming or rejecting
— is not gated at all. Those rows are already there, somebody has to answer them, and refusing the
answer strands them in a queue that cannot be cleared.

## Consequences

Switching AI off for an organisation takes one column and needs no capability to cooperate. Every
manual path keeps working because no manual path asks the gate, which is the property the hard
requirement actually needs — and it is asserted directly: with AI off and the provider throwing, the
member lifecycle endpoints still answer 200.

`over-cap` is in the enum and nothing produces it. Per-organisation cost caps are not built, and
inventing a cap here to give the case a producer would be a number chosen so that nothing hits it.
The value exists because the client already reads the three-value union; the day caps land, the
producer is a condition added to `AiAvailability` and no entry point changes.

The reason does not yet reach the shell. `/bootstrap` answers 501 and its payload has a normative
thirteen-key shape, so a fourteenth key is a specification change rather than a backend decision.
When bootstrap is assembled the switch travels as a feature flag, which is the channel that shape
already documents, and the client derives the other two reasons from its own request outcomes as
ADR-0051 describes.

A shared circuit means one organisation's traffic can open it for everybody. That is correct when
the provider is genuinely down and wrong when a single tenant sends prompts that get rejected. The
distinction is not one the failure count can make; if it starts mattering, the fix is to count only
transport failures rather than all of them, not to shard the counter per tenant.
