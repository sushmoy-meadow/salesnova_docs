# TASK-LEAD-017 — open points

Task: **Build lead table view** (frontend, size M). **Status: `done`.** The one formal acceptance
criterion and the description's substance are built and tested; both gates are green. The items below
are deliberately-deferred scope and decisions, each with what would close it.

## Acceptance criterion — covered

- **"/leads/table is the route a user lands on by default"** — `/leads` now redirects to
  `/leads/table` (`src/app/(app)/leads/page.tsx`; `welcome` already sends dismissed users to `/leads`,
  and `grid-width-guard` already falls back to `/leads/table` under `lg`). Tested by
  `src/app/(app)/leads/page.test.ts`.

## Description substance — covered

- **Compact, mobile-first list over `POST /api/v1/leads/query`** — `LeadTable` (row renderer) +
  `LeadTableScreen` (client screen reusing `useLeadListState` + `fetchLeadQuery` + the six-state
  `DataSurface`). It stacks on a phone and never scrolls sideways.
- **Contact actions per row (SN-LEAD-020)** — each row renders the channels the lead can be reached
  on via the shared `actionableChannels`/`hrefFor` helpers (`Call`/`WhatsApp`/`Email`/`SMS`), WhatsApp
  leading. Tested in `lead-table.test.tsx`.
- **New-lead badge per row (SN-LEAD-020..024)** — a `New` Badge renders when `row.isNew`. Tested.

## Backend change made while building the frontend

`POST /leads/query`'s `LeadQueryRow` carried no contact endpoints, so per-row contact actions were
impossible. Extended `LeadQueryRowDTO` + `LeadQueryService` to select and return `email`,
`phone_e164`, `whatsapp_e164` (the Lead model already had the columns; used in search). Pest test
added (`LeadQueryEngineTest` — "returns the contact endpoints each row can be reached on"), contract
regenerated, backend gate green. Mirrors the LEAD-015 precedent for a frontend-driven backend field.

## Decisions taken, and why

- **Per-row contact uses the shared channel helpers, not the `<ContactActionBar>` component.** That
  component is detail-screen chrome — `sticky top-0 z-30 … sm:static`, `lg` buttons — and would break
  stacked once per row. The table renders the same resolved channels at `sm` size in a plain
  per-row `<div role="group">`. The shared link-list body is noted for extraction in ISS-039.
- **The New badge renders but does not auto-clear on dwell.** `NewLeadDwell` marks one viewed lead
  seen after a 2s stay; firing it for every visible new row would clear the whole queue on a glance.
  Clearing stays the lead **detail** screen's job (where `NewLeadDwell` is already wired).
- **`currentMembershipId` is an empty stub**, as in the grid — nothing publishes the signed-in member
  yet, so the "me"/"unassigned" assignee filters cannot resolve. Comes alive when a bootstrap member
  is available; same deferral the grid carries.

## Deferred scope

1. **View tabs / saved-view toolbar / filter UI** are not rendered on the table (nor on the grid
   today). `useLeadListState` already reads view/filters/saved-view from the URL and `meta.counts`
   rides in every response (SN-LEAD-012), so wiring a shared tab/filter bar is a follow-on that
   belongs to the saved-views work (SN-LEAD-011), not this renderer.
2. **Settings-driven contact channels.** `LeadTable` takes an `options` prop (the same seam
   `ContactActionBar` exposes) but defaults to `DEFAULT_QUICK_CONTACT_OPTIONS` until the
   personalisation read is wired.

## Related issues

- **ISS-039** — the contact-action link list is duplicated between the detail bar and the table row;
  extract a shared `ContactActionLinks` when a third consumer appears.
