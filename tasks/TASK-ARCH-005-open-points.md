# TASK-ARCH-005 — open points

Written 2026-08-02, updated 2026-08-03. The task is **`done`**: gate green, both acceptance criteria
verified, no blocking review findings left. Nothing is committed.

One question below is still open (§1). The rest is recorded so the diff reads without archaeology.
Delete this file once §1 is decided.

---

## 0. Decided and applied on 2026-08-03

- **Security scheme.** `config/scramble.php` now sets `security_strategy` to
  `MiddlewareAuthSecurityStrategy`. Bearer auth is derived from route middleware, so an endpoint
  that gains or loses `auth:` cannot end up published as the opposite of what it enforces. The
  scheme is a document-wide default and `/health` is published `security: []`; an authenticated
  operation is therefore the one carrying no `security` key, which reads backwards until you know
  the default is set. `tests/Feature/ApiSecuritySchemeTest.php` asserts all three facts.
- **`X-Bootstrap-Stale`.** Kept write-only. The narrowing and its reason are in ADR-0016, including
  the explicit statement that no operation sets the header until the per-organisation invalidation
  stamp exists, and that broadening the rule to reads belongs to that task.
- **The leaked operation summary.** Moved off the docblock to a `//` comment above the
  `#[Response]` attribute. `BootstrapContractTest` asserts the operation publishes no summary, so a
  docblock added there fails the suite rather than shipping as the operation title.
- **The drift gate.** `scripts/check-contract-drift.mjs` now generates into a temp directory and
  compares against `contracts/`, instead of regenerating in place and asking `git status` whether
  the tree is clean. Git answered a different question — "is this committed?" — which is the same
  answer for a stale artefact and for one correctly regenerated but not yet committed, so the gate
  could only be cleared by the commit it was meant to gate. `package.json`'s `api:check` no longer
  regenerates first, because that made the comparison tautological.

  This is `TASK-ARCH-004`'s code, edited deliberately from outside its task. It was blocking
  `TASK-ARCH-005` from closing and would have blocked `TASK-ARCH-006` through `009` identically.
  Verified in three states: clean tree exits 0, a spec missing an endpoint exits 1, a deleted
  artefact exits 1 — and the temp directory is removed in all of them.

---

## 1. Still open: the consumer-segment prefix on the other two splits

`routes/splits/customer.php:8` dropped its `customer` HTTP prefix. That much is right —
`docs/05-api-design.md` §6 specifies `/api/v1/bootstrap`, `SN-ARCH-081` forbids a service name in
the path, and no entry in the §16 endpoint inventory carries a `customer/` segment. Both graders
agreed independently. The split keeps `name('customer.')`, so it stays a file-level grouping and a
route-name namespace.

Two places still disagree with it:

- `routes/splits/carrier.php:7`, `routes/splits/console.php:7` — still carry their path prefixes.
  Defensible: they are genuinely different consumer surfaces and §16 only inventories the customer
  API. But nothing records that, and the rationale comment in `customer.php` reads as a general
  rule, so the next person will read the asymmetry as an oversight.
- `CLAUDE.md:93` — still documents the customer split as registering the HTTP prefix `customer`
  ("Note the naming seam…"). Now stale. Left alone: it is your file, and `TASK-ARCH-036` may be the
  right owner of the edit.

**Decision:** whether `carrier`/`console` keep their prefixes, and whether the record goes in
ADR-0016 or waits for `TASK-ARCH-036`.

---

## 2. Accepted during the run — listed so it is not a surprise

- **`routes/api.php:10-15`, `require_once` → `require`.** A real latent bug, not scope creep.
  `require_once` caches per process, so the second application boot in a test run skipped the split
  entirely. Proved by reverting: `Route [customer.bootstrap] not defined`, 2 failures. Invisible
  until now only because all three splits were empty.

- **`NOT_IMPLEMENTED` → 501 added to `app/Enums/Platform/ErrorCode.php`.** Bidirectional
  (`fromHttpStatus(501)` maps back), recorded through the `EXTENSIONS` mechanism in
  `tests/Unit/ErrorCodeTest.php` that `BAD_REQUEST` already established, and argued in ADR-0016.
  Worth knowing: it is **not** in the published catalogue at `docs/05-api-design.md:203-218`, same as
  `BAD_REQUEST` before it. If that document is meant to stay exhaustive, both belong in it.

- **The endpoint answers 501 rather than a payload.** Assembly is TASK-ARCH-013. The alternative was
  fabricating a subscription and counts, which is worse. The 501 body is the real error envelope and
  the route is behind `auth:sanctum` + `throttle:api`.

---

## 3. Review warnings, none blocking

| Where | What |
|---|---|
| `app/Enums/Platform/WarningSeverity.php:14` | Class name does not match its published name (`BootstrapWarningSeverity`) or bible §23's `{Model}{Property}`. A second, unrelated severity enum later has nowhere to go. |
| `app/DTOs/Platform/Bootstrap/OrganizationBrandingDTO.php:13`, `UploadConstraintsDTO.php:9` | Publish as `OrganizationBranding` / `UploadConstraints` — unprefixed names in a flat schema namespace. A later branding-settings or upload-sign endpoint will want those names. `BootstrapUser`/`BootstrapOrganization` are correctly insulated from the real models. |
| `app/DTOs/Platform/Bootstrap/*` | No `fromArray()`/`toArray()`; bible §12 rules 3 and 4. Defensible — the public properties *are* the wire shape — but it is an unrecorded §12 deviation. |
| `app/Providers/OpenApiServiceProvider.php:46` | The universal 401/403 are still applied to every operation, including the ones now published as public. Narrowing them became possible with the security scheme; recorded in ADR-0016 as not done. |
| `app/Providers/OpenApiServiceProvider.php:113` | The forced error envelope applies to everything outside 200–299, so a declared 3xx would be given an error body. No such response exists today. |
| `app/Providers/OpenApiServiceProvider.php:136` | The stale header is advertised on every non-`GET` 2xx, including surfaces with no bootstrap at all (the recipient-facing public API per §13, the auth endpoints). Noise, not a defect. |
| `tests/Feature/BootstrapContractTest.php:66` | Test comment restates the `WarningSeverity` docblock almost verbatim. |

Checked and clean: no comment-rule regressions anywhere in `app/`, `tests/`, `routes/` or
`contracts/*.ts` — no requirement ids, ADR numbers, bible sections or spec filenames. Pest function
syntax throughout. `tests/Fixtures/` sits outside both testsuites, so the probe controller is never
collected, and the spec memo in `tests/Pest.php` does not leak the probe route.

---

## 4. State

- 27 new tests, 77 total, 197 assertions. All 50 pre-existing tests pass; no regression.
- `composer gate` exits 0: pint, tests, `api:check`, `api:typecheck`.
- Both acceptance criteria `VERIFIED`. Criterion 2's TypeScript proof was tested, not read: adding a
  key to the generated types fails `TS2353`, removing `server_time` fails `TS2741`.
- Closing this unblocked only `TASK-ARCH-021`, which is `frontend` track and belongs to the Next.js
  repository — not this one.
- Nothing committed. Three uncommitted paths are unrelated leftovers from the workflow-tooling
  session: `CLAUDE.md`, `docs/tasks/workflows/auto.md`, `.claude/commands/auto-task.md`.
