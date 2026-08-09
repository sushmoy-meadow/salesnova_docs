# ADR-0019 — Policy objects carry booleans only, denial reasons ride beside them

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

Every record and list response carries two independently computed policy objects. `access_policy`
answers "is this person allowed?" — role, capability grid, assignment, sub-team. `subscription_access_policy`
answers "does this plan include it?" — tier, limits, seats. The client ANDs them before rendering an
action as available, and collapsing them into one boolean would tell an unauthorised rep to upgrade
the plan, which is both wrong and insulting.

A denial also has to carry a reason, so the UI can be specific: a plain "you don't have access" for
one object and an upgrade modal naming the required tier for the other. The published example put
the reason inside the object it explained:

```json
"subscription_access_policy": { "can_export": false, "export_locked_reason": "PLAN_LIMIT" }
```

That shape does not survive being typed. The two objects are open maps — the action names differ per
resource, so they cannot be enumerated in the schema. One string value among the booleans widens the
map's value type to `boolean | string` for **every** action of **every** resource, and the generated
client then requires a type guard at every `if (policy.access_policy.can_edit)` in the application.
The convention that a reason key is the boolean key plus `_locked_reason` is also invisible to the
type system, so nothing stops the two from drifting apart.

Separately, the envelope had to decide where the policy object is mandatory. Marking it optional
everywhere makes the client branch on its absence, which at the call site that matters is
indistinguishable from a denial. Marking it required everywhere publishes a promise on responses
that carry no record and have no action to gate.

## Decision

**The policy envelope is three sibling maps, all required:**

```json
"policy": {
  "access_policy":              { "can_edit": true,  "can_delete": false },
  "subscription_access_policy": { "can_edit": true,  "can_delete": true  },
  "denial_reasons":             { "can_delete": "INSUFFICIENT_ROLE" }
}
```

`access_policy` and `subscription_access_policy` are maps of booleans and nothing else.
`denial_reasons` is keyed by the same action names and holds the reason for the ones that are off.
It is sparse: an action that is available has no entry.

**The reason vocabulary is its own five-value enum**, not the error catalogue: `NOT_ASSIGNED`,
`INSUFFICIENT_ROLE`, `PLAN_LIMIT`, `SEAT_LIMIT`, `FEATURE_NOT_ENABLED`. Two of the five are spelled
differently from the nearest error code (`PLAN_LIMIT_REACHED`, `SEAT_LIMIT_REACHED`) and the
difference is kept. A policy object explains a control the client chose not to draw; an error code
explains a request the server refused. Typing the map as the error catalogue would let
`WA_OPTED_OUT` or `CONCURRENT_MODIFICATION` appear in a policy object, where neither means anything,
and would tie a render-time vocabulary to a catalogue that grows for unrelated reasons.

**The envelope requires `policy` exactly where the body carries a record** — where `data` is a
schema reference or an array of them. That is decided from the shape of the documented payload in
the document transformer, not annotated per endpoint, so every future list and detail endpoint
inherits the requirement without anyone remembering to ask for it, and a body with no record does
not advertise a policy the assembler never sends.

The policy object remains a rendering hint. The server re-checks both halves at write time whatever
the object said.

## Consequences

- `policy.access_policy.can_edit` is a `boolean` in the generated client, at every call site, with
  no guard. That is the whole point.
- The reason for a denial is one lookup away from the boolean rather than in the same object. A UI
  that wants the reason reads `denial_reasons[action]`; one that only wants to hide a button never
  touches it.
- `denial_reasons` is required even when empty, so the assembler must emit `{}` — in PHP an empty
  array encodes as `[]` and violates the published object type. Every producer has to cast it, and
  the runtime task that assembles policy objects owns getting that right.
- Two vocabularies now describe overlapping situations, and they are not interchangeable. Mapping
  between them belongs to whoever throws the error, not to the policy computation.
- Any endpoint whose `data` is a `$ref` promises a policy object from the moment its contract is
  published. A contract task that publishes a record schema and no policy fails the gate rather
  than shipping a response the client cannot render actions from.
- The rule reads the *documented* shape, so an endpoint that returns a record without declaring one
  escapes the requirement. That is the same gap as any undocumented response, and the contract-first
  rule already closes it.

## Alternatives

- **Reason inside the policy object, as published.** Rejected: it destroys the type of both maps for
  every consumer, and the naming convention linking a reason to its boolean is unenforceable.
- **Reason as `boolean | DenialReason` per action.** Rejected: same widening, and it makes a truthy
  check on an available action silently correct and on a denied one silently wrong.
- **A parallel object per policy — `access_denial_reasons` and `subscription_denial_reasons`.**
  Rejected: an action is denied by one or the other, never usefully by both at once, and the client
  would have to check two maps to render one message. Which half denied it is already answerable
  from the booleans.
- **Reuse `ErrorCode` for the reason.** Rejected: it admits 38 codes where five are meaningful, and
  couples the shape a screen renders to a catalogue that exists for failed requests.
- **Require `policy` on every 2xx.** Rejected: it forces a meaningless object onto health checks and
  acknowledgements, and a required field the server does not always send is a contract the document
  is lying about.
