# TASK-DESIGN-007 — open points

`ContactActionBar` is built and unit-verified: `src/components/contact/contact-action-bar.tsx`, with
its behaviour covered by `contact-action-bar.test.tsx` and the F18 settings boundary covered by
`src/lib/contact/contact-channels.test.ts`. One clause of the first acceptance criterion cannot be
closed here, for want of a surface to close it against.

## AC1's "above the fold on lead detail" has no lead-detail screen to sit on

The criterion reads *"above the fold on lead detail at every breakpoint, and sticky-bottom on
mobile."* The half this component owns is tested by class token in the component test.

> **Superseded by [ADR-0074](../adr/0074-the-mobile-contact-bar-pins-to-the-top-because-the-foot-is-the-tab-bars.md).**
> When TASK-LEAD-007 first rendered the bar on a real lead-detail screen, `sticky bottom-0` was found
> not to pin from its position high in the page, and the mobile foot was already the fixed `BottomNav`'s.
> The bar now carries `sticky top-0 … sm:static` — it holds at the viewport top through a long
> timeline and folds into flow from `sm` up — and the component test asserts `top-0`. Read the
> "sticky-bottom" wording below as "pinned on mobile"; the direction is the ADR's.

*Above the fold on lead detail* is a placement, not a property of the component — it is decided by the
page that renders the bar, and there is no such page. `src/app/(app)/leads/[leadId]/` holds only a
`timeline/` route; the lead-detail screen (`[leadId]/page.tsx`) is unbuilt. Nothing in this repo
imports `ContactActionBar` yet.

That screen is also where the bar's two data props are filled:

- `contact` — the lead's `tel:` / `mailto:` / WhatsApp / Telegram endpoints, from the lead-detail
  response (TASK-LEAD-004 contract, `done`).
- `options` — the team's ordered, toggled quick-contact buttons, read from the F18 settings
  (`SN-SET-020`, external write) and parsed through `quickContactOptionsSchema`.

**What closes it:** the lead-detail screen task. When it lands, it renders `<ContactActionBar>` at the
top of the lead pane, passing the parsed settings and the lead's endpoints, and its own screen test
carries the above-the-fold placement — the one assertion this component cannot make about itself.

## A channel enabled in settings but unreachable on the lead is omitted, not disabled

A deliberate call, not a gap. `actionableChannels` drops a toggled-on channel the lead carries no
endpoint for rather than rendering a dead button. SN-DS-033 fixes the four canonical channels and
their distinction (WhatsApp leads) but says nothing about a channel with nowhere to point; an
unreachable button that dials nothing reads as broken, so a shorter bar wins. Recorded here because it
is a visible behaviour a reviewer might expect to be a disabled state instead.
