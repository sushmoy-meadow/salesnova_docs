---
doc: 11-ai-substrate
status: REVIEW
owner: Product + Engineering
audience: Everyone — this doc explains why V1 is built the way it is
depends_on: [04-domain-model, 09-technical-architecture, 10-nfr-security-compliance]
---

# The AI Substrate

**V1 ships parity AI. V1 also ships the data foundation that makes V2 possible — and that
foundation is the part competitors cannot copy by shipping a feature.**

This document exists so that engineers building V1 understand which V1 decisions are load-bearing
for V2, and do not optimise them away.

---

## 1. The thesis

### SN-AI-001 — Most CRM "AI" is a text box over an empty database

The current market pattern is a chat widget or a "summarise this lead" button bolted onto a CRM
whose records contain a name, a phone number, and a stage field last touched in March. The model
has nothing to reason over, so it produces fluent, confident, useless output. Users try it twice.

**The constraint on useful CRM AI is not model capability. It is the absence of a record of what
actually happened.**

### SN-AI-002 — Coexistence is the asset

Our wedge ([`01`](01-market-and-positioning.md)) is that WhatsApp Coexistence lets us see the
conversation while the rep keeps sending from their own number and their own phone.

The consequence for AI is larger than the consequence for the CRM:

| Everyone else has | We have |
|---|---|
| Lead fields | Lead fields |
| Stage, last touched | Stage, last touched |
| "Message sent" | **The message, and the reply, and the reply to that** |
| — | **Timing between every turn** |
| — | **The rep's own words, in their own voice** |
| — | **Objections as customers actually phrase them** |
| — | **What the winning conversations had in common** |

A model reasoning over the second column can do things that are not possible with the first, at any
model size. This is a **data moat, not a feature moat** — and it takes a competitor as long to
build as it takes us, starting from the day they decide to.

### SN-AI-003 — What "AI Native" means here

Not a chatbot in the corner. It means:

1. **The product knows what happened** without anyone filing a report
2. **The product tells you what to do next**, ranked, with a reason
3. **The product does the tedious part** and asks before anything consequential
4. **The rep stays the author** — of the relationship, and of the words

The last point is the one that governs. In this market the relationship is personal and the number
is the rep's own. **Automation that impersonates the rep destroys the exact thing that makes the
channel work.** Every AI feature is measured against that.

---

## 2. What V1 must capture

These are the V1 requirements that exist for V2's sake. They cost little now and cannot be
recovered later.

### SN-AI-010 — The `event` log

An immutable, append-only stream of every meaningful state change
([`04`](04-domain-model.md) §`event`), separate from `timeline_event`, which is a human-readable
feed ([`F05`](features/F05-timeline-and-activity.md) §1).

```
event_id  organization_id  event_type  actor  subject
occurred_at  payload(jsonb)  correlation_id  causation_id
```

`correlation_id` and `causation_id` are the whole point: they let us reconstruct **that this
message caused that reply which caused that stage change**. Without them we have a pile of
timestamped facts and no causality.

> ⚠️ **`timeline_event` and `event` MUST NOT be merged.** They have opposite requirements: one is
> curated, editable, deletable and shaped for reading; the other is complete, immutable and shaped
> for computation. The merge is proposed on every project of this kind, and it destroys the
> substrate to save one table.

### SN-AI-011 — Facts that can only be captured at write time ⚠️

Restated from [`04`](04-domain-model.md) §13 because this is where the reason lives. **None of
these can be reconstructed from a later backfill.** Getting them wrong in V1 is not a bug to be
fixed in V2 — it is a permanent hole in the training and analysis corpus.

| Fact | Where | Why it is unrecoverable |
|---|---|---|
| **`first_response_at`** | `lead` | A timestamp, stamped once, never overwritten. Privyr stores a boolean, so their response-time metric can never be computed retroactively — and neither can ours if we copy them. |
| **Stage transitions with timestamps** | `custom_field_value_history` | Current stage tells you nothing about velocity. Time-in-stage is the single strongest deal-health signal and it exists only if every transition was recorded. |
| **Message direction, timing and source** | `whatsapp_message` | `APP_ECHO` vs `API` vs `HISTORY_IMPORT` determines what a message means. Response latency is derivable only from accurate per-message timestamps. |
| **View engagement duration** | `content_view` | Floor, never round. **NULL and 0 are different facts** — one is "we don't know", the other is "they bounced". Conflating them poisons every model trained on it. |
| **Rule and sequence decisions** | `event` | Why this lead went to this rep. Needed to evaluate whether routing is working at all. |
| **Outcome with a reason** | `lead` | `is_terminal` + `outcome: WON|LOST`. Without a labelled outcome there is no supervised signal for anything. |

### SN-AI-012 — Conversation structure, not just content

`whatsapp_conversation` and `whatsapp_message` preserve threading, direction, timing, media type,
edits and revocations ([`F12`](features/F12-whatsapp-coexistence.md) §4).

**Revocation is honoured, and the fact of revocation is retained.** A deleted message is removed
from the customer-visible surface; that a message was sent and withdrawn at 11pm remains a fact
about the interaction.

### SN-AI-013 — Content engagement

`content_share` and `content_view` record what was sent, to whom, when, and how long they engaged
([`F07`](features/F07-sharing-and-tracking.md) §3). Correlating a 4-minute brochure view with the
reply that followed is a strong intent signal and is available to almost nobody else in this market.

### SN-AI-014 — Source fidelity

`source_payload` retains the integration's original payload verbatim, separately from any parsed
fields ([`F02`](features/F02-leads.md)). Campaign, ad set, form and question-level answers survive.

> Parsing improves over time. The raw payload lets us reparse historically. Discarding it after
> extracting three fields is a decision that cannot be undone, and every project regrets it.

### SN-AI-015 — Tenant tagging everywhere

`organization_id` on every event, message and view. Not only for isolation ([`10`](10-nfr-security-compliance.md)
§3) but because **every AI feature must be scoped to a tenant, and cross-tenant leakage through a
model or an embedding index is a breach** — one that is much harder to detect than a leaked SQL
query.

---

## 3. AI in V1 — parity only

Per the scope decision ([`02`](02-product-scope.md)): match what Privyr offers, build the substrate,
ship nothing speculative.

### SN-AI-020 — Lead parsing from email

The universal integration fallback ([`F10`](features/F10-integrations.md) §5). An LLM extracts
structured lead fields from arbitrary notification emails.

Requirements: **confidence tiers** with low-confidence results held for review rather than silently
created · per-sender learning so a recurring format stabilises · a mandatory sender allowlist ·
**raw email retained 90 days** for reparse and debugging · parse failure is recoverable and visible,
never a `500`.

### SN-AI-021 — Sequence generation

Draft a multi-step follow-up sequence from a short brief
([`F08`](features/F08-sequences.md)). Output is a **draft the user edits and approves** — never
activated automatically.

> Privyr generates these step-by-step from the browser and tells the user to "keep this window
> open". Ours generates server-side, as a job, with the result waiting when it is done.

### SN-AI-022 — Message drafting assistance

Draft a message in the composer given the lead's context. **Always a draft in an editable field, in
the rep's voice, never auto-sent.** The rep presses send.

### SN-AI-023 — Every AI output is labelled and correctable

AI-generated or AI-extracted values are marked in the UI, and correcting one is a first-class
action that is **recorded as a labelled correction event**.

> This is the cheapest high-quality training signal in the product and it is free at the point of
> collection. It requires only that we record the correction rather than silently overwriting the
> field.

---

## 4. V2 — what the substrate enables

Not committed scope. This is the argument for why the V1 requirements above are worth their cost.

| Capability | What it needs from V1 |
|---|---|
| **Conversation summary and state** — what was discussed, what was promised, what is outstanding | Message corpus, threading, timing |
| **Auto-updated stage** — inferred from the conversation, suggested for confirmation | Stage history + conversation + labelled outcomes |
| **Next-best-action ranking** — which five leads to contact now, and why | Events, engagement, outcomes, response timing |
| **Deal risk** — silence detection, sentiment shift, stalled velocity | Timing between turns, time-in-stage |
| **Reply suggestions in the rep's own voice** | The rep's own sent messages (`APP_ECHO`) |
| **Objection intelligence** — what customers actually push back on, per team | Conversation corpus at team scale |
| **Coaching from real transcripts** — what top performers do differently | Conversations correlated with outcomes |
| **Automatic activity logging** | Already automatic via Coexistence |
| **Ask your CRM in natural language** | The event log plus a query layer |
| **Forecasting** | Outcomes, velocity, engagement |

Read the right column. **Every one of them is a V1 data decision, not a V2 model decision.**

---

## 5. Architecture

### SN-AI-030 — `LlmProvider` port

```php
interface LlmProvider {
    public function complete(Prompt $p, LlmOptions $o): LlmResponse;
    public function embed(array $texts): array;
    public function stream(Prompt $p, LlmOptions $o): Generator;
}
```

No vendor SDK above the port. Model choice is configuration, per capability, changeable without a
deploy. **The model landscape moves faster than our release cycle; the architecture must not care
which model it is talking to.**

### SN-AI-031 — Every call is recorded

Prompt version, model, tokens, latency, cost, tenant, capability, outcome. Written to a dedicated
table, not the general event log.

Needed for: per-tenant cost attribution, regression detection when a model changes underneath us,
and evaluating whether a capability is worth its cost.

### SN-AI-032 — Prompts are versioned artefacts

In version control, reviewed like code, versioned in the record above. A prompt change is a
behaviour change and is treated as one.

### SN-AI-033 — Evaluation before rollout

Every capability has a labelled evaluation set and a measured baseline before it reaches a customer,
and the eval runs in CI. A capability with no eval does not ship.

### SN-AI-034 — Degradation is graceful

An AI capability that is unavailable, slow or over budget degrades to the manual path. **The CRM
works completely with every AI feature disabled.** This is a hard requirement, not an aspiration:
it is what makes an AI outage a minor incident instead of a SEV1.

### SN-AI-035 — Retrieval is tenant-scoped and filtered at the index

When retrieval is introduced (V2), `organization_id` is a **filter on the index, not a
post-retrieval check**. Post-filtering means the wrong tenant's content entered the context window
before it was discarded, and by then it is in a provider's logs.

---

## 6. Governance

### SN-AI-040 — Customer data is not training data ⚠️

Customer data **MUST NOT** be used to train or fine-tune any model without explicit, separately
obtained, revocable opt-in consent from the organisation — not a terms-of-service clause, not a
default-on setting.

Where we use third-party model providers, we use **zero-retention / no-training API tiers**, and the
contractual position is verified rather than assumed.

> This is a commercial position as much as an ethical one. The customer's conversations with their
> customers are the most sensitive asset they hold. Being unambiguous about this is a reason to
> choose us — and any ambiguity is a reason to leave.

### SN-AI-041 — Minimise what goes to the model

Send the minimum context needed. Redact identifiers that add nothing to the task. **Never send
payment data, credentials, or full contact databases.**

### SN-AI-042 — Consequential actions require confirmation

An AI capability may **draft, suggest, rank, summarise and extract** freely.

It **MUST NOT**, without explicit per-instance human confirmation: send a message to a customer ·
change a lead's owner · delete anything · make a purchase or consume credits · change a permission
or a setting.

The rep stays the author (SN-AI-003).

### SN-AI-043 — Uncertainty is shown, not hidden

Confidence is surfaced where it affects a decision. **A low-confidence extraction is held for
review, not written silently.** A confident wrong answer costs more trust than an honest "not sure"
— once, permanently, for the whole feature category.

### SN-AI-044 — Per-tenant cost controls

Per-org AI usage limits by plan, visible in the UI, with an alert before the cap. Metered
capabilities never auto-charge beyond an opt-in cap
([`F19`](features/F19-billing.md) §SN-BILL-041).

### SN-AI-045 — Off is a supported configuration

An organisation can disable AI features entirely, at the org level, and the product remains fully
functional. Some enterprise and regulated buyers require this, and SN-AI-034 means we get it almost
for free.

---

## 7. What we will not build

| Not building | Why |
|---|---|
| **An autonomous agent that talks to customers** | The rep's number, the rep's relationship. Impersonating them destroys the channel's value and is the failure mode this market punishes hardest. |
| A general chatbot over the CRM | Answers questions nobody has, in a surface nobody opens |
| Sentiment scores with no action attached | A number with no next step is decoration |
| Lead scoring in V1 | Needs outcome data we do not have yet. Shipping it with three weeks of data teaches users the score is noise, and that lesson is permanent. |
| AI that writes to the record unsupervised | SN-AI-042 |
| Training on customer data | SN-AI-040 |

---

## 8. Requirements this doc places on V1

Every item is a V1 deliverable. **None of them may be deferred to V2 — they are unrecoverable.**

- [ ] `event` table with `correlation_id` and `causation_id`, written on every state change
- [ ] `event` kept separate from `timeline_event`
- [ ] `first_response_at` as a **timestamp**, stamped once
- [ ] `custom_field_value_history` recording every stage transition
- [ ] `whatsapp_message.source` distinguishing `APP_ECHO` / `API` / `HISTORY_IMPORT`
- [ ] `content_view` duration floored, with **NULL distinct from 0**
- [ ] `source_payload` retained verbatim and separately from parsed fields
- [ ] `lead.is_terminal` and `outcome`
- [ ] Rule and sequence decisions logged with their reason
- [ ] AI-derived values labelled, and corrections recorded as events
- [ ] `LlmProvider` port with no vendor SDK above it
- [ ] Per-call AI usage recording
- [ ] `organization_id` on every event, message and view
