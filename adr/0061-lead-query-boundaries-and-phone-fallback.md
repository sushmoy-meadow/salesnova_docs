# ADR-0061 — Lead queries reject unavailable predicates and use a bounded phone fallback

Accepted · 2026-08-11 · @sakib

## Context

The unified lead query endpoint needs to protect tenant-scoped rows while the
group, stage, custom-field, saved-filter, and sub-team schemas are still being
delivered by other tasks. The repository also has no libphonenumber dependency,
although phone search must tolerate formatted input.

## Decision

The query service applies the existing `Lead::visibleTo()` boundary first and
rejects filter fields without an available schema or service with a bad-request
error. Until a phone-number port is available, phone search strips non-digits
and matches the canonical trailing digits in the stored E.164 values.

## Consequences

Unsupported predicates cannot silently return an unfiltered result. The endpoint
supports the available lead columns and system views now, while the deferred
predicates remain explicit open points. The phone fallback covers formatted
variants in the current data model but does not replace country-aware parsing.

## Alternatives

Ignoring unavailable predicates was rejected because it would present incorrect
data as a successful filtered response. Adding a new phone library in this task
was rejected because dependency ownership and country selection are not defined.
