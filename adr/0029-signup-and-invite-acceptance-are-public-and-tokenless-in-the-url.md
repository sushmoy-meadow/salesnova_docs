# ADR-0029 — Signup ends in a session, invite acceptance is public, and no credential rides in a URL

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

The signup, invitation and member-lifecycle endpoints publish their contracts ahead of the tasks
that assemble them ([ADR-0016](0016-contract-first-endpoints.md)). The specification describes the
flow in screens — identifier, then name and organisation, then a six-digit code, with a Google path
that skips the code — and screens do not translate to endpoints on their own. Three questions had
no answer in the specification, and each one fixes something the assembly tasks cannot revisit
without breaking a shipped client.

## Decision

**A stage answers with the state of the signup; completing it answers with a session.** There is no
terminal stage and no nullable session hanging off a stage response. `SignupState` says which screen
comes next and nothing about what happens after the last one; `AccountSession` is what the two
completing calls return. The alternative — one response type covering both, with the session present
only at the end — puts a null check on every stage transition forever to describe a state that lasts
one request.

**Google signup is one call, not a stage machine.** The specification requires it to skip the code
and to prefill the name and organisation screen from the token's claims. The client holds the
credential those claims are in while it renders that screen, so a round trip to hand them back buys
nothing; the name is optional on the request and the verified claim is the default. It posts the
token and the two fields and gets a session.

**Invitation acceptance is unauthenticated, and the token travels in the body.** Most people
following an invitation link have no account, and the service that accepts one already provisions
the user from the invited address — so requiring a session first would lock out the common case for
no gain. The token is a credential: in a path segment it lands in browser history, `Referer` headers,
proxy and access logs and error reports, none of which redact path segments. It is a body field.

**Deactivation names where the work goes, or refuses.** The two keys are mutually required and
mutually exclusive: send a membership id to reassign to, or send `leave_unassigned: true`. A `false`
is refused with an empty body, because declining to reassign without naming a target is silence
dressed as an answer. OpenAPI cannot express one-of-two, so both publish as optional and the rule
lives in validation.

**Deactivation answers with the membership, not the capability grid.** Deactivating moves
`memberships.status`. The grid survives untouched, which is what makes reactivating somebody a
status change rather than an administrator rebuilding their permissions from memory.

## Consequences

- The typed client gets `SignupState`, `AccountSession`, `Invitation` and `Membership` as four
  distinct shapes, and the signup screens can be built against them before any of it works.
- Every endpoint here answers 501 until `TASK-AUTH-010` and `TASK-AUTH-011` land.
- The unauthenticated endpoints sit on the address-keyed limiter at ten a minute rather than the
  general one. That is a ceiling on the whole address, not on one email or phone number; the
  per-identifier limit that stops somebody walking the address space belongs with the code issuer,
  which does not exist yet.
- `role_preset` on an invitation is refused when it says `OWNER`, which stops the label and not the
  power — the grid is the authority, and a check on the grid belongs with the code that reads it.
- Nothing here enforces a capability. The invitation and deactivation routes require a session and
  no more; the middleware that reads the membership grid is a separate task, and until it exists any
  authenticated member can reach these routes.

## Alternatives

- **Acceptance behind `auth:sanctum`, with signup carrying the invite token.** Rejected once the
  shipped `InvitationService::accept()` turned out to create or find the user from the invited
  address itself — the authenticated version would have contradicted the service and forced a
  sign-in screen in front of the one case the flow exists for.
- **`DELETE` for cancelling an invitation.** Rejected: the row is revoked and kept, the response is
  the revoked row rather than a 204, and the sibling deactivation endpoint already argues that a
  status transition is a named action rather than a removal.
- **A single `POST /signup` taking every field at once.** Rejected: the specification's three
  screens exist because each one is a place to abandon, and a single call cannot send a code between
  the second screen and the third.
