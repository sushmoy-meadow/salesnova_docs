# ADR-0014 — Passwordless authentication only

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Product + Engineering

## Context

Our users are non-technical salespeople on shared or mid-range Android devices, in a market where
mobile-number identity is the norm and email is often secondary or checked rarely.

Privyr already uses OTP-based login, which suggests this is validated behaviour in the segment
rather than a novel bet.

## Decision

**One-time passcode to phone or email, plus Google SSO. No password, ever.**

Phone and email are **equal-status channels** — neither is the "real" identifier
([`F01`](../features/F01-identity-and-onboarding.md)).

## Consequences

- **No password to phish, leak, reuse or store.** An entire vulnerability class, a breach-severity
  multiplier, and a support-ticket category all disappear together.
- No password reset flow, no strength meter, no rotation policy, no credential-stuffing exposure.
- Signup and login are the same interaction, which removes the "do I have an account?" hesitation
  that costs conversions.
- We accept the operational costs: SMS delivery cost and reliability in India, plus DLT sender
  registration. Email is a mandatory equal-status fallback partly for this reason.
- OTP endpoints become an abuse target, so rate limiting is tight and non-negotiable — 3 per
  identifier per 15 minutes, 10 per IP per hour, with Turnstile on **generation** rather than
  submission ([`10`](../10-nfr-security-compliance.md) §SN-SEC-008).
- **No user enumeration:** the response to an OTP request is identical whether or not the account
  exists.
- Account recovery is inherently tied to channel access. A user who loses both their number and
  their email needs support — rare, and acceptable against everything above.

## Alternatives

**Passwords with optional OTP.** Familiar, and it retains every problem passwords have while adding
a second system to maintain. The familiarity argument is weak in a segment that already logs into
banking, UPI and Privyr itself by OTP.

**Magic links only.** Poor on mobile, where the link opens in the mail app's in-app browser and
loses the session. Magic links are supported as a **convenience** in email
([`F01`](../features/F01-identity-and-onboarding.md)), not as the primary mechanism.

**Passkeys.** The right long-term answer, and adoption on mid-range Android in this market is not
yet there. Revisit for V1.5 as an additive option, never as the only one.
