---
doc: F07-sharing-and-tracking
status: REVIEW
owner: Product + Engineering
area_code: SHARE
depends_on: [04-domain-model, 05-api-design, F06-content]
---

# F07 — Sharing & View Tracking

The recipient-facing half of the product. A lead who never logs in still interacts with SalesNova:
they open a tracked link, and that view drives the rep's alert, the "Recently active" list and
every engagement metric in the app.

**This document is the most prescriptive in the set.** Privyr's implementation was captured end to
end against a throwaway account, and it contains six defects that materially corrupt the numbers
the product is sold on. Every one is specified as fixed here, with the observed behaviour cited so
the reasoning survives after this doc is old.

---

## 1. Minting a link

### SN-SHARE-001 — One link per (content, lead)

```
POST /api/v1/shares   {"content_id": "…", "lead_id": "…", "channel": "WHATSAPP"}
```

**Unique on `(content_id, lead_id)`.** Minting is idempotent: a second call returns the same
`share_code` with `is_new: false`, increments `share_count`, and **preserves accumulated view
stats**.

> Verified against Privyr: calling `generate-page` twice for the same pair returned the same code,
> share history stayed at 1, and the accumulated 1 view / 55 s survived. This is correct and worth
> stating explicitly — a rep who re-sends a brochure must not lose the evidence that the lead
> already read it.

### SN-SHARE-002 — The link identifies the recipient

Attribution is by URL. No cookie, no fingerprint, no login on the recipient side.

**Consequence, which must be stated in the product, not just in this document:** the link is a
**bearer credential**. Anyone the recipient forwards it to views as that recipient, and their dwell
time is attributed to the lead.

The share UI **MUST** surface this once, plainly, at first use. It is a real property of the design
and users should learn it from us rather than from a confusing analytics row.

### SN-SHARE-003 — Codes are opaque and high-entropy

`share_code` is 12 characters from a 58-character URL-safe alphabet. Random, never sequential,
never derived from any internal id.

> ⚠️ **Privyr defect 5.** They return `hitcountPK: 6749871` and `hit_id: 3829825` to the
> recipient's browser — global auto-increment counters. Two requests a day apart give any outsider
> their platform-wide daily share and view volume. **Nothing a recipient's browser can see may be
> sequential.**

### SN-SHARE-004 — URL structure

```
https://{org-slug}.mdw.link/t/{slug}/{share_code}
```

| Property | Rule |
|---|---|
| Domain | Short branded per-org subdomain; custom domain on Business |
| Fallback | Platform default when white-label is unconfigured |
| `slug` | Cosmetic and readable; **carries no authority** |
| Canonical | `share_code` alone resolves; the slug may be wrong or absent |

**One path order. Everywhere.** Privyr has two — `/t/{slug}/{page_code}` in the public URL and
`/share/t/{page_code}/{slug}` in the `uri` field — reversed relative to each other, on the same
record.

### SN-SHARE-005 — Render-time personalisation

Tokens resolve when the page renders, not when the link is minted. The `<title>` is personalised
too. A lead's corrected name appears in a link sent last week.

### SN-SHARE-006 — Revocation

A share **MAY** be revoked. A revoked link returns `410 Gone` with a neutral "no longer available"
page — never an error, never a leak of what it used to be.

Deleting the content invalidates every link minted from it. The confirmation says so with counts
([`F06`](F06-content.md) §SN-CONT-006).

### SN-SHARE-007 — Channels

WhatsApp · Email · SMS · Telegram · Copy link · QR code.

Default per `org_preferences.default_share_channel` (default `WHATSAPP`). The share sheet
pre-fills the `DEFAULT_SHARE` message for that content type, editable before sending.

**Acceptance criteria**

- `AC-SHARE-001.1` — Given a share with 3 views and 90 s, when the same content is shared to the same lead again, then the code is unchanged, `share_count` is 2, and the view stats are intact.
- `AC-SHARE-003.1` — Given 10 000 minted codes, when examined, then no ordering, prefix or arithmetic relationship exists between them.
- `AC-SHARE-006.1` — Given a revoked share, when opened, then `410` and a neutral page with no content metadata.

---

## 2. The viewer

### SN-SHARE-010 — Separate deployment

The viewer is a separate application on a separate domain, sharing nothing with the CRM bundle.
Server-rendered, minimal JavaScript, fast on a 3G connection.

### SN-SHARE-011 — Zero third-party trackers ⚠️

The viewer **MUST NOT** load any third-party analytics, advertising or session-recording script.
No exceptions, no configuration option to add one.

> **Privyr loads eight, verified in an anonymous run:** Facebook Pixel, TikTok Pixel, LinkedIn
> Insight, Microsoft Clarity, GA4 (two properties), Google Ads conversion, FullStory, Cloudflare
> RUM — because the viewer inherits their *marketing site's* stack.
>
> Every lead who opens a tracked link is fingerprinted by seven ad networks on our customer's
> behalf, on a page the lead never consented to. In the EU and UK that is a consent violation
> regardless of the rep's own privacy policy; under India's DPDP Act it is processing without
> notice. It is also simply not our customers' intent — they wanted to know if the brochure was
> opened, not to feed a lead's browsing profile to TikTok.
>
> This is a genuine competitive differentiator with enterprise and regulated buyers, and it costs
> us nothing.

### SN-SHARE-012 — Branded

Sender's logo, colours, name, photo and contact details. "Powered by SalesNova" unless white-label
is enabled.

### SN-SHARE-020 — The viewer is a callback surface

Click-to-call, click-to-WhatsApp and click-to-email buttons back to the **assigned rep** (not the
org) **MUST** be present and prominent on every viewer page.

> This is the point of the whole feature. It is not a document host. The single most valuable event
> in the product is a lead tapping "WhatsApp" from inside a brochure they are actively reading.

Every click writes a `CONTENT_CTA_CLICKED` event and triggers a real-time rep notification.

### SN-SHARE-013 — Performance budget

| | |
|---|---|
| LCP on 3G | < 2.5 s |
| Total JS | < 50 KB gzipped |
| Images | Responsive, lazy, WebP with fallback |
| Works without JS | Content renders; only tracking is lost |

---

## 3. View tracking — the mechanism

**Two independent signals: the view, and the duration.** Both require JavaScript, and that fact
determines the accuracy of everything downstream. It must be understood, not glossed.

### SN-SHARE-030 — Engagement gate before recording a view ⚠️

A view **MUST NOT** be recorded on page load. One of the following **MUST** occur first:

| Gate | Threshold |
|---|---|
| Dwell | ≥ 3 s **visible** (`document.visibilityState === 'visible'`) |
| Scroll | Any scroll event |
| Interaction | Any click, tap or keypress |

Whichever fires first registers the view.

> ⚠️ **Privyr defect.** They register a hit **500 ms after `DOMContentLoaded`** — no scroll, no
> dwell, no interaction. Page load *is* a view. That inflates open rates, and more damagingly it
> makes "opened" mean nothing: the rep gets an alert, calls the lead, and finds they never actually
> looked at it. An engagement gate is the difference between a signal and a number.

### SN-SHARE-031 — Prefetch and bot filtering ⚠️

The ingest endpoint **MUST** reject:

- Known bot and link-preview user agents (WhatsApp, Slack, Telegram, Twitterbot, Facebook, Discord,
  iMessage)
- Requests carrying `Sec-Purpose: prefetch` or `Purpose: prefetch`
- Requests exceeding a per-`share_code` rate limit
- Requests from known security-scanner ranges (Safe Links, URL Defense, Mimecast)

Rejected requests are logged with the reason, never counted.

> Privyr is protected from the common case **by accident, not by design**: fetching the viewer with
> a `WhatsApp/2.23.20.0 A` user agent returns `200` and the complete HTML including tracking
> scripts — there is no bot check at all. It only fails to count because the fetcher does not
> execute JavaScript.
>
> That protection evaporates against any JS-rendering scanner. Microsoft Safe Links and Proofpoint
> URL Defense both render pages — so a corporate lead's IT department opening the brochure counts
> as the lead opening the brochure, complete with dwell time. **Do not inherit this by omission.**

### SN-SHARE-032 — Duration: visibility-aware, idle-capped delta chunks

```
Accrue only while document.visibilityState === 'visible'
Pause after 30 s with no interaction (idle cap)
Report every 5 s, and on pagehide / visibilitychange→hidden
Each report carries only the delta since the last CONFIRMED report
Send via navigator.sendBeacon
```

**Duration measures visible, non-idle time — not wall clock.** A lead who opens a brochure and
walks away for ten minutes contributes 30 s, not 600. This is correct, and it should be documented
in the product's own help text so nobody misreads the number.

### SN-SHARE-033 — Flush on `pagehide`, never `unload` ⚠️

```js
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flush();
});
// 'unload' MUST NOT be used.
```

> ⚠️ **Privyr defect 1.** They use `window.addEventListener('unload', logTimeSpent)`. `unload` does
> not fire reliably on mobile Safari or Android Chrome — **precisely their audience**. The final
> partial chunk is silently lost, and if the tab is killed from the app switcher the whole tail
> goes. Their own captured session shows the `unload` flush carrying 10 of 55 recorded seconds;
> on a mobile browser that entire 10 s would have vanished.

### SN-SHARE-034 — Advance the watermark only on confirmed ingest ⚠️

The client **MUST NOT** advance `last_reported` until the server confirms receipt. A chunk
**MUST NOT** be sent without its `view_id`. If the view has not yet registered, duration is
**buffered locally** and flushed once it has.

> ⚠️ **Privyr defect 2, and the worst one.** Their `logTimeSpent` sends the beacon *before*
> checking `hitCountRegistered`, then returns early without advancing `LAST_REPORTED_TIME_SPENT`.
> So while the hit registration is failing or slow — it retries every 5 s — every subsequent tick
> re-sends the **cumulative** total: 5, 10, 15, 20…
>
> Worse, `HIT_ID` is `undefined` at that point, so `JSON.stringify` **drops the key entirely** and
> those beacons arrive unattributed. Any that the server does eventually attribute inflate the
> duration quadratically. On a flaky mobile connection — the normal case for this audience — the
> duration figure is not merely noisy, it is systematically wrong in the upward direction.
>
> `sendBeacon` returns only a boolean queue acknowledgement, so "confirmed ingest" requires a real
> response. Use `fetch(..., {keepalive: true})` for the periodic reports and reserve `sendBeacon`
> for the final flush, where a lost confirmation costs one chunk rather than compounding.

### SN-SHARE-035 — Floor, don't round ⚠️

Durations **MUST** be floored to whole seconds.

> ⚠️ **Privyr defect 3.** `.toFixed()` with no argument rounds, so a 4.5 s chunk reports 5 s. Over
> a long session with 5 s cadence the bias is consistently upward.

### SN-SHARE-036 — Distinguish "no data" from "zero" ⚠️

`duration_seconds = NULL` means **no duration data was received**.
`duration_seconds = 0` means **measured, and it was zero** — a genuine bounce.

The UI renders them differently: "duration not recorded" versus "opened briefly".

> ⚠️ **Privyr defect 4.** Their `> 1` guard drops 0 s and 1 s chunks entirely, so a bounce records
> a view with `viewed_duration: 0` — indistinguishable from a view whose beacons all failed. Those
> are opposite facts: one means the lead glanced and left, the other means we do not know.

### SN-SHARE-037 — Per-view records, not counters

Every view is a row: `viewed_at`, `duration_seconds`, `device_type`, `country_code`, `ip_hash`,
`user_agent_hash`, `is_engaged`, `beacon_count`.

Aggregates are derived. **IP addresses are hashed, never stored raw.**

### SN-SHARE-038 — Server-side dedup window

Reloading the same link within **30 s** extends the existing view rather than creating a new one.
Prevents a page refresh from reading as two views.

> Privyr's behaviour here is unknown — the recon lists it as an open question. Specify it rather
> than leave it to emerge.

**Acceptance criteria**

- `AC-SHARE-030.1` — Given a page loaded and closed after 1 s with no scroll or interaction, when the session ends, then no view is recorded.
- `AC-SHARE-031.1` — Given a request with a WhatsApp link-preview user agent, when the viewer is fetched, then the page renders and no view is recorded.
- `AC-SHARE-033.1` — Given an Android Chrome session ended by the app switcher, when stats are read, then the final partial chunk is present.
- `AC-SHARE-034.1` — Given a view-registration request that fails 4 times then succeeds, when stats are read, then the duration equals actual visible time ±2 s, not a multiple of it.
- `AC-SHARE-036.1` — Given a view where every beacon failed, when the row is read, then `duration_seconds` is `NULL`, not `0`.

---

## 4. Owner exclusion

### SN-SHARE-040 — Omit instrumentation, don't filter afterwards

When the content owner or any member of their organisation opens the link, the server **MUST NOT
RENDER** the tracking scripts at all. Exclusion happens at render time, not by filtering later.

> Adopted from Privyr, and a genuinely good decision — verified in the recon, their two renders
> differ in the HTML itself. Filtering afterwards means the events exist in the pipeline and every
> downstream consumer must remember to exclude them. One of them eventually won't.

### SN-SHARE-041 — Detect by more than session

Detection **MUST** combine:

1. Active CRM session on the same browser (Privyr's only mechanism)
2. A signed `viewer_context` cookie set on the share domain when a logged-in member last minted or
   opened a link
3. IP match against the org's recent authenticated request IPs, within 24 h

> Privyr excludes by session only, and their own modal copy admits it: *"sometimes we can't tell if
> it is you or your client opening the link."* A rep opening their own link in a private window, on
> their phone, or after their session expires **will** inflate their own stats.

### SN-SHARE-042 — Tell the user plainly

An owner opening their own link sees a clear notice: this view was not counted, and the lead will
not see this message.

> Privyr's modal does this well, including the honest hedge. The pattern — **enforce what you can,
> then plainly tell the user what you can't** — is worth copying along with the mechanism. It is
> also a nudge that reduces the false positives the technical guard can't catch.

---

## 5. Where views surface

### SN-SHARE-050 — Five surfaces, one event

| Surface | Behaviour |
|---|---|
| **Real-time alert** | Push + in-app to the assigned rep, within 5 s |
| **Lead timeline** | `CONTENT_VIEWED` inline with calls and notes |
| **Recently active** | Lead list sorted by `last_content_opened_at` |
| **Content stats** | Per-asset performance across recipients |
| **Sequence break** | A view can satisfy a break criterion ([`F08`](F08-sequences.md)) |

### SN-SHARE-051 — The alert is actionable

The notification names the lead and the content, and deep-links **to the lead with the message
composer open**. Not to a stats page.

> The lead is reading the brochure right now. Every tap between the notification and the message is
> a tap the rep might not take.

### SN-SHARE-052 — Stat vocabulary

`TOTAL_SHARED` · `TOTAL_OPENED` · `TOTAL_UNOPENED` · `VIEWED_RECENTLY` · `VIEWED_MULTIPLE_TIMES`

`TOTAL_UNOPENED` is the work queue. `VIEWED_MULTIPLE_TIMES` is the buying signal.

### SN-SHARE-053 — Duration detail is plan-gated; the view is not

Every plan sees **that** a lead opened content, in real time. Duration detail and the per-view
breakdown are Pro.

> The open event is the hook, and it is free. Privyr gates the whole thing behind
> `CONTENT_TRACKING_CLIENTS_ACCESS`, which means a free user never experiences the moment that
> sells the product.

---

## 6. API

```
POST /api/v1/shares                                  mint (idempotent)
GET  /api/v1/shares/{id}/views                       per-view rows
POST /api/v1/shares/{id}/revoke
GET  /api/v1/content/{id}/analytics                  aggregates
GET  /api/v1/leads/{id}/shares                       what this lead received

# Public — separate deployment, no auth
GET  /public/v1/share/{code}                         viewer payload + tracking config
POST /public/v1/share/{code}/view                    engagement-gated registration
POST /public/v1/share/{code}/beacon                  duration delta
POST /public/v1/share/{code}/cta                     CTA click
```

### SN-SHARE-060 — Consistent types and names

| Rule | |
|---|---|
| Durations | Integer seconds. Never a pre-formatted string. |
| Device | `device_type`, holding a `DeviceType` enum |
| Ids | `share_id` and `content_id` mean exactly what they say |
| Unknown enum | `400`, never `500` |

> ⚠️ **Privyr defect 6.** `user_agent` holds a `DEVICE_TYPE` enum. `type_specific_data.template_id`
> holds the *share* id while `content_id` holds the template id. `opened_duration` is `"55s"` in
> one endpoint and a raw integer in two others. An unknown `ITEM_TYPE` returns `500`. Their tier-1
> and tier-2 stats endpoints are keyed on **opposite** ids — pass the wrong one and you get a
> silent `{"count": 0}` rather than an error. Every one of these is an hour someone loses.

---

## 7. Delivery checklist

- [ ] Idempotent minting on `(content_id, lead_id)`, preserving stats
- [ ] Opaque high-entropy codes; **nothing sequential reaches a recipient**
- [ ] Branded short domain per org; custom domain on Business
- [ ] Single canonical URL path order
- [ ] Render-time token substitution
- [ ] Separate viewer deployment, **zero third-party trackers**
- [ ] Callback CTAs prominent on every viewer page
- [ ] **Engagement gate** — 3 s visible, scroll, or interaction
- [ ] **Bot and prefetch filtering** on ingest
- [ ] Visibility-aware, idle-capped delta chunks
- [ ] **`pagehide` + `visibilitychange`, never `unload`**
- [ ] **Watermark advances only on confirmed ingest**; no chunk without a view id
- [ ] Floor, don't round
- [ ] `NULL` duration distinct from `0`
- [ ] Per-view rows with hashed IP
- [ ] 30 s reload dedup window
- [ ] Owner exclusion at render time, by session + cookie + IP
- [ ] Honest "you clicked your own link" notice
- [ ] Real-time alert deep-linking to the composer
- [ ] `TOTAL_UNOPENED` as a first-class stat
- [ ] Integer durations, consistent id naming, `400` on bad enums
