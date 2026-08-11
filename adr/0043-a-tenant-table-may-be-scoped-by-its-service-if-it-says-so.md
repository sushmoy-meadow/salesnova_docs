# ADR-0043 — A tenant table may be scoped by its service, if its model says so

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

Every tenant-scoped model installs `TenantScoped`, which adds a global scope reading the active
`TenantContext`. With no context the scope fails closed — `where 1 = 0` — so a query outside a
request returns nothing rather than everything. That is the right default for anything a route can
bind, and an architecture test enforces it across `app/Models`.

`AiProposal` broke the rule and turned out not to want the fix. It is an internal governance
record: a capability proposes an action, a person confirms it, an executor applies it. No
controller binds one, and `AiProposalService` already establishes the tenant on every public entry
point — `confirm()` and `reject()` compare the caller's organisation against the proposal's before
touching a row, and the ids reaching `markApplied()` come from an object those checks produced.

Installing the global scope on it did work, but it dragged the whole tenant-resource contract
behind it: a registered policy, an ability for that policy, and coverage in the isolation matrix.
There is no AI capability in the catalogue, so satisfying the rule would have meant publishing one
— a new checkbox in the product's permission matrix, invented to satisfy a lint rule rather than
because anyone asked for it. And the scope would have made a background apply depend on whatever
context happened to be active, which for a record written outside any request is a way to lose
writes rather than a way to protect them.

## Decision

**A tenant table may carry its organisation predicate in its service instead of in a global scope,
by implementing the marker `App\Contracts\Security\ScopedByCaller`.** The architecture rule accepts
`TenantScoped`, an append-only log, or that marker, and nothing else.

The marker is a promise with terms. Every public entry point on the owning service establishes the
tenant before it queries; the predicate is written out at the query rather than left to a caller
further up; and the first controller that binds one of these by id moves the model onto the global
scope, because at that point a route is choosing the row and the service is no longer the only way
in.

It is a marker interface rather than a list in the test because the exemption then travels with the
file it describes. A name in a test file is invisible from the model and survives a rename of the
thing it was excusing.

## Consequences

Two sanctioned tenancy mechanisms exist instead of one, which is a real cost: a reader now has to
check which applies before concluding a query is unscoped. The interface docblock carries the terms
so that check is one hop.

`AiProposal` keeps the explicit predicate added to `markApplied()` alongside the caller-side checks.
It is redundant today and deliberately so — it makes the invariant local to the query, which is
what survives somebody adding a second caller.

The exemption is not a quarantine for models nobody got round to scoping. A model that a route can
reach has no claim on it, and the rule still fails for anything carrying `organization_id` with
neither a scope, an append-only trait, nor the marker.

## Alternatives

**Publish an AI capability and wire the full contract.** Uniform, and the seeder and contract tests
are data-driven so most of it would follow automatically. Rejected because the capability would
exist to satisfy a rule rather than to express a permission anyone wanted, and a published
capability is product surface that is hard to withdraw.

**Leave it unscoped and name it in the test.** Rejected: it reads as a known defect being tolerated,
and it hides the reasoning from the file that needs it.
