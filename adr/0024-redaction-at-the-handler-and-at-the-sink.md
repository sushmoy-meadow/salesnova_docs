# ADR-0024 — Personal data is removed in layers at each sink, and never at the call site

**Status:** Accepted · **Date:** 2026-08 · **Deciders:** Engineering

## Context

`SN-ARCH-050` and `SN-PRIV-002` both say the same thing in the same words: redaction happens at the
logger, not the call site, because a rule that depends on every developer remembering is a rule that
fails. That settles *where not* to put it. It leaves three questions that only turn up on contact
with Monolog and with the error tracker.

**Which layer of Monolog.** A processor can be pushed onto the logger or onto each handler. Laravel
pushes two of its own onto the logger: one interpolates `{placeholder}` values into the message, and
one merges the request-scoped context repository into `extra`. Both run before any handler is
reached, and both introduce values that were not in the record when it was created. Interpolation
also destroys the one thing free text can be recognised by: a body under a key named `body` is
recognisable, and the same body inlined into the message is not.

**Processors do not see everything.** A `Throwable` handed to the logger as a context value is still
an object when the last processor has run — the formatter unpacks it, and its message routinely
carries the thing that failed to send: an address, a number, a body.

**The error tracker does not go through Monolog at all.** It builds events from the exception, the
request and the scope, and it turns every log call into a breadcrumb off the event the logger fires
— the raw side, before Monolog has touched the record.

## Decision

**Two rules, and three gates per sink plus a fourth for the error tracker.**

**Which rule a structure gets is decided by who chose its keys**, and that is the only test applied.
A key a call site wrote is held to a list of keys permitted in the clear. A key a library wrote is
held to a list of forbidden names and a pattern scan.

**A structured field whose keys a call site chose is held to a list of keys permitted in the
clear.** A value under any other key is replaced whatever its type. This is deliberately the inverse
of a list of forbidden names: a forbidden-name list is only as good as the imagination of whoever
wrote it, and the developer who logs a body under a key nobody thought of gets a leak that nothing
reports. Which is the rule both requirements exist to forbid, wearing a config file. Inverted, the
same mistake produces a placeholder in that developer's own log line, and the fix is one line of
config.

That covers a log record's `context` and `extra`; the error tracker's `extra`, `tags`, context
blocks, log attributes and span data; a breadcrumb's metadata, which for a breadcrumb built out
of a log call *is* that call's context and would otherwise reach the tracker by a route the log
never took; and whatever a call site attached to the tracker's user object beside the five fields
it defines.

**A structure keyed from off the wire gets the same rule against a list of its own, and that list
is empty.** The body, the headers and the cookies of the request an event describes are the case:
the SDK builds the request block, but it fills `data` from the **parsed request body** — its default
`max_request_body_size` is `medium`, not off — and copies `headers` verbatim, so the field names in
both were chosen by whoever sent the request. They cannot share the list above, because the names on
it are *ours*: `route`, `notification`, `resource_type`, `op` and `version` mean a route name, a
notification type and a version string when our own code writes them, and mean whatever the sender
decided when a request body carries them. A body of `{"route": "Raj Kumar", "notification":
"Interested, please call after six"}` inherited permission meant for our fields and went out whole.
An allow-list only fails safe while the key space belongs to us, so the two populations get two
lists, and the one for names picked at the other end of a connection permits nothing: the shape of
the request still reaches the payload and every value in it is replaced. Shrinking the list above to
accommodate them would have cost the log lines their identifiers to fix a problem the log lines do
not have.

`setUser(['id' => …, 'org' => …])` is a third shape again: the SDK defines `id`, `email`,
`username`, `ip_address` and `segment`, and everything beside them is metadata a call site named.
`segment` is prose a call site chose to group accounts by, so it goes down the permitted list with
the metadata. `id` does not: blanking it costs the single most useful field on an event, and keeping
it in the clear ships an address whenever an account is keyed by one. It goes past the patterns
instead — an opaque handle comes back whole, an email-shaped one does not, and an integer id is
returned untouched because a number cannot be an address.

The permitted list is the identifiers a support ticket is traced by, the measurements of the work,
and the names the error tracker files its own measurements under — the query's connection and
duration, the outbound call's URL, query, method and status. Those last ones are named individually
rather than let through by category, so a breadcrumb keeps what it exists to report while the SQL
bindings and the notified party beside them do not. Arrays are descended into rather than replaced,
so a permitted identifier is still reached under a container nobody listed; a list inherits the key
it hangs from, because its elements have no name of their own and an unnamed value cannot be vouched
for. Booleans and nulls pass unfiltered — neither can encode a name, a number or a body. A permitted
key admits a value, not an object graph: anything that is not a scalar is replaced, so a model
handed to the logger under `id` cannot arrive as the row. The single exception is a throwable, which
is passed on whole because the sink below unpacks it into strings and scans those.

**Free text is held to patterns**, because it has no key to reason about. The message, an unpacked
throwable, a stack frame's source and a span's description are scanned for shapes and nothing else,
and that is a deliberate limit: an allow-list over prose would empty the log of the exception text
that is the reason for keeping it.

**The pattern scan runs twice over anything holding a `%`**: once on the string as written, and once
on a decoded copy, because percent-encoding is how a value reaches a query string and `%2B` in the
middle of a number defeats every rule that follows. Only the *offsets* come back from the decoded
copy — the placeholder is cut into the original bytes, so the escapes around a match survive and a
logged URL still replays. Writing the decoded copy back instead, which is what was built first, both
destroyed that and turned an encoded note into readable prose in the payload it was being removed
from. The decode repeats until it stops changing, bounded, because one pass leaves `%2540` as `%40`.
Nothing is discarded when the decoded bytes are not valid text: the earlier guard against that threw
away the whole scan, so a single stray `%FF` anywhere in a query string disabled encoded matching for
the entire record.

**What comes back from the decoded copy is one entry per escape, not one per byte.** The first
build kept an integer for every byte of the string so any match offset could be looked up directly,
and paid for it whether or not anything matched: a megabyte carrying a single `%20` cost 149ms and
26MB against 6ms and nothing for the same megabyte without it, and the sinks below apply this three
times per record. Percent-decoding shifts everything after an escape by two bytes and nothing else,
so the whole map is recoverable from the position of each escape and how far the original has run
ahead by then — a table sized by the escapes actually present, searched only for the spans that
actually matched. The common case, where nothing matches, now allocates nothing.

**A string past a configured length is replaced rather than scanned.** Scanning costs time in
proportion to length, it happens on every line every worker writes, and a megabyte of SQL or
response body is not worth a third of a second of it. This is the same bargain the depth limit
makes on the other axis, and it is settled the same way: past the bound, the placeholder. It is not
truncation — a value cut at a fixed offset leaves the half that no rule matched, which is the
failure this exists to prevent. The ceiling sits well above any line written on purpose, so what it
catches is the accident.

**A short list of forbidden names survives, for the structures a library builds out of its own
observations** — the URL, method and query string of a request, a stack frame and its variables, the
tracker's four defined user fields, and the normalised log record. Those keys come from the framework
or the SDK rather than from a call site, so the failure mode above does not arise, and an allow-list
over them would blank the URL and the class names that make an event worth receiving. A forbidden
name takes its whole subtree with it, so a list of addresses under `email` cannot survive by being a
list.

One processor class carries both rules, attached in three places by a tap the channel declares in
`config/logging.php`.

1. **On the channel**, where it lands ahead of Laravel's placeholder substitution. This is the only
   point at which a value still has the key it was written under, so it is the only point at which a
   body about to be inlined into the message can be recognised at all.
2. **On every handler**, which is downstream of every logger processor and travels with the handler
   object when another channel borrows it. This one is depth rather than reach, and the file says so
   because an earlier revision claimed otherwise: the framework pushes its context processor *after*
   the tap has run and a stack channel copies its children's processors along with their handlers,
   so gate 1 already covers both of the cases this was written for, and nothing in the suite fails
   when gate 2 is taken out. It stays because neither of those framework behaviours is ours, a
   stack is the default channel, and the cost of a second pass over an already-scanned record is a
   microsecond. A test writes a body through a stack under a key the list does not permit, so the
   day either behaviour changes, that fails rather than leaking.
3. **On the normalised record inside the formatter**, which is where an unpacked throwable first
   becomes strings. The formatter keeps the throwable's frames, which Monolog omits by default and
   which are the only thing mapping a 500 to a call site when no error tracker is configured; they
   are scanned with the rest of the record. The scan runs over the record's values rather than over
   the serialised line: a rule matching a run of digits cannot tell a quoted string from a bare
   numeric literal, and rewriting the latter leaves an entry nothing can parse and no trace can be
   correlated from.
4. **`before_send`, `before_send_transaction`, `before_breadcrumb` and `before_send_log`** on the
   error tracker's client, installed by extending the container's client builder. Not declared in
   `config/sentry.php` because they are closures and a config file holding one cannot be cached.
   The transaction callback reaches the event's spans as well as its own fields: a span names the
   work it timed, which for a query is the statement and for an outbound call is the full URI, with
   the query string and fragment beside it in the span's data.

Every channel that writes somewhere declares the tap. `stack` does not, because it fans out to the
handler objects its child channels already built. A test enumerates the resolved channel list and
fails on any that writes without declaring it — the framework merges its own defaults underneath the
application's config, so a channel nobody wrote down is still reachable by name.

The rules themselves — placeholder, patterns, all three key lists, depth, length — live in `config/redaction.php`
and are tested against the shipped file rather than a fixture, so a rule weakened in config fails the
suite rather than passing a test that describes rules nothing uses.

## Consequences

- **A call site cannot opt out, and does not have to opt in.** Redaction is a property of the sink.
- **A new field costs a line of config, and costs it visibly.** Logging under a key that is not on
  the permitted list writes a placeholder. That is the trade being made: the cost lands on the
  developer who added the field, in their own log line, at the moment they look at it — rather than
  on whoever eventually reads the log and does not know a value was ever there.
- **The permitted list has to stay short to mean anything.** A field belongs on it because it
  identifies a request or measures one, not because a leak made someone impatient. Everything else
  is logged by id.
- **False positives are the accepted direction of error.** A ten-to-fifteen digit run is replaced
  whether or not it was a phone number, and a key named `name` is replaced whether it held a
  person's name or an organisation's. Both are recoverable by an engineer; the other direction is
  not.
- **An IPv4 address in prose survives, and the rule says so rather than happening to.** An earlier
  revision of this file claimed the survival came free from the dot rule needing two-to-five digit
  groups. That was true of `127.0.0.1` and `203.0.113.42` and of nothing else: `192.168.100.200`,
  `104.244.42.129` and `255.255.255.255` have no short octet in them and all three were being
  replaced whole, while the only address the suite asserted was the loopback one that happened to
  work. The dot rule now refuses to start on four groups that are each a valid octet, and the full
  range is asserted — unspecified, loopback, both private forms, public, documentation and
  broadcast. The exclusion is exactly four groups wide: `999.888.777.666` is not an address,
  `192.168.100.200.250` is not four groups, and both are still replaced, as is `415.555.0132`.
  Losing the address a request came from is a diagnostic cost on any log and a compliance one on an
  access log, which is why it is worth a longer rule. Under a key none of it arises: `ip_address` is
  a forbidden name, and the error tracker's reporting address is dropped outright.
- **A bare unix timestamp in prose does not survive, and cannot.** `1785312000` is ten digits with
  nothing around it, which is character for character a national mobile number — the shape the
  criterion requires be removed. There is no rule that keeps one and drops the other, and narrowing
  the digit rule to spare it would open the shape the requirement names. Under a key it is a
  question about the permitted list, not about the patterns. This is the accepted direction of error
  again, and it is written down here so the next reader does not spend the afternoon on it.
- **How a number is typed does not decide whether it is removed.** The phone rule tolerates spaces,
  dashes, brackets, slashes and the two non-breaking spaces a pasted number arrives with, because a
  number written by a human arrives grouped and a rule that only sees an unbroken run is a rule with
  a spelling exemption.
- **One dot between two runs of digits is not enough to act on — unless a dialling prefix precedes
  it.** `98765.43210` is a phone number and `12345678.90` is an amount of money, and they are the
  same string shape, so the bare form is left alone and in free text that is a leak this design does
  not close. Three or more dot-separated groups are treated as a number, because nothing legitimate
  is written that way. So is any dotted run behind a leading `+`, because no amount of money is
  written with one. Under a key none of it arises — the permitted list has already replaced the
  value by then.
- **Correlation identifiers survive.** The digit rules are bounded on both sides, and letters, colons
  and slashes are not separators, so they cannot eat the digits out of a trace id, a span id, a UUID,
  a URL path or a timestamp — including the space-separated `Y-m-d H:i:s` form, where a colon is the
  only thing that ends the run. A log nobody can correlate is its own kind of failure, and every one
  of those shapes is asserted.
- **A reporting IP address is dropped, not replaced.** The error tracker's user object validates the
  address it is given and answers an unparseable one by keeping the address already there, so the
  placeholder would have left the original in place. It is the one field the scrubber removes rather
  than overwrites.
- **A request's body, headers and cookies reach the tracker as placeholders**, because the list for
  names picked off the wire is empty. The URL, the method and the query string carry the diagnosis
  instead; a field worth reading costs a line of config, visibly, like any other. The keys and the
  nesting survive, so the payload still says what was sent, just not what was in it.
- **A user id that is an email address is removed and the account with it.** Systems keyed by email
  lose the identifier off their events, which is the trade: the alternative is an address on every
  event those systems raise. An id that is an integer, a UUID or any opaque handle is untouched.
- **The platform blocks are not reachable from here and do not need to be.** `contexts.os` and
  `contexts.runtime` are typed objects the SDK serialises straight into the payload; they never
  appear among the event's context blocks, so the forbidden name `name` never meets them and the
  operating system and PHP version stay readable.
- **Stack frame source context is scanned too.** Source lines are code rather than runtime data, so
  this is defence in depth rather than a leak being closed, and the cost is that a code line
  containing a long digit run reaches the error tracker with a hole in it.
- **Two holes remain, both structural.** A channel built by `Log::build()` at runtime never consults
  the configuration and so has no tap; and the framework constructs its emergency logger without
  taps, by design, because that logger exists precisely for when configuration cannot be read.
- **One residual the logger cannot reach, closed above it instead.** A body concatenated into the
  message string at the call site arrives with no key and no shape, and nothing at the logger can
  tell it from ordinary prose. So the shape that produces it is forbidden where the string is built:
  a log message must be a literal, and a test over the source of `app/` fails on any log call whose
  message argument holds a variable — interpolated, concatenated or formatted. The value goes in the
  context array instead, where the permitted list already applies. This is the one rule here that a
  developer can see before it fires, and it is enforced by the build rather than by review, which is
  the distinction both requirements actually draw.
- A record's message is never held to the permitted list — it is prose by definition and the list
  would blank every line. It goes down the pattern side instead. A *context* key called `message` is
  a different thing and gets no such exemption.
- The append-only event log is a separate sink and is `TASK-SEC-039`'s to attach; it uses the same
  primitive.

## Alternatives

- **One processor on the logger alone.** It cannot see a value a handler-level processor introduces,
  and it cannot see an unpacked throwable at all.
- **The formatter alone.** It is downstream of interpolation, by which point a body has lost the key
  that was the only thing identifying it.
- **A pattern pass over the serialised line.** Cheap, and wrong: the patterns match runs of digits,
  a serialised line contains bare numeric literals, and replacing one puts a placeholder where JSON
  requires a number. The entry stops parsing and its trace correlation is lost silently.
- **A list of forbidden key names, and nothing else.** What was built first, and it failed the way
  such a list always fails: `text` was on it, `text_body` was not, and a body written under the
  second went out whole. Every round of that argument buys one more name and loses the next.
- **The permitted list over everything, prose included.** It removes exception messages, SQL and
  stack frames, which are what a log is read for. A log nobody bothers to keep is not a safer log.
- **Scrub at the call site, enforced by review.** What both requirements exist to forbid. Forbidding
  a *shape* at the call site is a different thing: it asks nobody to remember which values are
  sensitive, and it fails the build rather than a reviewer's attention.
- **Deny-and-scan for the error tracker's context blocks, tags and breadcrumb metadata**, which is
  what was built first. It failed the same way the log side's deny list did: `setContext('lead',
  ['blurb' => …])` and `setTag('blurb', …)` both went out whole, and those keys come from a call
  site, not from the SDK.
- **Deny-and-scan for everything the SDK assembled, on the theory that the SDK chose the keys.** The
  same failure again, one layer out: a request's parsed body and its headers are inside a structure
  the SDK built out of names the *caller* picked, and `data.comment`, `data.otp_value` and the
  header `x-api-key` all shipped in the clear while the log sink was removing the identical field
  names. The SDK filters six header names of its own and a custom credential header is on none of
  them.
- **One permitted list for both key spaces**, which is what the previous revision shipped once the
  request body was moved onto the allow-list at all. It closed the leak that was reported and left
  the one nobody had posted yet: five of the names on that list describe *our* fields, and a sender
  who used any of them as a field name of their own was permitted by a rule that had vouched for
  something else entirely.
- **Holding the request body to keys plus a pattern scan** rather than a list of its own. It is
  weaker where it matters: a name is the thing most often posted and the thing no pattern can see,
  so `{"route": "Raj Kumar"}` survives a scan intact. The narrow list refuses it without having to
  recognise it.
- **Truncating an over-long string instead of replacing it**, to keep the front of a long query
  readable. The cut lands mid-value as often as not, and the fragment left behind is the part no
  rule matched — a partial address is still an address.
- **Let the error tracker's own `send_default_pii => false` cover it.** That option governs what the
  SDK attaches on its own initiative. It says nothing about an exception message, a breadcrumb built
  from a log call, or anything the application put on the scope.
