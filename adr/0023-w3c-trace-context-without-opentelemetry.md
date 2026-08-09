# ADR-0023 — The trace id is a W3C trace id, propagated by `traceparent` rather than by an OpenTelemetry SDK

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-ARCH-051` asks for OpenTelemetry across API, workers and outbound calls, and for the `trace_id`
returned on every error response to resolve to that trace. Two facts constrain how that is met now.

**The id we were minting could not be a trace id.** `App\Support\TraceId::generate()` returned a
lowercased ULID — 26 characters of Crockford base32. Every tracing backend, and the error tracker
already installed here, requires 32 lowercase hex characters; `Sentry\Tracing\TraceId` rejects
anything else in its constructor. So the id in the error envelope was correlatable with our own log
and with nothing else. A support ticket quoting it could not be turned into a trace.

**OpenTelemetry is not installed and adding it is not this task's call.** `open-telemetry/*` is a
new Composer dependency, and the collector, exporter, sampling rate and dashboards behind it are
infrastructure that `TASK-INFRA-008` owns. Meanwhile the propagation format itself — W3C Trace
Context — is a 55-character header. Parsing and emitting it needs no package at all, and the error
tracker already in the tree speaks it.

## Decision

**The trace id is 16 random bytes as lowercase hex, and the application propagates W3C Trace Context
itself.**

- `TraceId::generate()` returns `bin2hex(random_bytes(16))`. `isValid()`, `spanId()`,
  `traceparent()` and `fromTraceparent()` are the rest of the format.
- An inbound `traceparent` that parses and is not all zeroes is **adopted**, so a request arriving
  from another service stays on one trace.
- The id is published four ways from one place: the `X-Trace-Id` response header, `error.trace_id`
  in the envelope, the log context, and the request-scoped context repository.
- **Queued work** inherits it through Laravel's context repository, which is serialised into the job
  payload and rehydrated by the worker. Nothing had to be added to a job's signature.
- **Outbound calls** carry it as a `traceparent` header, stamped by one global HTTP-client
  middleware. An outbound request that already carries one is left alone.
- **The error tracker's own trace** is seeded from ours, so an event it records is on the trace the
  error response quoted rather than on one it minted.

## Consequences

- The property the ULID had — log entries sorting naturally by trace id — is lost. Nothing depended
  on it; ordering comes from the timestamp the log line already carries.
- Nothing in the published contract changes: `error.trace_id` is `{"type": "string"}` with no format
  and no pattern, and the generated OpenAPI document is byte-identical.
- **What is built is propagation, not collection.** There is no collector, no exporter and no
  backend, and the error tracker's sample rate is unset by default, so no transaction is sampled.
  The id is carried correctly across all three legs and is asserted to be; turning it into something
  searchable in one place is infrastructure work that has not been done.
- Adopting an inbound header means a caller can choose our trace id. That is what the format is for,
  and the id is a correlation handle rather than a capability — it grants nothing, and a caller that
  supplies a colliding one only confuses its own trace.
- If OpenTelemetry lands later, the format is already the one it uses, so the change is a swap of
  transport rather than a change of identifier.

## Alternatives

- **Add `open-telemetry/opentelemetry-php`.** A new dependency, and the useful half of it — the
  collector and the backend — is environmental and absent. The header format is the part that has to
  be right today, and it is 55 characters.
- **Keep the ULID and translate at the boundary.** Two identifiers for one trace, and every query
  needs to know which one it is holding.
- **Take the error tracker's trace id and put that in the envelope.** It only exists once the
  tracker is configured, and unmatched routes and errors raised before the tracker's middleware
  would have no id at all — which is the failure the global trace-id middleware was written to fix.
