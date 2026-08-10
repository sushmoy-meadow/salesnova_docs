# 0051 — One gate decides whether AI may be offered, and off hides while down disables

- **Status:** Accepted
- **Date:** 2026-08-10
- **Task:** TASK-AI-018
- **Relates to:** `SN-AI-034` (degradation is graceful), `SN-AI-044` (per-tenant cost controls),
  `SN-AI-045` (off is a supported configuration), `SN-BILL-041`, ADR-0007 (AI substrate first),
  ADR-0050 (the request names its own tier)

## Context

An organisation can switch AI off entirely and the product must remain fully functional. That is a
hard requirement, and the way it is normally broken is not dramatic: one entry point out of thirty
checks a different flag, or checks none, and an org that paid for AI to be absent finds a "Draft a
reply" button on the one screen somebody forgot.

The same gate has to answer two other questions that arrive by different routes — the provider is
unreachable, and the org has spent its cap — and the temptation is to treat all three as one
"unavailable" and be done.

## Decision

**One function, and no entry point decides for itself.** `unavailableReason(conditions)` returns
`"off" | "over-cap" | "provider-down" | undefined`, and `AiFeature` is the only component that reads
it. An entry point is handed a **boolean**, never the reason: a control that receives the reason is a
control that can decide differently, and the one that decided differently is the bug. This is what
makes the off-switch a switch rather than a to-do list of controls to remember.

**Ordered by whose decision it was.** Off outranks everything: an org that switched AI off is not
told the provider is down, because that sentence implies it would be working otherwise and they are
the ones who turned it off. Between the other two, the cap comes first — it is the one they can act
on.

**Off hides; temporarily unavailable disables and says why.** A control that is never enabling again
this session is furniture — it invites a click, explains nothing, and leaves the manual path looking
like the second choice. A control that is coming back in a minute is the opposite: removing it moves
the layout under the reader for no gain. The reason sits beside the disabled control rather than in
a tooltip, and is wired as the control's `aria-describedby` — nothing is announced to a screen reader
by sitting next to something.

**Unknown is treated as no.** When the settings cannot be read at all, every AI entry point hides.
The manual path is complete, so withholding AI from an org that wanted it costs them a shortcut for
one page load; showing it to an org that switched it off costs them the thing they switched it off
for.

**Over the cap is a stop, not an invoice.** `capReached` is read off the numbers rather than a flag
beside them — two sources for one fact is one too many, and the flag is the one that goes stale. The
alert fires at 80% of the cap, because a warning at the moment the cap bites is a notification about
something that has already happened rather than a chance to act.

**Switching off is confirmed; switching on is not.** Reversible and wide, so the tier ladder puts it
at a plain confirm dialog. Only one direction is asked about: turning AI on costs nothing and the
same switch undoes it, while turning it off takes something away from people who are not in the room.

**The switch moves first and is put back if the server refuses.** `onSave` is a required prop, not an
optional one — a switch that moves and is never written back is a setting the owner believes they
changed, and making the callback optional lets a page ship exactly that.

## Consequences

- Every future AI entry point is one `AiFeature` wrapper. Nothing else in the app reads the AI
  settings, and nothing else may.
- The three reasons are deliberately **not** folded into `ACCESS_WALL_KINDS`. "Your org switched AI
  off" is not "coming soon", and an AI cap is the org's own limit rather than an upgrade prompt — the
  plan wall sells a plan and carries the props to do it; the cap message points at settings.
- A restricted member gets the permission wall the design system already ships, because the settings
  fetch keeps its failure code instead of collapsing every error into an outage.
- The cap alert has two tiers and no third: `clear` says nothing at all. A dashboard that always
  warns is a dashboard nobody reads.
- Nothing here can enforce owner-only access, and nothing pretends to. There is no session, no
  current user and no role anywhere in this repo yet; the only truthful gate available is reactive,
  and it is the one built.
