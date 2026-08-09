# Architecture Decision Records

Each ADR records **one decision, the context that forced it, and the consequences we accepted**.

An ADR is immutable once accepted. A decision that changes gets a new ADR that supersedes the old
one, and the old one stays — the record of what we believed and why is more valuable than a tidy
directory.

Open decisions live in [`13-open-decisions.md`](../13-open-decisions.md) until they are resolved
here.

## Format

```
# ADR-NNNN — Title
Status · Date · Deciders
## Context     what forced a decision
## Decision    what we chose, stated plainly
## Consequences what we accepted, good and bad
## Alternatives what we rejected and why
```

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-beachhead-market.md) | Beachhead market: India + SEA | Accepted |
| [0002](0002-responsive-web-first.md) | V1 is responsive web only | Accepted |
| [0003](0003-technology-stack.md) | Laravel 13 · Postgres · Next.js 16 | Accepted |
| [0004](0004-whatsapp-coexistence.md) | **WhatsApp Coexistence as the channel strategy** | Accepted |
| [0005](0005-pricing-posture.md) | Match price, beat on value | Accepted |
| [0006](0006-v1-full-parity.md) | V1 ships full web parity with Privyr | Accepted |
| [0007](0007-ai-substrate-first.md) | Substrate in V1, AI features in V2 | Accepted |
| [0008](0008-modular-monolith.md) | Modular monolith, not microservices | Accepted |
| [0009](0009-shared-schema-multitenancy.md) | Shared-schema multi-tenancy | Accepted |
| [0010](0010-separate-event-log.md) | `event` separate from `timeline_event` | Accepted |
| [0011](0011-two-payment-providers.md) | Razorpay for India, Stripe elsewhere | Accepted |
| [0012](0012-sse-over-websockets.md) | SSE for real-time, not WebSockets | Accepted |
| [0013](0013-separate-public-surface.md) | Public surfaces deploy separately | Accepted |
| [0014](0014-passwordless-authentication.md) | Passwordless authentication only | Accepted |
| [0015](0015-spec-envelope-over-bible-envelope.md) | Project API envelope supersedes the bible envelope | Proposed |
| [0016](0016-contract-first-endpoints.md) | An endpoint publishes its contract before its logic, answering 501 until then | Accepted |
| [0017](0017-uuid-keys-with-bigint-user-id.md) | UUID keys on org-scoped tables, bigint `users.id` until the auth schema task lands | Accepted |
| [0018](0018-lowercased-identity-values.md) | Identity values are lowercased on write, and query builders must repeat it | Accepted |
| [0019](0019-policy-envelope-shape.md) | Policy objects carry booleans only, denial reasons ride beside them | Accepted |
| [0020](0020-driver-conditional-check-constraints.md) | A multi-column CHECK is a constraint on Postgres and a trigger pair on SQLite | Accepted |
| [0021](0021-audit-log-is-not-the-activity-log.md) | `audit_log` is the compliance record, `activity_log` is model-change history, and no event goes to both | Accepted |
| [0022](0022-audit-log-immutability-by-trigger.md) | `audit_log` immutability is a trigger, and retention lifts it under a role the application does not hold | Accepted |
| [0023](0023-w3c-trace-context-without-opentelemetry.md) | The trace id is a W3C trace id, propagated by `traceparent` rather than by an OpenTelemetry SDK | Accepted |
| [0024](0024-redaction-at-the-handler-and-at-the-sink.md) | Personal data is removed in layers at each sink, and never at the call site | Accepted |
| [0025](0025-event-log-partitions-and-identity.md) | Event-log partitions are built by a scheduled command, and the key leads with the tenant | Accepted |
| [0026](0026-provider-ports-before-their-adapters.md) | Provider ports are scaffolded ahead of their adapters, carry only what can be typed, and import nothing foreign | Accepted |
| [0027](0027-the-llm-port-holds-translation-only.md) | The LLM port holds translation only, and a new dependency is placed before it is imported | Accepted |
| [0028](0028-the-call-log-is-telemetry-not-evidence.md) | The model-call log is telemetry, guarded in PHP, and outlives the tenant it belongs to | Accepted |
| [0029](0029-signup-and-invite-acceptance-are-public-and-tokenless-in-the-url.md) | Signup ends in a session, invite acceptance is public, and no credential rides in a URL | Accepted |
| [0030](0030-a-capabilitys-rate-sits-beside-its-model.md) | A capability's rate is configured beside its model, and the port reports whether a call timed out | Accepted |
| [0031](0031-one-queue-holds-both-reasons-to-stop.md) | One queue holds both reasons to stop, a confirmation is a type, and prompts are refused rather than redacted | Accepted |
| [0032](0032-the-invite-preview-names-the-inviter-without-their-address.md) | The invite preview names the inviter without their address | Accepted |
| [0033](0033-invite-preview-is-a-posted-token.md) | The invite screen reads its invitation by posting the token | Accepted |
