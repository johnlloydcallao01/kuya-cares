# Vendor Membership — Backend Implementation Plan (`apps/cms` only)

> Scope: **backend only**. No pages, no frontend, no UI work.
> Goal: vendors **register + pay for a membership plan to sell** (enterprise-grade multivendor subscription + commission), following existing `apps/cms` PayloadCMS 3.49 + Next App Router + Postgres + PayMongo patterns.
> Non-goals: web-merchant / web-admin pages, checkout UI, marketing pricing page, Stripe UI, mobile changes.

---

## 0. Current state (verified)

* `src/collections/Vendors.ts`: free model — `businessName, legalName, businessRegistrationNumber unique, taxIdentificationNumber, primaryContactEmail/Phone, businessType, cuisineTypes, isActive, verificationStatus pending|verified|rejected|suspended, onboardingDate, metrics, businessLicense/taxCertificate/logo uploads`. No `plan/subscription/billing` fields. Access `service|admin` only.
* `src/collections/Merchants.ts`: `vendor FK required, outletName/outletCode unique, isActive/isAcceptingOrders/operationalStatus, businessZone kill-switch, geospatial`. No plan gating.
* `src/app/api/admin/vendors/route.ts POST`: admin-only vendor creation. Only `customer-register` exists publicly. No `vendor-register`.
* Payments: raw `fetch https://api.paymongo.com/v1/payment_intents` in `src/services/topupProviders.ts`, `src/payload.config.ts`, `src/endpoints/paymongoWebhook.ts` (order paid/failed + wallet top-up). No `stripe` dep. No subscription webhook.
* Fees: `Orders.platform_fee` (customer-facing, in `Orders.ts:beforeValidate` total invariant) + `src/utils/payoutsShared.ts net = max(0, amount - platform_fee - delivery_fee)`. Not a vendor commission %.
* `package.json`: no billing SDK. `.env.example`: only `PAYMONGO_*, WALLET_*, LALAMOVE_*`.
* `src/proxy.ts`: CORS only — **must stay untouched** (no auth/billing there).
* `src/globals/SystemSettings.ts`: `maintenanceMode, couponsEnabled, pointsEnabled, deliveryProvider`. No membership settings.
* False positives: `tag-group-memberships` (product-tag join), `customer/loyalty/membership` (points tiers).

Enterprise target (Shopify / Mirakl / CS-Cart / Dokan / WCFM / Sharetribe / Amazon): **hybrid subscription + commission + visibility upsell**, `Register -> Verify -> KYB -> Plan select -> Pay -> Approval -> Go-live`, Stripe/PayMongo recurring, trial + proration + dunning (grace -> read-only -> hide -> cancel), centralized `can(action,vendor)` entitlement evaluator, admin plan CRUD + manual assign/waive/suspend, audit log + grandfathering.

---

## 1. Architecture overview

```
Vendor self-serve (public)                Vendor authed                     Admin authed
POST /api/vendor/register                 POST /api/vendor/subscriptions/*  /api/admin/membership-plans/*
  -> users(vendor)+vendors(pending)       checkout/upgrade/downgrade/       /api/admin/subscriptions/*
  -> optional trial start                 renew/cancel/coupon/trial         /api/admin/membership-invoices/*
                                          GET /api/vendor/subscription      /api/admin/vendors/[id]/approve
                                          GET /api/vendor/invoices*         /api/admin/vendors/[id]/commission-override
                                                    |                                    |
                                                    v                                    v
                                          MembershipService / EntitlementService / BillingService / CommissionService
                                                    |                                    |
                                                    v                                    v
Payload collections: membership-plans, vendor-subscriptions, subscription-invoices,
                     commission-rules, vendor-entitlements, membership-audit-log
                     (+ Vendors extension fields, SystemSettings.membership group)
                                                    |
                                                    v
Providers: src/services/membershipProviders.ts (paymongo live, manual live, stripe stub)
Webhooks: /api/paymongo-membership/webhook (canonical, Payload endpoint) + Next alias
Enforcement: Payload beforeChange/access + BFF early-402 + GeospatialService hide-listings filter
```

Conventions to follow (copy existing files):

* Access: `read/create/update/delete` returning `user?.role === 'service' || user?.role === 'admin'` for writes; vendor `read` returns a `where` query scoped to own vendor (see `Vendors.ts:13-39`, `Transactions.ts:12-30`).
* BFF auth: `authenticateAdmin` / vendor-scoped auth (`src/utils/mediaLibrary.ts`), `overrideAccess: true` only inside BFF after auth, `withAdminRequestSlot` on admin list routes (`src/utils/adminRequestGate.ts`).
* Validation: `zod@4.3.6`. Money: `roundMoney` (`CouponService.ts`), centavos conversion only at provider boundary (`toCentavos`).
* Notifications: `createAdminNotificationFanout` / `createMerchantNotificationFanout` (`src/utils/notificationFanout.ts`) — copy `Transactions.ts:91-128`, `Orders.ts:49-111`, `Vendors.ts:294-311`.
* Rate-limit: in-memory maps like `src/payload.config.ts:432` (note: swap to `@upstash/redis` for multi-instance later).
* Signature verify: raw `text()` + HMAC-SHA256 like `src/endpoints/paymongoWebhook.ts`.
* `payload generate:types` + `payload migrate:create` after every collection change.

---

## 2. Collections — full CRUD (new files)

All new collections: `group: 'Membership'`. Register in `src/payload.config.ts` `collections: [...]`. Run `pnpm --filter @encreasl/cms payload generate:types`.

Shared vendor-scoping helper (inline in each file, mirrors existing style):

```ts
const isServiceOrAdmin = (user: any) => user?.role === 'service' || user?.role === 'admin'
async function vendorIdForVendorUser(payload: any, userId: string): Promise<string | null> {
  const res = await payload.find({
    collection: 'vendors',
    where: { user: { equals: userId } },
    limit: 1, depth: 0, overrideAccess: true,
  })
  return res.docs?.[0]?.id ? String(res.docs[0].id) : null
}
```

### 2.1 `src/collections/MembershipPlans.ts` — slug `membership-plans`

Plan catalog. Admin CRUD. Vendors read only `status = active`.

Fields:

| Field | Type | Notes |
|---|---|---|
| `name` | text, required | e.g. `Basic`, `Growth`, `Pro`, `Enterprise` |
| `slug` | text, required, unique | e.g. `basic`, `growth-monthly`, `pro-yearly`. Auto-slugify in `beforeChange` if empty |
| `description` | textarea | |
| `price` | number, required, min 0 | PHP pesos (float, `roundMoney`). Yearly price = full yearly amount |
| `currency` | text, required, default `PHP` | forced `PHP` in hook |
| `billing_interval` | select required default `month` | `month \| year \| one_time` |
| `trial_days` | number min 0 default 0 | |
| `grace_days` | number min 0 default 7 | override of global default |
| `commission_percent` | number min 0 max 100 default 0 | plan-level commission |
| `transaction_fee` | number min 0 default 0 | flat PHP per order |
| `limits` | group | `max_products (-1=unlimited, default -1)`, `max_merchants (default 1)`, `max_images (-1)`, `storage_mb (-1)`, `staff_seats (default 1)`, `monthly_gmv_cap (-1)`, `order_cap (-1, orders/mo)` |
| `allowed_categories` | relationship hasMany → `product-categories` | empty = all |
| `allowed_business_types` | select hasMany | `restaurant, fast_food, grocery, pharmacy, convenience, bakery, coffee_shop, other` |
| `capabilities` | group | `microstore, ads, analytics, api_access, promos, custom_shipping, multi_user` checkbox default false; `visibility_boost` number 0–100 default 0; `support_sla` select `none\|email\|priority\|dedicated` default `email` |
| `status` | select required default `active` | `active \| hidden \| disabled \| archived`. `hidden` = assign-only (Enterprise) |
| `display_order` | number default 0 | |
| `is_fallback_basic` | checkbox default false | only one plan may have true (enforced in `afterChange`) |
| `stripe_product_id` / `stripe_price_id` | text | stub, nullable |
| `paymongo_plan_ref` | text | local ref (PayMongo has no product object) |
| `version` | number required default 1 | bump on limit/price change; subscriptions snapshot it |

Indexes: `slug` unique, `[status, display_order]`.

Access:

* `read`: service/admin → `true`; vendor → `{ status: { equals: 'active' } }`; else `false`.
* `create/update/delete`: service/admin only.

Hooks:

* `beforeChange`: slugify `name` if `slug` empty; force `currency='PHP'`; if `status` changes to `archived`, keep (no block here — delete guard below).
* `afterChange`: if `is_fallback_basic === true`, unset flag on all other plans (`overrideAccess: true`).
* `beforeDelete`: block when active subscribers exist — `count vendor-subscriptions where plan == id AND status in [trialing, active, past_due, grace] > 0` → `throw new APIError('Plan has active subscribers', 409)`. Only allow delete with zero active subs; prefer `archived` over hard delete.

### 2.2 `src/collections/VendorSubscriptions.ts` — slug `vendor-subscriptions`

One active + full history per vendor. All writes service/admin only (BFF uses `overrideAccess` after auth). Vendors read own only.

Fields:

| Field | Type | Notes |
|---|---|---|
| `vendor` | relationship → `vendors` required, indexed | |
| `plan` | relationship → `membership-plans` required | |
| `plan_version` | number required default 1 | frozen at subscribe |
| `plan_snapshot` | json required | frozen `{ name, price, billing_interval, commission_percent, transaction_fee, limits, capabilities }` |
| `status` | select required default `pending` | `pending \| trialing \| active \| past_due \| grace \| suspended \| cancelled \| expired` |
| `billing_interval` | select | `month \| year \| one_time` (copied from plan) |
| `current_period_start` / `current_period_end` | date | set on create (month/year/one_time+100y) |
| `trial_ends_at` / `grace_ends_at` | date | |
| `cancel_at` / `cancelled_at` | date | `cancel_at` = scheduled end when `cancelAtPeriodEnd` |
| `cancelAtPeriodEnd` | checkbox default false | |
| `scheduledPlan` | relationship → `membership-plans` nullable | downgrade target |
| `scheduledEffectiveAt` | date nullable | = `current_period_end` for downgrades |
| `auto_renew` | checkbox default true | |
| `payment_provider` | select default `paymongo` | `paymongo \| stripe \| manual` |
| `provider_customer_id` / `provider_subscription_id` | text | `provider_subscription_id` sparse-unique |
| `idempotencyKey` | text required unique | checkout idempotency |
| `retryCount` / `lastRetryAt` | number default 0 / date | dunning |
| `waivedUntil` | date nullable | manual waive |
| `waiveReason` | textarea nullable | required when waived |
| `suspendReason` | text nullable | required when suspended |
| `usage` | group | `products_used, merchants_used, storage_mb_used, gmv_current_period, orders_current_period` numbers default 0 + `last_reset_at` date |
| `grandfathered` | checkbox default false | backfill flag |
| `grandfather_notes` | textarea | |
| `meta` | json | provider refs, coupon, proration detail |

Indexes: `[vendor, status]`, `[plan, status]`, `provider_subscription_id` unique (sparse), `[current_period_end]`, `idempotencyKey` unique.

Access: `read` service/admin → true; vendor → `{ vendor: { equals: <ownVendorId> } }` (async function); `create/update/delete` service/admin only.

Hooks:

* `beforeChange`: on create or `plan` change — load plan, set `plan_version`, `plan_snapshot`, default period dates, `trial_ends_at` if `status==='trialing'` and `plan.trial_days > 0`, copy `billing_interval`.
* `afterChange`: denormalize to `vendors { currentSubscription, subscriptionStatus, subscriptionExpiresAt, graceEndsAt }` (`overrideAccess: true`, catch/log on failure, never throw); upsert `vendor-entitlements`; write `membership-audit-log { action: 'sync', plan_version, reason: subscription <status> }`.

### 2.3 `src/collections/SubscriptionInvoices.ts` — slug `subscription-invoices`

Per-cycle invoice + provider ref + idempotency. Same access shape as 2.2 (vendor reads own via `{ vendor: { equals } }`).

Fields: `subscription` rel → `vendor-subscriptions` required; `vendor` rel → `vendors` required (denormalized); `plan` rel → `membership-plans` required; `invoice_number` text required unique (auto `INV-<YYYY>-<6 base36>` in `beforeChange`); `amount` number required min 0; `currency` default `PHP`; `commission_due` number default 0; `status` select default `pending` (`pending \| paid \| failed \| past_due \| void \| refunded`); `billingReason` select (`initial \| upgrade \| downgrade \| renewal \| proration \| manual`); `prorationDelta` number default 0; `discount_amount` number default 0; `couponCode` text nullable; `payment_provider` select; `provider_payment_intent` text indexed nullable; `payment_link_url` text nullable; `period_start` / `period_end` date; `due_at` date required; `paid_at` date nullable (stamped when → `paid`); `receipt` upload → `media` nullable; `retry_count` number default 0; `failure_reason` textarea; `idempotencyKey` text required unique; `metadata` json.

Indexes: `invoice_number` unique, `[vendor, status]`, `[subscription, status]`, `provider_payment_intent`, `idempotencyKey` unique.

Hooks: `beforeChange` — autonumber, stamp `paid_at`, increment `retry_count` on → `failed`; `afterChange` — `createAdminNotificationFanout` on `paid/failed` (copy `Transactions.ts` pattern) + audit log write.

### 2.4 `src/collections/CommissionRules.ts` — slug `commission-rules`

Resolves vendor debit at payout. Never mutates order `total` (that invariant stays in `Orders.ts:beforeValidate`). Admin-only write; vendor `read: false` (or true if transparency desired — default false).

Fields: `name` text required; `scope` select required (`global \| plan \| category \| vendor`); `priority` number required default 0 (higher wins; recommended `vendor 100 > category 50 > plan 10 > global 0`); `plan` rel → `membership-plans` (only when `scope==='plan'`); `category` rel → `product-categories` (only when `scope==='category'`); `vendor` rel → `vendors` (only when `scope==='vendor'`); `commission_percent` number 0–100 required; `transaction_fee` number min 0 default 0; `effective_from` / `effective_to` date nullable; `is_active` checkbox default true.

Resolution (in `CommissionService`, not a hook): filter `is_active && now in [from,to] && scope matches (vendor/category/plan)` → winner = max `priority`, tie → most specific scope, then latest `effective_from`.

### 2.5 `src/collections/VendorEntitlements.ts` — slug `vendor-entitlements`

Materialized entitlement snapshot. One doc per vendor (`indexes: [{ fields: ['vendor'], unique: true }]`). Written only by subscription `afterChange` / cron — **gating reads this, never the plan directly**.

Fields: `vendor` rel required unique; `subscription` rel; `plan` rel; `capabilities` group (mirror plan flags + `support_sla`); `limits_snapshot` json; `granted_at` / `expires_at` date; `reason` text.

Access: same vendor-scoped read as 2.2; writes service/admin only. `beforeChange` stamps `granted_at`.

### 2.6 `src/collections/MembershipAuditLog.ts` — slug `membership-audit-log`

Immutable log. `create: service|admin`, `update/delete: () => false`.

Fields: `vendor` rel; `subscription` rel; `invoice` rel nullable; `action` select (`grant \| deny \| upgrade \| downgrade \| renew \| cancel \| grace \| override \| entitlement_check \| sync \| vendor_registered \| admin_approve \| admin_waive \| webhook_paid \| webhook_failed`); `plan_version` number; `previous_plan` / `next_plan` rel → `membership-plans` nullable; `reason` textarea; `actor` rel → `users` nullable; `metadata` json; `eventId` text unique nullable (webhook replay guard).

Indexes: `[vendor, createdAt]`, `[subscription]`, `eventId` unique (sparse).

### 2.7 Modify `src/collections/Vendors.ts` (append fields, keep access/hooks)

```ts
{ name: 'currentSubscription', type: 'relationship', relationTo: 'vendor-subscriptions', admin: { position: 'sidebar', description: 'Denormalized by subscription afterChange' } },
{ name: 'subscriptionStatus', type: 'select', defaultValue: 'none',
  options: ['none','pending','trialing','active','past_due','grace','suspended','cancelled','expired'].map(v => ({ label: v, value: v })),
  admin: { position: 'sidebar' } },
{ name: 'subscriptionExpiresAt', type: 'date', admin: { position: 'sidebar' } },
{ name: 'graceEndsAt', type: 'date', admin: { position: 'sidebar' } },
{ name: 'trialEndsAt', type: 'date', admin: { position: 'sidebar' } },
{ name: 'waivedUntil', type: 'date', admin: { position: 'sidebar' } },
{ name: 'waiveReason', type: 'textarea', admin: { position: 'sidebar' } },
{ name: 'suspendedReason', type: 'text', admin: { position: 'sidebar' } },
{ name: 'grandfatheredBasic', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
{ name: 'grandfatheredAt', type: 'date', admin: { position: 'sidebar', readOnly: true } },
{ name: 'commissionOverride', type: 'group', fields: [
  { name: 'commission_percent', type: 'number', min: 0, max: 100 },
  { name: 'transaction_fee', type: 'number', min: 0, defaultValue: 0 },
  { name: 'rule', type: 'relationship', relationTo: 'commission-rules' },
], admin: { description: 'Vendor-level override (highest priority)' } },
{ name: 'kycDocs', type: 'array', fields: [
  { name: 'docType', type: 'select', required: true, options: ['dti','sec','bir','id_front','id_back','selfie','other'].map(v => ({ label: v, value: v })) },
  { name: 'media', type: 'upload', relationTo: 'media', required: true },
], admin: { description: 'KYB documents (verification is manual for now)' } },
{ name: 'lastEntitlementSync', type: 'date', admin: { position: 'sidebar', readOnly: true } },
```

Keep existing `beforeChange` (onboardingDate), `beforeValidate` (storeHours), `afterChange` (vendor.created fanout) — append, don't replace.

Optional `src/collections/Merchants.ts` addition (for boost enforcement in service layer only):

```ts
{ name: 'isFeatured', type: 'checkbox', defaultValue: false, admin: { description: 'Requires vendor visibility_boost > 0 (checked in service layer)' } },
{ name: 'listingBoost', type: 'number', min: 0, max: 100, defaultValue: 0 },
```

### 2.8 Modify `src/globals/SystemSettings.ts` (add `membership` group)

```
membership: group {
  membershipEnabled: checkbox default false (kill-switch; false = skip all 402 gates, log-only),
  membershipEnforced: checkbox default false (alias used by membershipGuard; keep both in sync, enforced = membershipEnabled && membershipEnforced),
  grandfatherBasicEnabled: checkbox default true,
  trialDaysDefault: number default 7,
  graceDaysDefault: number default 7,
  dunningMaxRetries: number default 8,
  dunningSchedule: json default [1h,4h,12h,1d,2d,3d,5d,7d],
  fallbackBasicPlanSlug: text default 'basic',
  commissionDefaultPct: number default 8 (0–30),
  payProviderDefault: select paymongo|stripe|manual default paymongo,
}
```

### 2.9 Modify `src/collections/MerchantCategories.ts` + `src/collections/Coupons.ts`

* `MerchantCategories`: add `commissionOverridePct` number nullable (category-level override).
* `Coupons`: extend `appliesTo` select with `membership` value + add `membershipPlanWhitelist` relationship hasMany → `membership-plans` (reuse coupon engine for membership discounts via `CouponService.validate`).

---

## 3. Services + utils (new files)

| File | Responsibility | Key signatures |
|---|---|---|
| `src/services/membershipProviders.ts` | `BillingProvider` interface + registry (`paymongo`, `manual`, `stripe-stub`). Mirrors `topupProviders.ts` | `getMembershipProvider(name?)`, `createMembershipIntent(req): Promise<{paymentRef, checkoutUrl?, raw}>`, `normalizeEvent(raw): {kind:'invoice.paid'\|'payment.failed'\|'refund', paymentRef, eventId, paidAt?}` |
| `src/services/MembershipService.ts` | subscription lifecycle (pure + payload helpers for tests) | `resolveActiveSubscription(payload,vendorId)`, `getActiveSubscription`, `canSell(payload,vendorId)`, `computeProration(sub,toPlan)`, `prorateSwitch(oldPlan,newPlan,now,periodEnd)`, `startTrial(vendorId,planSlug)`, `activateFromInvoice(invoiceId,eventId)` (idempotent), `scheduleChange`, `transitionDunning(sub,event)` (pure) |
| `src/services/EntitlementService.ts` | centralized `can(action,vendor)` evaluator | `can(action:'publish_outlet'\|'create_product'\|'create_coupon'\|'view_analytics'\|'accept_orders', vendorId): Promise<{allowed, code?:'PAYWALLED'\|'QUOTA_EXCEEDED'\|'SUSPENDED', plan?}>` — reads `vendor-entitlements` + subscription status + `waivedUntil` |
| `src/services/BillingService.ts` | invoices + dunning machine | `createInvoice({vendorId,planId,billingReason,idempotencyKey,couponCode?})`, `handlePaid(paymentRef,eventId)`, `handleFailed(paymentRef,eventId)`, `refundOrVoid(invoiceId,action,reason,actorId)`, `retryDue()` sweep |
| `src/services/CommissionService.ts` | commission resolution | `resolvePct(vendorId,merchantId?): Promise<{pct, source:'vendor'\|'category'\|'plan'\|'global'}>` — chain `vendors.commissionOverride → merchant→merchant-categories.commissionOverridePct → plan snapshot commission_percent → SystemSettings.commissionDefaultPct`; `net = roundMoney(gross*(1-pct/100))`, `max(0,·)` parity with `payoutsShared` |
| `src/services/MembershipAuditService.ts` | thin writer to `membership-audit-log` | `log({vendor,subscription,invoice?,action,plan_version?,reason?,actor?,metadata?})` |
| `src/utils/membershipShared.ts` | shared helpers | `roundMoney, relId(docOrId), toCentavos(pesos), sanitizePlan/Subscription/Invoice (strip raw provider blob), badRequest, prorateDelta, netAfterCommission` |
| `src/utils/membershipSchemas.ts` | `zod` v4 schemas | register, checkout, upgrade/downgrade, waive (reason min 10), commission override (pct 0–30 + reason), approve |
| `src/utils/membershipGuard.ts` | reusable enforcement helper | `requireActiveMembership(payload,vendorId,opts?:{fn?:string})` throws `MembershipBlockedError {status:402, code, requiredPlan, vendorId, subscriptionStatus}`; `resolveVendorIdFromMerchant`, `resolveVendorIdFromProduct`, `isMembershipEnforced()` (reads SystemSettings + `BILLING_ENFORCE_MEMBERSHIP`); 60s in-request cache via `req.context.membershipCache`; admin bypass only for reads, never vendor writes |
| `src/utils/membershipRateLimit.ts` | rate limits | `checkRate(map,key,limit,windowMs)` + `vendorRegisterLimiter` (10/hr/IP), `checkoutLimiter` (20/hr/vendor), webhook 300/min/IP |

Proration (`membershipShared.prorateDelta` / `MembershipService.computeProration`):

```
dailyOld = oldPrice / daysInCycle; dailyNew = newPrice / daysInCycle
remainingDays = ceil((periodEnd - now) / 86400000)
delta = roundMoney((dailyNew - dailyOld) * remainingDays)
amountDue = max(0, adjustedNewPrice + delta - couponDiscount - credit)
```

Upgrade charges immediately; downgrade with negative delta → credit + `scheduledPlan` at `currentPeriodEnd` (no charge if `delta <= 0`).

Dunning: 8 retries exponential (`1h,4h,12h,1d,2d,3d,5d,7d`) via `retryCount/lastRetryAt`; sweep endpoint flips `past_due → grace(7d, read-only) → suspended(read-only) → cancelled/expired`.

---

## 4. Endpoints + API routes (backend only)

### 4.1 Payload custom endpoints (canonical webhooks) — register in `payload.config.ts` `endpoints[]`

| File | Path | Notes |
|---|---|---|
| `src/endpoints/paymongoMembershipWebhook.ts` | `path: '/paymongo-membership/webhook', method: 'post'` | raw `text()` + HMAC-SHA256 verify (copy `paymongoWebhook.ts`), replay guard via `membership-audit-log eventId`, dispatch `payment.paid → BillingService.handlePaid`, `payment.failed → handleFailed`. Payload serves at `/api/paymongo-membership/webhook` |
| `src/endpoints/stripeMembershipWebhook.ts` | `path: '/stripe-membership/webhook', method: 'post'` | stub, same interface; returns `501 {code:'STRIPE_NOT_CONFIGURED'}` when `STRIPE_WEBHOOK_SECRET` missing |

### 4.2 Next App Router BFF

Global: `Idempotency-Key: <uuid>` header accepted on all POST checkout/mutate (also `body.idempotencyKey`); money in PHP pesos; `limit <= 100`; sanitize raw provider blobs out of vendor responses. Status codes: `200/201/400/401/402 paywalled/403/404/409 conflict (replay returns original 200 + deduplicated:true)/422 semantic/429`.

**Public (rate-limited):**

* `src/app/api/vendor/register/route.ts POST` — body `{ email, password, firstName, lastName, businessName, legalName, businessRegistrationNumber, primaryContactEmail, primaryContactPhone, businessType, kycMediaIds:{businessLicense?,taxCertificate?,logo?}, planSlug?, billingInterval?, idempotencyKey }`. Flow: zod → dup check (`users.email` + `vendors.businessRegistrationNumber`) → `payload.create users{role:'vendor',isActive:true}` → `payload.create vendors{verificationStatus:'pending',isActive:false,membershipStatus:'none',kycDocs}` (verify media ids exist) → optional `startTrial` if plan has `trial_days` → audit `vendor_registered`. Res `201 {userId,vendorId,subscriptionId?,trialEndsAt?}`, `409` on duplicate. (KYC file upload itself reuses existing `POST /api/media/library`; this endpoint only links ids.)
* `src/app/api/webhooks/paymongo-membership/route.ts POST` — thin alias (same verify + delegate to `BillingService`); returns `410` if `PAYMONGO_MEMBERSHIP_DISABLED=true` to force canonical Payload endpoint.
* `src/app/api/webhooks/stripe-membership/route.ts POST` — `501` unless `STRIPE_*` set.

**Vendor authed (`authenticateVendor`, vendor-id scoping, `403` on cross-vendor id):**

* `POST /api/vendor/subscriptions/checkout` — `{ planSlug, billingInterval, couponCode?, idempotencyKey }` → `resolveActiveSubscription` → `409 ALREADY_SUBSCRIBED` if same plan active → `BillingService.createInvoice {billingReason:'initial'|'upgrade'}` (coupon via `CouponService.validate` with `appliesTo:'membership'`) → `provider.createMembershipIntent({amountCentavos, reference: invoice.idempotencyKey})` → store `paymentIntentId + checkoutUrl`. Res `201 {invoiceId, amount, checkoutUrl, paymentIntentId, status:'pending'}`.
* `POST /api/vendor/subscriptions/upgrade | downgrade | renew | cancel` — upgrade/downgrade `{ toPlanSlug, idempotencyKey }` → `201 {invoiceId, prorationDelta, newAmountDue, effectiveAt, checkoutUrl?}`; renew `{ idempotencyKey }` → `201`; cancel `{ cancelAtPeriodEnd, reason? }` → `200 {status, effectiveAt}` (stays `active` until period end, then `cancelled`).
* `GET /api/vendor/subscription` — `200 {subscription, plan, entitlements:{canPublishOutlet, canCreateCoupon, maxOutlets,...}, usage:{outlets,products,ordersThisCycle}, invoices:[last 5], trial:{active,endsAt}, grace:{active,daysLeft}}`; `402 {error:'SUBSCRIPTION_REQUIRED', code:'PAYWALLED'}` when paywalled.
* `GET /api/vendor/invoices?page&limit&status`, `GET /api/vendor/invoices/[id]` — sanitized list/detail.
* `POST /api/vendor/subscription/trial` — `{ planSlug }` → once-only guard (`vendors.trialEndsAt` null + no prior `trialing` event) → `200/201`, else `422 TRIAL_ALREADY_USED`.
* `POST /api/vendor/subscription/coupon` — `{ code, invoiceId? }` → `200 {invoiceId, discount, newTotal}`, `422` on invalid.

**Admin authed (`authenticateAdmin` + `withAdminRequestSlot` on lists):**

* `GET/POST /api/admin/membership-plans`, `GET/PATCH/DELETE /api/admin/membership-plans/[id]` — PATCH whitelisted fields; DELETE blocked `409 HAS_ACTIVE_SUBSCRIPTIONS` unless `?force=true` (then soft-disable `isActive=false` instead of hard delete when in use).
* `GET /api/admin/subscriptions?status&plan&vendor&search&page&limit` → `200 {docs, pagination, stats:{byStatus}}`; `POST /api/admin/subscriptions` (assign) `{ vendorId, planSlug, billingInterval, waivedUntil?, waiveReason? }` → `201`.
* `GET/PATCH /api/admin/subscriptions/[id]` — `{ planSlug?, status?, suspendReason?, unsuspend?, extendPeriodEnd? }`. Suspend sets `vendors.membershipStatus='suspended' + isActive=false`; unsuspend restores per subscription status.
* `POST /api/admin/subscriptions/[id]/waive` — `{ until, reason (min 10 chars, required) }` → audit `admin_waive`.
* `POST /api/admin/subscriptions/[id]/cancel` — `{ immediate }` → immediate `cancelled`, else `cancelAtPeriodEnd=true`.
* `GET /api/admin/membership-invoices?status&vendor&plan`, `GET/PATCH /api/admin/membership-invoices/[id]` — PATCH `{ action:'refund'|'void', reason }`; void only when `pending|failed|past_due`; refund only when `paid` (negative-side audit + best-effort PayMongo refund call).
* `POST /api/admin/vendors/[id]/approve` — `{ approve, reason?, waive?:{until, reason} }`. Gate: must have `resolveActiveSubscription in (active|trialing)` OR `waivedUntil > now` with reason, else `402 SUBSCRIPTION_REQUIRED` (not 400). On pass: `vendors{verificationStatus:'verified'|'rejected', isActive:approve}` + audit `admin_approve`. Manual waive without subscription requires `reason >= 10 chars`.
* `PUT/DELETE /api/admin/vendors/[id]/commission-override` — `{ pct|null (0–30 clamp), reason }` → sets `vendors.commissionOverride` + audit; DELETE clears to inherit.
* `POST /api/admin/subscriptions/retry-due` — dunning sweep (also cron, `BILLING_CRON_SECRET`).
* `src/app/api/cron/membership-sweep/route.ts` (new, `BILLING_CRON_SECRET`) — flips `past_due → grace → expired`, `cancelAtPeriodEnd` at period end → `cancelled`, resets `usage` counters each period.

### 4.3 State machines

**Subscription:** `trialing →(trial ends, no pay)→ pending →(invoice paid)→ active →(renew paid)→ active →(cancelAtPeriodEnd, period hits)→ cancelled`; `active →(upgrade paid)→ active (plan swapped)`; `active →(downgrade)→ active + scheduledPlan (swaps at periodEnd)`; `active →(payment failed)→ past_due → grace(7d, read-only) → suspended(read-only) →(paid)→ active` else `→ cancelled/expired`. In `grace`/`suspended`: `accept_orders=false`, outlet/product writes blocked `402`, reads allowed.

**Invoice:** `pending →(webhook paid)→ paid (terminal)`; `pending →(failed, retries left)→ past_due →(retry paid)→ paid` else `→ failed (terminal, triggers sub grace)`; `(admin void, only pending|failed|past_due)→ void`; `(admin refund, only paid)→ refunded`. All transitions guarded by `idempotencyKey` + `eventId` replay check.

**Vendor approval:** `pending →(approve=true + sub active|trial|waived)→ verified (isActive=true)`; `pending →(approve=false + reason)→ rejected`; `verified →(sub suspended/cancelled, no waive)→ stays verified but isActive=false (paywalled, not de-verified)`; `any →(fraud)→ suspended (admin, reason + audit)`.

**402 error shape (all gates):**

```json
{ "error": "Active membership required to sell", "code": "MEMBERSHIP_REQUIRED", "vendorId": 12, "subscriptionStatus": "past_due", "requiredPlan": "Basic", "status": 402 }
```

Payload hooks: `throw new APIError(message, 402, ...)` with `data: { code, requiredPlan, subscriptionStatus }`. Route handlers: `NextResponse.json({...}, { status: 402 })`.

---

## 5. Enforcement matrix (defense-in-depth, no frontend)

Helper: `requireActiveMembership(payload, vendorId, { fn })` — finds `vendor-subscriptions where vendor==id AND status in [active, trialing] AND current_period_end > now` (or `waivedUntil > now`, or fallback Basic when enabled); 60s in-request cache; `isMembershipEnforced()===false` → log-only allow (tests/seeds). Admin bypass for reads only, never vendor writes.

Modes: `hard-block` (all create/update-to-publish writes → 402), `read-only` (grace: GETs allowed, writes blocked), `hide-listings` (customer discovery filters, no error), `Basic fallback` (no sub or expired + `BILLING_GRANDFATHER_BASIC=true` → auto Basic ₱0 high-commission, `limits {outlets:1, products:20, coupons:0}`; never auto-upgrade).

| File | Hook / method | Gate |
|---|---|---|
| `src/collections/Vendors.ts` | `beforeChange` create | No block (registration allowed, `verificationStatus=pending`). Sellable flip happens via approval + subscription |
| `src/collections/Merchants.ts` | `beforeChange` create + update where `isActive:true \|\| isAcceptingOrders:true \|\| operationalStatus:open` | resolve `vendorId=data.vendor` → `requireActiveMembership`. Keep outletCode autogen + coordinates sync first, membership check second |
| `src/collections/Products.ts` | `beforeChange` create/update where publish (`isActive:true && catalogVisibility!=='hidden'`) | resolve vendor (`createdByVendor ?? createdByMerchant→merchant.vendor ?? req.user vendor lookup`) → block. Keep owner-exclusivity + slug logic |
| `src/collections/MerchantProducts.ts` | `beforeChange` create + update where `is_active && is_available` | resolve `merchant_id→vendor` → block publish. Keep `display_title` logic |
| `src/collections/Coupons.ts` | new `beforeChange` create (+ existing `beforeValidate`) | if `data.vendor` set → `requireActiveMembership` + entitlement count (`Basic→block all`, `Growth→max 5 active`) |
| `src/collections/Orders.ts` | `beforeChange` update `pending→accepted/preparing` | resolve `merchant→vendor` → block. Do NOT block `create(pending)` — customer checkout still creates pending; kitchen acceptance is gated. Keep totals invariant |
| `src/app/api/vendor/outlets/route.ts POST`, `outlets/[id]/route.ts PATCH/PUT`, `outlets/[id]/status/route.ts POST`, `vendor/products/route.ts POST/PATCH`, `vendor/coupons/route.ts + [id]/route.ts`, `vendor/orders/route.ts PATCH→accepted` | route handler | `authenticateVendor → vendorId → requireActiveMembership → 402 early`. Going-offline (`open→closed`, `true→false`) always allowed |
| `src/app/api/admin/vendors/*, merchants/*, products/*, coupons/*, orders/*` | POST/PATCH | guard with `allowAdminBypass=false` for vendor-initiated; `true` only for explicit ops override + audit |
| New `vendor/membership/*`, `admin/membership/*` | all | Never gated (must be reachable when blocked) |
| `src/services/GeospatialService.ts` (`findMerchantsWithinRadius`, `findMerchantsInDeliveryRadius`, `findMerchantsInServiceArea`, `...PostGIS`) | read filter | extend existing `isActive && isAcceptingOrders && vendor.isActive && bz.isActive` with membership-active: Payload paths post-filter `merchant.vendor.membershipStatus==='active'` (needs `depth:2`); PostGIS SQL `LEFT JOIN vendor_subscriptions vs ON vs.vendor_id=v.id AND vs.status IN ('active','trialing')` + `AND vs.id IS NOT NULL` (or `OR v.grandfathered_basic=true` in backfill window) |
| `src/endpoints/merchantLocationBasedDisplay.ts`, `merchantLocationBasedProductCategories.ts`, `merchantProductDetail.ts`, `effectiveModifiers.ts` | read filter | drop docs where `!canSell` unless `?includeInactive=true&role=admin`; return `membershipHidden:true` in meta, not 402 |
| `src/endpoints/couponsValidate.ts` + `CouponService.ts` | validate | vendor membership inactive → `valid:false, reason:'VENDOR_MEMBERSHIP_INACTIVE'` (422 customer-facing, not 402) |

Explicit non-gates: `proxy.ts`, `POST /api/vendor/profile`, analytics/reports reads, `paymongo/webhook` order path.

---

## 6. Migration, seed, env

### 6.1 Migration steps

1. `pnpm --filter @encreasl/cms payload migrate:create -- -n membership_plans_subscriptions` → edit `src/migrations/YYYYMMDD_HHMMSS_membership_*.ts` with `CREATE TABLE membership_plans, vendor_subscriptions, subscription_invoices, commission_rules, vendor_entitlements, membership_audit_log`, FKs to `vendors(id) ON DELETE CASCADE`, indexes `(vendor_id, status)`, `(plan_id, status)`, `ALTER TABLE vendors ADD COLUMN ... (grandfathered_basic bool DEFAULT false, current_subscription, subscription_status, ...)`. Follow `src/migrations/20260930_111554.ts` `sql``` + `payload_locked_documents_rels` pattern.
2. `scripts/seed-membership-plans.mjs` (new, idempotent, run via `payload run` or drizzle execute): `free-legacy` (hidden, no selling), `basic` (₱0, 18% / 1800bps, 1 outlet / 20 products / 0 coupons, default fallback), `growth-monthly/yearly` (e.g. ₱499/₱4,990, 8%, 5 outlets / 500 products / 5 coupons), `pro-monthly/yearly` (e.g. ₱1,499/₱14,990, 5%, unlimited / 50 coupons), `enterprise` (hidden, custom, admin-assign only).
3. `SystemSettings` seed: `membershipEnabled=false` initially, `graceDays`, `defaultPlanSlug='basic'`.
4. Verify: `pnpm --filter @encreasl/cms payload migrate:status`, `payload generate:types`.
5. Backfill: `scripts/backfill-grandfather-basic.mjs` (new) — for every vendor with no active subscription: create `vendor-subscriptions {plan=Basic v1, status:active, currentPeriodEnd=+10y, grandfathered:true}` + `subscription-invoices {status:waived, memo:'grandfathered-backfill'}` + `vendors{grandfatheredBasic:true, grandfatheredAt:now}`. No PayMongo calls. Dry-run first: counts must match `SELECT count(*) FROM vendors WHERE id NOT IN (SELECT vendor_id FROM vendor_subscriptions)`.
6. History note (2026-10-01): the database had been synced via dev-mode push, so the membership schema already existed when `20261001_061959` was generated — that file is recorded in `payload_migrations` (batch 2) as a baseline but never executed (its CREATEs target existing objects). `20261001_063000_membership_disabled_setting` (single ADD COLUMN) executed normally (batch 3). Pre-existing stale `Ran=No` rows predate this work; leave them alone — never run a full `pnpm payload migrate` on this DB without resolving them first (it replays stale files and aborts).

### 6.2 Config split: DB settings vs `.env` secrets (also `.env.example`)

Operational settings live in the **System Settings global** (`membership` group, admin-editable, no redeploy).
Plan prices live on the **`membership-plans` collection** (`price` field). Only secrets stay in `.env`:

```
# .env / .env.example — secrets only
BILLING_CRON_SECRET=<random>
PAYMONGO_MEMBERSHIP_WEBHOOK_SECRET=<separate from order webhook if needed>
STRIPE_WEBHOOK_SECRET=<optional, stub until set>
```

| Old env var | Where it lives now |
|---|---|
| `BILLING_ENFORCE_MEMBERSHIP` | System Settings `membership.membershipEnabled` + `membershipEnforced` (env `=true` forces on, `=false` forces off — emergency override only) |
| `BILLING_GRANDFATHER_BASIC` | System Settings `membership.grandfatherBasicEnabled` (default on; env `=false` forces off) |
| `BILLING_GRACE_DAYS` | System Settings `membership.graceDaysDefault` (explicit env wins when set) |
| `BILLING_DEFAULT_PLAN` | System Settings `membership.fallbackBasicPlanSlug` (explicit env wins when set) |
| `PAYMONGO_MEMBERSHIP_PRICE_*` | Deleted — prices come from `membership-plans.price` at checkout (PayMongo intents are created dynamically) |
| `PAYMONGO_MEMBERSHIP_DISABLED` | System Settings `membership.paymongoMembershipDisabled` (env `=true` forces 410 alias-off) |
| Checkout provider | System Settings `membership.payProviderDefault` (`BILLING_PAY_PROVIDER` env wins when set) |

---

## 7. Security / cross-cutting

* Auth: public register/webhook = no JWT (rate-limit + zod + signature). Vendor self = vendor auth + vendor-id scoping on every query (never trust `body.vendorId`). Admin = `authenticateAdmin`. `overrideAccess` only inside BFF after auth.
* Validation: `zod` schemas in `membershipSchemas.ts` (email, PH phone, prices ≥ 0, pct 0–30, reason min lengths) → `400 + issues[]`.
* Idempotency: `Idempotency-Key` unique on `vendor-subscriptions` + `subscription-invoices`; replay returns original + `deduplicated:true`; webhook guard via `membership-audit-log.eventId`.
* Rate-limit: register 10/hr/IP, checkout 20/hr/vendor, webhook 300/min/IP.
* Audit: every mutate writes `membership-audit-log` (actor, action, diff); waive/approve/commission-override require `reason`, non-deletable.
* Secrets via env only; never echo raw provider blobs to vendor clients (sanitize `raw` out).

---

## 8. Testing (backend only)

Run: `pnpm --filter @encreasl/cms test:int` (vitest `tests/int/**/*.int.spec.ts` per `vitest.config.mts`); e2e `pnpm --filter @encreasl/cms test:e2e` (playwright `tests/e2e/`, `request` fixture only — no browser UI).

Unit (`tests/int/membership-*.int.spec.ts`, pure, no DB):

* `membership-proration.int.spec.ts`: upgrade mid-cycle credit, downgrade deferred to period end, yearly→monthly math, centavo rounding.
* `membership-entitlement.int.spec.ts` matrix: Basic active (1 outlet ✅ / 2nd 402, coupon 402 always), Growth active (coupon < 5 ✅), `past_due` in grace (new writes 402, GETs ✅), expired/none (all writes 402, hidden), toggle `open→closed` always allowed.
* `membership-dunning.int.spec.ts`: `active→past_due (payment.failed) → graceUntil=+N → expired (sweep past grace) → active (payment.paid)`; `cancelAtPeriodEnd` stays sellable until `currentPeriodEnd`.
* `membership-commission.int.spec.ts`: snapshot wins after plan change; Basic 1800bps vs Pro 500bps; Enterprise custom.

Integration (`tests/int/membership-lifecycle.int.spec.ts`, DB + `overrideAccess`):

1. register → checkout → mock PayMongo PI paid → webhook paid → subscription active → outlet ✅ → publish product ✅ → coupon ✅ (Growth) → accept order ✅.
2. webhook `payment.failed` → `past_due` → outlet 402 + `requiredPlan` → GET orders 200 (read-only) → GeospatialService hides outlet.
3. sweep past grace → expired → all writes 402; webhook paid → active again.
4. Basic fallback: no sub + `BILLING_GRANDFATHER_BASIC` → 1 outlet ✅, 2nd 402, coupon 402.

E2E (`tests/e2e/membership.e2e.spec.ts`): `POST /api/vendor/outlets` without membership → `402 {code:MEMBERSHIP_REQUIRED, requiredPlan}`; checkout→webhook→publish-allowed; `GET /api/merchants-by-location` excludes expired vendor (200 filtered); `proxy.ts` untouched (OPTIONS CORS passes).

---

## 9. Phased implementation (Phase 0–5) + acceptance

**Phase 0 — Scaffolding (no enforcement).** Files: `src/collections/MembershipPlans.ts`, `VendorSubscriptions.ts`, `SubscriptionInvoices.ts`, `CommissionRules.ts`, `VendorEntitlements.ts`, `MembershipAuditLog.ts` (new); `src/payload.config.ts` (register 6); `src/migrations/*_membership_*.ts` (new); `scripts/seed-membership-plans.mjs` (new); `.env.example` (+ vars). Accept: `migrate:status` clean, `generate:types` passes, seed idempotent (re-run = 0 dupes), all existing `test:int` green, zero behavior change.

**Phase 1 — Core lib + kill-switch.** Files: `src/services/MembershipService.ts`, `EntitlementService.ts`, `CommissionService.ts`, `MembershipAuditService.ts`, `membershipProviders.ts` (new); `src/utils/membershipGuard.ts`, `membershipShared.ts`, `membershipSchemas.ts`, `membershipRateLimit.ts` (new); `src/globals/SystemSettings.ts` (membership group); `Vendors.ts` extension; `MerchantCategories.ts` + `Coupons.ts` extension. Accept: unit specs pass; `membershipEnabled=false` → all allowed + warn logged; `true` → 402 shape exact.

**Phase 2 — Write-path enforcement.** Files: `Merchants.ts`, `Products.ts`, `MerchantProducts.ts` (`beforeChange` + membership check), `Coupons.ts` (`beforeChange` new), `Orders.ts` (accept-transition gate); `src/app/api/vendor/outlets/route.ts`, `outlets/[id]/route.ts`, `outlets/[id]/status/route.ts`, `vendor/products/route.ts`, `vendor/coupons/route.ts (+[id])`, `vendor/orders/route.ts` (early 402). Accept: lifecycle cases 1–2 pass; going-offline never blocked; internal `overrideAccess:true` jobs unaffected.

**Phase 3 — Hide-listings + coupons/order convergence.** Files: `GeospatialService.ts` (4 methods + PostGIS `JOIN vendor_subscriptions`), `merchantLocationBasedDisplay.ts`, `merchantLocationBasedProductCategories.ts`, `merchantProductDetail.ts`, `effectiveModifiers.ts`, `CouponService.ts`, `couponsValidate.ts`. Accept: expired vendor absent from all geospatial paths (Payload + PostGIS) with 200; coupon validate 422 `VENDOR_MEMBERSHIP_INACTIVE`; order `create(pending)` allowed, `accept` blocked.

**Phase 4 — Billing wiring + dunning.** Files: `src/app/api/vendor/register/route.ts`, `vendor/subscriptions/checkout|upgrade|downgrade|renew|cancel/route.ts`, `vendor/subscription/route.ts`, `vendor/invoices/**`, `vendor/subscription/trial|coupon/route.ts` (new); `src/app/api/admin/membership-plans/**`, `admin/subscriptions/**`, `admin/membership-invoices/**`, `admin/vendors/[id]/approve`, `admin/vendors/[id]/commission-override`, `admin/subscriptions/retry-due`, `cron/membership-sweep/route.ts` (new); `src/endpoints/paymongoMembershipWebhook.ts`, `stripeMembershipWebhook.ts` (new); `MembershipPlans.beforeDelete` guard. Accept: checkout→paid→active green; `payment.failed→past_due`; sweep→expired; delete-with-subscribers→409; plan version bump doesn't mutate existing snapshots.

**Phase 5 — Backfill + rollout.** Files: `scripts/backfill-grandfather-basic.mjs` (new), grandfather migration (vendor columns), ops runbook section below. Accept: dry-run counts match; backfill creates `waived` invoices; flag flip `BILLING_ENFORCE_MEMBERSHIP=false→true` with zero 500s; full `test:int && test:e2e` green.

---

## 10. File checklist (all backend, no pages)

```
NEW  src/collections/MembershipPlans.ts
NEW  src/collections/VendorSubscriptions.ts
NEW  src/collections/SubscriptionInvoices.ts
NEW  src/collections/CommissionRules.ts
NEW  src/collections/VendorEntitlements.ts
NEW  src/collections/MembershipAuditLog.ts
MOD  src/collections/Vendors.ts (+ §2.7 fields)
MOD  src/collections/Merchants.ts (+ isFeatured/listingBoost optional)
MOD  src/collections/MerchantCategories.ts (+ commissionOverridePct)
MOD  src/collections/Coupons.ts (+ appliesTo membership + whitelist)
MOD  src/globals/SystemSettings.ts (+ membership group)
MOD  src/payload.config.ts (register 6 collections + 2 webhook endpoints)
NEW  src/services/membershipProviders.ts
NEW  src/services/MembershipService.ts
NEW  src/services/EntitlementService.ts
NEW  src/services/BillingService.ts
NEW  src/services/CommissionService.ts
NEW  src/services/MembershipAuditService.ts
NEW  src/utils/membershipShared.ts
NEW  src/utils/membershipSchemas.ts
NEW  src/utils/membershipGuard.ts
NEW  src/utils/membershipRateLimit.ts
NEW  src/endpoints/paymongoMembershipWebhook.ts
NEW  src/endpoints/stripeMembershipWebhook.ts
NEW  src/app/api/vendor/register/route.ts
NEW  src/app/api/vendor/subscriptions/checkout/route.ts
NEW  src/app/api/vendor/subscriptions/upgrade/route.ts
NEW  src/app/api/vendor/subscriptions/downgrade/route.ts
NEW  src/app/api/vendor/subscriptions/renew/route.ts
NEW  src/app/api/vendor/subscriptions/cancel/route.ts
NEW  src/app/api/vendor/subscription/route.ts
NEW  src/app/api/vendor/subscription/trial/route.ts
NEW  src/app/api/vendor/subscription/coupon/route.ts
NEW  src/app/api/vendor/invoices/route.ts
NEW  src/app/api/vendor/invoices/[id]/route.ts
NEW  src/app/api/admin/membership-plans/route.ts
NEW  src/app/api/admin/membership-plans/[id]/route.ts
NEW  src/app/api/admin/subscriptions/route.ts
NEW  src/app/api/admin/subscriptions/[id]/route.ts
NEW  src/app/api/admin/subscriptions/[id]/waive/route.ts
NEW  src/app/api/admin/subscriptions/[id]/cancel/route.ts
NEW  src/app/api/admin/subscriptions/retry-due/route.ts
NEW  src/app/api/admin/membership-invoices/route.ts
NEW  src/app/api/admin/membership-invoices/[id]/route.ts
NEW  src/app/api/admin/vendors/[id]/approve/route.ts
NEW  src/app/api/admin/vendors/[id]/commission-override/route.ts
NEW  src/app/api/cron/membership-sweep/route.ts
NEW  src/app/api/webhooks/paymongo-membership/route.ts (alias)
NEW  src/app/api/webhooks/stripe-membership/route.ts (501 stub)
MOD  src/collections/Merchants.ts, Products.ts, MerchantProducts.ts, Coupons.ts, Orders.ts (hooks)
MOD  src/app/api/vendor/outlets/route.ts, outlets/[id]/route.ts, outlets/[id]/status/route.ts,
     vendor/products/route.ts, vendor/coupons/route.ts (+[id]), vendor/orders/route.ts (early 402)
MOD  src/services/GeospatialService.ts + 4 location endpoints + CouponService.ts + couponsValidate.ts
NEW  src/migrations/*_membership_*.ts
NEW  scripts/seed-membership-plans.mjs
NEW  scripts/backfill-grandfather-basic.mjs
MOD  .env.example (+ §6.2 vars)
NEW  tests/int/membership-proration.int.spec.ts
NEW  tests/int/membership-entitlement.int.spec.ts
NEW  tests/int/membership-dunning.int.spec.ts
NEW  tests/int/membership-commission.int.spec.ts
NEW  tests/int/membership-lifecycle.int.spec.ts
NEW  tests/e2e/membership.e2e.spec.ts
```

---

## 11. Ops rollout runbook (backend)

1. Deploy Phase 0–1 with `membershipEnabled=false` → verify migrations + seeds, existing tests green.
2. Deploy Phase 2–3 with enforcement still off → verify log-only bypass warnings, no 402s.
3. Run `backfill-grandfather-basic.mjs --dry-run` → compare counts → run live → verify `waived` invoices.
4. Deploy Phase 4 → test checkout→webhook paid in staging with PayMongo sandbox → verify `retry-due` + `membership-sweep` cron.
5. Flip `BILLING_ENFORCE_MEMBERSHIP=true` (keep `GRANDFATHER_BASIC=true` initially) → monitor 402 rate + webhook failures + `membership-audit-log`.
6. Tune plans/commissions via admin APIs only (never direct DB); version-bump plans instead of editing snapshots.
