# ADR-0057 — Three deviations from the company bible, and why each one stands

**Status:** Accepted
**Date:** 2026-08-10
**Deciders:** Engineering

## Context

`meadowkart_backend_architecture_bible_by_claude.md` is the company standard for every Laravel
backend, and it closes with a sentence that makes this document necessary: *"Deviations require
explicit justification and team lead approval."*

SalesNova takes three. Each was taken deliberately and each is already shipped, which means the
choice is not whether to deviate but whether the deviation is written down. Undocumented, they are
found the way they are always found — by whoever reads the bible and the code side by side, decides
the code is wrong, and "fixes" it.

None of the three is a disagreement with the bible in general. Two are places where a normative
project specification is more specific than the company standard, and one is a place where the
bible's worked example contradicts a rule the bible itself would endorse.

## Decision

### 1. The API envelope is `{success, data, meta, policy}`

**The bible says** (Section 9, API Response Format): a bare `{data}` on success and
`{error: {message}}` on failure, and it explicitly forbids a `success` boolean on the grounds that
the HTTP status already carries it.

**We ship** the envelope from `05-api-design.md` §2: `{success, data, meta, policy}` on success and
`{success: false, error: {code, message, details, trace_id}}` on failure, with list responses
carrying `meta.pagination`, `meta.counts`, `meta.applied_filters` and `meta.sort`.

**Justification.** Two things in that shape are load-bearing and have no home in the bible's:

The dual `access_policy` / `subscription_access_policy` object is how the client renders a permission
refusal differently from a plan refusal without a second round-trip and without a rule duplicated in
the frontend. A 403 that does not say which of the two it is forces the client to guess, and the
guess is what produces an upgrade prompt shown to somebody who simply lacks the capability.

The error-code catalogue is a stable machine-readable identity for every refusal, which is what lets
a client act on `SEAT_LIMIT_REACHED` without matching on English. The bible's `{error: {message}}`
has nowhere to put it.

`trace_id` in the failure body is the smaller half of the same argument: a customer reporting an
error can quote it, and it resolves to one request in the logs.

The `success` boolean the bible forbids is the part with the weakest independent justification — the
status line does carry it. It stays because it comes with the rest of the shape from a normative
document, and half-adopting an envelope is worse than either whole. `05-api-design.md` is normative
for this project; the bible is the standard where the project specification is silent, and here it
is not silent.

**Scope.** The whole API. `App\Traits\ApiResponse` is the only thing that constructs a response body,
which is what keeps the deviation from spreading past one decision. See `TASK-ARCH-004`.

**Approval.** Recorded for team-lead sign-off. Merging this record is the approval.

### 2. Cross-module Eloquent imports are forbidden, including the bible's own example

**The bible says** — in Section 4's worked example — a `CartService` that imports the `Product`
model from another domain, as ordinary service-layer code.

**We ship** the rule from `SN-ARCH-002` and ADR-0008: a module never imports another module's
Eloquent model. Cross-module access goes through a published domain event or an explicit interface
in `app/Contracts/{Domain}/`, and it is enforced by tests in CI.

**Justification.** This is the one deviation where the bible contradicts itself rather than us. The
same document argues throughout for boundaries, for services that do not reach past their own
concern, and for interfaces over concrete dependencies; Section 4's example is a two-domain
illustration of a different point, and it happens to reach across a boundary to make it.

The rule wins because it is enforced and the example is not. A boundary that depends on nobody
copying a code sample is a convention, and the whole argument for a modular monolith over an
unstructured one is that the boundary is checked rather than remembered.

**Scope.** Every module. See `TASK-ARCH-001` and ADR-0008's amendment for how a module is resolved.

**Approval.** Recorded for team-lead sign-off. Merging this record is the approval.

### 3. The refresh-token chain is layered on Sanctum, not instead of it

**The bible says** (Section 13, Authentication & Authorization): Sanctum for all API
authentication.

**We ship** exactly that, with a 15-minute access token and a 30-day rotating refresh token whose
family is invalidated on reuse — built on Sanctum's personal access tokens rather than replacing
them with JWT.

**Justification.** This is listed as a deviation because a reader of Section 13 who finds a refresh
endpoint will reasonably suspect one, and should be able to confirm in one place that it is not.
Sanctum issues and verifies every credential; the rotation, the expiry and the reuse detection are
policy on top of tokens Sanctum still owns. Nothing in Section 13 is contradicted — no JWT was
introduced, no second guard, no parallel identity.

The reason for the layer is that a long-lived bearer token is the thing an attacker actually gets:
from a device backup, a shared machine, a logged URL. Fifteen minutes bounds what a stolen access
token is worth, and family reuse-detection turns a stolen refresh token into a detected event rather
than a silent parallel session.

**Scope.** All API authentication. See `TASK-AUTH-008`.

**Approval.** Recorded for team-lead sign-off. Merging this record is the approval.

## Consequences

A reader of the bible who reaches Section 4, Section 9 or Section 13 finds a note pointing here, so
the three places where this project reads differently are discoverable from the document that is
otherwise the source of truth.

The deviation list is closed by construction: anything not on it is a bug rather than a choice, and
adding a fourth means amending this record rather than writing code that quietly differs.

Two of the three come from `05-api-design.md` and `SN-ARCH-002` being more specific than the company
standard, which is the ordinary relationship between a project specification and a portfolio
standard — not a rejection of the standard. The third is a correction to an example, and it is worth
raising against the bible itself so the next project does not have to take the same deviation.

A test in the API repository asserts that this record exists, names all three, and that the bible
still points at it. That is a weak check — it reads for phrases, not for sense — but it is enough to
notice a record deleted or a pointer lost in an edit, which is how documents like this usually rot.
