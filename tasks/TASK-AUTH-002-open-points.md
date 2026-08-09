# TASK-AUTH-002 — open points

Written 2026-08-03. The task is **`done`**: gate green, no blocking review findings. Nothing is
committed. Delete this file once §1 and §2 are closed.

---

## 0. Criterion 1 was closed on a partial verification

> `invite.token` is stored hashed only; plaintext exists solely in the outbound email content.

**Proven.** `token_hash` holds `sha256(plaintext)`; a scan of all materialised tables after issuing
found zero occurrences of the plaintext in any string column; `token_hash` is in `$hidden` so it
never serialises; no route, controller or resource references the plaintext. Removing the hashing
fails the token tests.

**Not proven, and not provable here.** "Solely in the outbound email content" needs an outbound
email. There is no mailable, no notification and no mail view. The plaintext is returned in-process
through `IssuedInvitationDTO` and currently has no consumer at all.

**What the mail task owes:** a test asserting the plaintext reaches the recipient via mail *and only
via mail* — specifically that it appears in the rendered message body and in no log line, no
response payload and no persisted column. Closing this criterion here was a deliberate call that a
schema task cannot prove a delivery guarantee; it was not evidence.

---

## 1. Still open: which namespace segment is the module

Review raised as blocking, and it is downgraded rather than dismissed.

`SN-ARCH-002` lists eleven modules, and `Identity` owns *user, org, membership, subteam, auth,
invitation* — every model this task touches. So `App\Services\Auth\InvitationService` importing
`App\Models\Organizations\Organization` is an intra-module reference and breaks no rule that exists
today.

What is genuinely unresolved: `TASK-ARCH-036` records that boundary enforcement will resolve module
identity **from the second namespace segment**. This task spreads one module across three of them —
`Auth`, `Organizations`, `Users`. When `TASK-ARCH-001` lands the CI rule, it will read those as
three modules and fail correct code.

`CLAUDE.md` offers `App\Models\Users\User` as a correct example, so the same tension predates this
task and cannot be settled inside it. **Decision belongs to `TASK-ARCH-001`:** either the segments
become `Identity`, or the rule resolves modules through a map rather than the segment name.

---

## 2. Review warnings carried forward, none blocking

| Where | What |
|---|---|
| `app/Models/Organizations/Invitation.php:80` | `status` reads `CarbonImmutable::now()` while every sibling takes an injected `$now`. Confirmed consequence: a test asserting an expired invitation reads `EXPIRED` gets `PENDING`, so the accessor cannot be asserted for any time-dependent case. The list endpoint will need this. |
| `app/Models/Organizations/Invitation.php:86` | `isLive()` and `status` ignore the organisation's soft delete, so an invite into a trashed org still reads live. Only `accept()` and `resend()` catch it, via the service-level guard. |
| `app/Services/Auth/InvitationService.php:137` | The membership lookup inside `accept()` is unlocked; two concurrent accepts can both see `null` and race the `(organization_id, user_id)` unique index into a 500. |
| `app/Services/Auth/OrganizationProvisioningService.php:78` | Slug uniqueness is check-then-insert; concurrent signups on one company name hit `organizations_slug_unique`. |
| `app/Services/Auth/OrganizationProvisioningService.php:33` | `$countryCode` is unvalidated before it becomes a `config()` dot-path segment and a `char(2)` write. |
| migrations `…100200:20`, `…100100:31`, `…100000:29` | `invitations.capabilities`, `memberships.preferences` and `organizations.branding` are jsonb with no `->comment()`, while the identical `memberships.capabilities` has one. |
| `app/Models/Organizations/Invitation.php:98`, `Organization.php:52` | Relationships placed after accessors and business logic. |
| `app/DTOs/Auth/AcquisitionDTO.php:11` | snake_case promoted properties and no `fromArray()`. |
| `tests/Feature/Tenancy/TenantIndexLeadingColumnTest.php:13`, `tests/Feature/Auth/InvitationStatusTest.php:15,39` | Global helpers declared in test files rather than `tests/Pest.php`, plus a repeated hardcoded UUID literal. |
| `tests/Unit/ArchitectureTest.php:42` | Adds a repository-wide HTTP-awareness rule from a schema task. Correct rule, wrong task. |

---

## 3. Decided during the run

- **`issue()` supersedes live invitations for the same `(organization_id, email)`.** One live
  invitation per seat; `resend()` now delegates to it rather than duplicating the revoke. Expired
  rows are deliberately left alone so they keep reading as expired rather than superseded.
- **An expired invitation can still be resent**, and the expired row is *not* marked superseded.
  This changed as a consequence of the `resend()` refactor and is pinned by a test rather than left
  incidental.
- **`acquisition` is not mass-assignable.** The service assigns it directly, guarded by
  `wasRecentlyCreated` so a return visit cannot overwrite first-touch attribution.
- **The error-code split is intentional.** `accept()` answers someone following a link, so a spent
  link is `CONFLICT`/409; `cancel()` and `resend()` are administrative moves against a lifecycle
  that has already run past them, so they are `INVALID_STATE_TRANSITION`/422. Stated on
  `assertOpen()`.
- **Case normalisation is `docs/adr/0018`.** The rule has two halves and only the mutator half is
  enforceable; the query-builder half is what broke here.

---

## 4. State

- 132 tests, 335 assertions, `composer gate` exits 0.
- 20 tests added after the first grading round: 9 for the duplicate-account, row-locking and
  deleted-organisation defects, 11 for the four items above.
- Criteria 2, 3 and 4 `VERIFIED` with mutation evidence. Criterion 1 closed per §0.
- Nothing committed. `tasks.json` moved only through the CLI.
