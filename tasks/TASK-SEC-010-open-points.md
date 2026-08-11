# TASK-SEC-010 — open points

## The two Next.js halves

This repository holds the sanitiser and the one policy definition. Neither reaches a browser without
work in the other two repositories, and neither can be tested here.

- **`dangerouslySetInnerHTML` review.** The share viewer renders stored HTML. Sanitising on write
  makes what is stored safe; it does not stop a component interpolating something else. Closed by a
  lint rule in the Next.js repos banning the prop outside one reviewed wrapper component, and that
  wrapper carrying a test.
- **The surfaces emitting their own headers.** `config/security.php` defines `public` and `app`
  alongside `api`, but only `api` is emitted here — the other two are served by Next.js. Closed by
  those builds reading this definition (or a generated copy of it) in their middleware, plus a
  request-level test asserting the header on a rendered page.
- **Inline styles on the public surface.** The policy has `style-src 'self'` with no
  `'unsafe-inline'`. Next.js injects inline styles by default, so those builds need nonces. Closed by
  the same middleware work, not by relaxing the directive.

## Nothing receives the reports

`report-uri` points at `/api/v1/security/csp-report`, which does not exist. Browsers posting there
get a 404, which is harmless but useless. Standing the endpoint up is a decision with its own
surface — it is unauthenticated, it accepts a body from anyone, and it needs a named rate limiter
and a retention rule for what it stores. `report-uri` is also superseded by `report-to` plus a
`Reporting-Endpoints` header. Closed by a task that picks the mechanism and builds the receiver with
both.

## No real page-content column yet

The cast is proven against `tests/Fixtures/Security/PageContent`, a fixture model over a table the
test creates. There is no author-HTML column in the schema today. When the first one lands it must
carry the `SanitizedHtml` cast; nothing mechanical enforces that yet, because a rule that guesses
which `text` columns hold markup would be wrong more often than right.
