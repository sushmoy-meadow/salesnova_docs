# 32. The invite preview names the inviter without their address

Date: 2026-08-09

## Status

Accepted.

## Context

The invite acceptance screen must show which organisation an invitation is for and who sent it
before it asks the invitee for anything. An invitation that names nobody is indistinguishable from a
phishing link, which is the reason the requirement exists.

Nothing on the API surface could answer that. The invitation row stores only a hash of the token, the
issuer-facing shape carries `organization_id` and `invited_by_membership_id` — UUIDs, no names — and
no route read an invitation by token at all.

Serving the inviter means joining membership to user and returning a real person's details to
whoever presents the token, with no proof they are the person invited. The token arrives by email,
lives for fourteen days, and can be forwarded, archived, or read from a mailbox someone else
controls.

## Decision

`POST /invitations/preview` returns `organization_name`, `inviter_name`, `email`, `role_preset`,
`status` and `expires_at`.

It does **not** return the inviter's email address.

A name discharges the entire purpose of the field: it lets an invitee recognise the person who
invited them and tells a stranger's link apart from a colleague's. An address adds nothing the screen
can act on — there is no contact-the-inviter flow — while turning a leaked token into a durable,
harvestable target for exactly the phishing the field exists to prevent.

The counter-argument is that accepting the invitation reveals every member's address anyway, so the
preview discloses nothing new. It does not hold. Acceptance is a deliberate act that writes an
auditable membership row; the preview is an anonymous read that leaves no trace of who performed it.
The two are not equivalent disclosures merely because they end at the same data.

Withholding is also the recoverable direction. Adding a field to a published response is a
non-breaking change; removing one is not.

The capability grid is withheld on the same reasoning: what the seat can do is the organisation's
business, and the screen does not render it.

## Consequences

An invitee sees "invited by Sakib Khan" and not an address. Where no member stands behind the
invitation, or the member has since gone, `inviter_name` is null and the screen says an administrator
invited them.

Expired, cancelled and superseded invitations answer as one `410 GONE`. Distinguishing them would
narrate an organisation's administration to someone who may not belong to it, and the screen has no
different action to offer for each. An already-accepted invitation answers `200` with
`status: ACCEPTED` instead, because "you are already in" is a different thing to tell someone than
"this link is broken".

The token travels in the request body rather than a path segment, matching acceptance. A read does
not weaken the reason: a path segment lands in browser history, referrer headers, proxy and access
logs and error reports, none of which redact it.
