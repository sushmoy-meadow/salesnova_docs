# Open decision — is the tenant ambient or explicit?

Raised by merging `feature/arch` into `feature/sushmoy`. Both branches were right on their own and
disagree where they meet. One test is red until this is settled:
`tests/Unit/ArchitectureTest.php` → *every tenant model installs the organization global scope*,
failing on `Event.php`, `LlmCallLog.php` and `AiProposal.php`.

## The two positions

**Ambient.** A model with `organization_id` uses `TenantScoped`, which installs `TenantScope`.
The scope reads `TenantContext`, which `ResolveTenantContext` populates from the authenticated
user's membership. It fails closed: with no context every query becomes `1 = 0`. Anything that
legitimately reads across tenants wraps itself in `TenantQueryExemption`.

**Explicit.** `EventWriterService`, `LlmService` and `AiProposalService` take the organisation as a
parameter and check it themselves, because a service must be callable from a queue worker and a
console command where no request established a context. `AiProposalService::confirm()` compares the
passed organisation against the proposal's and answers `ORG_MISMATCH` → 404.

## Why they cannot both simply stay

A service that is handed one organisation and silently filtered by another produces a query that
matches nothing and an error that names the wrong cause. `confirm($proposal, $orgX, $membershipId)`
passes its own check, then updates zero rows because the ambient context holds `$orgY`, and reports
`INVALID_STATE_TRANSITION` — "already decided" — for a proposal nobody has touched.

## What each answer costs

Measured, not estimated: adding `TenantScoped` to `AiProposal` and `LlmCallLog` alone turns 21 tests
red across `tests/Feature/Ai` and `tests/Feature/Timeline`, all of them for the same reason — no
context, so `1 = 0`.

**Everything ambient.** Three models gain the trait, their services gain a context to activate or an
exemption to wrap, and roughly 25 tests gain a `TenantContext::activate()`. It also reverses
[ADR-0028](../adr/0028-the-call-log-is-telemetry-not-evidence.md), which decided the call log is
telemetry that outlives the tenant it belongs to; retention and cost reporting would move to
`TenantQueryExemption`, and the ADR needs amending rather than quietly contradicting.

**Two logs exempt.** `AiProposal` takes the trait — it is read by a request-scoped review surface —
and the rule records an exemption for append-only logs written through a service that is given the
organisation. Smaller, around 8 tests, but it narrows a tenancy invariant, which is the kind of hole
that is cheap to open and expensive to notice later.

**Nothing changes.** What is committed today. The invariant is advertised by a test that does not
hold, which is worse than either answer.

## What is not in question

Neither branch's isolation is weaker than the other in effect: cross-tenant reads answer 404 on both
paths today. This is about which mechanism the codebase commits to, not about whether tenants are
isolated.
