---
doc: F19-billing
status: REVIEW
owner: Product + Engineering
area_code: BILL
depends_on: [06-permissions-and-plans, 01-market-and-positioning]
---

# F19 — Billing & Subscriptions

Two rails: **Razorpay** for India, **Stripe** for international.

---

## 1. Why two providers

### SN-BILL-001 — Razorpay for India

RBI rules constrain card-based recurring billing: mandates require registration, e-mandate/AutoPay
flows, and pre-debit notification 24 hours before each charge. Meanwhile, **UPI AutoPay is how
Indian SMBs actually pay for software** — most of our beachhead ICP does not use a credit card for
subscriptions at all.

Stripe does not serve this well. Razorpay does, and also handles GST-compliant invoicing natively.

### SN-BILL-002 — Stripe for international

SEA, Middle East and everywhere else. Mature, well-documented, good subscription primitives.

### SN-BILL-003 — Provider chosen by billing country, abstracted behind a port

```php
interface PaymentProvider {
    public function createCustomer(Organization $org): ProviderCustomer;
    public function createSubscription(Organization $o, Plan $p, int $seats): Subscription;
    public function updateSubscription(Subscription $s, Plan $p, int $seats): Subscription;
    public function cancelSubscription(Subscription $s, bool $atPeriodEnd): void;
    public function createCheckoutSession(Organization $o, Plan $p, int $seats): CheckoutSession;
    public function createOneTimeCharge(Organization $o, Money $amount, string $reason): Charge;
    public function getPaymentMethod(Subscription $s): PaymentMethodSummary;
    public function parseWebhook(Request $r): array;
}
```

No provider-specific code above the port. The domain model has **one** subscription shape.

> Privyr ships `user_subscription` and `user_subscription_v3` simultaneously — a migration in
> progress, visible in the API contract. One shape, from the start.

---

## 2. Model

### SN-BILL-010 — Per-seat, monthly or annual

Priced per active member per month. Annual at a discount (2 months free), billed upfront.

### SN-BILL-011 — Seat changes prorate

Adding a seat charges pro rata immediately. Removing one credits pro rata to the next invoice —
**not a refund**, which creates a chargeback and reconciliation burden for a small amount.

### SN-BILL-012 — Nine subscription states

Per [`06`](../06-permissions-and-plans.md) §2.5. `PAYMENT_FAILING` (retrying) and `PAYMENT_OVERDUE`
(retries exhausted) are distinct and produce very different UI tone.

### SN-BILL-013 — Trial

14 days of Pro, no card required. Extendable once by 7 days, self-serve, with a reason captured.

> "No credit card required" is the correct choice for this market. A card wall at signup halves
> trial starts, and the trials it filters out are disproportionately the small teams we want.
>
> The self-serve extension is worth more than it costs: someone who asks for more time is engaged,
> and making them email support to get it is a needless loss.

### SN-BILL-014 — Currency follows the billing country

INR for India (Razorpay), USD elsewhere (Stripe). Set at first subscription; changing it requires
support.

---

## 3. Payment

### SN-BILL-020 — India methods

UPI AutoPay · e-mandate (net banking) · cards with mandate registration · wallets for one-time
top-ups.

**UPI AutoPay is presented first.** It is the highest-conversion method in this market by a wide
margin.

### SN-BILL-021 — Pre-debit notification

Indian mandates require notifying the customer at least 24 hours before each debit. Handled by
Razorpay, but the notification **MUST** also appear in-app so the charge is never a surprise.

### SN-BILL-022 — Dunning

| Attempt | Timing | Action |
|---|---|---|
| 1 | On failure | Email + in-app. `PAYMENT_FAILING`. |
| 2 | +3 days | Email + push |
| 3 | +7 days | Email + push. Warn about the consequence. |
| — | +10 days | `PAYMENT_OVERDUE`. **Sending blocked; product still works.** |
| — | +30 days | `EXPIRED`. Read-only. **Export still works.** |

**Data is never deleted for non-payment.** Retained 12 months, then a notified deletion process.

### SN-BILL-023 — Only a summary of the payment method reaches the client

`{brand, last4, exp_month, exp_year, method_type}` and nothing else.

> Privyr proxies the entire Stripe PaymentMethod object to the browser — card fingerprint, 3DS
> support flags, funding type, regulated status, wallet details. None of it is needed to render
> "Visa ending 4242".

### SN-BILL-024 — Card details never touch our servers

Hosted checkout or provider-hosted elements. **PCI scope stays out of our infrastructure.** No
exceptions, including for "just the last four".

---

## 4. Invoicing and tax

### SN-BILL-030 — GST for India

18% GST on subscription fees. Invoices carry our GSTIN, the customer's GSTIN where provided, HSN/
SAC code, and a tax breakdown.

**GST also applies to Meta's messaging charges** (imported OIDAR services) and to any BSP platform
fee. Credit pricing **MUST** show GST-inclusive amounts, because that is the number that leaves the
customer's account.

### SN-BILL-031 — GSTIN capture

Optional at signup, editable in billing settings, validated against format. Required for a customer
to claim input credit — which for a business customer is a real cash difference and worth prompting
for.

### SN-BILL-032 — Invoice history

Downloadable PDFs, all past invoices, always accessible — including after cancellation.

---

## 5. Credits (metered WhatsApp)

### SN-BILL-040 — Prepaid, separate from subscription

Template and campaign sends draw from a prepaid balance
([`F13`](F13-whatsapp-campaigns.md) §4). Top-up is a one-time charge, not a subscription change.

### SN-BILL-041 — Auto-top-up is opt-in with a cap

A monthly maximum is **required** when auto-top-up is enabled. An uncapped auto-charge on a
metered service is how a customer wakes up to a bill they did not authorise.

### SN-BILL-042 — Ledger reconciles

`credit_ledger` is append-only and reconciles daily against the provider's reported usage.
Divergence beyond 1% raises an internal alert.

---

## 6. Plan changes

### SN-BILL-050 — Upgrade is immediate

Prorated, features available at once, charged immediately.

### SN-BILL-051 — Downgrade takes effect at period end

The customer keeps what they paid for until the period ends. The downgrade screen states exactly
what will change — which features are lost, which limits will be exceeded and what happens then
([`06`](../06-permissions-and-plans.md) §2.3: **data is never destroyed**).

### SN-BILL-052 — Cancellation is self-serve

No retention gauntlet. One optional question about why. Access continues to period end; reactivation
is one click during the grace period.

> Making cancellation hard buys a month of revenue and costs the referral, the review and the
> re-subscription. In a market that runs on WhatsApp groups of agents recommending tools to each
> other, this is not a close call.

---

## 7. Webhooks

### SN-BILL-060 — Provider webhooks are the source of truth

Subscription state changes come from provider webhooks, never from the client's return from
checkout. A user who closes the tab after paying **MUST** still be upgraded.

### SN-BILL-061 — Verified, persisted, idempotent

Signature verified; payload persisted to `inbound_event` before processing; keyed on the provider
event id.

### SN-BILL-062 — Reconciliation job

A nightly job compares our subscription state against the provider's. Divergences are logged and
alerted — they are rare, and they are always worth a human look.

---

## 8. Acceptance criteria

- `AC-BILL-011.1` — Given a mid-cycle seat addition, when the invoice is generated, then the charge is prorated to the remaining days.
- `AC-BILL-022.1` — Given a subscription 31 days past a failed payment, when access is checked, then read and export succeed and writes are blocked.
- `AC-BILL-023.1` — Given a billing settings response, when inspected, then only brand, last4, expiry and method type are present.
- `AC-BILL-030.1` — Given an Indian customer purchasing credits, when the price is shown, then it is GST-inclusive and the breakdown is visible before payment.
- `AC-BILL-060.1` — Given a user who closes the browser immediately after checkout, when the webhook arrives, then the subscription activates without any client call.
