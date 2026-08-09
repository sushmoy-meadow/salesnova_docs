---
doc: F01-identity-and-onboarding
status: REVIEW
owner: Product + Engineering
area_code: AUTH
depends_on: [04-domain-model, 05-api-design, 06-permissions-and-plans]
---

# F01 — Identity, Signup & Onboarding

Covers signup, sign-in, session, organisation creation, invite acceptance, server-driven
onboarding and the activation checklist.

**Why this matters more than it looks.** Our headline metric is *median time-to-first-message under
five minutes*. That clock starts at signup. Every field, every screen and every verification step
in this document is spending that budget.

---

## 1. Authentication model

### SN-AUTH-001 — Passwordless only

The system **MUST NOT** implement password authentication. Sign-in is by one-time code (email or
SMS) or Google Sign-In.

> Privyr made this call and it is right for the market. Field reps sign in on a shared or
> replaced phone often; a password is a support ticket waiting to happen, and password reuse in
> this segment is near-universal. No password means no password database, no reset flow, no
> credential-stuffing surface.

### SN-AUTH-002 — Equal-status channels

Email OTP and phone OTP **MUST** be equal-status paths, not primary and fallback. A user
**MUST** be able to sign in with whichever identifier is verified on their account.

> Privyr treats phone as the fallback for unverified email, which produces the awkward
> "your email isn't verified, use your phone instead" modal. In India and SEA the phone number is
> frequently the *more* reliable identifier.

### SN-AUTH-003 — OTP mechanics

| Rule | Value |
|---|---|
| Code length | 6 digits |
| TTL | 10 minutes |
| Max verify attempts per challenge | 5, then the challenge is consumed |
| Resend cooldown | 15 s, **enforced server-side** |
| Rate limit — request | 5/hour per identifier, 20/hour per IP |
| Storage | Hashed. Never plaintext, never logged, never in an error message. |

The client **MUST** display a countdown, but the countdown is a courtesy. Privyr enforces the
cooldown with a client-side `setInterval` only.

### SN-AUTH-004 — Bot protection

Cloudflare Turnstile **MUST** guard OTP *generation* and signup initiation — the actions that cost
us money by sending an email or SMS.

It **MUST NOT** guard OTP *submission*. Submission is protected by the attempt limit
(SN-AUTH-003), which is the correct defence. Adding a captcha there taxes every legitimate user to
no benefit.

### SN-AUTH-005 — No user enumeration

The OTP request response **MUST** be identical whether or not an account exists for the identifier.

The account-existence branch happens *after* successful verification: an unrecognised identifier
that verifies correctly enters the signup flow.

> This closes the enumeration hole in Privyr's `EMAIL_NOT_VERIFIED`, which confirms account
> existence pre-authentication. It costs a small amount of UX clarity and it is worth it.

### SN-AUTH-006 — Session

Per [`05-api-design.md`](../05-api-design.md) §5: 15-minute access token, 30-day rotating refresh
token in an `HttpOnly` cookie, with reuse detection revoking the token family.

### SN-AUTH-007 — Multi-org membership

A user with more than one active membership **MUST** be shown an organisation picker after
verification, and **MUST** be able to switch organisations from within the app without
re-authenticating.

> This is what makes agency staff, contractors and consultants work natively rather than through
> impersonation. See [`06`](../06-permissions-and-plans.md) §4.

**Acceptance criteria**

- `AC-AUTH-003.1` — Given a challenge with 5 failed attempts, when a 6th correct code is submitted, then the response is `403 OTP_MAX_ATTEMPTS` and the code is rejected.
- `AC-AUTH-003.2` — Given an OTP requested 10 s ago, when a resend is requested, then the response is `429` with `Retry-After: 5`, regardless of client state.
- `AC-AUTH-005.1` — Given an unregistered email, when an OTP is requested, then the response body and status are byte-identical to those for a registered email.
- `AC-AUTH-006.1` — Given a refresh token already exchanged once, when it is presented again, then all tokens in its family are revoked and the response is `401`.

---

## 2. Signup

### SN-AUTH-010 — Signup is server-rendered, outside the SPA

The signup page **MUST** be server-rendered and **MUST NOT** require the application bundle.

> Adopted from Privyr, who serve signup from Django while the app is a Nuxt SPA. It is faster to
> first paint, indexable, and does not ship a megabyte of application JavaScript to someone who
> does not yet have an account. On a 3G connection in a tier-2 city, this is the difference between
> a signup and a bounce.

### SN-AUTH-011 — Three stages, minimum fields

| Stage | Fields | Required |
|---|---|---|
| 1 | Email **or** phone. Google Sign-Up alongside. | identifier |
| 2 | Name, organisation name | name only |
| 3 | 6-digit code | code |

Google signup **MUST** skip stage 3 (the verified ID token is the proof) and **MUST** prefill
stage 2 from the token claims.

**Nothing else is asked at signup.** Industry, team size and role are collected during onboarding,
after the account exists, where abandonment costs us nothing.

### SN-AUTH-012 — Role is derived server-side

The signup request **MUST NOT** contain a role field. Role is derived server-side: `OWNER` for a
new organisation, or the role carried by the invite for an invited user.

> Privyr's shipped source contains `payload['role'] = "OWNER"; // TODO: customize this. Should not
> be hard coded`. Their server presumably ignores it, but a client-supplied role should not exist
> in the payload at all.

### SN-AUTH-013 — Typed signup errors

Every signup failure **MUST** return a typed error code, and the client **MUST** branch on it.

> Privyr's signup page carries the comment *"Hmm this isn't very good. We assume all error is email
> error?"* — rate-limit trips, invalid invite codes and captcha failures all render under the email
> field. Their login flow already does this correctly; signup never adopted it.

### SN-AUTH-014 — Server-side attribution capture

Acquisition data **MUST** be captured **server-side** and persisted to `user.acquisition` at
account creation. First-touch window: **15 days**.

Captured: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `gclid`, `fbclid`, `referrer`,
`device_type`, `first_touch_at`.

> Privyr does this in `localStorage` and expires the bundle with `localStorage.clear()` — which
> wipes everything the origin stored, not just the campaign keys. The *idea* is right and worth
> copying; the implementation is not. Ad blockers, private browsing and storage clearing all lose
> attribution silently, and it can never be recovered.

**Acceptance criteria**

- `AC-AUTH-012.1` — Given a signup request with `{"role": "OWNER"}` injected, when submitted, then the field is ignored and role is derived from the invite or defaulted server-side.
- `AC-AUTH-014.1` — Given a visit with `?utm_source=google&gclid=X` followed by signup 14 days later, when the account is created, then `user.acquisition.utm_source = "google"`.
- `AC-AUTH-014.2` — Given the same visit followed by signup 16 days later, then `user.acquisition.utm_source` is null and `referrer` reflects only the final session.

---

## 3. Organisation creation and invites

### SN-AUTH-020 — Organisation on first signup

A user signing up without an invite **MUST** get an organisation created automatically, with an
`OWNER` membership. Defaults derive from the detected country: currency, timezone, phone country
code.

### SN-AUTH-021 — Invite lifecycle

`invite → resend → cancel → accept → active → deactivate → reactivate`

| Rule | |
|---|---|
| Token | Stored hashed; plaintext exists only in the email |
| Expiry | 14 days; resending mints a **new** token and invalidates the old |
| Capabilities | Carried on the invite, applied at acceptance |
| Existing user | Creates a second membership; **MUST NOT** create a second user row |
| Seat check | At **acceptance**, not at invite — so an invite sent under an old plan fails clearly rather than silently over-filling |

### SN-AUTH-022 — Deactivation requires reassignment

Deactivating a member with assigned leads **MUST** require an explicit choice: reassign to a named
member, or leave unassigned. Members **MUST NOT** be deletable.

---

## 4. Onboarding — server-driven

### SN-AUTH-030 — The server owns the sequence

```
GET  /api/v1/onboarding/screen        → the next screen to render
POST /api/v1/onboarding/submit        → answers; returns the next screen
```

The client **MUST NOT** hardcode the onboarding sequence. It renders whatever screen the server
returns and posts the answers back.

```json
{
  "screen_key": "industry",
  "is_complete": false,
  "progress": {"step": 2, "total": 5},
  "skippable": true,
  "title": "What do you sell?",
  "subtitle": "We'll set up your lead stages to match.",
  "fields": [
    {"key": "industry", "type": "SINGLE_SELECT", "required": true,
     "options": [{"value": "real_estate", "label": "Real Estate", "icon": "…"}]}
  ]
}
```

> **This is the highest-leverage pattern in the whole growth surface.** Onboarding is the flow
> teams iterate on most and re-release least willingly. Making it data means a growth experiment is
> a database change, shippable in an afternoon, reversible in a minute. Adopted from Privyr's
> `get-onboarding-screen` and worth building properly on day one rather than retrofitting.

### SN-AUTH-031 — Onboarding is skippable and resumable

Every screen except organisation name **MUST** be skippable. Progress **MUST** persist so the user
resumes where they stopped. Onboarding **MUST NOT** block access to the product.

### SN-AUTH-032 — Industry seeds real defaults

Answering the industry question **MUST** seed:

| | Real estate | Insurance | Education |
|---|---|---|---|
| Lead stages | New · Contacted · Site Visit · Negotiation · Closed | New · Contacted · Quoted · Documents · Policy Issued | New · Contacted · Counselling · Enrolled |
| Custom fields | Budget, Property Type, Location | Policy Type, Sum Assured, Renewal Date | Course, Batch, Fee Quoted |
| Starter content | 3 message templates | 3 message templates | 3 message templates |

> An empty CRM is a CRM nobody adopts. The single strongest predictor of week-4 retention in this
> category is whether the account had usable structure in the first session. Seeding costs us one
> table of defaults.

### SN-AUTH-033 — Onboarding order is deliberate

```
1. Organisation name        (required)
2. Industry                 → seeds stages, fields, templates
3. Team size                → routes solo vs team paths
4. Connect a lead source    ← skippable, high value
5. Connect WhatsApp         ← skippable, THE moment
```

WhatsApp connection is **last and skippable**. It is the highest-value step and the highest-
friction one — it requires the user's phone in their hand and a QR scan. Putting it earlier
increases completion of that step and reduces completion of onboarding overall. It reappears as the
first activation task.

---

## 5. Activation checklist

### SN-AUTH-040 — Server-defined tasks

```
GET  /api/v1/activation/tasks
POST /api/v1/activation/dismiss
```

```json
{"completed": 3, "total": 7, "is_dismissed": false,
 "tasks": [{"key": "connect_whatsapp", "label": "Connect your WhatsApp",
            "description": "See every conversation in SalesNova automatically.",
            "is_complete": false, "route": "/settings/whatsapp",
            "cta_label": "Connect", "estimated_seconds": 120, "order": 1}]}
```

Task definitions are **seed data**. Completion is **derived from real state**, never from a
"mark as done" click.

### SN-AUTH-041 — The default task set

| Order | Task | Completion condition |
|---|---|---|
| 1 | Connect your WhatsApp | `whatsapp_account.status = CONNECTED` |
| 2 | Add your first lead | ≥1 lead exists |
| 3 | Send your first message | ≥1 outbound message or logged contact |
| 4 | Connect a lead source | ≥1 `integration_connection` connected |
| 5 | Create your first content | ≥1 content item |
| 6 | Share content with a lead | ≥1 `content_share` |
| 7 | Invite a team member | ≥1 invitation sent |

### SN-AUTH-042 — Dismissible, permanently

The checklist **MUST** be dismissible, and dismissal **MUST** persist. A solo agent who will never
invite anyone should not be nagged forever about a task they have correctly decided not to do.

---

## 6. App warnings

### SN-AUTH-050 — One banner channel

All global banners — subscription expiry, payment failure, WhatsApp health, seat limits,
deprecations — **MUST** flow through `bootstrap.warnings`. One rendering component, many producers.

```json
{"code": "WA_INACTIVITY_WARNING", "severity": "warning|error|info",
 "message": "…", "action": {"label": "…", "route": "…"},
 "dismissible": false, "expires_at": null}
```

Non-dismissible warnings are reserved for states with **data-loss or service-loss consequences** —
imminent WhatsApp disconnection, payment overdue. Everything else is dismissible.

---

## 7. Magic links

### SN-AUTH-060 — Scoped, single-purpose, expiring

A magic link **MUST** grant access to **one named resource** and nothing else. It **MUST NOT**
create a full session.

| Property | Rule |
|---|---|
| Scope | Exactly one resource id and one action |
| Expiry | 7 days default; 24 h for anything sensitive |
| Single-use | Where the action is a state change |
| Revocation | Invalidated when the underlying resource is deleted or revoked |
| Audit | Every use logged with IP and user agent |

Used for: shared content viewing, invite acceptance, unsubscribe, email-based lead claim.

> Privyr's `resources-access-policy?{MAGIC_TOKEN}` returns a `set-cookie`, which reads as a session
> grant. Scoping the grant to the resource rather than the account is the safer construction.

---

## 8. Screens

| Screen | Route | Notes |
|---|---|---|
| Sign in — identifier | `/login` | Google button above the fold; email/phone toggle |
| Sign in — code | `/login/verify` | **Own URL**, refresh-safe |
| Organisation picker | `/login/organizations` | Only when >1 membership |
| Sign up | `/signup` | Server-rendered, outside the SPA |
| Invite acceptance | `/invite/:token` | Shows org name and inviter before asking for anything |
| Onboarding | `/onboarding` | Server-driven screens |

> **The verification step gets its own URL.** Privyr keeps it as `activeStep` state on `/login`, so
> a refresh — or an Android user switching to their SMS app and back, which the OS may treat as a
> reload — drops them to step one. On mobile web this is a routine and infuriating failure.

---

## 9. Metrics

| Metric | Target |
|---|---|
| Signup → account created | > 70% |
| OTP delivery p95 | < 10 s email, < 20 s SMS |
| Onboarding completion | > 60% |
| WhatsApp connected within first session | > 35% |
| WhatsApp connected within 7 days | > 55% |
| **Signup → first message sent (median)** | **< 5 min** |

The last one is the product thesis expressed as a number. Everything in this document is
subordinate to it.
