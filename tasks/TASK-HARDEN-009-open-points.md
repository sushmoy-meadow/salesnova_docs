# TASK-HARDEN-009 — open points

Both acceptance criteria are tested here. Two items in the task's description belong to a repository
this one cannot reach, and one of the two criteria has a half that does.

## The Devanagari-capable font stack is the Next.js repos'

The description asks for a font stack that can render Devanagari ahead of the Hindi rollout. There is
no font stack in an API — nothing here renders a glyph. It belongs with the design tokens in
`salesnova_frontend`, alongside the Tailwind theme that `TASK-DESIGN-001` configured.

**What would close it:** a frontend task that adds a Devanagari-covering family to the token set,
declares it in the `font-sans` stack after the Latin face, and subsets it so the Hindi build does not
ship the whole range. Worth naming there rather than leaving to the language rollout, because a
missing glyph is discovered in production by the first Hindi-speaking customer.

## "Every UI date display honours the viewing member's locale/timezone" — the UI half

This repo owns the contract half of that criterion, and it is tested: responses carry ISO-8601
instants with an offset, an architecture rule stops a DTO or Resource formatting one, and every
membership answers with a resolved `timezone` and `locale` — the member's own, or the organisation's
zone and the application's language.

Rendering those preferences is the client's. Nothing here can assert that a lead card shows
`3:00 pm` to a member in Bengaluru and `5:30 am` to one in New York.

**What would close it:** a frontend task that formats every date through one helper taking the
bootstrap payload's membership zone and locale, plus a test that renders the same instant under two
zones and asserts two different strings. Until then the guarantee stops at the response body.

## The catalogue's coverage is checked; its wording is not

`LocalisationTest` walks every `ErrorCode` case and asserts the catalogue answers, so a code cannot
ship without a sentence. Nothing checks that the sentence is any good, or that two codes have not
been given contradictory advice.

That is acceptable while there is one language and one writer. It stops being acceptable at the
second language, where a key present in `lang/en` and missing in `lang/hi` falls back to English
silently — a half-translated screen rather than a failure. A key-parity test across locale
directories is the thing to add with the first translation, not now, because with one directory it
asserts nothing.

## No caller formats a phone number or a sum yet

`PhoneNumber` and `Money` are covered by their own tests and used by nothing else, because the lead
and billing endpoints that will hand them a number and an invoice total are not built. They were
built now rather than with their first caller so that the first caller does not hand-roll a format
and set the precedent — but they are, today, a floor with nothing standing on it.

**What would close it:** the first lead-detail response to carry `phone_display`, and the first
subscription response to carry a formatted amount, both going through these rather than around them.
