# TASK-ARCH-013 — open points

Written 2026-08-11. The task is **`done`**: both gates green, the demo run and recorded in
`TASK-ARCH-013-demo.md`, every acceptance criterion verified. Nothing is committed.

Four things below could not be closed here. None blocks the slice; each names what would close it.

---

## 1. There is no WhatsApp health warning, because there is no messaging domain

The criterion lists four warning producers: expiry, payment failure, WhatsApp health, seat limits.
Three are built and live — `SubscriptionWarningProducer` publishes all three through the single
channel. The fourth has nothing to read: no messaging domain exists yet, so there is no quality
rating, no template rejection and no disconnected account to warn about.

Stubbing it would have put a banner on screen that no server state can raise or clear. Instead the
warning *shape* is proven end to end: `shell.test.tsx` renders a `WHATSAPP_HEALTH` warning through
the same component as the other three and asserts they share one implementation.

**Closes when** the WhatsApp domain lands (`F09`). A new class implementing `ShellWarningProducer`,
tagged `shell.warnings` in `AppServiceProvider`, is the whole change on the shell's side — the
assembler folds the tagged iterable and knows nothing about which domains exist.

## 2. `counts` can be up to five minutes stale, and no header says so

`ShellStateObserver` watches the models the *shape* of the shell depends on — subscription, feature
flag, override, membership. It deliberately does not watch leads or follow-ups. A member who works
through their overdue queue will see the badge keep its old number until the payload's 300-second
TTL expires.

That is a real staleness, and it was a choice: registering the observer on `Lead` would drop the
whole assembled payload on every lead edit, which is most writes in the product, and the cache would
stop being a cache. The acceptance criterion names plan changes and flag rollouts for the stale
header, and both of those invalidate correctly.

**Closes when** either the counts move out of the cached payload onto their own short-lived key, or
the follow-up and lead domains publish an event the shell can subscribe to cheaply. Worth deciding
before the badge is load-bearing for anybody's working day.

## 3. `activation.completed` is always `0`

`total` is real — the count of seeded `ActivationTaskDefinition` rows — and `is_dismissed` is real.
The completed count is not: deriving which activation tasks a member has finished is `TASK-AUTH-013`,
and reading it from anywhere else would be guessing.

**Closes when** `TASK-AUTH-013` lands. `IdentityProgressReader::activation` is the one method to
change.

## 4. `inbox.unread` is not published, so the Inbox item carries no badge

Same reason as §1: nothing counts unread conversations. The navigation item is published with
`badge_source: null`, which the web app renders as a destination with no number — correct today,
rather than a zero that would read as "nothing waiting".

**Closes when** the messaging domain publishes a counts provider. Tagging it `shell.counts` and
setting the item's `badge_source` in `NavigationBuilder` is the whole change.

---

## Noted, not open

- **`/` is still the marketing splash, and sign-in lands there.** `APP_PATH` in
  `src/app/login/login-actions.ts` sends a verified member to `/`, which is the public page. The
  authenticated shell lives under the `(app)` route group, and `/leads/grid` is the only screen
  inside it so far. Deciding what a signed-in member should land on is a product question, not this
  slice's.
- **The lead grid still fails to load inside the shell.** It calls its endpoint with
  `currentMembershipId=""`, hardcoded before anything published a membership id. Now that the
  bootstrap payload carries one, the fix is available — but a layout cannot pass props to a page, so
  it needs either a context provider or the page reading the session itself. Pre-existing, and
  visible in the demo screenshot.
- **`signup-request.ts` sends `captcha_token: null` too**, the same way the login request did before
  this slice fixed it. Not changed here because it is another task's code and no demo exercised it.
