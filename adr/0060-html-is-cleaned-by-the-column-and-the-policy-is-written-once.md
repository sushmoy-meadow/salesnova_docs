# 60. HTML is cleaned by the column, and the policy is written once

Date: 2026-08-10

## Status

Accepted

## Context

Two ways a string somebody else wrote ends up executing in a reader's browser: it is stored as
markup and later rendered, or the page it lands on permits sources it should not.

For the first, the conventional answer is a sanitiser called at the write site. That works until the
second write path — an import, an admin edit, a migration backfill, a webhook — is written by
somebody who did not know the call existed. The failure is silent and permanent: the payload is in
the database, and every consumer afterwards reads it raw. Sanitising on read inverts the problem
without fixing it, because the export, the report and the support tool are all readers with no
sanitiser.

For the second, there are three surfaces served by three deployables: the public share viewer, the
authenticated app, and this API. Each could define its own content security policy in its own repo.
Three definitions drift, and the drift is invisible — nobody diffs a header across repositories, so
the surface that quietly relaxed keeps its relaxation.

## Decision

**HTML is sanitised by an Eloquent cast on the column, on write.** `SanitizedHtml` cleans in `set()`
and returns the stored value untouched in `get()`. A column typed as HTML cannot be written around,
so correctness stops depending on the write path remembering anything.

The allowlist is closed and small — structural and formatting elements, links restricted to `https:`
and `mailto:`, images to `https:`. An element with no rule is dropped rather than passed through,
which makes the failure mode "an author's paste lost some markup" rather than "a reader ran a
script". `symfony/html-sanitizer` does the parsing; the allowlist is ours.

**The content security policy is one config array in this repo**, covering all three surfaces. This
application emits the `api` policy on every response, globally rather than per route, because the
response most likely to render something unexpected is the one that never matched a route. The
Next.js builds read the same array to generate theirs.

No surface carries `'unsafe-inline'` or `'unsafe-eval'`. An inline script that genuinely has to run
gets a nonce or a hash — which is a decision about one script, not a switch that opens the whole
policy.

The authenticated app carries an `exceptions` map, asserted empty by a test. An entry is the policy
fragment plus the sentence arguing for it. A relaxation nobody has to justify in writing is one
nobody removes, and a list nobody can see does not shrink.

## Consequences

Sanitising is invisible at the call site, which is the intent but also means an author's markup can
be silently reduced. The allowlist lives in one file so that widening it is a reviewable change; the
alternative — a per-field configuration — puts the decision back in the hands of whoever adds a
field.

The public surface's policy forbids inline styles, which the Next.js builds will have to satisfy
with nonces rather than by relaxing the directive. That work belongs to those repositories.

`report-uri` is advertised but nothing receives the reports yet, and the directive is superseded by
`report-to`. Both are recorded as open.
