# TASK-ARCH-019 — open points

Six ports exist, five are bound from configuration, and no adapter implements any of them. What that
does and does not prove is worth stating rather than letting a green suite imply more than it does.

---

## 1. What each criterion rests on

**"Each of the six ports exists … with no vendor SDK type in its signature"** is two tests. One names
all six fully qualified and fails if any stops existing — a directory scan would simply stop looking.
The other reads every `use` under `app/Contracts` and fails on anything outside `App\`, which is
stricter than the criterion: a framework class is refused too, because a port is called from a queue
worker and a console command where there is no request to accept.

**"Bindings are resolved from config via a `match()`"** is proved negatively, since no arm can name an
adapter yet. Setting a port's config key to an unknown driver and resolving it produces an error
naming that key and that driver; leaving the key unset produces a different one. Both messages come
from the resolver, so the config value demonstrably reaches it.

**"Swapping a provider binding is a config change, verified by binding a stub … with zero code
changes to callers"** is proved through `tests/Fixtures/Providers/PortConsumer.php`, a class that
constructor-injects all six ports and is never edited between resolutions. Two different stubs are
bound for the same port in one test and the consumer receives each in turn.

## 2. Method surfaces are partial, on purpose

The spec sketches three of the six in full: eleven methods on the WhatsApp channel, eight on
payments, three on the LLM. Between them they name around twenty payload types — `WhatsAppAccount`,
`SendResult`, `Subscription`, `Money`, `Prompt` — none of which exist and all of which belong to
modules built in G2, G3 and G4. Declaring them now means inventing twenty shapes without the domain
knowledge the owning task will have, and then having them rewritten.

So a port declares only what can be typed today, and nothing declared contradicts the sketch. What is
outstanding, by owner:

- `TASK-WA-006` — `createOnboardingSession`, `completeOnboarding`, `syncContacts`, `requestHistory`,
  `sendMessage`, `sendTemplate`, `submitTemplate`, `getHealth`.
- `TASK-BILL-003` — `createCustomer`, `createSubscription`, `updateSubscription`,
  `createCheckoutSession`, `createOneTimeCharge`, `getPaymentMethod`.
- `TASK-AI-007` — `complete` and `stream`, and the `Prompt`, `LlmOptions` and `LlmResponse` types
  both need. That task is ready and unblocked; this one deliberately did not do its work.

`TASK-INFRA-005` owns the storage adapter and per-tenant key prefixes; nothing here presumes a
prefix scheme.

## 3. Decisions taken where the task was silent

**A webhook arrives as a decoded payload, not a request object.** Both spec sketches take
`Illuminate\Http\Request`. Ingestion persists the raw payload before anything parses it and the parse
then runs on a queue, where the request is gone. Typing the port on it would also be the only foreign
import in `app/Contracts`, which is the rule that makes "no vendor SDK" checkable without maintaining
a list of vendors.

**No driver is defaulted.** A default of `meta` or `razorpay` would quietly settle two open
commercial questions — the WhatsApp provider decision is `TASK-HARDEN-011` and still open. A build
that has not chosen fails the first time it resolves the port.

**Refusal is at resolve time, not at boot.** A deployment that never touches WhatsApp does not have
to name a WhatsApp provider to start.

**`NotificationChannelInterface` takes the existing `PushPayloadDTO`.** Every channel carries the
same minimal content — ids and an event type, never a name or a body — so a second identical DTO
would be duplication.

## 3a. What the review pass changed

- **The six resolvers folded to a shared helper for the config lookup and the two refusals**, keeping
  a per-port `match` for the drivers. Each port's config path had been spelled three times.
- **`LeadSourceParserInterface` was removed from the container.** Its own docblock said parsers are
  selected per source and several are live at once, which the one-driver-per-port binding
  contradicts; the first adapter would have had to undo the mechanism rather than add an arm to it.
  The port still exists and is still a port — it simply has no configured driver, and the registry
  that resolves parsers by source belongs with the first two of them.
- **A redundant test was deleted.** `PortConsumer` declares all six as required constructor
  parameters, so a successful resolution already proves each is an instance of its interface; a
  second test asserting exactly that could not fail once its own setup had succeeded.

## 3b. What the review pass declined

- **Renaming `PushPayloadDTO` to something transport-neutral** now that a second channel will
  implement the port. Fair on the name, but it is another module's shipped type with two live
  consumers, and the email channel that would justify it does not exist. It belongs with that work.
- **Moving `UnconfiguredProviderException` out of `app/Exceptions`** because that directory otherwise
  holds the API error catalogue. `app/Exceptions` is where a Laravel exception goes; the class
  docblock already says why it is not an `ApiException`, and a subdirectory for one file buys nothing.
- **Returning DTOs instead of `array<string, mixed>` from `parseWebhook`.** The normalised event shape
  is the ingestion task's to define, and defining it here is the same guesswork as §2.

## 4. Not built here

- **Every adapter.** No implementation of any of the six exists, so nothing in the tree resolves a
  port outside its own test.
- **The lead-source parser registry.** See §3a.
- **A static-analysis gate on vendor imports outside adapters.** The rule here covers
  `app/Contracts`; `TASK-AI-007`'s second criterion asks for the wider check, across the whole tree.
