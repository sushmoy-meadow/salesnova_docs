---
doc: F11-lead-forms
status: REVIEW
owner: Product + Engineering
area_code: FORM
depends_on: [04-domain-model, F03-custom-fields-and-groups, F10-integrations]
---

# F11 — Lead Forms

First-party hosted forms. No website required, no third party, no developer.

For a solo insurance agent with a WhatsApp status and a QR code on a business card, this **is**
their lead capture stack.

---

## 1. Model

### SN-FORM-001 — Fields derive from the org's custom-field schema ⭐

The form builder's available fields come from `GET /api/v1/lead-forms/metadata`, derived from
`custom_field_definition` plus the standard lead fields.

**Adding a custom field makes it available in every form builder, with no release.**

> The metadata-endpoint pattern, third instance ([`F06`](F06-content.md) §SN-CONT-031,
> [`04`](../04-domain-model.md) §5.4). Privyr does this and it is the reason their builder never
> needs a deploy to support a new field type. Consistency here is worth insisting on.

### SN-FORM-002 — Field configuration

| Property | Meaning |
|---|---|
| `is_visible` | Rendered to the visitor |
| `is_required` | Must be filled |
| `is_mandatory` | **Locked** — cannot be hidden or made optional (name, and at least one contact field) |
| `label`, `placeholder` | Overridable per form |
| `options` | For dropdowns |
| `order` | |

### SN-FORM-003 — Hidden and required is impossible

Enforced **in the model layer**: setting `is_required = true` forces `is_visible = true`; setting
`is_visible = false` clears `is_required`.

> Privyr enforces this in two separate client event handlers, which means any third code path that
> touches these flags gets it wrong. One invariant, one place.

### SN-FORM-004 — At least one contact field is mandatory

Every form **MUST** require at least one of email, phone or WhatsApp — matching the lead
contactability constraint ([`F02`](F02-leads.md) §SN-LEAD-002). Enforced at save, not at submit.

### SN-FORM-005 — Relative-move field ordering

Same contract as everywhere else ([`05`](../05-api-design.md) §11).

---

## 2. Creation and configuration

### SN-FORM-010 — Creation is atomic ⚠️

Creating a form **MUST** create the record, its fields, its share code and its QR code in **one
transaction**. Either all exist or none do.

> ⚠️ **Privyr defect.** Their creation is two non-atomic calls — `createForm` then `share-qr`. A
> failure between them leaves a form with no QR code, in a state the UI cannot represent and the
> user cannot fix without deleting and starting again.

### SN-FORM-011 — Post-submit configuration

Success message · success CTA (none / URL / WhatsApp / phone) · redirect URL · auto-assign group ·
routing rule override.

**The WhatsApp success CTA is the highest-converting option** — the visitor moves straight into a
conversation while intent is at its peak. It should be the recommended default in the builder.

### SN-FORM-012 — Branding

Header image · logo · primary colour · custom thank-you copy. "Powered by SalesNova" unless
white-label.

### SN-FORM-013 — Sharing

Direct link on the org's short domain · **downloadable QR** (PNG + SVG, print resolution) ·
embed snippet (iframe + script) · WhatsApp/SMS/email share.

The QR matters more than it looks: printed on a card, a hoarding, a stall banner, a property board.
It **MUST** be downloadable at print resolution with a quiet zone, not a 200 px screenshot.

---

## 3. The public form

### SN-FORM-020 — Separate deployment, no third-party trackers ⚠️

Same rule as the share viewer ([`F07`](F07-sharing-and-tracking.md) §SN-SHARE-011). **Zero**
third-party analytics, advertising or session-recording scripts. No configuration option to add
one.

> Privyr loads seven third-party trackers onto pages **collecting personal data under our
> customer's name**. On a lead-capture form specifically — where the visitor is typing their name
> and phone number — this is the worst possible place for a Facebook Pixel and a session recorder.

### SN-FORM-021 — Preview mode is enforced server-side ⚠️

`?preview=1` **MUST** be enforced on the server. A submit in preview mode returns
`403 PREVIEW_MODE`.

> ⚠️ **Privyr defect.** They hide the submit button client-side and the endpoint accepts the
> submission anyway. Removing one attribute in devtools creates real leads from a preview.

### SN-FORM-022 — Anti-abuse

| Layer | |
|---|---|
| Rate limit | 10 submissions/hour per IP per form |
| Captcha | Turnstile, challenge escalating above threshold |
| Honeypot | Hidden field |
| Timing | Submissions under 2 s from load are challenged |
| Duplicate | Same phone/email within 60 s is deduplicated silently |

### SN-FORM-023 — Performance

LCP < 2 s on 3G · < 40 KB JS · works without JavaScript (progressive enhancement — the form posts
natively; only the captcha and inline validation are lost).

### SN-FORM-024 — Consent

Where the org operates under GDPR/DPDP, the form **MUST** render a configurable consent checkbox
with a link to their privacy policy, and the consent state and timestamp **MUST** be stored on the
lead.

### SN-FORM-025 — Accessibility

WCAG 2.1 AA. Labelled inputs, keyboard navigable, errors announced, 4.5:1 contrast. This is a
public page filled in by people we know nothing about.

---

## 4. Submissions

### SN-FORM-030 — Through the standard pipeline

`POST /public/v1/form/{code}/submit` → `inbound_event` → parser → dedup → **routing rules** →
alerts.

No shortcut path.

### SN-FORM-031 — Empty is not an error ⚠️

A form with zero submissions **MUST** return `200` with an empty collection and its counts.

> ⚠️ **Privyr defect.** `GET .../get-leads` returns **`500`** on a form with no leads — which is
> every form, immediately after it is created. The user's first interaction with a form they just
> made is an error screen.

### SN-FORM-032 — Per-form analytics

Views · submissions · conversion rate · per-field drop-off · source breakdown · submissions over
time.

**Per-field drop-off is the one that changes behaviour** — it tells the user which question is
costing them leads. It is measurable with a field-focus beacon and no personal data.

### SN-FORM-033 — Status

`DRAFT` · `ACTIVE` · `PAUSED` · `CLOSED`

`PAUSED` shows a configurable message and stops accepting. `CLOSED` returns `410`. Existing links
never break silently.

---

## 5. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Forms | 1 | 20 | unlimited |
| Fields per form | 5 | 20 | 30 |
| Submissions/month | 100 | unlimited | unlimited |
| Custom branding | ❌ | ✅ | ✅ |
| Remove "Powered by" | ❌ | ❌ | ✅ |
| Embed | ❌ | ✅ | ✅ |

---

## 6. Acceptance criteria

- `AC-FORM-003.1` — Given a visible required field, when `is_visible` is set false, then `is_required` becomes false in the same transaction.
- `AC-FORM-010.1` — Given form creation where QR generation fails, when the request completes, then no form record exists and the response is `500` with a trace id.
- `AC-FORM-021.1` — Given `?preview=1` and a submit request forged past the client, when submitted, then the response is `403 PREVIEW_MODE` and no lead is created.
- `AC-FORM-031.1` — Given a form with zero submissions, when its leads are requested, then the response is `200` with an empty array and `meta.counts.total = 0`.
- `AC-FORM-001.1` — Given a new custom field created in settings, when the form builder is reopened, then the field is available with no client deployment.
