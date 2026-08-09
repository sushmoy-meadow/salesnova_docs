---
doc: F18-settings
status: REVIEW
owner: Product + Engineering
area_code: SET
depends_on: [04-domain-model, 06-permissions-and-plans]
---

# F18 — Settings & Preferences

Where the product is shaped to the organisation. Two scopes, one screen tree.

---

## 1. Two scopes

### SN-SET-001 — User scope vs org scope

| Scope | Stored on | Governs |
|---|---|---|
| **User** | `membership.preferences` | How **I** work — display, defaults, notifications |
| **Org** | `organization.settings` | How the **business** works — duplicates, stages, branding, policy |

### SN-SET-002 — Scope is decided by consequence, not by convenience

A setting is **org-scoped** when inconsistency across the team would corrupt shared data or
reporting.

| Setting | Scope | Why |
|---|---|---|
| Duplicate policy | **Org** | Different reps applying different merge rules corrupts the lead database |
| Unmark-contacted triggers | **Org** | Otherwise "contacted %" means something different per rep, and the dashboard is meaningless |
| Custom fields, groups, stages | **Org** | Shared schema |
| Branding, share domain | **Org** | One business, one identity |
| Quiet hours, notification matrix | **User** | Personal |
| Display name style, default sort | **User** | Personal |
| Default share channel | **User** | Personal, with an org default |
| Follow-up defaults | **User**, org default | |

> Privyr scopes almost everything per-user, including the unmark triggers. That means the
> "contacted" column on the team dashboard aggregates six different definitions of contacted. The
> number looks precise and is not comparable.

### SN-SET-003 — Admin lock

An owner **MAY** lock specific user-scoped settings org-wide, forcing the org default. Locked
settings render disabled with an explanation.

Adopted from Privyr's `settings_edit_control`.

---

## 2. Screen tree

```
/settings
  Profile             name, photo, phone, WhatsApp, email (OTP flow), timezone, language
  Preferences         display, defaults, quick-contact buttons, startup screen
  Notifications       the matrix (F17)
  Follow-ups          defaults, auto-create mode, reminder times
  Lead settings       ORG — duplicates, unmark triggers, new-lead badge sources
  Custom fields       ORG — F03
  Groups              ORG — F03
  Team                ORG — F14
  Sub-teams           ORG — F14
  Integrations        ORG — F10
  WhatsApp            ORG — F12
  Lead forms          ORG — F11
  Automation          ORG — F09
  Branding            ORG — logo, colours, share domain, powered-by
  Meta CAPI           ORG — F09
  Billing             ORG — F19
  Import / export     F20
  Security            sessions, devices, audit log
  Organisation        name, country, currency, timezone, industry
```

Org-scoped screens are visually marked and hidden entirely from members without the capability.

---

## 3. Profile

### SN-SET-010 — Fields

Photo · name · phone · WhatsApp number · country · timezone · language · job title ·
certification id.

`certification_id` carries the agent licence (RERA in India, CEA in Singapore) and renders on
shared pages and lead forms where configured — a genuine trust signal in real estate and a
regulatory requirement in some markets.

### SN-SET-011 — Email changes go through OTP

Not editable inline. `/settings/profile/change-email` → new address → OTP to the **new** address →
confirmation to the old.

Notifying the old address is what makes account takeover visible.

---

## 4. Preferences

### SN-SET-020 — Personalisation

| Setting | Values | Default |
|---|---|---|
| Display name style | Full name · First word | Full name |
| Default share channel | WhatsApp · Email · SMS · Copy | WhatsApp |
| Default page CTA | WhatsApp · Call · Email · URL · None | WhatsApp |
| Startup screen | Leads · Follow-ups · Inbox · Insights | Leads |
| Default lead sort | Created · Last activity · Name · Follow-up | Created desc |
| Default lead view | Table · Grid | Table |
| Default content tab | Messages · Files · Pages · Sequences | Messages |
| Quick-contact buttons | Call · WhatsApp · SMS · Email · Telegram, each toggleable and orderable | Call, WhatsApp, Email |
| Grid columns | Order and visibility | System default |
| Default intro content | Content item | None |
| Default sequence | Sequence | None |

> **`quick_contact_options` is more valuable than it looks.** It is the row of buttons a rep taps
> forty times a day. A team that never uses SMS should not see an SMS button. Privyr models it as
> an ordered array of `{button_type, user_selection}` and that is exactly right.

### SN-SET-021 — Follow-up defaults

Default offset (3 days) · default time (09:00 local) · auto-create mode
([`F04`](F04-follow-ups.md) §SN-FUP-011) · quick-set shortcut set.

---

## 5. Lead settings (org)

### SN-SET-030 — Duplicate policy

`CREATE_NEW` · `MERGE_EXISTING` · **`FLAG_FOR_REVIEW`** (default). Match keys: phone, WhatsApp,
email — each independently toggleable.

### SN-SET-031 — Unmark-contacted triggers

The six triggers from [`F02`](F02-leads.md) §SN-LEAD-040, org-scoped, with `unmark_on_view` off by
default.

### SN-SET-032 — New-lead badge sources

Which sources get the badge (default: integration, form, WhatsApp) and whether reassignment
re-marks (default yes).

---

## 6. Branding (org)

Logo · favicon · primary and accent colours · share domain · email from-name · powered-by toggle
(Business).

### SN-SET-040 — Live preview

Branding changes **MUST** preview against a real share viewer and a real lead form before saving.
Nobody should discover their logo is illegible on the actual page after sending it to fifty leads.

### SN-SET-041 — Contrast validation

Colour choices are checked for WCAG AA contrast against the surfaces they render on, with a warning
— not a block — when they fail.

---

## 7. Security

### SN-SET-050 — Sessions and devices

List of active sessions: device, browser, location (city), last active. Revoke individually or all
others. Revocation is immediate.

### SN-SET-051 — Audit log

Business tier. Filterable by actor, action, resource, date. Exportable. Read-only, always.

### SN-SET-052 — Data export and deletion

Every org can export all their data (leads, timeline, content, messages) in a machine-readable
format, self-serve, at any subscription status including expired
([`06`](../06-permissions-and-plans.md) §2.5).

Account deletion is self-serve, with a 30-day grace period and a clear statement of what is
destroyed and when.

> Required under DPDP and GDPR. Also simply correct — and a product that makes leaving difficult
> generates the kind of complaint no amount of marketing repairs.

---

## 8. Implementation

### SN-SET-060 — Settings come from `/bootstrap`

Both scopes ship in the bootstrap payload ([`05`](../05-api-design.md) §6). No screen fetches its
own settings.

### SN-SET-061 — Writes are granular and immediate

`PATCH` a single key. No "save" button on toggle-based screens; changes apply immediately with an
inline confirmation and undo where destructive.

### SN-SET-062 — Every setting has a documented default

Defaults live in one seed file, not scattered across code. A missing preference resolves to the
documented default, never to `null`-shaped undefined behaviour.

### SN-SET-063 — Org-setting changes are audited

Every org-scoped change writes `audit_log` with before and after values.
