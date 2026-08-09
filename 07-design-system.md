---
doc: 07-design-system
status: DRAFT — direction requires approval
owner: Design
audience: Designers, frontend engineers
depends_on: [03-information-architecture]
---

# Design System

> **⚠️ This document proposes a design direction rather than recording an approved one.**
> The brand decision so far is the name, SalesNova. Sections 1–3 (principles, tone, colour) are a
> **proposal grounded in the ICP and the existing Meadow product family** and need explicit
> sign-off. Sections 4 onward (type, spacing, components, accessibility, performance) are
> largely direction-independent and can proceed regardless.

---

## 1. Who we are designing for

Every decision below traces to one of these. If a proposed change does not, it is decoration.

| Reality | Design consequence |
|---|---|
| **Mid-range Android, 5–6" screen, often 2–3 years old** | Performance budget is a design constraint, not an engineering afterthought. No heavy animation, no large images in the shell. |
| **Used outdoors, in sunlight** | High contrast is mandatory, not aspirational. Light theme is the default. Thin grey-on-white text is unreadable at a site visit at 2pm. |
| **One-handed, while walking or driving between appointments** | Primary actions in the bottom third. Tap targets ≥44 px. Nothing critical in a top corner. |
| **Patchy 3G/4G, frequently switching cells** | Optimistic UI, visible sync state, graceful degradation. Never a spinner that blocks the whole screen. |
| **Speed decides the outcome** | The path from notification to sent message is the most optimised path in the product. Everything else yields to it. |
| **Not technical; will not read a manual** | Labels over icons. Plain language. Empty states that teach. |
| **Part of the Meadow family** (`meadow-kart`, `meadow-support`) | Should feel like a sibling: shared type scale, spacing, radii and interaction grammar; its own accent. |

---

## 2. Principles

**1. The next action is always obvious.** Every screen has one primary action, visually dominant.
If a screen has two equally weighted primary actions, the screen is wrong.

**2. Speed is a feature you can see.** Optimistic updates, skeletons that match final layout, no
layout shift. Perceived speed matters as much as measured speed.

**3. Density where it earns its place.** The lead list is dense — a rep scanning 40 leads needs to
see 12 at once, not 4. The lead detail is not — it is where they think. Density is a per-screen
decision, not a global setting.

**4. Labels, not icons alone.** Icons are ambiguous to non-technical users and untranslatable in
context. Every icon-only control has a visible label or a persistent tooltip. Bottom navigation
always carries labels.

**5. Honest states.** Loading looks like loading. Empty says why it is empty and what to do. Errors
say what went wrong and what to do next. Nothing pretends to have succeeded before it has.

**6. Nothing decorative between the rep and the lead.** No hero illustrations on working screens,
no marketing surfaces inside the app, no interstitials on the critical path.

---

## 3. Colour — PROPOSED

### 3.1 The proposal

A **deep green primary** with a **warm amber accent**. Green reads as "meadow", carries growth and
progress connotations that suit a sales tool, and — critically — is not blue. Nearly every CRM in
this segment is blue; on a screen glimpsed for two seconds, being visibly different has real
recall value.

Amber handles attention and warmth, and survives sunlight better than the pastel accents that are
fashionable and unusable outdoors.

### 3.2 Semantic tokens

Components reference **semantic** tokens only. Never a raw palette value, never a hex.

```
--color-primary            deep green      primary actions, active nav, focus
--color-primary-hover
--color-primary-subtle                     tinted backgrounds
--color-on-primary         white           text on primary

--color-accent             warm amber      highlights, badges, "new"
--color-success            green           delivered, completed, connected
--color-warning            amber           expiring, degraded, overdue soon
--color-danger             red             failed, overdue, destructive
--color-info               blue            neutral information

--color-surface                            page background
--color-surface-raised                     cards, sheets
--color-surface-sunken                     wells, code, inset
--color-border / --color-border-strong
--color-text-primary / -secondary / -tertiary / -inverse
```

### 3.3 Contrast is a hard rule

| Content | Minimum |
|---|---|
| Body text | **7:1** (AAA) — sunlight, not compliance |
| Large text, UI labels | 4.5:1 |
| Interactive borders, focus rings | 3:1 |
| Disabled | 3:1 — must still be readable |

**Body text at AAA rather than AA is a deliberate, ICP-driven choice.** It costs nothing and it is
the difference between usable and unusable on a phone held at arm's length in the sun.

### 3.4 Colour never carries meaning alone

Every status uses colour **plus** an icon or text label. Around 8% of men have some form of colour
vision deficiency, and this is a male-skewed user base in most of our target verticals.

### 3.5 Dark theme

V1.5. The tokens are structured for it from day one, but light-first is correct for outdoor use and
shipping both well at launch is not worth the cost.

---

## 4. Typography

### SN-DS-010 — System font stack

```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Noto Sans", "Noto Sans Devanagari", sans-serif;
```

**No webfont in V1.** A webfont costs 100–200 KB and a flash of invisible text on exactly the
connections our users have. The system stack is free, instant, and renders Devanagari, Tamil,
Bengali, Thai and Vietnamese correctly on the devices that matter.

### SN-DS-011 — Scale

| Token | Size / line-height | Use |
|---|---|---|
| `display` | 32/40 | Page titles, rare |
| `h1` | 24/32 | Screen titles |
| `h2` | 20/28 | Section headings |
| `h3` | 17/24 | Card titles |
| `body` | 15/22 | Default |
| `body-sm` | 13/20 | Secondary |
| `caption` | 12/16 | Timestamps, meta |
| `mono` | 13/20 | Codes, ids, numbers |

**Minimum body size is 15 px.** Not 14. The 14 px body text that is standard in Western SaaS is
measurably harder to read on a 5.5" screen at arm's length outdoors, and our users are older on
average than a typical B2B SaaS audience.

### SN-DS-012 — Weights

400 regular · 500 medium · 600 semibold. **No 300 or lighter** — light weights fail the contrast
requirement in practice regardless of what the colour value says.

---

## 5. Spacing, radius, elevation

### SN-DS-020 — 4 px base scale

`0 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`

Shared with the Meadow family. No arbitrary values; a spacing that is not on the scale is a bug.

### SN-DS-021 — Radius

`sm 4` (inputs, chips) · `md 8` (cards, buttons) · `lg 12` (sheets, modals) · `full` (avatars,
pills).

### SN-DS-022 — Elevation

Four levels, all subtle. Shadow indicates layering, never decoration. On low-end Android, large
blurred shadows cost real frames — keep radii tight.

---

## 6. Components

### SN-DS-030 — Inventory

**Foundations** — Button (primary/secondary/ghost/danger, 3 sizes, loading state) · IconButton ·
Input · Textarea · Select · Combobox · DatePicker · TimePicker · Checkbox · Radio · Switch ·
Chip · Badge · Avatar · Tooltip · Spinner · Skeleton

**Layout** — Card · Sheet (bottom, mobile) · Modal · Drawer · Tabs · Accordion · Divider ·
EmptyState · ErrorState · Banner

**Data** — Table (sortable, selectable, sticky header) · Grid (inline-editable) · List ·
ListItem · Pagination · CursorPagination · Filter bar · SearchInput · SavedViewPicker

**Domain** — LeadCard · LeadListRow · ContactActionBar · StageBadge · GroupChip ·
FollowUpPill · TimelineEvent · MessageBubble · ConversationRow · ContentCard ·
ShareSheet · ViewStatsRow · SequenceStepCard · RuleConditionRow · **HealthBadge** ·
**UpgradeLock** · CapabilityToggle

### SN-DS-031 — Every interactive component ships six states

Default · hover · focus-visible · active · disabled · loading.

**`focus-visible` is not optional.** Keyboard navigation is how power users work the grid, and it
is an accessibility requirement.

### SN-DS-032 — Buttons

| Variant | Use | Per screen |
|---|---|---|
| Primary | The one main action | **Exactly one** |
| Secondary | Alternative actions | Several |
| Ghost | Tertiary, in-context | Several |
| Danger | Destructive | One, and always confirmed |

Sizes: `sm 32` · `md 40` · `lg 48`. **Minimum touch target 44×44 px** regardless of visual size —
padding makes up the difference.

### SN-DS-033 — `ContactActionBar` is the most important component in the product

Call · WhatsApp · Email · SMS, configurable and orderable per
[`F18`](features/F18-settings.md) §SN-SET-020.

| Rule | |
|---|---|
| Position | Above the fold on lead detail, at every breakpoint. On mobile, **sticky to the bottom**. |
| Size | `lg`, 48 px |
| Labels | Always visible |
| WhatsApp | Visually distinguished — it is the default action for ~80% of contacts |

Everything else on the lead screen is context for this bar.

### SN-DS-034 — `UpgradeLock`

Renders a plan-locked control per [`06`](06-permissions-and-plans.md) §3: control visible, lock
badge, specific copy naming the limit and the tier.

**One component, so upgrade prompts cannot drift into inconsistency** across twenty screens.

### SN-DS-035 — `HealthBadge`

The WhatsApp connection state ([`F12`](features/F12-whatsapp-coexistence.md) §6) in four states,
each with icon, colour and text. Appears in nav, settings and the inbox.

---

## 7. Mandatory states

### SN-DS-040 — Six states, every data surface

Per [`03-information-architecture.md`](03-information-architecture.md) §7:
loading · empty-first-run · empty-filtered · error · partial-degraded · permission-denied.

A screen shipped without all six is incomplete, and it is a review-blocking omission — not a
follow-up ticket.

### SN-DS-041 — Empty states teach

Three parts: what this is · why it is empty · one specific action.

> ✅ "No leads yet. Connect Facebook Lead Ads to start receiving them automatically."
> ❌ "No data."

### SN-DS-042 — Skeletons match the final layout

Skeletons mirror the real content's shape so nothing shifts on load. **Zero cumulative layout
shift on the leads list and lead detail** is a hard requirement, not a target.

### SN-DS-043 — Errors are specific and recoverable

What failed · why, in plain language · what to do · a retry. Plus the `trace_id`, small, selectable.

Never "Something went wrong."

---

## 8. Motion

### SN-DS-050 — Fast and purposeful

| Type | Duration |
|---|---|
| Micro (hover, press) | 100 ms |
| Transition (sheet, modal) | 200 ms |
| Page | 250 ms |
| **Maximum** | **300 ms** |

Easing: `cubic-bezier(0.4, 0, 0.2, 1)`.

### SN-DS-051 — Motion communicates, never decorates

Permitted: a sheet showing where it came from, an optimistic row appearing, a state change drawing
the eye. Not permitted: entrance animations on lists, parallax, decorative loops, staggered reveals.

Every one of those costs frames on a mid-range Android and delays the action.

### SN-DS-052 — `prefers-reduced-motion` is honoured

All non-essential motion is disabled. Essential feedback becomes an instant state change.

---

## 9. Responsive

### SN-DS-060 — Breakpoints

| | Width | Layout |
|---|---|---|
| `base` | < 640 | Single column, bottom nav, sheets |
| `sm` | ≥ 640 | Wider cards, two-column forms |
| `md` | ≥ 768 | Collapsible sidebar, modals |
| `lg` | ≥ 1024 | Persistent sidebar, table view, **grid available** |
| `xl` | ≥ 1280 | Max content width 1440, detail panes |

### SN-DS-061 — Mobile web is not a degraded desktop

Every core workflow — receive, open, contact, log, follow up — **MUST** be complete at `base`.
Only the spreadsheet grid, bulk operations and rule building are desktop-only, and each degrades to
a clear explanation rather than a broken screen.

### SN-DS-062 — Bottom navigation on mobile

Leads · Follow-ups · Inbox · More. Labels always visible. Badge counts on Follow-ups and Inbox.

**Follow-ups gets a slot on mobile that it does not get on desktop.** A deliberate asymmetry: on a
phone, the follow-up queue *is* the working day.

---

## 10. Accessibility

### SN-DS-070 — WCAG 2.1 AA, with AAA body contrast

| Requirement | |
|---|---|
| Contrast | Body AAA (7:1), everything else AA |
| Keyboard | Every action reachable and operable; visible focus |
| Screen reader | Semantic HTML, ARIA only where semantics fall short |
| Touch targets | ≥44×44 px |
| Forms | Labelled inputs, errors associated and announced |
| Live regions | New messages, toasts, count updates announced |
| Motion | `prefers-reduced-motion` honoured |
| Zoom | Usable at 200% with no horizontal scroll |

**Public surfaces — the share viewer and lead forms — are held to the same bar.** Those pages are
filled in by people we know nothing about.

---

## 11. Performance budgets

Design constraints, enforced in CI.

| Metric | Budget |
|---|---|
| Initial JS (app shell) | < 180 KB gzipped |
| Route chunk | < 60 KB gzipped |
| LCP, mid-range Android on 4G | < 2.0 s |
| INP | < 200 ms |
| CLS | < 0.05 |
| **Share viewer total JS** | **< 50 KB** |
| **Lead form total JS** | **< 40 KB** |
| Fonts | **0 bytes** |

A design that cannot be built inside these budgets is not an approved design.

---

## 12. Implementation

### SN-DS-080 — Tailwind with semantic tokens, headless primitives

Tailwind CSS with the token scale above configured as theme values. Headless primitives
(Radix or equivalent) for accessible behaviour; all visual styling is ours.

### SN-DS-081 — Components never contain raw values

No hex, no arbitrary spacing, no magic numbers. Tokens only. Enforced by lint.

> This is what makes white-label branding ([`F15`](features/F15-agency-and-white-label.md)) a
> configuration change rather than a rebuild, and what would make a rebrand tractable.

### SN-DS-082 — Documented in Storybook

Every component with all states, props, usage guidance and accessibility notes. A component that is
not in Storybook does not exist.

---

## 13. What needs deciding

| # | Decision | Blocks |
|---|---|---|
| 1 | **Approve or replace the green/amber direction** | All visual design |
| 2 | Relationship to the Meadow family — shared design system, or sibling with shared tokens? | Component library setup |
| 3 | Logo and wordmark | Nav, share viewer, forms, emails |
| 4 | Illustration style for empty states | Empty-state components |
| 5 | Dark theme in V1 or V1.5 (**recommendation: V1.5**) | Token structure — cheap now, expensive later |

Items 3 and 4 are brand work that can run in parallel with engineering. **Item 1 is on the critical
path for design and should be resolved first.**
