---
doc: F15-agency-and-white-label
status: REVIEW
owner: Product + Engineering
area_code: AGCY
depends_on: [06-permissions-and-plans, F14-team-and-subteams]
security_review: REQUIRED
---

# F15 — Agency & White-label

Lets a marketing agency, a broker network or a franchisor operate SalesNova on behalf of client
organisations.

**This document has the highest security sensitivity in the set.** Impersonation grants one
organisation access to another's customer data.

---

## 1. Three separate relationships

They are frequently conflated. They **MUST NOT** be.

| Relationship | Meaning | Granted by | Revocable by |
|---|---|---|---|
| **Manage** | The agency administers the account | Client, at invite acceptance | Client, any time |
| **Sponsor** | The agency **pays** for the subscription | Client accepts the sponsorship | Either party |
| **Impersonate** | Agency staff act **as** the client | Client, **separately** from Manage | Client, instantly |

### SN-AGCY-001 — Independently granted, independently revocable

Accepting management **MUST NOT** grant impersonation. Paying the bill **MUST NOT** grant access.

> Privyr bundles these more loosely, and their `login-as-user` endpoint has no documented consent
> gate. A client accepting "let my agency help manage this" has not agreed to that agency reading
> every conversation with every customer. Those are different consents and they need different
> checkboxes.

### SN-AGCY-002 — Revocation is immediate and unilateral

The client **MUST** be able to revoke any of the three from their own settings, without contacting
the agency and without ending the other two. Revocation takes effect within 60 seconds and kills
active impersonation sessions.

---

## 2. Agency structure

### SN-AGCY-010 — An agency is an organisation with a flag

`agency` extends an organisation; `agency_membership` links it to client organisations with the
three permission booleans, status and timestamps.

Agency staff are **memberships in the agency org**. They gain access to a client org through
impersonation, not through a membership there.

> Alternatively, agency staff could hold real memberships in each client org — which our identity
> model supports natively ([`04`](../04-domain-model.md) §3.1). **That is the better path where the
> client wants it**, because it is auditable per-person, permission-scoped, and requires no
> impersonation at all. Impersonation exists for the cases where the client wants the agency to see
> exactly what they see. Offer both; recommend memberships.

### SN-AGCY-011 — Client invitation

The agency invites by email or `agency_code`. The client sees an acceptance page naming the agency,
the three permissions requested, and what each means — **before** accepting.

### SN-AGCY-012 — Agency console

List of client accounts with: name, plan, status, member count, lead volume, sponsorship state,
last activity, and health flags (WhatsApp disconnected, payment failing, integration expired).

The health column is the reason an agency pays for this. They want to see, across 40 accounts,
which three are broken.

---

## 3. Impersonation ⚠️

All eight requirements from [`06-permissions-and-plans.md`](../06-permissions-and-plans.md) §4 are
mandatory and are **launch blockers** for this feature. Restated with implementation detail:

### SN-AGCY-020 — Consent-gated

Requires `agency.manage`, an accepted `agency_membership`, and `allow_impersonation = true`.

### SN-AGCY-021 — Time-boxed

**60 minutes.** Expiry is hard; extension requires a new session and a new audit entry. There is no
silent renewal.

### SN-AGCY-022 — Always visible

A persistent, **non-dismissible** banner across the full viewport width, in a distinct colour,
naming the agency and the impersonated account, with a live countdown and a one-click exit.

Present on every screen. There is no route where impersonation is invisible.

### SN-AGCY-023 — Fully audited

Session start and end logged. **Every write during the session** carries
`impersonator_membership_id` on `audit_log`, so a year later it is still answerable who actually
made a change.

### SN-AGCY-024 — Read-mostly by default ⚠️

Blocked unless the client explicitly grants `allow_destructive`:

- Delete anything
- Export leads
- Change billing or payment method
- Change permissions, invite or deactivate members
- Disconnect WhatsApp or any integration
- Change org settings

> The common legitimate use is "help me set up my automation rules", not "delete my data" or
> "export my customer list". Default to the common case; make the rest an explicit, separate grant.

### SN-AGCY-025 — Notified

The impersonated org's owner is emailed on session start. Not a digest — immediately.

### SN-AGCY-026 — Visible to the client

The client sees their own impersonation history in **their** settings: who, when, how long, what
changed. Not buried in an admin console they do not know exists.

**Acceptance criteria**

- `AC-AGCY-021.1` — Given a session at 61 minutes, when any request is made, then it returns `401` and the session is terminated.
- `AC-AGCY-023.1` — Given 5 writes during an impersonation session, when the audit log is queried, then all 5 carry `impersonator_membership_id`.
- `AC-AGCY-024.1` — Given impersonation without `allow_destructive`, when an export is requested, then it returns `403` and the attempt is audit-logged.
- `AC-AGCY-002.1` — Given an active impersonation session, when the client revokes consent, then the session terminates within 60 s.

---

## 4. Sponsorship

### SN-AGCY-030 — The agency pays; the client owns

A sponsored subscription is billed to the agency. **The data belongs to the client organisation.**

### SN-AGCY-031 — Ending sponsorship never destroys data

When sponsorship ends, the client enters a 30-day grace period at their current plan, with clear
notice and a self-serve path to take over billing. Data is never deleted for non-payment by a third
party.

> The client did not fail to pay. Punishing them for their agency's decision is indefensible, and
> it is exactly the story that ends up on a public forum.

### SN-AGCY-032 — Consolidated billing

The agency sees one invoice with a per-client breakdown, and can set different plans per client.

---

## 5. White-label

### SN-AGCY-040 — What can be branded

| Surface | Brandable | Notes |
|---|---|---|
| Share viewer | ✅ | Logo, colours, custom domain |
| Lead forms | ✅ | Logo, colours, custom domain |
| Emails to leads | ✅ | From-name, logo, footer |
| "Powered by SalesNova" | ✅ removable | Business tier |
| **The CRM application itself** | ❌ | Not in V1 |
| Login page | ❌ | Not in V1 |

> **Full application white-label is deliberately out of scope.** It means custom domains with TLS
> per tenant, brand-swapped emails, a branded mobile experience and a support surface where the
> user does not know they are our customer. It is a product line, not a feature, and it should not
> be built by accident inside V1. Revisit at V1.5 with real demand.

### SN-AGCY-041 — Custom share domain

Business tier. `share.clientbrand.com` → CNAME, automated TLS. Verification and issuance status are
visible; failures explain what to fix.

### SN-AGCY-042 — Branding cascades with an override

An agency **MAY** set default branding applied to managed accounts, and each client **MAY**
override it. The client's choice always wins.

---

## 6. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Agency features | ❌ | ❌ | ✅ |
| Managed accounts | — | — | unlimited |
| White-label branding | ❌ | ❌ | ✅ |
| Custom share domain | ❌ | ❌ | ✅ |
| Remove "Powered by" | ❌ | ❌ | ✅ |

---

## 7. Sequencing

Agency is a **G4** deliverable ([`02-product-scope.md`](../02-product-scope.md)). It is the least
urgent pillar for the beachhead ICP and carries the highest security burden.

**It MUST NOT ship without a completed security review** covering impersonation, cross-tenant
isolation, and the audit trail.
