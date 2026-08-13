# TASK-LEAD-007 — open points

The slice's demo criterion is met and its acceptance criteria are covered (see
`TASK-LEAD-007-demo.md`). Three parts of the fuller screen composition in SN-LEAD-021 cannot be closed
here, each for want of something a done upstream task did not ship. None of them is the demo criterion,
which asks for a lead *created, edited and re-read* — exercised through the notes field, which is
writable end to end.

## The info block is only partially inline-editable — most fields have no route to edit through

SN-LEAD-021 describes the info block as inline-editable across *display name, phone, WhatsApp, email,
custom fields, stage + time-in-stage, groups, notes*. The independent per-cell PATCH routes that back
inline editing (TASK-LEAD-004, `done`) exist only for **assignee, stage, groups, follow-up, notes and
custom fields** — there is no cell route for `name`, `display_name`, `phone_e164`, `whatsapp_e164` or
`email`. So the lead's identity and contact fields have nowhere to write to, and the detail screen
renders them read-only.

Of the routes that do exist, only stage and (now, this slice — see ISS-033) notes are implemented on
the server; groups and follow-up still answer 501. So the info block's editable surface today is
notes and stage, not the eight fields SN-LEAD-021 lists.

**What closes it:** cell routes for the identity/contact fields — phone and WhatsApp through the same
`PhoneNumber` parse and contactability rules `LeadWriter::create` already enforces, so an inline edit
cannot leave a lead unreachable or store an unparseable number — plus the server implementations of
the groups and follow-up cells (ISS-033). Belongs with TASK-LEAD-004's contract and TASK-LEAD-018's
grid, not invented mid-slice here.

## The collapsed source section cannot show the structured `source_payload`

SN-LEAD-021's Source section is *"where it came from + structured source_payload, collapsed."* The
detail screen collapses the source and shows the `source` label (e.g. "MANUAL"), but not the payload:
`LeadDTO` publishes `source` and not `source_payload`. The column is persisted verbatim on create and
kept apart from notes (AC-LEAD-005.1, tested) — it simply is not on the read model, so the client has
nothing to render.

**What closes it:** expose `source_payload` on `LeadDTO` (a keyed map; mind the empty-map-as-`[]`
seam that bit ISS such that a list encodes wrong — box it as an object), then render it as a
definition list inside the existing collapsed `<details>`. The DTO is TASK-LEAD-004's.

## The web app hand-writes the lead-detail schema rather than deriving it from the generated types

`src/lib/leads/lead-detail.ts` carries a `leadDetailSchema` written by hand against the published
contract, per [ADR-0068](../adr/0068-the-web-app-reads-the-contract-at-runtime-and-never-imports-it.md)
(the app imports nothing from the API checkout). That is the intended pattern, not a gap — recorded
only so the next reader does not "fix" it into a compile-time import of `contracts/api-types.ts`. If
the two drift, the seam tests catch it; the schema is the client's own boundary and stays that way.
