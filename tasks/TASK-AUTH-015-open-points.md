# TASK-AUTH-015 — open points

Built: `/login`, `/login/verify` and `/login/organizations` as three real routes, with the pending
challenge and the issued session each in their own `HttpOnly` cookie. What follows is what could not
be closed inside `salesnova_frontend`, and what would close it.

## 1. `POST /auth/switch-org` answers 501

`routes/splits/customer.php` registers it behind `auth:sanctum`, and `SwitchOrganizationController`
returns `NOT_IMPLEMENTED`.

`src/lib/auth/login-request.ts` is built against the contract it publishes — `{ organization_id }` in,
`AuthSessionDTO` out — and is unit tested against a stub fetcher. The task's second criterion —
switching does not require re-authentication — is proved in `src/app/login/login-actions.test.ts`
against a sender the test controls: the switch sends the access token and the organisation and
nothing else, and neither OTP call is reached.

What is unproved is that a real switch returns a session scoped to the organisation asked for.

`GET /auth/memberships` is also registered and also 501, but nothing here calls it: verification
already answers with the whole membership list, so the picker reads what it needs from the session
rather than asking a second time. A client for that endpoint was written and then deleted for having
no caller — if the session cookie is ever slimmed to drop the list, this is where it comes back.

**Closes when** TASK-AUTH-008 implements session issuance and multi-org switching.

## 2. `MembershipDTO` publishes no organisation name

The DTO carries `id`, `organization_id`, `role_preset`, `status`, `deactivated_at`, `timezone`,
`locale`. The picker has to name the thing being chosen, and an organisation id is not a name.

`membershipSchema` reads an optional `organization_name` with a `null` default, so a row still parses
today and the picker falls back to the role preset — "Sales Rep", "Org Admin" — which at least
distinguishes two rows for the common consultant case. Two memberships with the same preset are
indistinguishable until the name lands.

**Closes when** `MembershipDTO` gains `organization_name`. No client change: the schema already reads
it and the picker already prefers it.

## 3. Google sign-in has no route behind its button

`POST /auth/google` exists on the API and takes a Google credential. What does not exist is the
browser-side half — the OAuth redirect, the client id, and the callback route that would hand the
credential over. `/login/google`, which the button links to, is not a route in this repo.

The button is above the fold as SN-AUTH-002 and F01 §8 require, and it currently 404s.

**Closes when** the Google client is configured and a `/login/google` route exchanges the credential
through `POST /auth/google`. It was not stubbed here: a placeholder that signs nobody in reads as the
integration being built.

## 4. Turnstile is accepted but never produced

`OtpDeliveryRequest` requires `captcha_token` wherever the deployment has configured bot protection,
and SN-AUTH-004 makes it mandatory on OTP generation.

`requestCode` reads a `captcha_token` field from the form and forwards it, so the wire side is
finished. Nothing renders a Turnstile widget to fill that field, and no site key is configured — so
a deployment with bot protection on will refuse every code request from this screen.

**Closes when** a Turnstile widget component exists and a site key is in `.env.example`. The action
already forwards whatever the field holds.

## 5. The resend cooldown is not shown

SN-AUTH-003 requires the client to display a countdown, and says plainly that the countdown is a
courtesy — the fifteen seconds are enforced server-side.

`resend_available_at` is read off the OTP response into `OtpState`, so the instant reaches the action
that would need it. It is deliberately not banked in the challenge cookie: nothing renders a
countdown today, and a stored value no screen reads is one that can only go stale. A live countdown
needs a client component, and this screen is otherwise server-rendered.

**Closes when** a small client countdown takes the instant and disables the control until it passes.
Nothing on the wire changes; the value is already parsed.

## 6. Nothing else in the app reads `salesnova_session` yet

The session cookie written here is the first one in the repo. No middleware guards a route with it,
no request module attaches its access token, and nothing refreshes it when its fifteen minutes are
up — the rotating refresh token per SN-AUTH-006 is set by the API and never read here.

Sign-in therefore completes and lands on `/`, but the app it lands on does not yet know anybody is
signed in.

**Closes when** whatever owns the authenticated request path — the bootstrap work behind
TASK-ARCH-013, or a middleware task alongside it — reads this cookie and refreshes it.
