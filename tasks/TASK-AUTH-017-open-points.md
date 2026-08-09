# TASK-AUTH-017 — open points

The screen is built and every behaviour it owns is tested. What is listed here is what this repo
cannot close on its own.

## ~~The invitation preview endpoint does not exist~~ — CLOSED

**Acceptance criterion:** *Org name and inviter are visible on first paint of the invite link,
before any form field.*

`POST /invitations/preview` shipped under a widened `TASK-AUTH-011`, so the criterion is now
satisfiable against live data. The screen needed no change beyond dropping `inviter_email`, which
the backend chose not to expose (its ADR-0032); naming the inviter without their address is the
narrower grant and the screen reads the same.

Tested here: given an invitation, `/invite/[token]` renders the organisation name and the inviter
in its server-rendered output, ahead of every form field on the page
(`src/app/invite/[token]/page.test.tsx` asserts the ordering with `compareDocumentPosition`, not
just the presence of both). What is still untested in this repo is the wiring against a running
backend — that is `TASK-AUTH-021`'s job, and it is the last thing standing between this screen and
real data.

## Acceptance answers 501

`POST /invitations/accept` is published but returns `NOT_IMPLEMENTED` until `TASK-AUTH-010` and
`TASK-AUTH-011` land. The form posts to it and renders the rejection inline, which is the correct
behaviour today and needs no change when the endpoint starts working. What is untested here is the
success path beyond the client boundary: nothing in this repo yet consumes the returned
`AccountSession` or navigates anywhere after acceptance, because there is no authenticated shell to
navigate into (`TASK-ARCH-021`).

## Types are a stand-in, not generated

`SN-ARCH-032` forbids hand-written API types, and the generated client lives in
`salesnova_backend/contracts/` with no publishing route into this repo. The Zod schemas here — the
shared envelope in `src/lib/auth/api-envelope.ts` and the invitation shape in
`src/lib/auth/invite-preview.ts` — validate at the boundary as `docs/tasks/RULES.md` requires, but
they are not generated and will drift. Wiring the generated client into this repo is its own task
and was not in scope.

The schemas are deliberately **more tolerant than the published contract** in one place:
`role_preset` and `expires_at` are required in `InvitationPreview` but optional here, because this
screen renders neither, and a field it never reads must not be able to fail the parse and turn a
good invitation into a dead end. Fields the screen does render are validated strictly.

## Hardening left for a task that owns it

Three review findings are real but reach past this screen, and each is cheap only where it belongs:

- **No `server-only` guard.** `src/lib/auth/api-envelope.ts` reads `SALESNOVA_API_URL` and must never
  be imported from a client component. Nothing enforces that today; the acceptance form is careful
  to take only types and a leaf schema module (`src/lib/auth/invite-input.ts`) as values. Adding the
  `server-only` package would make it a build error instead of a convention, and that is a
  dependency decision for the repo rather than for this screen.
- **No CSP on the invite route.** `next.config.ts` now sets `Referrer-Policy: no-referrer`,
  `X-Robots-Tag` and `Cache-Control: no-store` for `/invite/:token*`, which is what keeps the token
  in the path from travelling. A CSP would close the remaining hole — a third-party script added to
  the root layout later could read the token from `location.pathname` — but the app has no CSP on
  any route, and introducing the first one belongs with the surface that owns them.
- **Acceptance has no idempotency key.** The write is given a longer timeout than the read so a slow
  provision is not abandoned, but a client that times out and retries can still land on `CONFLICT`
  for work that succeeded. Making that safe needs a key the server honours.

## Expired and cancelled are indistinguishable

Both `InvitationService::accept()` and now `preview()` collapse expired, revoked and superseded into
one `410 GONE` with a single message, so the screen cannot tell an invitee which of the three
happened. It renders the expiry wording for all of them. Distinguishing them needs distinct error
codes from the backend; whether that is worth doing is a product call, not a frontend one.

## ADR numbering has forked between the repos

This repo's ADR-0016 is the invite preview decision; the backend's ADR-0016 is contract-first
endpoints, and its sequence has run to 0032. Two independent sequences in one numbering space means
a bare "ADR-0016" no longer identifies a document. Worth reconciling before either repo writes
another — merge the sequences or prefix them.
