# ADR-0030 — A capability's rate is configured beside its model, and the port reports whether a call timed out

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

The adapter behind the LLM port ([ADR-0026](0026-provider-ports-before-their-adapters.md),
[ADR-0027](0027-the-llm-port-holds-translation-only.md)) is the first thing that spends money, and
every call it makes has to leave a row in `llm_call_log`
([ADR-0028](0028-the-call-log-is-telemetry-not-evidence.md)) saying what it cost.

That row needs a price, and a price has to come from somewhere. The obvious shape — a table of
models keyed by the name the provider reports, sitting in config next to the endpoint — was built
first and had two faults that only showed once it was wired up.

The first is that it breaks the thing the model-per-capability design exists to give us: pointing a
capability at a different model becomes two edits in two places, one of them a code file, so a
change advertised as configuration needs a deploy.

The second is worse. A provider is free to resolve a stable alias to a dated version and report the
dated name back — the exact case a per-model table is keyed for. Cost it by the name that answered
and a rename we did not know about turns a successful, already-paid-for call into an exception,
thrown while writing the record, discarding both the answer and the row.

Separately, the adapter's transport failures were reaching the recording service as
`Illuminate\Http\Client\ConnectionException`, and the service was reading that class to decide
whether a call had timed out.

## Decision

**The rate is part of a capability's configuration, beside the model, and both come from the
environment.** `LLM_MODEL_LEAD_PARSE` moves with `LLM_PRICE_LEAD_PARSE_PROMPT` and
`LLM_PRICE_LEAD_PARSE_COMPLETION`. Two capabilities on one model repeat its rate, which is the
price of making "move this capability" a single coherent edit.

**The rate is resolved before the request goes out, and nothing re-resolves it afterwards.** A
capability whose rate nobody set is refused while refusing is still free. Once a call has been made
its cost is arithmetic on a number already in hand, so no configuration gap discovered later can
veto the record. The name the provider reports is still what the row stores — it is the useful
signal for noticing a version moved underneath us — it just no longer decides what the call cost.

**Failure classification crosses the port as a domain exception.** The adapter translates its own
transport into `LlmCallFailedException`, which carries whether the call ran out of time. The service
reads that flag rather than an HTTP client's class name.

## Consequences

Deployment gains six environment variables and loses a code file it had to edit to ship a model
change. A rate set wrong is a wrong number in a cost report rather than a failed call, which is the
correct trade for telemetry: the alternative refuses work over a reporting error.

Costing at the capability's rate means a provider that silently moves a capability onto a
differently-priced version is reported at the old price until somebody updates the environment. The
row still names what answered, so the discrepancy is visible; nothing detects it automatically, and
that belongs with the eval harness rather than here.

A non-HTTP adapter — a local model, a gRPC provider — now records timeouts correctly without the
service knowing anything about it, and the graceful-degradation path can decide to retry or fall
back without catching a framework exception.
