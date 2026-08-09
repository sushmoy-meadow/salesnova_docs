# ADR-0012 — Server-sent events, not WebSockets

**Status:** Accepted · **Date:** 2026-07 · **Deciders:** Engineering

## Context

Three surfaces need real-time delivery: an inbound WhatsApp message appearing on the timeline within
5 seconds, a content-view alert, and lead assignment. All are server-to-client. None requires the
client to push.

The delivery budget is tight ([`10`](../10-nfr-security-compliance.md) §SN-NFR-003) and our users
are on mobile networks that drop connections routinely.

## Decision

**Server-sent events over HTTP, with channels scoped per membership and authorised on connect.**

## Consequences

- Automatic reconnection with `Last-Event-ID` is part of the protocol rather than something we
  implement and get subtly wrong. On a patchy 3G connection this is the property that matters most.
- Plain HTTP: it traverses corporate proxies, mobile carrier proxies and CDNs that mishandle
  WebSocket upgrades.
- No separate real-time server, no separate scaling story, no second authentication path.
- We accept: one-way only, and a browser per-domain connection limit under HTTP/1.1 — not a
  practical constraint over HTTP/2, which we serve.
- Client writes go over normal HTTP requests, which is where they belong anyway. Nothing in the
  product needs a persistent upstream channel.

## Alternatives

**WebSockets.** Justified by typing indicators, presence or collaborative editing. We have none of
those, and adopting a bidirectional transport for a unidirectional problem buys a scaling and
operational burden with no corresponding capability. Revisit if a genuinely bidirectional feature
appears.

**Polling.** Simplest, and it cannot meet a 5-second budget without a request rate that is wasteful
on both our infrastructure and the user's data plan — which in this market is a real cost to them.
