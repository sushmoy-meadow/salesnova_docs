# TASK-AI-018 — open points

Both acceptance criteria have tests behind them. What follows is what this repo could not close,
and what would close it.

## 1. Owner-only access cannot be enforced here yet — and this is the important one

The criterion says "**Owner** can toggle org AI off". Nothing in this repo can tell who is asking.
There is no session, no current user, no role and no capability endpoint: the only `cookies()` reader
in `src/` is `signup-session.ts`, a pre-account cookie scoped to `/signup` carrying no user id, no
org id and no role; `proxy.ts` does not cover `/settings`; no request in the app sends an
`Authorization` header; and `/login` is linked from `deep-link.ts` but does not exist. The
`role_preset` on an invitation is presentational by spec and explicitly not authority.

So `/settings/ai` renders its toggle to anyone who reaches the URL, and the toggle is the org-wide
one. What *is* built is the reactive half, which is the honest one and arguably the right one
permanently: the settings fetch keeps its failure code, and a `FORBIDDEN` / `INSUFFICIENT_ROLE`
response renders the permission wall through `DataSurface`'s `denied` state rather than being
collapsed into "try again later". The server is the authority either way.

**Closes when:** the session/membership work lands (TASK-AUTH-*) and there is a viewer to ask about.
The remaining piece is then a route-level guard so a member never reaches the screen at all, rather
than reaching it and being refused by the API.

## 2. Nothing calls `AiFeature` yet

`AiFeature` is the gate every AI entry point is meant to be built through, and today the only things
rendering it are its own tests. "Every AI entry point disappears" is proven against two
representative controls built through the gate, which is the strongest claim available before any AI
feature exists — but it is not the same as the claim holding across a real screen.

**Closes when:** the first AI capability ships (TASK-AI-019 onward). The test to add then is that the
real entry point is inside an `AiFeature`, not that it happens to disappear.

## 3. The AI settings endpoints do not exist

`GET`/`PATCH /v1/organization/ai-settings` are consumed but unbuilt — TASK-AI-011 is the backend
side. The zod schemas here are this repo's half of the contract and are tested against the payload
shape they expect; the field names (`provider_healthy`, `period_label`, `by_capability`, spend and
cap in **minor units**) are a guess that the backend task should be held to or should correct.

Until it lands, the page renders its degraded surface and the toggle reports that it could not save.
That path is tested.

**Closes when:** TASK-AI-011 ships and the two field lists are reconciled.

## 4. `src/lib/auth/api-envelope.ts` is now the transport layer for the whole app

`getEnvelope` and `patchEnvelope` were added beside `postEnvelope`, and `src/lib/ai/ai-settings.ts`
is the first non-auth caller. Nothing in the file is auth-specific — it is `resolveApiRoot`, a fetch
and an envelope parse — so `src/lib/auth/` is now where the transport lives because that is where the
first caller happened to be. The misleading `PostEnvelopeOptions` name was fixed to `EnvelopeOptions`
in this task; the file move was not.

**Closes when:** somebody moves it to `src/lib/api/envelope.ts`. Six importers, all mechanical. Left
out here deliberately — it touches three files outside this task's diff and belongs in its own change.

## 5. `formatMoney` exists but has no shared home

Money formatting now lives inside `src/lib/ai/usage.ts` as a private formatter. It is the only
`Intl.NumberFormat` in the repo, and `Cost.amount` in `consequence.ts` already declares a need for
exactly this ("already formatted, currency and all"). One caller does not justify a `src/lib/money/`
yet.

**Closes when:** a second screen needs a formatted amount — most likely the first metered AI action,
which builds a `cost-preview` confirmation and will otherwise hand-roll its own.

## 6. The screen is not in the shell and not in the navigation

`/settings/ai` renders its own `<main>` and is reachable only by typing the URL. `AppShell` exists
and provides the skip link, the main landmark and the nav, but no route uses it yet, so wrapping this
one page would be the first — and would need the nav entry and the settings section around it.

**Closes when:** the authenticated shell layout lands and settings gets its section. The local
`<main>` comes out at that point or there will be two.

## 7. No visual regression coverage

Tests assert roles, names, disabled states and text through jsdom. The bar chart's readability at
five-plus capabilities, the alert's colour contrast at `warning` and `danger`, and the disabled entry
point's reason line at mobile widths are unverified here.

**Closes when:** the Playwright suite exists (TASK-QA-*) and takes the three availability states and
the three cap states as fixtures.
