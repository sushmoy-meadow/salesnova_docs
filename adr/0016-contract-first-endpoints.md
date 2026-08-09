# ADR-0016 — An endpoint publishes its contract before its logic, and answers 501 until then

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

The backlog splits several endpoints across two tasks: one defines the request/response contract,
route and generated types; a later one assembles the payload. `TASK-ARCH-005` and `TASK-ARCH-013`
are the first pair, and `TASK-ARCH-006` / `007` / `008` / `009` are the same shape.

That split exists because the Next.js repositories consume `contracts/api-types.ts`. A published
contract unblocks frontend work weeks before the data behind it exists, which is the point of
generating the client from the server rather than hand-writing it.

It also creates a gap. Between the two tasks the route exists and has nothing truthful to return,
and the obvious ways to fill that gap are all wrong:

- **Return a fabricated payload.** A frontend built against fixtures ships assumptions no server
  ever promised — a field that is always present in the fixture and null in production, an empty
  array where the real answer is an error.
- **Widen the contract so the missing parts are optional.** This moves a temporary implementation
  gap into a permanent shape the client must null-check forever.
- **Leave the route unregistered.** The generated types are then missing the type the frontend was
  waiting for, which defeats the split.
- **Return 500.** The client's generic error handling treats it as transient and retries something
  that cannot succeed until the feature ships.

## Decision

**A contract-first endpoint registers its route, publishes its full response schema, and returns
`501 NOT_IMPLEMENTED` until its assembly task lands.**

The response shape is a tree of `final readonly` DTOs under `app/DTOs/{Domain}/`, declared on the
controller action with Scramble's `#[Response(status: 200, type: …)]` attribute — necessary because
the `ApiResponse` trait's `mixed $data` parameter erases any shape the generator could otherwise
infer. `#[SchemaName]` fixes the published name, so the `DTO` class suffix the bible requires never
reaches the TypeScript client.

The DTO tree is what makes this safe rather than a promise. Its public properties are simultaneously
the published schema and what `json_encode` emits, and the assembly task types its assembler to
return the root DTO — so a payload missing a field fails to construct in PHP, and one carrying an
extra field changes the published schema. Contract and payload cannot drift.

`NOT_IMPLEMENTED` is a new error code, mapped to 501. The client distinguishes "not built yet" from
"broke", and can render a coming-soon state instead of a retry.

The generated document also carries the invalidation header contract: every 2xx of every non-`GET` /
`HEAD` / `OPTIONS` operation advertises an optional `X-Bootstrap-Stale: true` response header. This
is applied by HTTP method in the document transformer rather than by annotation, so the first real
write endpoint inherits it without anyone remembering to ask. Deciding that a given mutation was
relevant, and actually setting the header, belongs to the runtime that owns the mutation.

**The header is documented on writes only, which is narrower than the specification.** The normative
text puts it on any request following a relevant mutation, which includes a read that follows
*someone else's* write — an administrator changing the plan, the seat count or a feature flag while
another member has the shell cached. Covering that needs a per-organisation invalidation stamp read
on every response, which is a runtime mechanism this contract task does not build and cannot
usefully document. Documenting the write case now keeps the published contract truthful about what a
client can rely on; the read case is deliberately absent rather than advertised and unimplemented.
Until the stamp exists, no operation actually sets the header — the document describes a shape, not
a behaviour.

Authentication is documented from route middleware rather than annotated per operation, so an
endpoint that gains or loses `auth:` cannot end up published as the opposite of what it enforces. A
bearer scheme becomes the document-wide default and unauthenticated routes are published as
`security: []`. An authenticated operation is therefore the one that carries no `security` key at
all, which reads backwards until you know the default is set.

## Consequences

- Frontend work on a screen starts as soon as its contract task closes, against types that are the
  real ones rather than a stand-in.
- A 501 in the wild is unambiguous: some endpoint's assembly task is still open. It is not a fault
  to page on, and it is not something a client should retry.
- Every one of these endpoints is a promise the backlog must keep. A 501 that survives past its
  assembly task is a broken published contract, not a slow rollout — the pairs must stay linked.
- The acceptance criteria for a contract task are testable without any data: the generated document
  and the compiled TypeScript are the artefacts under test. That is why these tasks assert against
  `generatedSpec()` and against `tsc`, not against HTTP responses.
- 501 joins the published status set. Client error handling has one more case, and the error
  catalogue grows by one permanent code.
- `X-Bootstrap-Stale` is not delivered by the contract task that names it. The task that builds the
  invalidation stamp owns both broadening the documented rule to reads and making any operation set
  the header; until then nothing in the shipped document mentions it, because no write endpoint
  exists for the rule to apply to.
- The universal 401/403 responses are still documented on every operation, including the ones now
  published as public. Narrowing them to authenticated operations became possible with the security
  scheme and has not been done.

## Alternatives

- **Feature-flag the route off until assembly lands.** Rejected: an unrouted endpoint publishes no
  schema, so the frontend gets nothing, and a flag that gates a route is one more thing to forget
  to flip.
- **`503 Service Unavailable`.** Rejected: it means try again shortly, and clients back off and
  retry on it. Nothing about waiting will make an unbuilt feature answer.
- **`404`.** Rejected: it is the answer for a cross-tenant read, and overloading it would make a
  genuine tenancy bug indistinguishable from an unfinished endpoint.
- **Merge each contract task into its assembly task.** Rejected: it serialises the frontend behind
  the backend on every screen, which is the coupling the generated client exists to remove.
