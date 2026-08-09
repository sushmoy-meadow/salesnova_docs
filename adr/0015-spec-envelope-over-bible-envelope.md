# ADR-0015 — The project API envelope supersedes the company bible envelope

**Status:** Proposed — awaiting team-lead approval · **Date:** 2026-08 · **Deciders:** Engineering

> The bible closes with *"Deviations require explicit justification and team lead approval"*, and
> `TASK-ARCH-004`'s fifth acceptance criterion is that the deviation is *recorded **and approved***.
> Recording it is this document; approving it is not something the author of the deviation can do
> for themselves. `TASK-ARCH-036` owns the sign-off and is still `pending`.

## Context

Two normative documents describe the API response envelope and they disagree.

The company architecture bible ([§9](../meadowkart_backend_architecture_bible_by_claude.md)) is the
standard every company project starts from. It specifies a bare `{data}` envelope, a
`{error: {message}}` error shape, and states explicitly: *"HTTP status codes convey success/failure —
no `status: true/false` booleans."*

[`05-api-design.md`](../05-api-design.md) declares every rule in it normative and specifies a
`{success, data, meta, policy}` envelope with a `{code, message, details, trace_id}` error object.

This is not a stylistic disagreement. Three things in the project spec are load-bearing and have no
home in the bible envelope:

- **`policy`** carries `access_policy` and `subscription_access_policy` (`SN-ARCH-085`), which the
  client must AND before rendering an action. Permission and plan gating across the entire product
  is built on it.
- **`error.code`** is a permanent, additive catalogue (`SN-ARCH-086` §4.1) that drives client
  behaviour — the `403` / `423` / `425` distinction decides whether the UI shows a plain denial, an
  upgrade modal, or "coming soon".
- **`error.trace_id`** is required on every error and must match the server log entry
  (`SN-ARCH-084`).

A third conflict surfaced during implementation: the two documents also use **different pagination
key names**. The bible uses `total, count, per_page, current_page, total_pages`; `SN-ARCH-083` uses
`page, per_page, total, total_pages, has_more`.

## Decision

**`05-api-design.md` wins. The project envelope is `{success, data, meta, policy}` with the
`{code, message, details, trace_id}` error object and the `SN-ARCH-083` pagination keys.**

It is implemented by **extending the bible's existing `App\Traits\ApiResponse`**, not by introducing
a parallel response layer. `responseData` / `responseList` / `responseSuccess` / `responseCreated` /
`responseError` remain the only public surface, and the bible's rule that controllers never call
`response()->json()` directly is kept and enforced in CI.

Three specific deviations from the bible are recorded here:

| Bible | This project | Why |
|---|---|---|
| §9 — no `success` boolean | `success` on every response | `SN-ARCH-082`; the client discriminates the union on it |
| §9 — `{error: {message}}` | `{code, message, details, trace_id}` | `SN-ARCH-084`; code drives client behaviour, trace_id drives support |
| §9 — `current_page`/`count` | `page`/`has_more` | `SN-ARCH-083` |

One addition to the spec's own catalogue is also recorded here. §4's status table has a
`400 — Malformed request` row, but §4.1 publishes no error code for it, so a malformed body had
nothing to resolve to and fell through to `INTERNAL_ERROR`/500 — a client error reported as a server
fault. `BAD_REQUEST` fills that hole. §4.1 states codes are *"permanent and additive"*, which makes
an addition in-contract where a removal would not be; `tests/Unit/ErrorCodeTest.php` requires every
non-catalogue code to be declared deliberately, so this cannot grow by accident.

The bible's §18 worked example renders the *old* error shape. **It must not be copied.** This is the
same class of trap as the §4 `CartService` example that reaches across a domain boundary
`SN-ARCH-002` forbids — the bible's prose is normative, its examples are illustrative and predate
this project.

## Consequences

- Response shaping stays in one file, so the envelope cannot drift per endpoint.
- The generated OpenAPI spec needs an operation transformer to describe the envelope, because
  Scramble infers the *inner* payload a controller returns and cannot know the trait wraps it.
  Without it every generated TypeScript type would be wrong at the top level.
- Engineers arriving from another company project will write `{data}` from muscle memory. The CI
  boundary check and `tests/Unit/ArchitectureTest.php` catch the `response()->json()` form; they do
  not catch someone hand-building the wrong array and passing it to `responseData`.
- We accept a permanent, visible divergence from the company standard on the single most-touched
  convention in the codebase. Anyone porting code in either direction must translate the envelope.
- `success` is redundant with the HTTP status, which is the bible's actual objection and is correct
  in isolation. We pay that redundancy to get a discriminated union the TypeScript client can narrow
  on without inspecting the status code.

## Alternatives

- **Follow the bible, drop `success`.** Rejected: `policy` and the error catalogue still need a
  home, so the envelope diverges anyway — this would produce a third shape that matches neither
  document.
- **Keep both — bible envelope internally, spec envelope at the edge.** Rejected: a translation
  layer on every response, and two shapes for reviewers to hold in their heads.
- **Amend the bible.** Rejected as out of scope for one project. The bible governs several
  codebases; changing it is a company-level decision, not this task's to make. Revisit if a second
  project needs the same envelope.
