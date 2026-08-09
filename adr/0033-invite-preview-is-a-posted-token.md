# ADR-0033 — The invite screen reads its invitation by posting the token

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

> Shipped as proposed, with one amendment: the endpoint returns **no `inviter_email`**. The server
> named the inviter without their address, reasoned in [ADR-0032](0032-the-invite-preview-names-the-inviter-without-their-address.md).
> The screen never rendered the address as anything but a parenthetical, so nothing was lost.

## Context

The invite acceptance screen must name the organisation and the person who sent the invitation
before it asks the invitee for anything. Nothing on the published API surface can tell it either
one. `Invitation` is the issuer's view and carries `organization_id` and
`invited_by_membership_id` — opaque identifiers, no names — and it is unreachable by token, because
only the token's hash is ever stored. The single affordance that comes close is
`SignupState.invited_organization_name`, which arrives from a signup stage, names no inviter, and
answers 501 today.

So the screen needs an endpoint that does not exist, and the shape of that endpoint decides how the
token travels.

The obvious construction, `GET /invitations/{token}`, puts a live credential in a path segment.
[ADR-0029](0029-signup-and-invite-acceptance-are-public-and-tokenless-in-the-url.md)
already rejected exactly that for acceptance: path segments land in browser history, `Referer`
headers, proxy and access logs and error reports, and none of those redact them.

## Decision

**The frontend reads an invitation with `POST /invitations/preview`, sending `{ token }` in the
body, and renders the result from the server.** The response is the standard envelope wrapping
`organization_name`, `inviter_name`, `email`, `role_preset`, `status` and `expires_at`.
`inviter_name` is nullable, because an invitation whose sender has since been deactivated still has
to render.

Only `PENDING` and `ACCEPTED` reach a caller as a `200`; the closed states answer `410 GONE`. The
client still refuses to render an acceptance form for any status other than `PENDING`, so a change
to that split cannot put a live form in front of a dead invitation.

A POST for what is semantically a read is the price of keeping the credential out of the request
line. It matches the sibling acceptance endpoint, which posts its token for the same reason.

The token stays in the *frontend* path, `/invite/[token]` — the email has to link somewhere and the
specification names that route. The route answers with `referrer: no-referrer` so the URL is not
carried to another origin, and `robots: noindex` so it is not indexed.

## Consequences

- The endpoint was not in `TASK-AUTH-005`'s scope, which recorded "no way to read invitations back"
  as an open point of its own. `TASK-AUTH-011` was widened to own it and it shipped there, public,
  on the address-keyed limiter the other public invitation routes sit on.
- Exposing an inviter's name to anyone holding the token is a deliberate disclosure. It is the point
  of the screen — an invitation from nobody in particular is a phishing link — and the token is
  single-purpose and expiring. The address is not disclosed; naming the person turned out to be
  enough, and it is the narrower grant.
- Response parsing is a Zod schema in `src/lib/auth/invite-preview.ts` rather than a generated
  type, because the generated client has no such operation to generate from. That schema is a
  stand-in and should be deleted when the endpoint ships and the client regenerates.

## Alternatives

**`GET /invitations/{token}`.** Rejected: it is the construction ADR-0029 argued against, and the
argument does not weaken because the endpoint is a read.

**Reuse `POST /signup/identifier` for the organisation name.** Rejected: it names no inviter, so it
cannot satisfy the screen, and it starts a signup as a side effect of rendering a page.

**Render the screen without the identity and ask for the name first.** Rejected: it is the one
thing the specification says this screen must not do. An invitee who cannot see who is asking has
no way to tell an invitation from a phishing link.
