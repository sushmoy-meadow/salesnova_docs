---
doc: F06-content
status: REVIEW
owner: Product + Engineering
area_code: CONT
depends_on: [04-domain-model, 05-api-design, F07-sharing-and-tracking]
---

# F06 — Content: Messages, Files & Pages

Reusable, trackable assets a rep sends to leads. The second pillar of the product.

---

## 1. Model

### SN-CONT-001 — One polymorphic record, three types

`MESSAGE` · `FILE` · `PAGE`, sharing one `content` base with type-specific detail tables.

All three share: folders, labels, visibility, stats, sharing, tracking, sequence membership.

> Privyr's structure is right — one `content-type` abstraction plus a shared taxonomy layer — but
> they back each type with a *separate microservice* (`message-template`, `document-template`,
> `template-v2`). The result is three different list shapes, three sort implementations and three
> versions of "search". One typed service, three renderers.

### SN-CONT-002 — Two independent taxonomies

**Folders** are hierarchical containers (a content item lives in at most one).
**Labels** are cross-cutting tags (any number).

Both apply to all three types. Neither is a substitute for the other, and users reach for both:
folders for "Whitefield Project", labels for "needs updating".

### SN-CONT-003 — Three-way visibility

`PRIVATE` → `SUBTEAM` → `ORG`

Promoting to `ORG` requires `content.set_visibility_org`; to `SUBTEAM`, `content.set_visibility_subteam`.

### SN-CONT-004 — Copy-on-edit

A member who can see but not edit shared content **MUST** be offered "Make a copy" — creating a
`PRIVATE` duplicate owned by them.

> Adopted from Privyr. It is what stops shared content becoming a bottleneck: a rep needing a
> tweaked version of the company brochure copy for their patch does not have to ask permission or
> wait.

### SN-CONT-005 — Archive is distinct from delete

| State | Shareable | Existing links | Visible in list |
|---|---|---|---|
| `ACTIVE` | ✅ | work | ✅ |
| `ARCHIVED` | ❌ | **keep working** | on request |
| deleted | ❌ | **break** | ❌ |

> Privyr has no archive, so "stop sending this" and "destroy the engagement history" are the same
> action. Their own UI steers users toward pausing instead of deleting — which is a workaround for
> a missing state. Model it properly.

### SN-CONT-006 — Deletion states its consequences

The confirmation **MUST** state how many tracked links will break, how many leads have opened it,
and how many sequences reference it. Where sequences reference it, deletion is **blocked** until
they are updated.

---

## 2. Messages

### SN-CONT-010 — Roles

`MAIN` · `FOLLOW_UP` · `DEFAULT_SHARE`

`DEFAULT_SHARE` is the accompanying text auto-filled when sharing a file or page, configurable per
content type.

### SN-CONT-011 — Personalisation tokens

`@leadName` `@leadFirstName` `@leadEmail` `@leadPhone` `@senderName` `@senderPhone` `@orgName`
`@cf.{key}` for any custom field.

| Rule | |
|---|---|
| Resolution | **At send/render time**, never at authoring time |
| Missing value | Falls back to a per-token default, then to empty — **never** renders `@leadName` literally |
| Preview | Server-rendered against a real or sample lead |
| Vocabulary | Served from `/api/v1/content/tokens`, derived from the org's custom-field schema |

> Render-time resolution means a lead's corrected name appears in a link sent last week. Privyr
> does this and it is quietly important.

### SN-CONT-012 — WhatsApp template constraints are enforced at authoring

Where a message is destined for a WhatsApp Business template, the editor **MUST** enforce Meta's
rules **at authoring time**, not at send time:

- A template **MUST NOT** begin or end with a variable
- No two variables adjacent
- Variables numbered sequentially from `{{1}}`
- Character limits per component

> Privyr surfaces `"Sorry, WhatsApp templates can't start or end with a variable"` — a real Meta
> constraint. Catching it at authoring saves a template rejection cycle, which costs the user
> 24–48 hours of waiting to discover a fixable mistake.

### SN-CONT-013 — Messages are sendable directly

A message can be sent to a lead without being wrapped in a share link — it is text, not a tracked
asset. Sending logs a timeline event.

---

## 3. Files

### SN-CONT-020 — Async processing, five states

`NOT_PROCESSED → PROCESSING → PROCESSED` · `WILL_NOT_PROCESS` · `FAILED`

`WILL_NOT_PROCESS` (a valid file of a non-trackable type) **MUST** be distinct from `FAILED`
(something went wrong). They need different UI and different retry behaviour.

### SN-CONT-021 — Limits

| | |
|---|---|
| Max size | 100 MB |
| PDF max pages | 200 |
| Trackable types | PDF (rendered viewer), images |
| Other types | Stored and shareable, **not** duration-trackable |

Enforced at the **signing** step, before a byte moves ([`05`](../05-api-design.md) §12). Validating
after upload wastes the user's mobile data.

### SN-CONT-022 — Processing is visible and non-blocking

The file appears in the list immediately with its state shown. The user may leave and return.
`FAILED` offers retry and a plain-language reason.

### SN-CONT-023 — Storage

Direct-to-S3 presigned upload; CDN delivery. Storage keys opaque. Originals retained; a rendered
trackable derivative is generated for supported types.

---

## 4. Pages

### SN-CONT-030 — Block-composed micro-landing-pages

| Block | Content |
|---|---|
| `TITLE` | Heading |
| `DESCRIPTION` | Rich text, constrained |
| `GALLERY` | Up to 20 images, lightbox |
| `VIDEO` | YouTube embed |
| `MAP` | Google Maps location |
| `LINK` | Titled external link |
| `ATTACHMENT` | Downloadable file |
| `PDF_VIEWER` | Embedded trackable PDF |
| `CTA` | Call · WhatsApp · Email · URL |

### SN-CONT-031 — Templates declare the vocabulary

The editor **MUST** fetch available blocks from `GET /api/v1/page-templates/{key}/schema`. The
client **MUST NOT** ship a hardcoded block list.

> The metadata-endpoint pattern again ([`04`](../04-domain-model.md) §5.4). A new block type is a
> seed row and a renderer, not a frontend release cycle.

### SN-CONT-032 — Blocks are an ordered array with semantic styling

Uniformly keyed `{slot_key, type, value, style}`. Three corrections to Privyr's contract:

1. **Uniform keying.** They key components as `{comp_type}-{comp_code}` — except `image_gallery`,
   special-cased to a bare `"images"` key with a different envelope. Every slot keys the same way.
2. **Semantic style tokens, not framework classes.** They persist raw Tailwind (`"mt-3"`) as
   styling data, so changing CSS framework becomes a data migration. We store `{"spacing": "md"}`.
3. **No placeholders round-tripping as data.** They send `placeholder` strings through the API as
   if they were content.

### SN-CONT-033 — Per-page CTA

`default_page_cta` (org preference, default `WHATSAPP`) with per-page override. The CTA is the
point of the page — see [`F07`](F07-sharing-and-tracking.md) §SN-SHARE-020.

### SN-CONT-034 — No third-party pixel injection

SalesNova **MUST NOT** offer Facebook Pixel or GTM injection into recipient-facing pages.

> Privyr does (`/account/tracking-pixels`). It means every lead who opens a tracked link is
> fingerprinted by ad networks on a page they never consented to, under our customer's name. That
> is our customer's legal exposure created by our feature. Meta CAPI ([`F09`](F09-automation.md))
> gives them the ad-optimisation benefit server-side, from data they already own, without the
> consent problem. That is the substitute we offer, and we should say so plainly when asked.

### SN-CONT-035 — Live preview

The builder **MUST** show a live preview at mobile width by default. Over 90% of these pages are
opened on a phone from a WhatsApp message.

---

## 5. Organisation

### SN-CONT-040 — List columns

Title · type · folder · labels · **shared count** · **opened count** · **unopened count** ·
last shared · owner · visibility.

### SN-CONT-041 — `TOTAL_UNOPENED` is first-class

Not a subtraction the client computes. It is a queryable, sortable stat.

> Sound instinct from Privyr: the actionable list is *who hasn't opened it*. Making it a real
> column turns content stats from a vanity screen into a work queue.

### SN-CONT-042 — Configurable recency window

The "viewed recently" window is a configuration value, defaulting to 7 days.

> Privyr's help site says 3 days; their shipped constant says `VIEWED_IN_LAST_7_DAYS`. Docs and
> code disagreeing about a number the user sees is a small thing that erodes trust in every other
> number.

### SN-CONT-043 — Search and filter

Search title, body and private notes. Filter by type, folder, label, visibility, owner, shared
state, engagement.

### SN-CONT-044 — Private notes

Internal-only text on any content item, never rendered to a recipient, searchable by the team.
For "outdated pricing — check before sending".

---

## 6. Shared folders

### SN-CONT-050 — A third access axis

Content **MAY** be placed in a shared folder so other members send it **under their own name and
branding**, without edit rights.

### SN-CONT-051 — Revocation is non-retroactive

Revoking removes it from others' lists and blocks new shares. **Links already sent keep working.**

> The correct semantic, and worth deciding deliberately rather than discovering after the first
> support ticket. Privyr states it explicitly in their UI copy and so should we.

---

## 7. Limits

| | Free | Pro | Business |
|---|---|---|---|
| Content items | 20 | unlimited | unlimited |
| Folders | 3 | 50 | unlimited |
| Labels | 5 | 50 | unlimited |
| Pages | 2 | unlimited | unlimited |
| File storage | 500 MB | 10 GB | 100 GB |
| Shared folders | ❌ | ❌ | ✅ |

---

## 8. Acceptance criteria

- `AC-CONT-005.1` — Given archived content with 12 minted links, when a recipient opens one, then it renders normally.
- `AC-CONT-006.1` — Given content referenced by an active sequence step, when deletion is attempted, then it returns `409` naming the sequence.
- `AC-CONT-011.1` — Given a message with `@leadName` and a lead whose name is later corrected, when a previously-sent link is opened, then the corrected name renders.
- `AC-CONT-011.2` — Given `@cf.budget` and a lead with no budget value, when rendered, then the token resolves to its default or empty — never the literal string.
- `AC-CONT-012.1` — Given a WhatsApp-destined template ending in `{{1}}`, when saved, then it returns `422` with the Meta constraint explained.
- `AC-CONT-020.1` — Given a 120 MB PDF, when signing is requested, then it returns `423 PLAN_LIMIT_REACHED` and no upload occurs.
- `AC-CONT-031.1` — Given a new block type seeded server-side, when the editor loads, then the block appears with no client deployment.
