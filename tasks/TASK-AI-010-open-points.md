# TASK-AI-010 — open points

Both acceptance criteria are tested. The one thing to be plain about is what the recorded baselines
currently contain, which is nothing.

## No capability has actually been scored

`resources/evals/baselines.json` ships with an empty `capabilities` map. Nothing has been measured
because measuring means calling a real model, and this environment has no provider key — `config/ai.php`
reads every model name from an unset environment variable, so no capability is configured, none is
callable, and none can reach a customer.

This is the gate working rather than the gate being absent. `EvalGate` asks its question only of
capabilities that name a model, so a deployment that sets `LLM_MODEL_LEAD_PARSE` and ships without
running the eval fails the build with `LEAD_PARSE: never evaluated — run ai:eval --record`. Four tests
cover that path directly: enabled-but-unmeasured, measured-against-a-stale-prompt, below-floor, and the
one case that passes.

**What would close it:** whoever first configures a capability runs

```
php artisan ai:eval --capability=LEAD_PARSE --organization=<id> --record
```

against the provider, reviews the per-case failures it prints, and commits the resulting
`baselines.json` in the same pull request that sets the model. Until then the empty map is the honest
record.

## The floor is a judgement, not a measurement

`floors.default` is 0.8 — four checks in five. It was picked before anything was scored, which makes it
a stated intent rather than a calibrated threshold. The first real run will show whether it is
demanding or trivial, and it should be revisited then rather than treated as settled.

One floor covers all three capabilities. A per-capability floor chosen now would be a number chosen so
that whatever gets measured passes it; the shape to add one exists in `baselines.json` and should be
added when a capability has evidence to argue for its own.

## Drafting capabilities are graded by constraint, not by quality

The lead-parsing set is graded on extracted field values, which is a real correctness measure. The
message and sequence sets are graded on what a draft must not do — no invented price, no invented
delivery date, no false urgency, no claim that something was already sent — and on length and shape.

That catches the failures that matter commercially and it is fully automatable, but a draft can pass
every check and still be a bad message. Judging whether a draft is any good needs either human rating
or a model-graded rubric, and both are a larger piece of work than this task. The constraint set is
the floor under quality, not a measure of it.
