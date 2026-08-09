---
doc: 03-information-architecture
status: REVIEW
owner: Product + Design
audience: Design, frontend, product
depends_on: [02-product-scope]
---

# Information Architecture

## 1. Principles

#### SN-ARCH-098 — Lead-centric, two-click, mobile-first navigation

Navigation **MUST** reflect the lead-centric object hierarchy rather than backend service
boundaries. The four daily actions (check new leads, message them, set a follow-up, check who
opened something) **MUST** be reachable from the app shell without navigating into a section.
Administrative surfaces (settings, integrations, team management) **MUST NOT** compete for space
with the daily loop, and the mobile layout **MUST** be designed first for the four daily actions,
not degraded from desktop.

**1. The lead is the centre of the universe.** Every object in the product either produces a lead,
describes a lead, or is something you send to a lead. Navigation reflects that hierarchy rather
than mirroring the backend's service boundaries. Privyr's navigation leaks its architecture —
"Automations" contains both routing rules and WhatsApp campaigns because they happen to share a
service. Ours doesn't.

**2. Two clicks to any daily action.** A rep's day is: check new leads, message them, set a
follow-up, check who opened something. All four are reachable from the app shell without
navigating into a section.

**3. Configuration lives away from work.** Settings, integrations and team management are
administrative surfaces used weekly at most. They must not compete for space with the daily loop.

**4. The mobile web layout is not a degraded desktop.** ~70% of our ICP's usage will be a mid-range
Android phone on a patchy connection. The mobile layout is designed first for the four daily
actions; desktop adds density, not capability.

---

## 2. Navigation model

#### SN-ARCH-099 — Rail, tab bar and the global `+ New` action

Desktop **MUST** use a persistent left rail; mobile web **MUST** use a five-tab bottom bar, with
Follow-ups as its own tab on mobile only (a deliberate desktop/mobile asymmetry) — matching the two
layouts would make one of them worse. The global `+ New` action **MUST** always offer "New lead"
first, and on mobile **MUST NOT** be a nested menu more than one level deep.

### 2.1 Desktop — persistent left rail

```
┌──────────────┬────────────────────────────────────────────────────┐
│  SalesNova   │  [ search ]              [ + New ]  [ 🔔 ]  [ 👤 ] │
│              ├────────────────────────────────────────────────────┤
│  ◆ Leads   ⁴ │                                                    │
│  ◆ Inbox   ⁷ │                                                    │
│  ◆ Content   │                    content area                    │
│  ◆ Automations                                                    │
│  ◆ Sources   │                                                    │
│  ◆ Insights  │                                                    │
│              │                                                    │
│  ─────────── │                                                    │
│  ◆ Team      │                                                    │
│  ◆ Settings  │                                                    │
│              │                                                    │
│  [ Acme Co ] │                                                    │
│  ▸ upgrade   │                                                    │
└──────────────┴────────────────────────────────────────────────────┘
```

Badges on **Leads** (uncontacted count) and **Inbox** (unread conversations) are the only numeric
indicators in the rail. Everything else would become noise.

### 2.2 Mobile web — bottom tab bar

Five tabs, chosen because they are the five things a rep does on a phone:

```
┌────────────────────────────────────────┐
│  ← Leads                    ⌕    ⋮    │
├────────────────────────────────────────┤
│                                        │
│              content area              │
│                                        │
│                                  ╭───╮ │
│                                  │ + │ │
│                                  ╰───╯ │
├────────────────────────────────────────┤
│  Leads   Inbox   Follow   Content  More│
│    ⁴       ⁷      ups ¹²               │
└────────────────────────────────────────┘
```

**Follow-ups gets its own tab on mobile and not on desktop.** On a phone it is the rep's to-do
list and the single highest-frequency destination; on desktop it is a view within Leads. This
asymmetry is deliberate — matching the layouts would make one of them worse.

`More` contains Automations, Sources, Insights, Team and Settings.

### 2.3 The global `+ New` action

One affordance, context-aware. Always offers:

- **New lead** (primary, always first)
- New message / file / page
- New sequence
- Import leads

On mobile this is a floating action button. It **MUST NOT** be a nested menu more than one level
deep.

---

## 3. Route table

#### SN-ARCH-100 — Route structure and the public recipient-facing surface

Route structure **MUST** follow the table in this section (auth, leads, inbox, content,
automations, sources, insights/team/agency/settings). Public recipient-facing routes (§3.8) **MUST**
be served from a separate deployment that **MUST NOT** load the authenticated application bundle
and **MUST NOT** load any third-party marketing or advertising tracker.

Next.js 16 App Router. Authenticated application unless marked otherwise.

### 3.1 Public and authentication

| Route | Screen | Notes |
|---|---|---|
| `/login` | Sign in | Two-step: identifier → OTP. Email and phone paths. |
| `/signup` | Sign up | **Server-rendered, outside the app bundle.** Three stages. |
| `/onboarding` | Onboarding flow | Server decides the next screen |
| `/welcome` | Activation checklist | Persistent until dismissed or complete |
| `/auth/google/callback` | OAuth return | |
| `/error` | Error boundary | |

### 3.2 Leads

| Route | Screen | Notes |
|---|---|---|
| `/` | — | Redirects to the user's default startup screen preference |
| `/leads` | Lead list | Renders grid or table per user preference |
| `/leads/grid` | Spreadsheet view | Wide, editable, column-configurable |
| `/leads/table` | Compact table | Light projection; the mobile default |
| `/leads/uncontacted` | Uncontacted | Derived, per configurable triggers |
| `/leads/recently-active` | Recently active | Ranked by last content-open time |
| `/leads/follow-ups` | Follow-ups | Four buckets |
| `/leads/:id` | Lead detail | The most-visited screen in the product |
| `/activity` | Account activity feed | Cursor-paged, bidirectional, calendar nav |

### 3.3 Inbox — new to SalesNova

Does not exist in Privyr in this form. It is the surface Coexistence makes possible.

| Route | Screen | Notes |
|---|---|---|
| `/inbox` | Conversation list | Across all numbers the member may access |
| `/inbox/:conversationId` | Conversation thread | Read-only mirror + send affordances |
| `/inbox/numbers/:numberId` | Filtered by number | For multi-number orgs |

> **Scope guard.** This is a *lead-centric* conversation view, not a general-purpose WhatsApp
> client. Every conversation resolves to a lead — creating one if the sender is unknown. We do not
> support group chats, broadcast lists or status. Those don't sync via Coexistence anyway, which
> conveniently aligns the constraint with the product decision.

### 3.4 Content

| Route | Screen |
|---|---|
| `/content` | Redirects to the user's default content tab |
| `/content/messages` · `/content/messages/:id` | Message list · detail/edit |
| `/content/files` · `/content/files/:id` | File list · detail |
| `/content/pages` · `/content/pages/new` · `/content/pages/:id` · `/content/pages/:id/edit` | Page list · type chooser · detail · builder |
| `/content/sequences` · `/content/sequences/:id` · `/content/sequences/:id/edit` | Sequence list · detail · builder |
| `/content/bundles/:id` | Content group sharing |

### 3.5 Automations

| Route | Screen |
|---|---|
| `/automations` | Hub — all automations with status |
| `/automations/rules` · `/new` · `/:id` | Lead routing rules |
| `/automations/distribution` · `/new` · `/:id` · `/history` | Lead distribution + audit log |
| `/automations/campaigns` · `/new` · `/:id` · `/:id/edit` | WhatsApp campaigns |
| `/automations/responder` · `/history` | WhatsApp auto-responder |

### 3.6 Sources (integrations)

Named "Sources", not "Integrations" — the user's mental model is *where my leads come from*.

| Route | Screen |
|---|---|
| `/sources` | Registry, server-declared, with per-account status |
| `/sources/facebook` · `/sources/facebook/pages/:pageId` | Account → pages → forms |
| `/sources/linkedin` | LinkedIn Lead Gen Forms |
| `/sources/wordpress` · `/sources/indiamart` · `/sources/godaddy` | Token/key-based connections |
| `/sources/email` | AI email lead parsing — per-account inbound address |
| `/sources/forms` · `/new` · `/:id` · `/:id/edit` | First-party lead forms |
| `/sources/whatsapp` | **Coexistence connect and number management** |
| `/sources/zapier` | |
| `/sources/import` | CSV import |
| `/sources/export` | Async export |

### 3.7 Insights, team, agency, settings

| Route | Screen |
|---|---|
| `/insights` | Overview dashboard |
| `/insights/:dashboard` | Named dashboard (pipeline, sources, content) |
| `/insights/team` | Team performance, incl. average first-response time |
| `/team` · `/team/members` | Member list and capability management |
| `/team/subteams` · `/team/subteams/:id` | Sub-team management |
| `/agency` · `/agency/new` · `/agency/:id` · `/agency/invite/:code` | Agency surfaces |
| `/settings` | Settings index |
| `/settings/profile` · `/email` · `/notifications` · `/personalisation` | Personal |
| `/settings/custom-fields` · `/groups` · `/follow-ups` · `/uncontacted` · `/duplicates` | Data model config |
| `/settings/whatsapp` · `/tracking-pixels` · `/meta-capi` · `/branding` | Channel and brand config |
| `/settings/billing` | Plan, usage, invoices, credit ledger |

### 3.8 Public recipient-facing surfaces

**A separate deployment.** These are served to strangers, must be fast on a poor connection, and
must never load the application bundle. See [`09-technical-architecture.md`](09-technical-architecture.md) §6.

| Route | Screen | Notes |
|---|---|---|
| `/t/:slug/:code` | Tracked content viewer | Per-recipient link. The tracking surface. |
| `/f/:code` | Hosted lead form | Public, anonymous, lead-capture |
| `/qr/:code` | QR redirect | Permanent short link |
| `/u/:token` | Unsubscribe / opt-out | WhatsApp policy requirement |

Served from a **short branded domain per organisation**, falling back to the platform domain when
branding is unconfigured.

> **No marketing or advertising trackers load on any route in §3.8.** Privyr loads seven on its
> public lead form — a page whose entire purpose is collecting a stranger's name, phone and email,
> with the form owner having no control over any of them. We load our own first-party measurement
> and nothing else. See [`10`](10-nfr-security-compliance.md) §7.

---

## 4. Screen inventory and parity mapping

#### SN-ARCH-101 — Route consolidation against Privyr's inventory

Route consolidation relative to Privyr's 96 routes **MUST** follow the merged/dropped/renamed/new
decisions in this table, targeting ~78 authenticated + 4 public routes without loss of capability.

Against Privyr's 96 routes. `NEW` marks something they don't have; `MERGED` marks where we
deliberately collapse theirs.

| Privyr | SalesNova | Decision |
|---|---|---|
| `/clients/` + `/clients/clients-table` | `/leads` with a view toggle | **MERGED** — two routes for one concept is a navigation tax |
| `/client/:id` | `/leads/:id` | Renamed; "client" and "lead" were the same entity anyway |
| `/team/lead-assignment` | — | **DROPPED** — already a dead redirect in Privyr |
| `/automations/*` (5 tab routes) | `/automations` with tabs | **MERGED** |
| `/whatsapp/:waNumberId/:agentId` | `/inbox` | **REPLACED** — a real conversation surface, not a monitoring log |
| — | `/inbox`, `/inbox/:id` | **NEW** — the Coexistence payoff |
| — | `/sources/whatsapp` | **NEW** — Coexistence onboarding |
| `/account/*` (14 routes) | `/settings/*` | Renamed and regrouped |
| `/integration/*` (16 routes) | `/sources/*` | Renamed; user's mental model |
| `/analytics` (paywalled marketing wall) | `/insights` | **CHANGED** — real dashboards, self-serve |
| `/app-download`, `/open-in-app`, `/login_mobile` | — | **DROPPED for V1** — no native app yet |
| `/subscription/one-time-payment` | `/settings/billing` | **MERGED** |

**Route count: ~78 authenticated + 4 public**, down from Privyr's 96, with more capability. The
reduction is entirely from merging duplicate routes and dropping mobile-app bridges.

---

## 5. The lead detail screen

#### SN-ARCH-102 — Above-the-fold contact, unified timeline, inline-editable fields

Contact actions **MUST** remain above the fold on every breakpoint. WhatsApp messages, content
views and logged calls **MUST** render as a single unified timeline stream — never a separate
WhatsApp tab. Custom fields **MUST** be inline-editable (click the value, type, blur to save), with
no modal and no explicit edit mode.

The single most important screen in the product. Specified here because its layout is an
architectural decision, not a visual one.

```
┌────────────────────────────────────────────────────────────────┐
│ ← Leads                                          [⋮ Options]   │
├────────────────────────────────────────────────────────────────┤
│  Priya Sharma                              ● NEW LEAD          │
│  Facebook Lead Ads · 12 minutes ago                            │
│  Assigned to you · No follow-up scheduled          [Set →]     │
├────────────────────────────────────────────────────────────────┤
│  [📱 WhatsApp]  [📞 Call]  [✉ Email]  [💬 SMS]                 │  ← quick contact
│  [ Send content ▾ ]         [ Add to sequence ▾ ]              │  ← configurable
├────────────────────────────────────────────────────────────────┤
│  ▸ DETAILS                                                     │
│    Phone      +91 98••• •••••                                  │
│    WhatsApp   same                                             │
│    Email      priya@example.com                                │
│    Lead stage Contacted        (in stage 2 days)               │
│    Budget     ₹45,00,000                                       │
│    Groups     [ Whitefield ] [ 3BHK ]         + add            │
│    Notes      …                                                │
├────────────────────────────────────────────────────────────────┤
│  ▸ TIMELINE                            [ All ▾ ] [+ Log ]      │
│                                                                │
│   💬  WhatsApp · you · 10 min ago                              │
│       "Hi Priya, thanks for your interest in…"                 │
│   💬  WhatsApp · Priya · 8 min ago                             │
│       "What's the possession date?"                    ← auto  │
│   👁  Opened "Acme Residences" · 6 min ago · 1m 22s            │
│   ↗  Sent "Acme Residences" · 11 min ago                       │
│   ✦  Lead received from Facebook Lead Ads · 12 min ago         │
└────────────────────────────────────────────────────────────────┘
```

Three things this layout asserts:

**Contact actions sit above the fold, always.** The job is *message this person*. Anything that
pushes those buttons below the fold on a phone is a regression.

**WhatsApp messages appear inline in the timeline, not in a separate tab.** This is the entire
point of Coexistence. A conversation, a content view and a logged call are the same class of
event — one stream, one taxonomy. Separating them would recreate the filing-cabinet problem in a
new place.

**Custom fields are inline-editable.** No modal, no edit mode. Click the value, type, blur to save.
Privyr does this and it is correct.

---

## 6. Cross-cutting state conventions

#### SN-ARCH-103 — The six required states, and the three distinct walls

Every list and detail surface **MUST** implement all six states in this section's table (loading,
empty first-run, empty filtered, error, partial/degraded, permission-denied). Permission-denied
(`403`, no upgrade CTA), plan-gated (`423 Locked`, upgrade modal) and feature-flagged-off (`425 Too
Early`, no CTA) **MUST** be presented as three visually and textually distinct conditions, never
collapsed into one generic denial.

Every list and detail surface **MUST** implement all six states. Missing states are the most
common cause of a product feeling unfinished, and they are cheap to specify and easy to forget.

| State | Requirement |
|---|---|
| **Loading** | Skeleton matching the final layout's shape. **MUST NOT** be a centred spinner on a blank page — it causes layout shift and reads as slower than it is. |
| **Empty (first-run)** | Explains what the object is, why it's useful, and gives one primary action. Never just "No results." |
| **Empty (filtered)** | Distinct from first-run. States which filters are active and offers to clear them. |
| **Error** | States what failed, whether it's retryable, and offers the retry. Never surfaces a raw status code or stack. |
| **Partial / degraded** | When a dependency is down (e.g. WhatsApp provider), the rest of the screen **MUST** still work, with a scoped inline notice. |
| **Permission-denied** | Distinct from empty and from paywalled. "You don't have access" vs. "Your plan doesn't include this" are different messages with different CTAs. |

### 6.1 Paywall vs. permission vs. not-yet-available

Three different walls, three different treatments. Conflating them is a common and damaging error —
telling a rep to upgrade when their *manager* restricted them is actively confusing.

| Condition | HTTP | UI treatment |
|---|---|---|
| Member lacks the capability | `403` | Inline, quiet. "Ask your admin for access." **No upgrade CTA.** |
| Plan doesn't include it | `423 Locked` | Upgrade modal with the value proposition and a plan comparison |
| Feature flag off for this account | `425 Too Early` | "Coming soon" state. No CTA. Not an error. |

Adopted from Privyr's constants, which get this genuinely right.

---

## 7. Search

#### SN-ARCH-104 — Global search performance, scoping and phone tolerance

Global search **MUST** return first results within 200ms at p95, **MUST** be scoped to the caller's
permissions and sub-team access and **MUST NOT** leak the existence of a lead the member cannot
view, and **MUST** support phone-number search tolerant of country-code presence, spaces, dashes
and brackets.

One global search field in the header, `⌘K` / `Ctrl+K`.

**Scope, in result order:** leads (name, phone, email) → content (title) → sequences → team members.

Requirements:
- **MUST** return first results within 200 ms at p95
- **MUST** be scoped by the caller's permissions and sub-team access — search **MUST NOT** leak the
  existence of a lead the member cannot view
- **MUST** support phone-number search with and without country code, and tolerate spaces, dashes
  and brackets
- **SHOULD** support recent-items as a zero-query state

Phone search tolerance matters more than it sounds: a rep searching `98765 43210` for a lead stored
as `+919876543210` must find it. This is the most common search a rep performs.

---

## 8. URL and deep-linking rules

#### SN-ARCH-105 — Query-string filters, unroutable modals, opaque IDs

Filter state **MUST** live in the query string. Destructive confirmations **MUST NOT** be routable,
and modals **MUST NOT** own a route unless deep-linking is a genuine requirement. Every ID exposed
in a URL **MUST** be opaque (ULID), never a sequential integer.

| Rule | Requirement |
|---|---|
| Filter state | **MUST** be in the query string, so a filtered list is shareable and survives reload |
| List position | **SHOULD** be preserved on back-navigation from a detail view |
| Modals | **MUST NOT** own a route unless deep-linkable is a genuine requirement |
| Destructive confirmations | **MUST NOT** be routable |
| IDs in URLs | **MUST** be opaque (ULID), never sequential integers — see [`10`](10-nfr-security-compliance.md) §4 |

> Privyr returns globally sequential IDs to recipients' browsers on its public viewer. Two requests
> a day apart give an outsider their total share and view volume. We use opaque IDs on every
> surface a non-member can see.

---

## 9. Responsive breakpoints

#### SN-ARCH-113 — Mobile-first breakpoints, grid gated to `lg`-and-above

The layout **MUST** be designed mobile-first for the `sm` breakpoint (< 640px: single column,
bottom tabs, FAB) as the primary target, scaling up through `md` and `lg` to `xl`. The spreadsheet
grid view **MUST NOT** render below `lg` — `/leads/grid` **MUST** redirect to `/leads/table` on
smaller viewports rather than rendering an unusable cramped grid.

| Breakpoint | Width | Layout |
|---|---|---|
| `sm` | < 640px | Single column, bottom tabs, FAB. **The primary design target.** |
| `md` | 640–1024px | Two-pane where useful (list + detail), collapsed rail |
| `lg` | 1024–1440px | Full rail, list + detail, spreadsheet grid usable |
| `xl` | > 1440px | Max content width capped; extra space goes to the grid, not to stretching prose |

**The spreadsheet grid is `lg`-and-above only.** Below that, `/leads/grid` redirects to
`/leads/table`. A 12-column editable grid on a 375px screen is not a smaller grid — it is an
unusable one, and pretending otherwise wastes build effort on a surface nobody can use.
