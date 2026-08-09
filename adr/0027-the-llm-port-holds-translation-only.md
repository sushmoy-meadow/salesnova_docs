# ADR-0027 — The LLM port holds translation only, and a new dependency is placed before it is imported

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

[ADR-0026](0026-provider-ports-before-their-adapters.md) left the six provider ports carrying only
the methods whose types already existed. `LlmProviderInterface` was the thinnest of them: `embed()`
alone, because the other two name `Prompt`, `LlmOptions` and `LlmResponse`, and none of the three
existed.

The port is now complete, which forces three questions the spec's four-line sketch does not answer.

**Where the model is chosen.** "Model choice is configuration, per capability, changeable without a
deploy" fixes that it is configuration and says nothing about which side of the port reads it.

**What a prompt is.** The sketch types the parameter as `Prompt` and stops there.

**How "no vendor SDK above the port" is enforced.** The requirement is stated everywhere and
enforced nowhere; ADR-0026 explicitly declined to enforce it with a maintained list of vendor
names, on the grounds that such a list only ever catches the vendors whoever wrote it thought of.

## Decision

**The model is a required field on `LlmOptionsDTO`.** Capability-to-model resolution happens above
the port. An adapter is handed a model name and translates; it reads no configuration and holds no
product policy.

**A prompt is single-turn: a versioned instruction we wrote, plus the customer's input.** The two
are separate fields because they belong to different people, and keeping the customer's text in a
field of its own makes minimisation something a reviewer can check.

**A dependency is placed before it can be imported.** `reviewedDependencies()` in `tests/Pest.php`
lists every runtime package and, for each, either nothing or the one path prefix its namespace may
be imported under. Two rules read it: the required set must match `composer.json` exactly, and a
placed package may not be imported outside its prefix.

## Consequences

Resolution above the port means the resolver has to exist before the first real call, and it does
not exist yet — the port is complete and not yet callable end to end. The alternative was an
adapter that reads config, which is the same policy re-implemented once per vendor behind a
boundary meant to hold only translation.

Single-turn is the shape the three shipping capabilities need and it is where the port will next
change. A conversation carried across turns cannot be expressed as an optional fifth field beside
`instruction` and `input` without every adapter branching on which of them is set; the honest form
is a second prompt type, and it arrives with the first capability that needs one.

Enforcement moves from "know every vendor" to "know every dependency", which is a set the build
already has to be exact about. The failure mode inverts: an unlisted package now turns the suite
red at the moment it is required, instead of passing silently until somebody notices the import.
The cost is that adding any package — not only a model SDK — is a two-line change rather than one,
and the second line is where the boundary decision is made.

It leaves one gap. Both rules read import statements, so an SDK reached through a fully qualified
name written inline, or through a bare HTTP call to a vendor's endpoint, is not caught. The first
is unusual enough to be visible in review; the second is a genuine hole, and closing it needs a
rule about outbound hosts rather than about namespaces.
