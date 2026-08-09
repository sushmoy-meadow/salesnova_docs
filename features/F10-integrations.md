---
doc: F10-integrations
status: REVIEW
owner: Product + Engineering
area_code: INTG
depends_on: [04-domain-model, 05-api-design, F09-automation]
---

# F10 — Integrations (Lead Sources)

Where leads come from. Everything else in the product hangs off this: if leads do not arrive within
seconds, nothing downstream matters.

---

## 1. The registry

### SN-INTG-001 — Integrations are server-declared data ⭐

The client **MUST NOT** contain a hardcoded list of integrations. It renders whatever
`GET /api/v1/integrations` returns.

**Adding an integration = one seed row + one parser. No frontend release.**

> The single highest-leverage architectural decision in this area, adopted from Privyr, who serve
> 50 registry entries this way. Integrations are the most frequently added surface in a CRM's life,
> and coupling each one to a client deployment is a self-inflicted tax paid forever.

### SN-INTG-002 — Registry entry

| Field | Purpose |
|---|---|
| `key` | Stable identifier, e.g. `facebook_lead_ads` |
| `name`, `description`, `icon_url` | Presentation |
| `category` | `LEAD_SOURCE` · `AUTOMATION` · `IMPORT_EXPORT` · `OTHER` |
| `auth_type` | `OAUTH` · `API_KEY` · `TOKEN` · `WEBHOOK` · `EMAIL` · `NONE` |
| **`visibility`** | `PUBLIC` · `BETA` · `STAFF_ONLY` · `UPCOMING` |
| `parser_key` | Discriminator telling the pipeline how to parse inbound payloads |
| `config_schema` | jsonb — the connection form, rendered from the server |
| `setup_url`, `help_url` | |

**`visibility` doubles as a rollout mechanism.** Ship dark as `STAFF_ONLY`, promote to `BETA` for
design partners, then `PUBLIC`. `UPCOMING` renders a "coming soon" card that measures demand before
we build.

### SN-INTG-003 — Per-account status on the card

`CONNECTED` · `NOT_CONNECTED` · **`EXPIRING_SOON`** · `EXPIRED` · `ERROR`

Rendered from the server. `EXPIRING_SOON` is what turns a support ticket into a proactive nudge —
OAuth tokens for lead sources expire routinely and, without it, silently.

### SN-INTG-004 — Connection forms are server-rendered from `config_schema`

An API-key integration is a seed row with a one-field schema. **Zero client code.**

---

## 2. Ingestion pipeline

### SN-INTG-010 — One path for every source

```
webhook / inbound email / API poll
        │
        ▼  1. persist raw to inbound_event          ← before anything else
        ▼  2. verify signature
        ▼  3. parse via parser_key → normalised lead
        ▼  4. duplicate policy (org-level)
        ▼  5. create or merge
        ▼  6. routing rules → assign + enrol        ← synchronous, < 50 ms
        ▼  7. distribution rules → forward
        ▼  8. alerts: push + email                  ← the clock starts
        ▼  9. Meta CAPI event
```

**First-party lead forms go through the same path.** No shortcuts, no parallel implementation.

> Privyr does this too — their own forms carry `lead_source_type: "privyr-lead-form-webhook"`. It
> means one place to fix a bug, and every source gets rules, dedup and alerting for free.

### SN-INTG-011 — Persist before processing ⚠️

Every inbound payload **MUST** be written to `inbound_event` before parsing.

Non-negotiable. When a parser has a bug, or Meta changes a payload shape, or a customer says
"I never got that lead", this table is the only thing that lets us **replay** rather than guess.
Retention 90 days.

### SN-INTG-012 — Signature verification

Every webhook with a signing mechanism **MUST** verify it. Unsigned or mismatched requests are
rejected `401` and logged.

### SN-INTG-013 — Idempotent, at-least-once tolerant

Keyed on the provider's event id. Duplicates are discarded silently. Every provider retries; none
guarantees exactly-once.

### SN-INTG-014 — Return `200` fast, process async

Parsing, dedup and rules run out of band. Meta throttles and eventually disables slow endpoints.

**Budget: webhook `200` in < 200 ms p95.**

### SN-INTG-015 — Parse failures are recoverable

A parser failure marks `inbound_event.status = FAILED` with the error, alerts engineering, and
surfaces to the customer as "a lead arrived but we couldn't read it — we're on it".

**It MUST NOT return `500`.** A `500` makes the provider retry, then give up, and the lead is gone.

### SN-INTG-016 — Campaign metadata is preserved

Campaign, adset, ad, form name and every custom question/answer **MUST** land in
`source_payload`, structured, and be available as rule conditions, custom-field autofill sources
and report dimensions.

**Acceptance criteria**

- `AC-INTG-011.1` — Given a webhook whose parser throws, when the request completes, then `inbound_event` holds the raw payload with `status = FAILED` and the response is `200`.
- `AC-INTG-013.1` — Given the same Facebook leadgen id delivered three times, when processing completes, then exactly one lead exists.
- `AC-INTG-014.1` — Given a webhook burst of 100 requests, when measured, then p95 response time is under 200 ms.

---

## 3. Facebook / Instagram Lead Ads ⭐

The primary integration. Most of our ICP buys leads here.

### SN-INTG-020 — Hierarchy with per-form control

**Account → Pages → Forms**, each form independently enable/disable, with bulk
enable-all/disable-all per page.

### SN-INTG-021 — Token expiry is routine, not exceptional

The system **MUST**:

- Detect expiry and impending expiry proactively
- Show `EXPIRING_SOON` from 7 days out
- Notify the connector by email and in-app at 7, 3 and 1 days
- Offer one-click renewal
- **Continue attempting delivery** and queue failures for replay after renewal

> Build renewal from day one. Privyr's i18n carries `expired`, `permissionsExpired`,
> `insufficientPermission`, `renewPermissions` — evidence they learned this the hard way. An
> expired token means the customer's leads stop arriving and nobody notices for days.

### SN-INTG-022 — Partial failure per page

Connecting 5 pages where 2 fail **MUST** connect 3 and report the 2 with reasons. Never
all-or-nothing.

### SN-INTG-023 — Historical backfill

On connection, offer to import leads from the last 30/90 days. Backfilled leads are marked
`is_backfill`, **do not trigger alerts, rules or sequences**, and do not distort response-time
metrics.

> A backfill that fires 400 push notifications and enrols everyone in the intro sequence is a
> catastrophe, and an easy one to ship by accident.

### SN-INTG-024 — Delayed-delivery detection

Meta sometimes delivers leads hours late. The system **MUST** compare Meta's `created_time` against
receipt time, and warn when the gap exceeds 15 minutes on a page.

> Privyr surfaces this (`fb-delayed-leads-pages` with a dismissible warning) and they are right to.
> Without it the rep blames us for a slow response that was Meta's.

### SN-INTG-025 — Auto-tagging by source attribute

Leads **MAY** be auto-added to groups by page, campaign or form. Configured per connection.

> Privyr implements this as `hack_auto_tag_by_fb_page` and `hack_auto_tag_by_fb_campaign` — their
> own preference keys carry the `hack_` prefix. The capability is genuinely useful; it belongs in
> the rules engine ([`F09`](F09-automation.md)), not as a bolted-on preference.

---

## 4. Other integrations

### SN-INTG-030 — V1 set

| Integration | Auth | Notes |
|---|---|---|
| **Facebook / Instagram Lead Ads** | OAuth | Primary |
| **SalesNova Lead Forms** | None | First-party ([`F11`](F11-lead-forms.md)) |
| **WordPress** | Token | Plugin + account token; 9 form plugins |
| **IndiaMART** | API key | Critical for the India market |
| **Lead via email** | Email | Universal fallback, §5 |
| **Zapier** | OAuth | The long tail |
| **LinkedIn Lead Gen Forms** | OAuth | |
| **Google Forms / Ads** | OAuth | |
| **Webhook (generic)** | Token | Documented payload contract |
| **TikTok Lead Ads** | OAuth | Growing fast in SEA |
| **99acres / MagicBricks** | API key | India real estate — **evaluate at G4** |

### SN-INTG-031 — WordPress: token, not OAuth

Install the plugin, paste the account token. Supports Contact Form 7, WPForms, Elementor, Gravity
Forms, Ninja Forms, Forminator, Divi, Fluent Forms, Houzez.

Setup **MUST** poll for connection status and confirm in-app the moment the first payload arrives.
The user is on another site entirely; they need to know it worked without switching back to guess.

### SN-INTG-032 — Generic webhook is documented and testable

A per-connection URL and secret, a documented JSON contract, a field-mapping UI, and a
**"send test payload"** button that shows exactly what would be created.

---

## 5. Lead parsing from email ⭐

### SN-INTG-040 — Per-account inbound address plus an LLM parser

Each org gets `leads-{org_code}@in.salesnova.com`. Any lead-alert email forwarded there is parsed
into a lead.

> **The universal fallback for every source without an API.** It covers 99acres, MagicBricks,
> Housing.com, JustDial, a college's enquiry form, a portal nobody has heard of — without building
> an integration for any of them.
>
> Privyr built this when LLM parsing was expensive and awkward. It is dramatically cheaper now, and
> it is the highest leverage-to-effort item in this entire document. **Ship it in V1.**

### SN-INTG-041 — Extraction contract

Extract: name, email, phone, source, and every labelled field. Return **structured output with
per-field confidence**.

| Confidence | Behaviour |
|---|---|
| High | Create the lead |
| Medium | Create, flag for review |
| Low | Hold in a review queue, notify |

### SN-INTG-042 — Learns per sender

Once a sender/format pair is confirmed correct, subsequent emails from that sender use the cached
mapping — deterministic, fast, and free. The LLM is the fallback for unrecognised formats, not the
steady-state path.

### SN-INTG-043 — Sender allowlist

Only allowlisted sender addresses or domains are parsed. Everything else is held and surfaced for
one-click approval.

**An open inbound email address that creates records is an obvious abuse vector.** The allowlist is
mandatory, not optional.

### SN-INTG-044 — The raw email is retained

Stored 90 days on `inbound_event`, viewable by the customer. When parsing is wrong, they can see
what arrived and correct the mapping.

---

## 6. WhatsApp as a lead source

### SN-INTG-050 — Inbound messages create leads

Configurable per connected number:

| Setting | Options |
|---|---|
| Create on inbound from unknown number | on / off |
| Create on outbound to unknown number | on / off |
| Auto-assign | to the number's owner, or via routing rules |

See [`F12`](F12-whatsapp-coexistence.md).

---

## 7. Health and observability

### SN-INTG-060 — Per-connection health

Last successful receipt · leads in the last 24 h / 7 d · error count and last error · token expiry ·
**delivery latency p50/p95**.

### SN-INTG-061 — Silence is an alert

A connection that has received nothing for **3× its normal interval** raises a warning.

> A quiet integration is indistinguishable from a working one until somebody notices revenue
> dropped. Alert on the absence, not just on errors.

### SN-INTG-062 — Replay

Any `inbound_event` **MUST** be replayable by staff after a parser fix, with per-event and bulk
replay, and idempotency so replaying a succeeded event is safe.

---

## 8. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Connections | 1 | unlimited | unlimited |
| Lead-via-email | ❌ | ✅ | ✅ |
| Generic webhook | ❌ | ✅ | ✅ |
| Historical backfill | ❌ | ✅ | ✅ |
| `inbound_event` retention | 7 d | 90 d | 90 d |
