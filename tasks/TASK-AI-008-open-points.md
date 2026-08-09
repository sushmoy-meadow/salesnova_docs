# TASK-AI-008 — open points

Both acceptance criteria are covered by tests in `tests/Feature/Ai/LlmServiceTest.php`. The decisions
that shaped the adapter are in [ADR-0030](../adr/0030-a-capabilitys-rate-sits-beside-its-model.md).
What follows is what is owed, and what the simplify pass raised and did not get.

## 1. Owed to a later task

**Embeddings are not implemented and would not be recorded if they were.**
`OpenAiCompatibleLlmProvider::embed()` throws, and `LlmService` has no method that reaches it, so the
architecture test that keeps callers off the port also keeps them off embeddings. The recording shape
here assumes a prompt, a completion and a finish reason, none of which an embedding has; whoever
implements the retrieval index (TASK-AI-012) decides whether that is a second table or a nullable
column set.

**The rate that produced a price is still not recorded on the row.**
`TASK-AI-006-open-points.md` §1 assigned the rate-card version column to this task. It was not added,
and the reason is that the price list it assumed no longer exists: the rate now lives beside the
model in a capability's configuration, so the thing to version is the deployment's configuration, not
a table. Recomputing a historical period means knowing what the environment held at the time, which
is a deployment question. Left open rather than solved with a column that would name nothing.

**`prompt_version` is asserted by whoever builds the `PromptDTO`.** Nothing checks that the version
string describes the instruction it travels with, so the regression tracing the call log exists for
rests on caller discipline. The prompt catalogue in TASK-AI-009 should hand out the instruction and
its version together, at which point the pairing stops being assertable by hand.

**A retry or a fallback decision has nothing to read yet.** `LlmCallFailedException` says whether a
call timed out and that is all; a 429 and a 500 are both `rejected`. TASK-AI-011 is where degradation
policy is written, and it will need at least "is this worth retrying" on the exception.

## 2. Findings taken from the simplify pass

- The price list shipped empty with no environment binding, so a model named in `LLM_MODEL_*` was
  refused until `config/ai.php` was edited — which is a code deploy, and criterion 1 says there is
  not one. Rates moved into the capability block and come from the environment.
- Costing the model that *answered* let a provider-side alias rename throw while the row was being
  written, discarding a successful call that had already been paid for. The rate is now resolved once,
  before the request, and recording cannot fail on it.
- Latency was measured twice — once in the adapter, once in the service — and the adapter's number,
  which is the port's contract, was never read. One clock each now: the adapter's value on success,
  the service's on failure, where there is no response to carry one.
- Three bare `RuntimeException` throws for configuration gaps, in a tree where every other one is
  `UnconfiguredProviderException`. Now that, via a new `missingSetting()` factory.
- `Illuminate\Http\Client\ConnectionException` was being read in the service to classify a timeout,
  which put transport knowledge above the port and would have mis-recorded every timeout from any
  adapter that does not speak HTTP.
- The SSE reader kept looping after `[DONE]`, holding the connection open until the provider closed
  it, and re-copied its buffer once per line. It returns at the terminator and splits per read.
- A caller that stopped draining a stream destroyed the generator and left no row for a call that had
  already gone out. Recording moved into a `finally`.
- The architecture rule allowed all of `app/Services/Ai/`, so the next service in that namespace could
  have taken the port and spent invisibly. Narrowed to `LlmService`, the adapters and the binding.
- A response body with no trailing newline lost its last event, which is where the usage totals
  arrive.

## 3. Declined

**Recording on a queue instead of a blocking insert.** Correct on latency and wrong on the criterion:
a row that a failed queue can drop is not "every completed call produces exactly one row", and cost
attribution is the one thing this table exists for. Revisit if the insert shows up in a profile.

**A persistent Guzzle client on the adapter, to reuse the connection.** Real — `Http::baseUrl()`
builds a client per call, so every completion pays DNS, TCP and TLS again. Declined here because it
puts state on a class that is currently stateless and bound as a singleton under Octane, and no
measurement yet says what it would buy. It is a change worth making with a benchmark next to it.

**A byte ceiling on the SSE buffer.** A provider that never sends a newline would accumulate its whole
response in memory. `max_completion_tokens` bounds it in practice, and the alternative is a
configuration knob nobody would set correctly without a number to set it from.

**An outcome value for a stream nobody finished reading.** Recorded as `FAILED`, which is honest — no
usable usage came back — but it is not the same event as a provider failure. A fourth
`LlmCallOutcome` case would be the precise answer and would change a shipped enum and its value rule
for a case nothing queries yet.

**Moving the tenant id onto `PromptDTO`.** The house pattern carries the tenant inside the DTO, and
`complete(string $organizationId, PromptDTO $prompt)` lets the two be mismatched. Declined because
`PromptDTO` is TASK-AI-007's published port contract and the tenant is not the provider's business —
it would cross the port to reach nothing.

**An injectable model resolver, so the eval harness can vary a model without touching global config.**
That is TASK-AI-010's requirement, and building the seam before the thing that needs it fixes its
shape first.
