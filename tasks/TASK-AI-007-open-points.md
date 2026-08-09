# TASK-AI-007 — open points

Both acceptance criteria are covered by tests. What follows is what the task deliberately did not
build, and the findings from the review pass that were declined.

## 1. What is not here

**No per-capability model configuration.** It was built and then removed. A flat, provider-agnostic
map (`AI_MODEL_LEAD_PARSE=gpt-4o-mini` alongside `LLM_PROVIDER=anthropic`) passes every test and
fails at a customer's call, because a model name is provider vocabulary. The map belongs with the
resolver that reads it and with the adapter whose vocabulary it is — TASK-AI-008 — and shipping the
wrong shape early is worse than shipping none.

**No resolver.** `LlmOptionsDTO::$model` is required, so something above the port has to map a
capability to a model before the first real call. That something does not exist yet. The port is
complete and not yet callable end to end, which is the same seam ADR-0026 already accepted for the
other five ports.

**No adapter, and no `app/Services/Ai/Adapters/`.** The placement rule names that path in its
self-test only; nothing is placed behind it yet because nothing is required yet.

**No embedding model configuration.** `embed()` takes no capability and no options, so there is no
per-capability slot for the model it uses. The signature is the spec's and was not changed for it.
The adapter knows which embedding model it called and records it; a caller that needs to choose one
needs a key space separate from `AiCapability`, which is a decision for whoever introduces retrieval.

## 2. Declined findings

**`embed()` should return a DTO with the model and token counts, like `complete()`.** True, and it
would let a caller record embedding cost without re-tokenising. Declined because SN-AI-030 fixes the
signature as `embed(array $texts): array` and the criterion is "exactly the three specified
methods". Worth reopening with the adapter, as a spec amendment rather than a quiet divergence.

**`app/Services/Ai/` was too wide an exemption.** Taken, not declined — narrowed to
`app/Services/Ai/Adapters/`, so a model resolver or call recorder living beside the adapter cannot
import the SDK.

**Memoise `sourceFilesIn()` and `file_get_contents` across the architecture rules.** Measured at
0.05–0.10s on a 17s suite. Declined: it changes a helper eight other rules share, for half a percent.

**The suite's contract-import rule should not have exemptions.** It now has exactly one,
`Generator`. A streaming return type has no other spelling, and the language is not a dependency.

## 3. Residual risk

Both dependency rules read `use` statements. An SDK reached through a fully qualified name written
inline, or through a bare `Http::post()` to a vendor's endpoint, is not caught by either. The second
is the real hole: it needs a rule about outbound hosts, which belongs with the outbound resilience
framework rather than here.

`reviewedDependencies()` covers runtime packages only. A model SDK added to `require-dev` would not
trip the gate. That is deliberate — dev tooling is not shipped — but it means a prototype adapter
written against a dev dependency would pass.
