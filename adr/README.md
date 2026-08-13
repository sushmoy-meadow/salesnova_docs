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
| [0034](0034-the-signup-screens-hold-their-state-in-a-cookie-and-their-failures-in-the-url.md) | The signup screens hold their state in a cookie and their failures in the URL | Accepted |
| [0035](0035-the-storage-port-reads-a-prefix-and-signs-the-disposition.md) | The storage port reads a prefix, and the disposition is signed rather than requested | Accepted |
| [0036](0036-the-token-layer-deletes-the-values-it-does-not-want.md) | The token layer deletes the Tailwind values it does not want, and spacing is keyed by pixels | Accepted |
| [0037](0037-the-contract-registry-is-a-compile-error-and-the-pointer-states-are-not-props.md) | The component contract registry is a compile error, and the pointer states are a precedence function rather than props | Accepted |
| [0038](0038-a-wall-is-named-by-why-it-is-shut-and-an-error-surface-always-has-a-way-out.md) | A wall is named by why it is shut, an error surface always has a way out, and the page behind an overlay is owned by one stack | Accepted |
| [0039](0039-the-platform-is-the-headless-primitive-everywhere-it-has-one.md) | The platform is the headless primitive everywhere it has one, and only the combobox is written by hand | Accepted |
| [0040](0040-the-touch-target-is-a-pseudo-element-and-a-class-name-is-never-computed.md) | The touch target is a pseudo-element rather than padding, and a class name is never computed | Accepted |
| [0041](0041-the-placeholder-and-the-table-are-one-frame.md) | The placeholder and the table render through one frame, and the row height is fixed | Accepted |
| [0042](0042-a-chart-is-svg-we-draw-and-a-table-nobody-can-skip.md) | A chart is SVG we draw, and a table nobody can skip | Accepted |
| [0043](0043-a-tenant-table-may-be-scoped-by-its-service-if-it-says-so.md) | A tenant table may be scoped by its service, if its model says so | Accepted |
| [0044](0044-the-live-region-is-in-the-page-before-there-is-anything-to-say.md) | The live region is in the page before there is anything to say, and there is one focus ring | Accepted |
| [0045](0045-attribution-is-a-server-written-cookie-and-the-window-closes-server-side.md) | Attribution is a server-written cookie, and the window closes server-side | Accepted |
| [0046](0046-the-seat-is-taken-at-acceptance-and-the-plan-is-asked-then.md) | The seat is taken at acceptance, and the plan is asked then | Accepted |
| [0047](0047-causation-is-ambient-because-a-parameter-gets-dropped-at-the-boundary.md) | Causation is ambient, because a parameter gets dropped at the boundary | Accepted |
| [0048](0048-the-breakpoint-is-a-css-variant-and-javascript-never-measures-the-window.md) | The breakpoint is a CSS variant, and JavaScript never measures the window | Accepted |
| [0049](0049-a-deep-link-refusal-is-data-and-the-way-out-is-part-of-the-reason.md) | A deep-link refusal is data, and the way out is part of the reason | Accepted |
| [0050](0050-the-request-names-its-own-tier-and-the-money-step-is-a-machine.md) | The request names its own tier, and the money step is a machine | Accepted |
| [0051](0051-one-gate-decides-whether-ai-may-be-offered-and-off-hides-while-down-disables.md) | One gate decides whether AI may be offered, and off hides while down disables | Accepted |
| [0052](0052-motion-is-one-rung-and-a-test-is-what-stops-a-second-one-appearing.md) | Motion is one rung, and a test is what stops a second one appearing | Accepted |
| [0053](0053-the-server-sends-the-instant-and-the-reader-owns-the-zone.md) | The server sends the instant, and the reader owns the zone | Accepted |
| [0054](0054-a-story-is-indexed-statically-so-the-coverage-test-cannot-be-the-only-gate.md) | A story is indexed statically, so the coverage test cannot be the only gate | Accepted |
| [0055](0055-a-403-cannot-be-sold-to-because-there-is-nothing-to-build-the-offer-from.md) | A 403 cannot be sold to, because there is nothing to build the offer from | Accepted |
| [0056](0056-the-off-switch-is-enforced-at-the-only-door-and-the-circuit-is-shared.md) | The off-switch is enforced at the only door, and the circuit is shared | Accepted |
| [0057](0057-three-deviations-from-the-company-bible-and-why-each-one-stands.md) | Three deviations from the company bible, and why each one stands | Accepted |
| [0058](0058-a-capability-that-narrows-is-not-a-grant-and-no-preset-switches-it-on.md) | A capability that narrows is not a grant, and no preset switches it on | Accepted |
| [0059](0059-an-unread-field-is-refused-and-an-identifier-is-the-only-thing-glued-into-sql.md) | An unread field is refused, and an identifier is the only thing glued into SQL | Accepted |
| [0060](0060-html-is-cleaned-by-the-column-and-the-policy-is-written-once.md) | HTML is cleaned by the column, and the policy is written once | Accepted |
| [0061](0061-lead-query-boundaries-and-phone-fallback.md) | Lead queries reject unavailable predicates and use a bounded phone fallback | Accepted |
| [0062](0062-bulk-records-retain-source-evidence-and-tenant-links.md) | Bulk records retain source evidence and tenant-linked ownership | Accepted |
| [0063](0063-lead-merge-winners-are-explicit-field-lead-pairs.md) | Lead merge winners are explicit field/lead pairs | Accepted |
| [0064](0064-timeline-and-activity-streams-use-one-cursor-contract.md) | Timeline and activity streams use one cursor contract | Accepted |
| [0062](0062-a-verified-identifier-is-an-account-and-the-two-otp-ceilings-both-hold.md) | A verified identifier is an account, and both OTP ceilings hold | Accepted |
| [0063](0063-the-onboarding-sequence-is-rows-so-its-keys-cannot-be-enums.md) | The onboarding sequence is rows, so its keys cannot be enums | Accepted |
| [0064](0064-the-code-step-is-a-route-and-the-session-is-a-cookie-the-page-cannot-read.md) | The code step is a route, and the session is a cookie the page cannot read | Accepted |
| [0065](0065-the-refresh-chain-remembers-the-organisation-and-a-reuse-ends-the-family.md) | The refresh chain remembers the organisation, and a reuse ends the family | Accepted |
| [0066](0066-search-results-come-from-the-response-and-nothing-a-browser-holds-is-a-result.md) | Search results come from the response, and nothing a browser holds is a result | Accepted |
| [0067](0067-a-magic-link-grants-one-action-and-the-action-decides-how-long-it-lives.md) | A magic link grants one action, and the action decides how long it lives | Accepted |
| [0068](0068-the-web-app-reads-the-contract-at-runtime-and-never-imports-it.md) | The web app reads the contract at runtime, and never imports it | Accepted |
| [0069](0069-google-arrives-by-redirect-and-the-browser-never-holds-the-credential.md) | Google arrives by redirect, and the browser never holds the credential | Accepted |
| [0070](0070-the-refresh-cookie-is-set-on-our-own-origin-so-the-auth-routes-are-proxied.md) | The refresh cookie is set on our own origin, so the auth routes are proxied | Accepted |
