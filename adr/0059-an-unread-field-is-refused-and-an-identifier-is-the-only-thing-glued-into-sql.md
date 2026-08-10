# ADR-0059 — An unread field is refused, and an identifier is the only thing glued into SQL

**Status:** Accepted
**Date:** 2026-08-10

## Context

Laravel drops a request field no rule mentions, silently and with a 200. That is the framework
default and it is comfortable: a client can send whatever it likes and nothing breaks.

Nothing breaks visibly. A client sending `notify: true` to an endpoint that never read it gets the
same response as one whose notification worked, and the two only diverge in production, where the
symptom is a customer saying they turned something on. Three tests in this repository existed
precisely to assert that a `role` in a signup body was *ignored* — the escalation attempt returning
200 was the documented behaviour.

The same shape of problem exists one layer down. A value concatenated into SQL is safe until the
input that reaches it changes, and by then the code has been read and approved many times. The
existing gate refuses raw `DB::` facade calls in `app/`, which is a different rule: it protects
tenant scopes, and it says nothing about the raw SQL that migrations and DDL helpers legitimately
write.

## Decision

**A declared request refuses a field it did not declare, at every depth.** `StrictFormRequest` is
the base class; it compares the payload's paths against the rule paths and adds a validation error
for each one no rule accounts for, which reaches the client as the ordinary 422 envelope with the
offending path named in `error.details`.

Depth matters. A rule set declaring `capabilities.*.key` and `capabilities.*.granted` has described
a shape, and checking only the top level would let `capabilities.0.until` through — the field most
likely to be a client's misunderstanding rather than an attack. Conversely, a rule naming a key and
nothing beneath it has declared no shape there, so that subtree is left alone; the author said
"an array", not "an array of this", and inventing a stricter rule than the one written would refuse
correct requests.

Query parameters are checked on the same footing as the body, because `all()` carries both and an
ignored query parameter is the same lie about what the server read.

**Refusing beats ignoring even where ignoring was safe.** The three signup tests now assert 422
rather than "the role was ignored". Ignoring was safe — the role never came from the body — but a
caller whose escalation attempt returns 200 learns nothing about whether it worked and moves on to
the next endpoint. A 422 is the cheapest possible signal that the shape is wrong, and it is as
useful to an honest client with a typo as it is unhelpful to a dishonest one.

**No value is concatenated into SQL, and the gate is its own CI step.**
`ConcatenatedSqlScanner` reads the *first* argument of every raw sink — `whereRaw`, `selectRaw`,
`orderByRaw`, `DB::raw`, `statement`, `unprepared` and the connection's `select`/`insert`/`update`
family — and fails the build when it finds a variable or an interpolation there. Later arguments are
the bindings, which is the correct place for a variable and has to stay legal, or the rule teaches
people to route around it. Literal-only concatenation passes: a statement split across lines is
still a constant.

**A file that builds schema says so.** An identifier cannot be bound — there is no way to write
`create trigger ?` — so the DDL helpers and four migrations genuinely have to interpolate a table
name. Those files carry `@builds-schema` in a docblock, which exempts `statement()` and
`unprepared()` *in that file* and nothing else. A `whereRaw` in a declared file is still refused,
because a predicate has never needed an interpolated identifier.

## Consequences

An endpoint's rule set is now its published input contract in both directions: what it accepts and,
by omission, what it refuses. That makes the generated OpenAPI document a stronger statement than it
was, since a field absent from it is a field the server will now reject rather than quietly drop.

Adding a field to an endpoint is a two-sided change. A client that starts sending one before the
server declares it gets a 422 instead of a silent no-op — noisier during a rollout, and noisy in the
direction that gets noticed before release rather than after.

The exemption list is `grep -rl '@builds-schema'`, which is seven files today. It grows one file at a
time and each addition is a sentence somebody wrote deliberately, which is the property a blanket
directory exclusion would not have.

Endpoints that take no input at all are unprotected against unknown query parameters, because there
is no rule set to compare against — nothing declares a `FormRequest` when it reads nothing. The gap
closes when list endpoints arrive and the filter layer declares its own allowlist; until then, an
unknown query parameter on a parameterless endpoint is ignored exactly as before.

No webhook endpoint exists yet. When one does, it validates through the same base class, and the
requirement that webhook payloads reject unknown fields is met by having nowhere else to go.
