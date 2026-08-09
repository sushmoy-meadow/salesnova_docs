# TASK-AUTH-005 — open points

Both acceptance criteria are covered by tests: `tests/Feature/Auth/SignupContractTest.php` asserts no
role field reaches any signup request body or the state they answer with, and
`tests/Feature/Auth/MemberLifecycleEndpointTest.php` asserts the deactivation body must carry one of
its two answers and not both. The shape decisions are in
[ADR-0029](../adr/0029-signup-and-invite-acceptance-are-public-and-tokenless-in-the-url.md). What
follows is what is owed, and what the review pass raised and did not get.

## 1. Owed to a later task

**Every endpoint answers 501.** Assembly is `TASK-AUTH-010` (signup and attribution capture) and
`TASK-AUTH-011` (organisation auto-creation and the invite lifecycle). A 501 surviving past those is
a broken published contract, not a slow rollout.

**No capability is enforced.** Inviting, cancelling and deactivating require a session and nothing
else. The authority is the membership's capability grid, and the only middleware alias mounted reads
Spatie's tables, which are not it. The routes needing `team.manage` are
`members.invitations.store`, `.resend`, `.cancel` and `members.deactivate` — they get it from
whichever task builds the grid middleware.

**No per-identifier rate limit on signup.** The four signup routes and acceptance sit on the
address-keyed `auth` limiter at ten a minute. That bounds one address; it does not stop a
distributed walk of the email space, and it does not stop one address being asked for a code
repeatedly from many places. The limit that does belongs with the code issuer, which does not exist
yet — `TASK-SEC-006` owns the layered limiter.

**Acquisition is not on any request.** Attribution is captured server-side from the request itself,
so no signup body carries UTM parameters by design. What captures them is `TASK-AUTH-010`.

**Reactivation is not published.** The lifecycle in the specification ends
`deactivate → reactivate`, and this task names only deactivation. Reactivation also has to answer a
seat check, which has no contract decided anywhere yet. It belongs with the lifecycle assembly.

**No way to read invitations back.** The task names create, resend and cancel; a team screen also
needs to list what is outstanding. That is a read endpoint with pagination and filter contracts of
its own, and it was not in scope here.

## 2. Findings taken from the simplify pass

- Invitation acceptance took the plaintext token as a URL path segment on an authenticated route.
  Both halves were wrong: the token is a credential and a path is logged everywhere, and the shipped
  `InvitationService::accept()` provisions the user from the invited address, so requiring a session
  first would have locked out the case the flow exists for. Now public, token in the body.
- Deactivation answered with `MemberCapabilitiesDTO`, which has no status field — so the response
  could not say the member was deactivated, and the wording pushed the assembly task towards wiping
  the grid. Now answers with a new `MembershipDTO` carrying `MembershipStatus`.
- `SignupStateDTO::$resend_available_at` described a window for an operation the contract did not
  publish. The resend endpoint now exists.
- The signup routes took the general `api` limiter, whose key resolves the current user — on a route
  where nobody is signed in, that is guard work to reach the address it would have used anyway. The
  narrower `auth` limiter was already defined and used by nothing.
- `id_token` had no length ceiling on an unauthenticated route, and `capabilities` on an invitation
  had neither a bound nor `distinct`.
- `boolean` and `accepted` on `leave_unassigned` disagreed in the published document: `accepted` won
  the inference and advertised four values the runtime refuses. `boolean` dropped.
- Google signup required `name`, forcing the client to decode a token the server verifies and reads
  anyway. Now optional, with the verified claim as the default.
- Cancel was a `DELETE` returning the revoked row, in the same file that argues a status transition
  is a named action rather than a removal. Now a `POST` to `/cancel`.
- Contract assertions and live HTTP assertions shared one file per group; the tree keeps them in two
  (`*ContractTest` and `*EndpointTest`), and the endpoint half carries the versioned-path assertion.

## 3. Declined

**Deriving `role_preset` from the capability grid instead of accepting it.** The label is
presentational and the grid is the authority, so refusing `OWNER` on the label blocks a word rather
than a power — the finding is correct about that. It was still kept: `invitations.role_preset` is a
column the shipped `InvitationService::issue()` takes as a parameter, so removing it from the request
would leave the service with nothing to fill it from. The grid-level ownership check belongs with
the code that reads the grid, and the test name now claims only what the rule does.

**Publishing a token expiry on `AccountSession`.** Session lifetime and refresh are `TASK-AUTH-008`'s
to decide; a nullable expiry published now would pre-commit its shape.
