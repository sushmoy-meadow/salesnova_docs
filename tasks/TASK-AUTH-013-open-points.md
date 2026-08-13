# TASK-AUTH-013 — open points

What this slice could not close, and what would close it. Everything else it was asked for is built
and tested; the demo is in `TASK-AUTH-013-demo.md`.

## Four of the seven activation conditions cannot yet answer truthfully

SN-AUTH-041 names seven tasks. Three of them are decided by data that exists — a lead, a contact
event on a timeline, a sent invitation — and each is answered by the domain that owns it through the
`activation.signals` port, so Identity never reaches into another module's tables.

The other four have nothing to read:

| Task | What would decide it | State |
|---|---|---|
| `connect_whatsapp` | A connected WhatsApp Business account on the organisation | The channel feature is unbuilt; no table records a connection |
| `connect_lead_source` | A configured, enabled lead source | Sources are unbuilt |
| `create_first_content` | One content item owned by the organisation | Content is unbuilt |
| `share_content_with_lead` | A share, or a `CONTENT_SHARED` timeline event | Both unbuilt |

An unanswered key reads `false`, which is not a placeholder — it is the truthful answer while the
feature does not exist, because an account genuinely has not connected WhatsApp. So the checklist is
correct today and will stay correct: the numbers only understate what a future account will have
done, never overstate it.

**What closes it:** each domain registering an `ActivationSignalProvider` in its own service provider
when it lands, tagged `activation.signals`, answering for its own key. No change to Identity, the
endpoint, the DTOs or the widget — the reader already merges whatever the tag yields, and
`ActivationChecklistTest` already proves an unanswered key reads `false` rather than throwing. The
three built providers are the worked example.

## The demo could not tick a lead-created item through the web app

"Add your first lead" is derived from a real `lead` row, and the derivation is exercised both ways in
`ActivationChecklistTest` — creating a lead ticks it, deleting the lead unticks it again. What the
browser could not do is create that lead from the UI: the web app has `/leads/grid`,
`/leads/duplicates` and `/leads/{id}/timeline`, and no create-lead control on any of them. The demo
ticked `send_first_message` instead, through the TL-005 composer, which exercises the same path end
to end.

**What closes it:** the lead create screen — the same work as ISS-016, which is the missing `/leads`
home the checklist's own CTA points at.

## Whether the widget appears anywhere but `/welcome`

SN-AUTH-040 and the IA (`03-information-architecture.md:133`) place the checklist on `/welcome`,
"persistent until dismissed or complete", and that is what this slice built. Whether the same widget
should also sit on the leads home once that exists — a smaller, collapsed form — is not decided
anywhere in the spec tree, and nothing here forecloses it: `ActivationChecklistWidget` takes its
loaders as props and holds no route knowledge.

**What closes it:** a decision, not code. If it is wanted in a second place, the widget mounts there
with the same two server actions and the same query key, and the two copies stay in step because they
share the key.
