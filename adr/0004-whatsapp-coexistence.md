# ADR-0004 — WhatsApp Coexistence as the channel strategy

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Founders

**This is the most consequential decision in the product.**

## Context

Privyr won by being the shortest path from a Facebook Lead Ad to a WhatsApp message sent from the
rep's own number. That architecture — the rep's own number, not a Business API number — is still
right for this market, and it is why Privyr's customers tolerate a mediocre CRM.

It has one blind spot: **the product cannot see the conversation.** Everything after "message sent"
is invisible, so the CRM stays a manual filing cabinet. The rep sends from WhatsApp, the reply
arrives in WhatsApp, and the CRM knows nothing about either.

Four conventional options were considered and rejected (see below).

Meta's **Coexistence**, rolled out in May 2025, removes the blind spot: a number can run on the
WhatsApp Business app and the Cloud API simultaneously, with messages mirrored both ways.

## Decision

**WhatsApp Coexistence is the primary channel architecture.** The rep keeps their number, keeps
their phone, keeps their habits — and the CRM sees every message in both directions.

Click-to-chat remains as a fallback, so the product works completely without Coexistence.

## Consequences

**What it unlocks**

- Automatic activity logging with no data entry. The single largest reason CRMs fail in this segment
  disappears.
- A conversation corpus that becomes the AI moat ([ADR-0007](0007-ai-substrate-first.md),
  [`11`](../11-ai-substrate.md) §1). No competitor has this by shipping a feature; they have to
  build the same thing and then wait.
- Response-time metrics that are real rather than self-reported.
- Economics that favour us: inbound, app-sent echoes, service-window replies, contact sync and
  history sync are **all free**. Only API-initiated templates are billable
  ([`F12`](../features/F12-whatsapp-coexistence.md) §8).

**What it costs**

- Hard constraints we must design around, not hide: 5 msg/sec throughput · the business must open
  the WhatsApp Business app every 13 days or the connection degrades · **companion devices
  (WhatsApp for Windows, WearOS) get unlinked** · no OBA badge · no WABA migration · several message
  types do not sync ([`F12`](../features/F12-whatsapp-coexistence.md) §2).
- The 13-day requirement makes **health monitoring a launch blocker**, not a feature
  ([`F12`](../features/F12-whatsapp-coexistence.md) §6).
- A dependency on Meta's roadmap for a recent, still-evolving capability — hence mandatory
  re-verification before implementation and quarterly thereafter ([OD-3](../13-open-decisions.md)).
- A provider decision, deliberately deferred behind `WhatsAppChannelProvider`
  ([OD-1](../13-open-decisions.md)).

## Alternatives

**Cloud API with a dedicated business number.** The standard approach. Rejected: it takes the number
away from the rep. In this market the relationship is personal, the customer has the rep's number
saved, and messages from an unfamiliar business number get ignored. This is precisely what Privyr
avoided, correctly.

**Click-to-chat only, like Privyr.** Ships fastest. Rejected: it reproduces the blind spot, which
means reproducing the manual filing cabinet — and there is no reason for a customer to switch.

**WhatsApp Web automation / unofficial libraries.** Bans the customer's number. Not viable at any
scale, for anyone.

**Both, as separate products.** Two channel architectures, two support burdens, and a choice the
customer is not equipped to make at signup.
