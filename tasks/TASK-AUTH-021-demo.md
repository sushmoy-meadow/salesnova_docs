# TASK-AUTH-021 — demo

One browser session against `php artisan serve` on :8000 and `next dev` on :3000, with a queue
worker running. Codes read out of the mail log, which is where `MAIL_MAILER=log` puts them.

## The demo criterion

> A new user signs up, verifies by OTP, lands in an authenticated shell, signs out and signs back
> in — in one browser session against live services.

`demo.slice@buyer.example`, from nothing:

| Step | What happened |
|---|---|
| `/signup`, identifier | → `/signup?stage=PROFILE` |
| profile: Sam Okafor / Slice Demo Trading | → `/signup?stage=VERIFICATION`, code `419752` delivered |
| code | session written, → `/onboarding` (a new account has a sequence to walk) |
| onboarding, 5 screens | → the shell, header naming Sam Okafor / Slice Demo Trading |
| account menu → Sign out | → `/login`, no error banner; `/welcome` then bounced to `/login` |
| `/login`, code `330139` | → `/welcome`, signed in again |

Landing goes to `/welcome` rather than `/`: `/` is the public site and the authenticated tree has no
index of its own. Signup and invite acceptance land one step earlier still, at `/onboarding`, because
a membership made seconds ago has an untouched sequence by definition — going through the app first
only builds a whole shell payload to read one flag off it. Both routes are in
`src/lib/auth/paths.ts`.

**Re-run after the simplify pass.** That pass moved the landing, replaced the shell-cache
invalidation with a targeted one, and changed how the account menu reaches the shell, so the
criterion was walked again end to end on the final code as `reverify.slice@buyer.example`: signup →
`/onboarding` directly → five screens → `/welcome` with no bounce → account menu → Sign out →
`/login` → code → `/welcome`. Same outcome, one redirect fewer. The blank-parameter case the pass
fixed was checked in the same session: `/signup?stage=` now resumes at the profile stage instead of
resetting to the first screen.

**Walked a third time, 2026-08-13, after the open points were resolved.** `AccountSession` gained
the membership list, onboarding's last screen was pointed at `APP_PATH`, and switching moved into
the account menu — all three sit on paths this criterion covers, so it was run again end to end as
`resolve.slice@buyer.example`: signup → `/onboarding` → five screens → **`/welcome`**, where the
last screen used to land on `/`. Then an invitation to a second organisation, accepted in the
browser, landing in Northwind Realty's own onboarding; one user row and two memberships; the account
menu offering *Switch to → Resolve Trading* and not the organisation already open; the switch
landing back on `/welcome` with the header renamed and the switcher now offering Northwind. Then
sign out, sign back in, and the picker — which still appears at sign-in, because choosing where to
land is not a switch.

The API log for the run reads `signup/verify → onboarding/screen` and
`invitations/accept → onboarding/screen` with no `auth/memberships` between them, and
`auth/switch-org → bootstrap` for the switch. That is the round trip removed and the picker
navigation removed, in the log rather than in a claim.

## The other five

**Expired and reused each say their own thing.** Reused (a code already spent, presented against a
live challenge) → `OTP_INVALID` → *"Check the six digits and try again, or ask for a new code."*
Expired (challenge expiry moved back, its own code presented) → `OTP_EXPIRED` → *"Codes last ten
minutes. Ask for a new one."* Two distinct non-generic messages under the code field.

A reused code answering `OTP_INVALID` rather than a "reused" code of its own is deliberate — telling
a holder their code was already spent tells them somebody else spent it. The criterion asks for two
distinct on-screen errors and gets them.

**A replay invalidates the family and says why.** Against the live API: sign in, refresh once
legitimately (200), present the same refresh token a second time → `UNAUTHENTICATED`, and the access
token that family had minted went from 200 to 401. In the browser, revoking the signed-in session's
family the way a replay does and reloading `/welcome` → `/login?error=UNAUTHENTICATED`, rendering
*"You have been signed out — Sign in again to pick up where you left off."*

The replay itself cannot be driven from the web app: Next's server-to-server fetch discards the
API's `Set-Cookie`, so the browser never holds a refresh token. Recorded in the open points.

**Switching carries no stale data.** `demo.slice@buyer.example` in two organisations: the picker
listed *Slice Demo Trading (Owner)* and *Northwind Realty (Rep)*. Choosing Northwind landed on
**that organisation's own onboarding** — a stale payload would have shown Slice Demo Trading's
finished sequence and gone straight to the shell. After walking it, the shell named Northwind
Realty; switching back named Slice Demo Trading. Org name, onboarding state and the switcher's own
visibility all followed.

**An invite to an existing member adds a membership, not a user.** Invite issued to
`demo.slice@buyer.example` for a second organisation, accepted in the browser:

```
user rows:   1
memberships: 2
  - Slice Demo Trading as OWNER
  - Northwind Realty  as REP
```

**A resumed signup returns to the stage it left.** After the profile stage, a bare `/signup` — the
address in the visitor's history, with no `?stage=` — rendered *"Tell us who you are"*, not the
identifier screen. The stage rides in the signup cookie, which is the only copy that survives
closing the tab. A stage in the URL still wins, so the back button still goes back.

## Four defects the integration found

Each blocked the demo, and each is fixed with a test behind it.

**Signup issued a code nobody could ever be told.** `SignupCodeIssued` had no listener, so the
verification screen asked for six digits that were never sent. `TASK-AUTH-007` owns queued delivery
and wired only the login OTP. → `app/Listeners/Auth/DeliverSignupCode.php`.

**An unauthenticated API call without `Accept: application/json` answered 500.** Laravel's guard
builds a redirect to a `login` route this API does not have, and that lookup threw before the
refusal was ever raised. The web app's reads sent no `Accept` header, so a session the API had
withdrawn reached the shell as *"the server is unavailable"* rather than as a reason to sign in —
which is criterion three failing. → `redirectGuestsTo(fn () => null)`, and the web app now states
`accept: application/json` on every request.

**Finishing onboarding left the shell cached as unfinished** (ISS-020). `/welcome` ↔ `/onboarding`
looped until the 300-second entry expired; reproduced as `ERR_TOO_MANY_REDIRECTS` immediately after
signup. Nothing observed `OnboardingProgress`, which is what the sequencer derives completion from.
→ `app/Observers/Identity/OnboardingProgressObserver.php`, forgetting the one membership key the
writing row names. Walked the second organisation's onboarding afterwards and went straight into
the shell.

**Accepting an invitation left the accepter on the invitation screen.** The endpoint hands back a
session for the membership it just made and the web app parsed it as `z.unknown()` and dropped it,
so somebody who had just proved who they were had to go and sign in again. → the same landing the
signup path now takes.
