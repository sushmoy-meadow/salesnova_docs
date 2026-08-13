# TASK-AUTH-014 — open points

All three acceptance criteria are built, tested and demonstrated; the demo is in
`TASK-AUTH-014-demo.md`. What follows is one decision the spec does not make, taken here with a
reason, and one thing the browser could not show.

## How long a dismissal lasts

SN-AUTH-050 says which warnings may be dismissed and why, and says nothing about how long a
dismissal holds. The neighbouring requirement is explicit where it wants durability — SN-AUTH-041
says the checklist's dismissal "**MUST** persist" — so the silence here reads as deliberate rather
than as an omission of the same rule.

This slice makes a warning dismissal **session-scoped**: `sessionStorage`, per browser tab, cleared
when the tab closes. The reasoning is what the two dismissals are for. The checklist is a decision
about the account — *we are never inviting anyone* — and it is stored server-side against the
membership that made it. A banner is a decision about *right now*: the seat limit is still reached
tomorrow, and a reader who waved it away this afternoon has not agreed never to be told again.
Anything longer would need to answer what re-raises it, and nothing in the spec tree says.

Three things that follow, all of them live behaviour rather than intentions:

- Dismissal never suppresses a warning the server has pinned open. `visibleWarnings` filters on
  `dismissible && dismissed`, so the same code coming back non-dismissible — an expiry that was a
  warning last week and is an error once the plan lapses — draws regardless.
- A dismissal is a client fact and never reaches the API. No endpoint, no column, no bootstrap
  field, so making it durable later is additive.
- An unreadable stored value shows every banner again rather than trusting it (`dismissedCodesFrom`).

**What closes it:** a decision. If per-membership durability is wanted, it is a dismissals table
keyed by `(membership_id, code, raised_at)` and a `dismissed` flag on the entry — the rendering
contract does not change, because the component already asks only whether to draw.

## The producer-extension criterion is held by test, not by the demo

> Adding a new banner producer requires no changes to the rendering contract, only a new entry
> generator

Demonstrating this in a browser means adding a producer while the servers are running, which is a
code change mid-demo rather than an actor doing something. `BootstrapWarningsTest` holds it instead:
it binds an anonymous `ShellWarningProducer`, tags it `shell.warnings`, and asserts the entry
arrives in the payload unchanged with no controller, DTO, resource or component touched. The live
run shows the same property from the other end — two producers, one list, two banners drawn by one
component.

**What closes it against the browser:** the next real producer. WhatsApp health (F04) is the one the
spec names, and when it lands it should need nothing in this slice but its own class and one line in
`AppServiceProvider`. If it needs more than that, this criterion regressed and the test did not
catch it.
