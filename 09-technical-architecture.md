---
doc: 09-technical-architecture
status: REVIEW
owner: Engineering
audience: Backend, frontend, platform, SRE
depends_on: [04-domain-model, 05-api-design]
---

# Technical Architecture

**Laravel 13 · PostgreSQL 16 · Next.js 16 · Redis · S3-compatible object storage.**

---

## 1. Shape

### SN-ARCH-001 — A modular monolith, not microservices

One Laravel application, internally partitioned into domain modules with explicit boundaries.

> Privyr runs 14 backend services behind an `/api/{service}/api/{version}/` gateway. The cost is
> visible throughout the recon: the same resource versioned at v1, v2 and v3 simultaneously;
> follow-ups in a separate service from the leads they belong to; sub-teams in the content service
> because that is where they started; two stats endpoints keyed on **opposite** ids.
>
> None of that is inherent to microservices — it is what happens when service boundaries are drawn
> before the domain is understood. We are building a known domain at a scale one well-structured
> application handles comfortably. **Extract a service when a specific, measured need appears**, not
> in anticipation.

### SN-ARCH-002 — Module boundaries

```
app/Domains/
  Identity/       user, org, membership, subteam, auth, invitation
  Leads/          lead, custom fields, groups, follow-ups, duplicates
  Activity/       timeline_event, event, audit
  Content/        content, pages, files, messages, folders, labels
  Sharing/        shares, views, the public viewer
  Sequences/      sequences, steps, enrolments, task queue
  Automation/     rules, conditions, distribution, CAPI
  Acquisition/    integrations, connections, lead forms, ingestion
  Messaging/      WhatsApp accounts, conversations, messages, templates, campaigns
  Billing/        plans, subscriptions, credits, invoices
  Platform/       notifications, jobs, feature flags, settings, search
```

Each module owns its models, services, policies, jobs and events. **Cross-module communication is
through published domain events or an explicit public service interface — never by reaching into
another module's models.** Enforced by a static-analysis rule in CI.

The interfaces that carry that traffic live in `app/Contracts/{Domain}/`. In force today:

```
PushSubjectInterface      Notifications ← any record       app/Contracts/Notifications
EventWriter               Timeline ← any module            app/Contracts/Timeline
```

`PushSubjectInterface` reduces a record to the organisation, type and id a client resolves it from,
so the notification payload producer never holds a row it could copy contact detail out of.

`EventWriter` is the only way into the event log. It carries a single `append` method — append-only
is the absence of anything else to call rather than a rule each caller has to remember — and returns
a reference DTO rather than the model, so appending an event never hands another module a row it
could write through. A test rule fails the build if anything outside the timeline module reaches the
table or the model directly.

### SN-ARCH-003 — Four deployables

| | Runtime | Why separate |
|---|---|---|
| **API** | Laravel (Octane) | The CRM backend |
| **Web app** | Next.js | The authenticated SPA |
| **Public surface** | Next.js, separate build | Share viewer + lead forms. Different security posture, different performance budget, no auth, no CRM bundle. |
| **Workers** | Laravel Horizon | Queues, schedulers, ingestion |

> Splitting the public surface is a **security and performance decision, not an organisational one**.
> It carries no third-party trackers, no authentication code, no CRM bundle, and its own CSP and
> rate limits ([`F07`](features/F07-sharing-and-tracking.md), [`F11`](features/F11-lead-forms.md)).

---

## 2. Backend

### SN-ARCH-010 — Laravel Octane

Persistent workers rather than per-request bootstrap. Roughly 3–5× throughput on the read-heavy
endpoints that dominate our traffic.

**Consequence engineers must internalise:** application state persists between requests. Static
properties, singletons holding request data, and container bindings mutated at runtime are all
bugs. Reviewed explicitly.

### SN-ARCH-011 — Queues on Redis, managed by Horizon

| Queue | Priority | Purpose |
|---|---|---|
| `ingest` | highest | Inbound leads, WhatsApp webhooks — **the response-time promise** |
| `notify` | high | Push and email alerts |
| `send` | high | Outbound WhatsApp, rate-limited per account |
| `sync` | normal | Contact and history sync, integration polling |
| `bulk` | low | Bulk operations, imports, exports |
| `analytics` | lowest | Rollups, aggregation |

Separate supervisors per queue so a 50,000-row export cannot delay a lead notification.

Laravel 13's `#[Connection]` / `#[Queue]` attributes declare routing on the job class itself,
keeping it beside the logic rather than in a config file.

### SN-ARCH-012 — Read/write splitting

Writes to primary; heavy reads (analytics, exports, rollups) to a read replica. **Request-path
reads stay on primary** — replication lag showing a rep a lead that "does not exist yet" is worse
than the load saving.

### SN-ARCH-013 — Caching

| Layer | Content | TTL |
|---|---|---|
| Redis | Bootstrap payload per membership | 5 min, invalidated on mutation |
| Redis | Plan constraints, feature flags, integration registry | 1 h |
| Redis | Permission resolution per membership | 5 min, invalidated on change |
| CDN | Public viewer assets, content files | long, hashed filenames |
| CDN | Public viewer HTML | **not cached** — personalised and owner-aware |

**Cache keys always include `organization_id`.** A cache key that could collide across tenants is a
cross-tenant data leak, and it is the most likely way one happens.

### SN-ARCH-014 — Real-time

Server-sent events for inbound messages, content-view alerts and lead assignment. Not WebSockets.

> SSE is one-way, which is all we need; it survives proxies and mobile networks better; it
> reconnects automatically; and it needs no separate server. WebSockets would be justified by
> typing indicators or collaborative editing, and we have neither.

Channels are scoped per membership and authorised on connect.

### SN-ARCH-015 — Search

PostgreSQL full-text with GIN indexes in V1. **No Elasticsearch.**

Phone normalisation happens before the query ([`05`](05-api-design.md) §8.3). Budget: p95 < 200 ms.
Revisit only if that budget is missed at real data volume — not before.

---

## 3. Data

### SN-ARCH-020 — Shared-schema multi-tenancy

`organization_id` on every tenant-scoped table, leading every composite index, applied by a global
Eloquent scope.

**Enforcement is layered** ([`06`](06-permissions-and-plans.md) §1.6). The single highest-severity
bug class in this product is a query that forgets the tenant. Mitigations:

1. Global scope by default on every tenant model
2. A CI rule flagging raw `DB::` queries in domain code
3. A test suite that runs every list endpoint as two tenants and asserts zero overlap
4. Query-log sampling in staging alerting on tenant-less queries against tenant tables

The runtime implementation keeps the response boundary scalar-only through
`App\Contracts\Security\TenantFieldGuard`. `TenantIsolationServiceProvider` wires a stateless
staging listener whose critical event contains only the connection, matched table names and a
normalised SQL fingerprint; bindings, raw SQL and request state are never logged.

### SN-ARCH-021 — Partitioning

`timeline_event`, `whatsapp_message` and `event` are **range-partitioned by month** from day one.

Partitions are created 3 months ahead by a scheduled job. Retention is enforced by detaching old
partitions, which is instant — versus a `DELETE` of tens of millions of rows, which is not.

> Partitioning later means a maintenance window on the largest tables at exactly the moment the
> product is succeeding. Doing it upfront costs a day.

### SN-ARCH-022 — Migrations are backward-compatible

Expand → migrate → contract. No migration may break the currently-deployed application version.
No blocking DDL on a large table during business hours; `CREATE INDEX CONCURRENTLY` always.

### SN-ARCH-023 — Backups

| | |
|---|---|
| Continuous | WAL archiving, PITR to any second within 7 days |
| Daily | Full snapshot, retained 35 days |
| Weekly | Retained 12 months |
| **Restore drill** | **Monthly, to a scratch environment, timed and recorded** |

> A backup that has never been restored is a hypothesis. The monthly drill is the requirement; the
> backup is just its precondition.

### SN-ARCH-024 — Object storage

S3-compatible, per-tenant key prefixes, server-side encryption, presigned upload and download,
lifecycle rules for temporary artefacts (exports at 24 h, import files at 7 days).

**Buckets are never public.** Delivery is via CDN with signed or opaque URLs.

---

## 4. Frontend

### SN-ARCH-030 — Next.js App Router, mostly client-rendered

The authenticated app is behind a login, personalised per membership, and highly interactive.
Server rendering buys little and complicates state.

**Server-rendered:** the public share viewer, lead forms, signup, and marketing routes — where
first paint, indexability and payload size are the whole point.

### SN-ARCH-031 — State

| Kind | Tool |
|---|---|
| Server state | TanStack Query — caching, invalidation, optimistic updates, retry |
| Global client state | Zustand — small: bootstrap payload, UI prefs, active org |
| Form state | React Hook Form + Zod |
| URL state | Search params — filters, sort, pagination |

**Filters and sort live in the URL**, so a filtered view is shareable and back-button-safe
([`F02`](features/F02-leads.md) §SN-LEAD-082).

### SN-ARCH-032 — Types are generated, not written

OpenAPI is generated from Laravel route and request definitions; TypeScript types and a typed
client are generated from the OpenAPI spec. **Hand-written API types are forbidden** — they drift,
silently, and the drift surfaces in production.

CI fails when the committed spec differs from the generated one.

### SN-ARCH-033 — Optimistic updates with per-element rollback

Per [`08-ux-flows.md`](08-ux-flows.md). A failed mutation reverts **that element**, inline, with a
retry. Never a full-screen error for one failed cell.

### SN-ARCH-034 — Code splitting per route

App shell under 180 KB gzipped; route chunks under 60 KB. The grid, the page builder and the rule
builder are lazy-loaded — they are desktop-only and large.

### SN-ARCH-035 — Offline resilience

Service worker caching the shell and recent reads. Writes queue in IndexedDB and flush on
reconnect, with a visible pending state. **A queued message survives a page reload.**

Not full offline mode (V2). This is graceful degradation on a bad connection, which is the actual
daily reality for our users.

---

## 5. Integration layer

### SN-ARCH-040 — Ports for every external dependency

```
WhatsAppChannelProvider   BSP or direct Meta        F12 §10
PaymentProvider           Razorpay / Stripe          F19 §1
LeadSourceParser          per integration            F10
NotificationChannel       web push, email, (SMS)     F17
StorageProvider           S3-compatible              §3.4
LlmProvider               email parsing, V2 AI       11-ai-substrate
```

No vendor SDK appears above its port. **The provider is a config value, not an architectural
commitment.**

Scaffolded, with the driver for each read from `config/providers.php` through a `match` in
`ProviderServiceProvider`:

```
WhatsAppChannelProviderInterface   app/Contracts/Messaging       providers.whatsapp
PaymentProviderInterface           app/Contracts/Billing         providers.payment
NotificationChannelInterface       app/Contracts/Notifications   providers.notification
StorageProviderInterface           app/Contracts/Platform        providers.storage
LlmProviderInterface               app/Contracts/Ai              providers.llm
LeadSourceParserInterface          app/Contracts/Acquisition     not container-bound
```

`Ai` is a twelfth namespace segment beyond the eleven modules SN-ARCH-002 lists, added here because
the AI substrate is its own spec document and its own backlog domain.

`LeadSourceParserInterface` is the one port with no configured driver. Which parser runs depends on
the source a payload arrived from, so several are live at once and a single container binding would
have to be reassigned per request — unsafe on a worker that outlives it. The task that builds the
first parsers owns the registry that resolves them.

Each port carries only the methods whose types exist today; the fuller signatures sketched in
[`F12`](features/F12-whatsapp-coexistence.md) §SN-WA-080 and [`F19`](features/F19-billing.md)
§SN-BILL-003 arrive with the adapters that implement them.

`LlmProviderInterface` is the exception and is complete, carrying all three methods
[`11`](11-ai-substrate.md) §SN-AI-030 specifies, with `App\DTOs\Ai\{PromptDTO, LlmOptionsDTO,
LlmResponseDTO}` and `App\Enums\Ai\{AiCapability, FinishReason}` as its types. Two things about its
shape are decisions rather than transcription: the model is a required field on the options, so
capability-to-model resolution sits above the port and no adapter holds product policy; and a
prompt is single-turn, because every capability the product ships is. See
[ADR-0027](adr/0027-the-llm-port-holds-translation-only.md).
A webhook reaches a port as a decoded payload rather than as a request, because ingestion persists
it before parsing and the parse then runs on a queue. No driver is defaulted: a build that has not
chosen a provider fails at the moment it resolves the port, rather than talking to whichever vendor
was listed first. See [ADR-0026](adr/0026-provider-ports-before-their-adapters.md).

### SN-ARCH-041 — Webhook ingestion

Per [`F10`](features/F10-integrations.md) §2: persist raw → verify → `200` fast → process async →
idempotent → replayable.

A dedicated `ingest` queue with the highest priority and its own supervisor.

The admission half of that sequence — everything up to `200` — is `App\Services\Security\WebhookGuard`,
which records, verifies, deduplicates and settles a verdict in that order. It resolves two ports:

```
WebhookSignatureSchemeInterface    app/Contracts/Security      passed per call
InboundWebhookRecorderInterface    app/Contracts/Acquisition   constructor-injected
```

The scheme is passed per call rather than bound, because a single request already knows which
provider it came from and the caller holds the secret; a container binding would have to name one
provider for a guard that serves all of them. `HmacWebhookScheme` covers every provider that signs
a digest over the body, with the header name, prefix, optional timestamp header and tolerance as
constructor arguments — Meta, Razorpay and Stripe differ only in those four values.

The recorder is a contract, not a class, because the table it writes to is migrated by a later task
and the guard must not wait on it. It is filed under Acquisition because `inbound_event` is that
module's table, and it is split into `record()` and `settle()` so the row exists before there is a
verdict to attach to it.

Replay protection is `App\Support\Security\ReplayWindow`, an atomic claim on a shared cache store
keyed by source and a hash of the provider's event id, configured through `config/webhooks.php`.
The claim is taken only after the signature verifies and only after the payload is safely recorded:
an id claimed on behalf of a delivery nobody wrote down would turn every retry of it into a
duplicate for the length of the window.

### SN-ARCH-042 — Outbound resilience

Retry with exponential backoff and jitter · circuit breaker per provider · timeouts on every
external call (5 s connect, 15 s read) · a dead-letter queue that is monitored, not merely
populated.

### SN-ARCH-043 — Rate limiting is provider-aware

WhatsApp sends are governed per account by `throughput_mps` — enforced in the **queue**, not the
HTTP layer. Meta's Graph API calls are limited per app and per token.

---

## 6. Observability

### SN-ARCH-050 — Structured logs, always with context

JSON logs carrying `trace_id`, `organization_id`, `membership_id`, route and duration.

**PII is never logged.** Phone numbers, emails, message bodies and OTP codes are redacted at the
logger, not at the call site — redaction that depends on every developer remembering is redaction
that fails.

### SN-ARCH-051 — Distributed tracing

OpenTelemetry across API, workers and outbound calls. `trace_id` is returned on every error
response ([`05`](05-api-design.md) §2.4), so a support ticket maps to a trace in one search.

> **Deviation in force.** The build propagates W3C Trace Context directly and does not install an
> OpenTelemetry SDK; see [ADR-0023](adr/0023-w3c-trace-context-without-opentelemetry.md). The
> requirement above is unchanged, and nothing built against it has to move if an SDK is added later:
> what crosses a process boundary is the `traceparent` header this requirement already specifies.

### SN-ARCH-052 — The metrics that matter

| Metric | Alert |
|---|---|
| **Lead ingest → notification delivered** | p95 > 10 s |
| **Webhook ack time** | p95 > 200 ms |
| Queue depth per queue | `ingest` > 100 |
| **WhatsApp accounts in `CRITICAL`/`DISCONNECTED`** | any increase |
| Failed webhook signature rate | > 1% |
| Integration silence | any connection past 3× its interval |
| API error rate by endpoint | > 1% 5xx |
| DB connection pool saturation | > 80% |
| Credit/provider reconciliation drift | > 1% |

The first two are the product promise as an alert. Everything else is infrastructure.

### SN-ARCH-053 — Uptime targets

| Surface | Target |
|---|---|
| API | 99.9% |
| **Webhook ingestion** | **99.95%** |
| **Public share viewer and forms** | **99.95%** |
| Workers | 99.9% |

Ingestion and the public surface get the higher target because their failures are **invisible and
unrecoverable**: a dropped webhook is a lost lead nobody knows about, and a broken lead form loses
a customer we never learn existed.

---

## 7. Environments and delivery

### SN-ARCH-060 — Four environments

`local` (Docker Compose, seeded) · `ci` (ephemeral) · `staging` (production-shaped, anonymised
data, real sandbox integrations) · `production`.

### SN-ARCH-061 — Pipeline

```
lint · static analysis · type check
unit tests
integration tests (real Postgres, real Redis)
tenant isolation suite          ← blocking
contract tests (OpenAPI ↔ client)
E2E on critical flows           ← the 10 flows in 08-ux-flows.md
performance budget check        ← blocking
security scan (deps + secrets)  ← blocking
→ staging → smoke → production (blue-green)
```

### SN-ARCH-062 — Feature flags decouple deploy from release

Per [`06`](06-permissions-and-plans.md) §5. Incomplete work ships behind a flag rather than living
on a long-lived branch.

**Flags are removed within 2 releases of reaching 100%**, enforced by a lint check that fails on a
flag older than 90 days at full rollout.

### SN-ARCH-063 — Migrations run separately from deploys

Expand-phase migrations run before the deploy; contract-phase after it is confirmed stable. Never
in the same step as the application rollout.

---

## 8. Regional considerations

### SN-ARCH-070 — Primary region in India

Latency for the beachhead market, and alignment with DPDP data-localisation expectations. SEA
traffic is served through the CDN with the origin in India — acceptable for the API, and the public
surface is edge-cached regardless.

### SN-ARCH-071 — Data residency is designed for, not built yet

The schema and deployment are structured so a second region is additive: `organization.region`
exists from the start, and no cross-tenant global state assumes a single database.

A second region is a V1.5+ decision driven by real demand or a real regulatory requirement.

---

## 9. Security

Full treatment in [`10-nfr-security-compliance.md`](10-nfr-security-compliance.md). Architectural
essentials:

| | |
|---|---|
| Transport | TLS 1.3, HSTS, no plaintext anywhere |
| At rest | Database and object storage encryption; integration credentials encrypted at the column level |
| Secrets | A secret manager. **Never in code, never in a repo, never in an image.** |
| Sessions | Short-lived JWT + rotating refresh with reuse detection |
| CSP | Strict on the public surface; no inline script |
| Dependencies | Automated scanning; criticals patched within 48 h |
| Tenant isolation | Four layers, tested (§3.1) |

---

## 10. What we deliberately did not build

| Not building | Why | Revisit |
|---|---|---|
| Microservices | The domain is known; one application handles this scale | On measured need |
| Elasticsearch | Postgres FTS meets the 200 ms budget | If it stops |
| WebSockets | SSE covers our one-way needs | Typing indicators, collaboration |
| GraphQL | REST + generated types is simpler; no third-party clients yet | Public API demand |
| Event sourcing as the write model | The `event` log gives us the audit and AI benefits without the complexity | Never, probably |
| Kubernetes | Managed containers are enough at this scale | Multi-region, or ops scale |
| A separate BFF | The API is already client-shaped | Native apps with different needs |

> Each line is a decision to revisit on evidence, not an oversight. Every one of them is a thing a
> team can spend a quarter on and be no closer to the product working.
