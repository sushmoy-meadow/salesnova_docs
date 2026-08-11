# ADR-0053 — The server sends the instant, and the reader owns the zone

**Status:** Accepted
**Date:** 2026-08-10

## Context

The product launches in English, in India, and intends to add Hindi, Bahasa and Vietnamese. It also
intends to sell to organisations whose salespeople are not all in one country. Both of those are
cheap to build for now and expensive to retrofit, because the retrofit is not a feature — it is
finding every sentence, every date and every phone number already written into a hundred call sites.

Three questions had to be answered before anything else was built on top of them.

**Where a user-facing sentence lives.** Every `ApiException::make()` in the tree carried its message
as a string literal beside the error code. That reads fine and it is unfindable: there is no list of
what the product says, so there is nothing to hand a translator and nothing to review for tone.

**Who chooses the zone a date is read in.** A server that formats a date has already picked one. The
client cannot undo it — there is no way to recover an instant from `10 August, 3:00 pm` without
knowing which zone wrote it, and by then the information is gone.

**Where a member's zone and language come from.** A membership had neither. The organisation has a
timezone, detected at signup from its country. That is right for a company with one office and wrong
for the first one that hires somebody abroad, which is a customer we intend to have.

## Decision

**Sentences live in `lang/en/errors.php`, keyed by error code.** A call site passes
`__('errors.seat_limit_reached')` or a nested key where one code covers several distinct problems —
`errors.membership.transfer_ownership_first` and `errors.membership.choose_reassignment` are not the
same thing to the person reading them, though both are an invalid transition. `ErrorCode::
defaultMessage()` reads the catalogue and falls back to its own constant name with the underscores
taken out, so a code added without an entry degrades to something readable rather than to the key.
An architecture test greps for a literal beside an error code, and a test walks every case of the
enum and asserts the catalogue answers.

**API responses carry the instant.** `toIso8601String()`, always with the offset, never a
`->format()` call inside a DTO or a Resource — also greped for. Rendering is the client's, which is
where the reader's preferences are known.

**A member's `timezone` and `locale` are nullable, and null is the answer, not a gap.** Null timezone
means the organisation's; null locale means the language the application ships in. Callers read
`effectiveTimezone()` and `effectiveLocale()` rather than the columns, so the fallback cannot be
forgotten at one call site and honoured at another.

The locale chain skips the organisation deliberately. The organisation has a timezone because its
country was detected at signup and a country is a zone; it has no language for the same reason a
country is not one, and the first organisation that wants a second language will be asking for
per-member choice anyway, not a company-wide switch.

**Phone numbers are stored E.164 and displayed through `PhoneNumber`**, our own value object over
`giggsey/libphonenumber-for-php-lite`. The library is the only sane way to know that a number is
real, which country it belongs to and how that country writes it; the wrapper exists because we need
two verbs, and a package that also brings a cast, a validation rule and a facade brings three more
places for a phone number to be handled differently. Parsing answers null rather than throwing — an
unreadable number is a field somebody has to fix, not an exception every caller has to catch on the
way to saying so.

**Money is held in minor units and displayed through `Money`,** which knows two currencies. Indian
grouping is not thousands all the way up, and `₹12,34,567.89` is not something to hand-roll or to get
wrong in front of a customer. A third currency is a decision, so an unknown one throws rather than
quietly falling back to dollars.

## Consequences

A translator can be handed one file. Adding a language is a second directory under `lang/`, not an
audit.

A member in New York and a member in Bengaluru reading the same lead see the same instant written
two ways, and neither of them had to be asked their zone at signup — a required field there collects
whatever the fastest signup guessed, and a wrong zone is worse than an absent one.

The catalogue can drift from the tone the product wants without any test noticing; only its
existence is checked, not its wording. That is the right trade for now and the wrong one once there
is a second language, because a key present in English and missing in Hindi will answer with the
English sentence rather than failing.

Nothing yet reads a member's locale to choose a translation, because there is only one. The column
and the fallback exist so the second language is a `lang/` directory and a setting, not a migration
during a rollout.

`ext-intl` is now a hard requirement, declared in `composer.json`. It is present in the standard PHP
image and in CI; a host without it fails at install rather than at the first invoice.
