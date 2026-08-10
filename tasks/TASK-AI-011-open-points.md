# TASK-AI-011 — open points

Both acceptance criteria are tested. Three things are worth saying plainly about what the gate does
and does not yet reach.

## Nothing produces `over-cap`

`AiUnavailableReason` carries three values and the server produces two. Per-organisation AI cost
caps are `SN-AI-044`, which is not built — there is no per-org budget, no spend counter and no
alert threshold, so there is nothing to be over.

The value is in the enum because the client already reads the three-value union that ADR-0051
settled, and adding a case later would change a published shape. Inventing a cap here to give the
case a producer would mean choosing a number so that nothing hits it, which proves nothing and
would have to be re-chosen the day real caps arrive.

**What would close it:** the billing task that introduces per-org AI budgets adds one condition to
`AiAvailability::reasonFor()` — spend for the period against the plan's cap — ordered after the
switch and before the circuit, per ADR-0051. No entry point changes, because none of them decides.

## The reason does not reach the shell yet

`/bootstrap` answers 501 and its payload has a normative thirteen-key shape (`SN-ARCH-088`), so
adding an `ai` key is a specification change rather than something a backend task should do on its
own way past. Nothing client-facing currently reads the gate.

**What would close it:** whoever assembles the bootstrap payload surfaces the organisation's switch
through `feature_flags`, which is the channel that shape already documents for exactly this. The
client derives `provider-down` from its own request outcomes and `over-cap` from the subscription
block, as ADR-0051 describes — so only the switch has to travel.

## "Every dependent feature" is two features today

The criterion asks that forcing the provider to fail leaves every dependent feature usable via its
manual fallback. The dependent features that exist are the model call itself and the proposal store;
lead parsing, message drafting and sequence drafting have prompts and evaluation sets but no
endpoint or job calling them yet.

What is tested is the property that will hold for those when they arrive: the gate is enforced
inside `LlmService`, which is the only way into the model, so a capability is gated by having been
written at all. The manual paths are asserted directly — with AI off and the provider throwing, the
member lifecycle endpoints still answer 200 — but there are only a handful of manual paths built to
assert against.

**What would close it:** each capability task (`TASK-LEAD-*`, `TASK-WA-*`) adding a test that its
own endpoint still serves the manual path with the provider failing. That belongs with the
capability, not here, because the fallback is specific to what the capability was going to do.
