# TASK-TL-005 — open points

What this slice could not close, and what would close it. Everything else it was asked for is built
and tested; the demo is in `TASK-TL-005-demo.md`.

## Attachments on a manual activity

SN-TL-012 wants up to 5 attachments per activity, 10 MB each, through the presigned upload described
in `05-api-design.md` §12. The composer has no file control and the write endpoint accepts no
attachment ids.

The table is there — `timeline_attachment`, with its own tenant scope and an index on
`(organization_id, timeline_event_id)` — so the storage side of the requirement is decided. What is
missing is everything above it: no bucket is configured, nothing issues a presigned URL, and no
endpoint records an upload against an entry. Building a file input against none of that would be a
control that cannot succeed.

**What closes it:** the presigned-upload endpoint from `05` §12, then a file control on the composer
that uploads before the activity is written and sends the resulting ids, and the card rendering them.
The 5-per-activity and 10 MB limits belong on the API, with the composer refusing early for the
message rather than for the enforcement.

## Two of the six states have no signal to drive them

SN-TL-025 lists six. The stream draws four — loading, empty (never contacted), empty (filtered),
error — through `DataSurface`, which is the same switch every other list screen uses.

The remaining two cannot be driven from what the timeline publishes:

- **Partial**, for a lead whose WhatsApp history is still importing. `DataSurface` has the state
  (`degraded`) and the timeline has nothing to put in it: the list meta carries pagination and
  nothing else, and Coexistence import does not exist yet to report phases from.
- **Permission-denied.** A lead outside the reader's scope answers `404`, not `403`, by the house
  rule that a cross-tenant read must not confirm the record exists. So the screen that a denied
  reader reaches is the not-found page, and `AccessWall` never renders here. This is the rule
  working, not a gap in the screen — recorded so the next reader of SN-TL-025 does not go looking
  for the state.

**What closes the first:** an import-progress block in the timeline list meta once Coexistence lands,
and the stream mapping it to `{ kind: "degraded" }`. The component already renders its children
underneath that notice, which is what the requirement asks for — honest that more is coming, while
showing what has arrived.

## The failure vocabulary covers what exists today

AC-TL-004.1 is met for WhatsApp error 131047, and `WHATSAPP_FAILED`, `CAMPAIGN_FAILED` and
`SEQUENCE_BROKEN` all render their reason through the same banner. The reasons themselves are only as
good as the catalogue they come from: `TimelineEntryPresenter::failureReason()` looks up
`timeline.failure.{code}` and falls back to `timeline.failure.unknown` for a code nobody has written
a line for — which is honest, and says nothing a rep can act on. Extending the catalogue is cheap and
belongs with whichever task first meets an unmapped code in the wild.
