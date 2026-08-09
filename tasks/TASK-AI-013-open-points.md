# TASK-AI-013 — open points

Both acceptance criteria are covered by tests in `tests/Feature/Ai/AiProposalTest.php`, with the
prompt and no-training halves of the task in `tests/Feature/Ai/PromptGuardTest.php` and
`tests/Feature/Ai/LlmServiceTest.php`. The decisions that shaped the gate are in
[ADR-0031](../adr/0031-one-queue-holds-both-reasons-to-stop.md). What follows is what is owed, and
what the simplify pass raised and did not get.

## 1. Owed to a later task

**Nothing binds a membership to the organisation it is confirming in.** `confirm()` takes the acting
organisation and the acting membership and compares only the first against the proposal, because
`App\Services\Ai` may not import `App\Models\Organizations\Membership`. A caller that passes the
proposal's own organisation alongside a membership from another one is not caught here. The missing
piece is a contract in `app/Contracts/Organizations/` answering "does this membership belong to this
organisation", which the authentication middleware will need for every other domain too — the check
belongs there, once, not copied into each service.

**No-training consent is deployment-wide and cannot be revoked per organisation.**
`ai.endpoint.no_training_confirmed` refuses every call while it is unset, which covers the assertion
but not the second half of the requirement: an organisation cannot record, or withdraw, its own
consent. That needs organisation state and the settings surface in TASK-AI-018. Until then a tenant
that objects is served by turning the capability off, which TASK-AI-011 owns.

**Nobody is told a proposal is waiting, and nothing collects it.** A held action sits in
`ai_proposals` with an index that answers "what is pending for this organisation", and no endpoint
reads it. The review surface is TASK-AI-018; the notification, if there is one, belongs with the
follow-up domain rather than here.

**A confirmation writes no audit event.** The row records who decided and when, which is the
evidence, but `App\Contracts\Timeline\EventWriter` is not called — the instrumentation of domain
write paths is TASK-AI-003, and adding one call here would be the first of a set that task exists to
place consistently.

**No architecture test asserts that a consequential executor takes a `ConfirmedAction`.** There are
no production executors yet, so the rule would today pass over an empty set and read as coverage it
does not have. It should be written with the first capability that acts — the shape to enforce is
that anything performing a `requiresConfirmation()` action accepts the value object, never an
`AiProposal` and never a payload array.

**Tenant deletion does not reach this table.** `ai_proposals.organization_id` is
`restrictOnDelete`, matching the house position everywhere else, so the eventual deletion sweep has
to cover it explicitly or a tenant with a pending proposal cannot be removed.

## 2. Findings taken from the simplify pass

- `confirm()` and `reject()` checked the status and then wrote it, so two concurrent confirms both
  returned a `ConfirmedAction` — one agreement, two executions of a `SEND_MESSAGE`. The condition now
  rides in the `UPDATE`, and a zero-row result is the refusal. The same shape on `markApplied()` is
  what makes a confirmation single-use.
- `ConfirmedAction::fromProposal()` trusted the status on the instance handed to it, so
  `new AiProposal(['status' => CONFIRMED])` minted a valid confirmation without a row existing. It
  now reads the confirmed state back out of storage, and the constructor is private.
- The cross-tenant refusal threw a bare exception and rendered as a 500. It is `ORG_MISMATCH` through
  `ApiException` now, which is the mandated 404 — a 403 would confirm the id exists.
- `ActionNotConfirmedException` was a second exception idiom for caller-facing failures in a tree
  that already has one. Deleted; the service throws `ApiException` like every other service.
- `carriesAPaymentCard()` compared `preg_match_all` against `1` and then re-checked the match array,
  so a text with two card numbers in it passed. It reads the count once.
- A `preg_match` returning `false` on a malformed configured pattern was treated as "no match", which
  fails open on the check that exists to fail closed. It is now an explicit `!== 0`.
- The prompt length was measured after concatenating instruction and input, allocating the full
  string to find out it was too long. Measured from the parts.
- The migration carried a `subject_type, subject_id` index nothing queries, and the factory a
  `consequential()` state with no caller.
- Two architecture rules had hand-rolled copies of the same directory walk. Both use a new
  `filesImporting()` helper in `tests/Pest.php`, built on the existing `sourceFilesIn()` and
  `importedTypesIn()`.
- A test asserted the proposals table's index leads with the tenant, which `TenantIndexLeadingColumnTest`
  already does for every tenant table by discovering them from the schema.

## 3. Declined

**Reusing `PiiRedactor` on outbound prompts.** It strips emails and phone numbers, which is what
lead-parse is there to read — reusing it would remove the payload and leave the capability returning
nothing, silently. Refusal on credentials, payment data and size is the guard that does not break the
feature. Recorded in the ADR so it is not "fixed" later.

**Making `max_input_characters` per-capability, beside `model` and `timeout_seconds`.** Consistent
with its siblings and currently pointless: one ceiling serves every capability, and a knob per
capability is six values nobody has a reason to set differently. Worth revisiting when a capability
arrives whose input is legitimately larger.

**Dropping `bearer_token` from the forbidden patterns because `config/redaction.php` has a `bearer`
pattern already.** Same regex, different question — one decides what a log line prints, the other
decides whether a request leaves the building. Sharing them couples a logging change to an outbound
safety rule.

**A `PENDING → PENDING` re-propose path for a capability that revises its own suggestion.** No caller
exists, and the honest shape is a new proposal superseding the old one, which needs a column and a
review surface to make sense of it.

**Confidence as a value object rather than a nullable `0–100` integer.** The threshold comparison is
one line in one place; a class around it buys nothing until a second capability scores differently.
