# TASK-ARCH-020 — open points

What this task leaves open, and who closes it. This is the durable record of why the task closed
with criteria short of verified; it outlives the task and stays in the tree.

Two of the four acceptance criteria are met and demonstrated. **Criterion 1 is partial** — three
shapes of free text stay open and are described in §2, with the reason none of them is reachable
from a logger. **Criterion 3 is proven in-process and cannot be proven end to end here** — there is
no tracing backend to resolve an id in. Neither is a criterion that was narrowed to fit; both are
stated below as they were written.

---

## 0. Spec defect: criterion 4 contradicts SN-NOTIF-043

The criterion says a captured push payload contains **no lead name**. `SN-NOTIF-043`
(`docs/features/F17-notifications.md:165`) says a notification carries **the lead's name** and the
event type, and only forbids message bodies, phone numbers and email addresses.

Built to the strict reading — `App\DTOs\Notifications\PushPayloadDTO` carries identifiers and an
event type and has no field capable of holding a name. That satisfies the criterion and
`SN-PRIV-003` ("push notifications carry a reference, not content"), which is more general, is
normative, and is one of this task's own `spec_refs`. The display name is resolved client-side from
the reference.

**What closes this:** a decision on which document is right, and an edit to whichever is wrong.
`F17` is where the notification copy is specified, so if the name is to appear on a lock screen the
change lands there and `SN-PRIV-003` needs an explicit exception written into it. Until then the
payload is the strict one and `SN-NOTIF-043` is stale.

---

## 1. Criterion 3 is proven in-process and not end to end

> Every error response's `trace_id` resolves to exactly one trace spanning API + worker + outbound
> call legs.

**Proven.** `tests/Feature/Observability/TracePropagationTest.php` takes the `trace_id` out of an
error envelope and finds the same id on all three legs: the outbound call's `traceparent` header,
the queued job's log line after the request-scoped context has been flushed — so the payload is the
only route left — and every log line the whole exchange produced, of which there is exactly one
distinct id. `tests/Feature/Observability/SentryRedactionTest.php` adds the fourth: the error
tracker's event is on that trace rather than one of its own.

**Not proven, and environmental.** That the id resolves *in a tracing backend*. There is no
collector, no exporter and no dashboard, and no transaction is sampled until
`SENTRY_TRACES_SAMPLE_RATE` is set — it is documented in `.env.example` with what it costs and why
it is off. Setting it changes nothing on its own; the "one search" the requirement describes has
nowhere to happen until a collector exists. **`TASK-INFRA-008` owns that**, and it is the only thing
standing between this criterion and a demonstration.

**Correction to an earlier note in this file.** A previous revision said that nothing writes
`sentry-trace` or `baggage` into the queued job payload, and that turning the sample rate up would
therefore split the trace in two. **That is wrong, and it materially misdirected `TASK-INFRA-008`.**
`vendor/sentry/sentry-laravel/src/Sentry/Laravel/Features/QueueIntegration.php` registers a
`Queue::createPayloadUsing` callback whenever `sentry.tracing.queue_jobs` or
`sentry.tracing.queue_job_transactions` is on — **both default to `true`** in `config/sentry.php` —
and it writes `sentry_trace_parent_data` and `sentry_baggage_data` into every payload it builds. On
the worker side the same integration reads those two keys back and calls `continueTrace(…)`, so the
worker's transaction joins the trace rather than starting one.

The traceparent it writes carries *this application's* id, not one of the SDK's: with no span open,
`Sentry\getTraceparent()` falls back to the scope's propagation context, and `AssignTraceId` has
already set that context's trace id to the id in the error envelope.

So the propagation exists and `TASK-INFRA-008` does not have to build it. What that task still owns:
a collector to send to, a sample rate above zero, and the SDK booted on the worker — the payload
keys are only written when the queue integration is applicable, which needs a DSN.

**Untested here.** Nothing in this repository exercises the SDK's payload keys: the propagation the
suite proves is the framework context repository's, on a queue with no DSN and no sampling. The two
paths are independent and only one of them is under test.

---

## 2. Criterion 1: what is closed, and the three residuals in free text

> A log line containing a phone number, email, message body or OTP code has the sensitive value
> redacted, verified against real log output

**Structured fields are closed by construction.** A log record's `context` and `extra` are held to a
list of keys permitted in the clear, and everything else is replaced whatever its type. A value
written under a key nobody anticipated is therefore removed rather than logged, which is the point:
the previous design listed the keys to *deny*, and every key nobody thought of was a silent leak. A
developer who needs a new field in the clear sees a placeholder in their own log line and adds the
key to `config/redaction.php`; the failure mode is visible and recoverable in the direction it now
falls. ADR-0024 carries the decision.

**Free text stays on the patterns**, because prose has no key to reason about and holding it to the
same list would empty the log of the exception messages that make it worth keeping. Percent-encoded
values are matched on a decoded copy and cut out of the original bytes, so a value that reached a
query string as `%40` or `%2B` is removed without the escapes around it being unwound.

**Three shapes stay open. None of them is reachable from the logger**, and the first is the one that
matters.

### 2.1 A message body that has already become prose

`Log::info("lead said: $body")` and — far more importantly — `throw new RuntimeException("lead said:
$body")`, whose message lands in `context.exception.message` on the log side and in
`exception.value` in the error tracker's payload.

By the time either reaches a sink it is an arbitrary sentence. It has no key, no marker and no
shape, and no rule available at the logger can tell it from the exception text that is the reason
for keeping a log at all. The alternative — holding prose to the permitted list the way structured
fields are held to it — was considered and rejected: it blanks exception messages, SQL and route
names, and an operator who cannot diagnose a 500 is a worse outcome than the one being fixed.

What is built instead is a build-time rule, `tests/Unit/ArchitectureTest.php`, which fails on any
log call whose message argument holds a variable — interpolated, braced, concatenated, formatted or
passed by name. It is watched rejecting each of those and accepting `{placeholder}` interpolation,
which is the supported way to get a value into a message and goes through the redaction unharmed.

**The rule closes the log-call half of this shape and not the exception half**, and it has known
limits either way. It reads:

- the four directories that ship PHP — `app/`, `bootstrap/` (excluding the generated cache),
  `database/` and `routes/`. Nothing else, including `tests/` and `config/`;
- calls rooted at the `Log` facade in any spelling — bare, `\Log`, fully qualified, and an alias
  declared by `use Illuminate\Support\Facades\Log as …` — and at the `logger()` helper.

It does not see, and will not without becoming a different rule:

- **`throw new SomeException("… $var")`**, which is the shape that matters most and which lives in
  domain code nowhere near a logging call. Catching it means flagging every interpolated exception
  message in the codebase — a different rule with a different false-positive budget;
- **an injected PSR logger** — `$this->logger->info("… $body")` — or any other call rooted at a
  variable rather than at a name;
- **a logger resolved from the container**, `app('log')->info(…)`, `resolve(LoggerInterface::class)`;
- **the `logger()` helper renamed by `use function … as …`**;
- **a message assembled by a call rather than a variable**, `Log::info(self::describe())`.

A rule a leading backslash defeated has been closed. The rest are enumerated here rather than
guessed at, and each is an extension of the same predicate rather than a different design.

### 2.2 A one-time code with no label

`"sent 483920 to the lead"`. The code rule anchors on a label — `otp`, `pin`, `passcode`,
`verification`, `one-time password` — within ten characters of the digits, because a bare six-digit
number is any six-digit number: an order count, an amount in paise, a row id. Removing every four-
to-eight digit run would take those with it.

Under a key it does not arise; `otp`, `otp_code` and every key not on the permitted list are already
replaced.

### 2.3 A phone number split by exactly one dot, with nothing in front of it

`98765.43210`, `9876543.210`. Character for character the shape of a decimal number — `12345678.90`
is ten digits either side of one dot as well — and taking monetary values off the must-not-touch
list is the worse trade. The same form behind a dialling prefix, `+91.9876543210`, *is* removed,
because no amount of money is written with a leading `+`, and so is any run of three or more
dot-separated groups.

What would close it: a locale-aware number formatter at the call site. Not a regex.

### 2.4 What this adds up to

The criterion is met for every value that arrives under a key, and for the phone, email, one-time
code and bearer-token shapes that arrive in prose with something to anchor on. It is not met for
prose that arrived already assembled. **This is `PARTIAL` and it should be read as `PARTIAL`.**

**Accepted by the developer on 2026-08-05.** All three residuals above were put to the developer
with what each would cost to close, and the task was authorised to close over them. This is a
decision, not an oversight: none of the three is reachable from a logger, the closest thing to a fix
for 2.1 is already built as a build-time rule, and closing 2.2 or 2.3 by widening a digit rule costs
every one-time code, order count and monetary amount in the log. Reopening any of them is a new
decision and wants a new task, not a re-reading of this one.

`TASK-SEC-039` extends the same primitive to the channels a call site builds for itself and inherits
all three residuals unchanged; it closes none of them. The append-only event log is `TASK-TL-001`,
which comes after both and writes against the primitive rather than adding to it.

### 2.5 A fourth shape, recorded rather than open

A bare unix timestamp in free text — `1785312000` — is removed. Ten digits with nothing around them
is the shape the criterion requires be removed, and no rule tells one from a national mobile number.
This is a false positive in the accepted direction rather than a residual: nothing leaks, a
timestamp goes missing. Listed here because it has been reported twice as if it were a leak.

---

## 3. Seams built here, called by other tasks

- **`App\Support\Platform\RequestScope`** defines `organization_id` / `membership_id` and the
  ordering that puts them on a log line before `BindLogContext` closes the request. Nothing in the
  tree calls `bind()` yet, so the two keys never appear in a real log line today, which is the half
  of `SN-ARCH-050` still outstanding. `TASK-SEC-004` and `TASK-PERM-003` own resolving the tenant and
  the membership; both need to call it. The seam and its ordering are under test: one request binds a
  tenant and the next resolves none, and the second must not be logged under the first one's — which
  is the leak the clear exists to prevent and the assertion that fails when the clear is removed.

  `BindLogContext` runs **first** in the `api` group rather than last. It begins by clearing the
  two keys, so a resolver placed ahead of it would have had its work wiped; first in the group means
  everything that can resolve a tenant — the rest of the group, route middleware, the controller —
  runs after the clear. It cannot move to the global stack instead, because the route it records has
  not been matched there.
- **`App\Services\Notifications\PushPayloadFactory`** produces the payload; nothing delivers it. The
  provider port is `TASK-ARCH-019` and the channel is F17. `App\Models\Leads\Lead` implements
  `App\Contracts\Notifications\PushSubjectInterface`, which is how the producer reaches a record
  without the Notifications code importing another domain's model.

Both are deliberate and both are tested at the seam. Neither has a production caller, so neither is
exercised end to end by anything in this repository.

---

## 4. Channels and paths the redaction tap does not reach

- **`Log::build([...])`** constructed an on-demand channel from an array that never passed through
  `config/logging.php`, so it carried no tap. **Closed by `TASK-SEC-039`**, and without the
  `LogManager` override this file expected: the framework names that channel `ondemand` and looks
  its taps up by name rather than in the array it was handed, so a channel of that name in
  `config/logging.php` reaches it. `tests/Feature/Security/LoggerBypassTest.php` holds it.
- **The framework's emergency logger** is constructed without taps by design — it exists for the
  case where configuration cannot be read, which is exactly when a tap could not be resolved. It
  writes only Laravel's own "unable to create configured logger" line, which carries no application
  data.
- **The error tracker's platform blocks.** `contexts.os` and `contexts.runtime` are typed objects
  the SDK serialises straight into the payload without ever placing them among the event's context
  blocks, so the scrubber is never handed them. Nothing personal is in them; the operating system
  name, kernel string and PHP version go out as the SDK built them, and the kernel string includes
  the host name.

---

## 5. Deviations `TASK-ARCH-036` has to pick up

That task is `pending` and its description lists three deviations — the API envelope, module
boundaries and auth. **This task adds three more, and none of them is registered anywhere except
here.** A task's description is not editable from a fix round, so this list is the handover.

1. **`SN-ARCH-051` specifies OpenTelemetry; the build does not install it.** W3C Trace Context is
   propagated directly, using the `traceparent` header the requirement already names and the error
   tracker's own performance tracing. ADR-0023 carries the reasoning; the requirement text is
   unchanged and carries a note beside it.
2. **`BindLogContext` and `AssignTraceId` keep their names**, against the bible's `{Purpose}Middleware`
   suffix. `AssignTraceId` predates this task, sits in the same directory and solves the same
   problem; renaming one of the two would make the directory less consistent, not more.
3. **`PushPayloadDTO` has no `fromArray()`**, against the bible's rule that every DTO has one. A
   generic array constructor on a payload whose entire purpose is that it *cannot* carry a name is a
   hole in the guarantee that no test can watch: the field and reflection tests both check the
   constructor, and a `fromArray()` would let a caller in around them.

---

## 6. Decisions taken while building this

- **The logging classes live in `App\Support\Logging`, not `App\Logging`.** `app/Logging/` is
  Laravel's documented home for taps and formatters, but it is not in the bible's `app/` tree and
  every other directory in this repository is. `app/Support/` is where this repository already puts
  framework support classes, beside `app/Support/Security/` and `app/Support/Platform/`, both of
  which this change also touches. Consistency with the tree in front of us won. This is a choice
  within the standard rather than a deviation from it, which is why it is not in §5.
- **The trace id is written on two paths and both are kept.** `Log::withContext` puts it in a
  record's `context`, which is what a log-event listener reads; the context repository puts it in
  `extra`, which is the only one that survives serialisation into a job payload. Removing either
  loses a consumer, so both are written and a test asserts a record carries the same id in both
  places.
- **The redaction rules are three lists, and which list a structure gets is decided by who chose its
  keys.** A key a call site wrote is held to the list of keys permitted in the clear — a log record's
  context and extra; the error tracker's extra, tags, context blocks, span data and breadcrumb
  metadata, the last of which for a breadcrumb built out of a log call *is* that call's context; and
  **whatever a call site attached to the tracker's user object** beside the five fields the SDK
  defines. A key a library wrote keeps the forbidden-name list and the pattern scan — the URL, method
  and query string of a request, a stack frame, the normalised record — because an allow-list over
  those would blank the URL and the class names that are the reason a payload is worth receiving.
  Where the tracker files its own measurements under names of its own (`url`, `http.query`,
  `executionTimeMs`, `connectionName`), those names are on the permitted list individually.
- **A key that arrived off the wire gets a third list, and it is empty.** The body, headers and
  cookies of the request an event describes were on the call-site list until a fix round found what
  that meant: `route`, `notification`, `resource_type`, `op` and `version` are our own field names
  and a sender who used them as their own inherited permission written for something else. Two
  populations, two lists — the log-context list keeps its identifiers and the request keeps its
  shape and none of its values. `content-type` and `user-agent` are a real cost, paid the same way
  as before: the URL, method and query string carry the diagnosis and a field worth reading costs
  one visible line of config. The alternative had `x-api-key` shipping in the clear, because the SDK
  filters only the six names on its own `pii_sanitize_headers` default — `Authorization`,
  `Proxy-Authorization`, `Cookie`, `Set-Cookie`, `X-Forwarded-For`, `X-Real-IP`.
- **The tracker's user id goes past the patterns rather than onto a list.** Blanking it costs the
  field an engineer actually searches by; keeping it costs an address wherever an account is keyed
  by one. An integer or an opaque handle survives, an email-shaped id does not. `segment` is prose a
  call site chose and goes down the permitted list with the metadata.
- **Percent-encoded values are matched on a decoded copy and cut out of the original.** Only the
  offsets come back from the decoded copy. Writing the decoded copy back, which is what was built
  first, unwound every escape in the string: a logged URL stopped replaying, `%0A` became a real
  newline, and an encoded note turned into readable prose in the payload it was being removed from.
  The decode repeats until it stops changing, bounded, because one pass leaves `%2540` as `%40`.
  Nothing is discarded when the decoded bytes are not valid text — the guard that did that threw
  away the whole scan, so one stray `%FF` anywhere in a query string disabled encoded matching for
  the entire record.
- **The offsets are one entry per escape, not one per byte, and a string past a length is replaced
  unread.** The first build allocated an integer for every byte before it knew whether anything
  matched, which a single `%` anywhere in the string was enough to trigger: a megabyte carrying one
  `%20` cost 149ms and 26MB against 6ms and nothing without it, three times per record. Decoding
  shifts everything after an escape by two bytes and nothing else, so the table only needs the
  escapes. The length ceiling is the other half — the same bargain the depth limit makes, settled
  the same way, replacing rather than truncating because a value cut at a fixed offset leaves the
  half nothing matched.
