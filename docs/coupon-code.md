# Coupon Codes — Implementation Plan (multi-vendor food delivery)

Status: IMPLEMENTED in `apps/cms` (2026-09-03). This doc is now the record: §1–§10 the plan,
§11 the build notes (files, endpoints, what still needs a client).
Model: FoodPanda-style marketplace. **Vendor = brand/business entity (e.g. Jollibee). Merchant = outlet/branch (e.g. Jollibee Pasig, Jollibee Manila).** One vendor owns many merchants.
Proven reference: WooCommerce coupons (WordPress), adapted below — same object semantics and validation order, re-scoped to vendor → merchant hierarchy plus delivery-fee and settlement concerns WooCommerce does not have.

---

## 1. Existing architecture (what we found)

### 1.1 Vendor → Merchant hierarchy

- `apps/cms/src/collections/Vendors.ts` — brand owner: `user → users` (role `vendor`), `businessName`, `businessRegistrationNumber` (unique), `businessType`, `verificationStatus` (`pending/verified/rejected/suspended`), denormalized `totalMerchants`.
- `apps/cms/src/collections/Merchants.ts:41-49` — outlet: **`vendor → vendors` (required)**. So 1 vendor : N merchants. `outletName`, `outletCode` (unique, auto `beforeChange`), `isActive / isAcceptingOrders / operationalStatus`, `businessZone → business-zones`, geo + `delivery_radius_meters / delivery_fee_base / per_km / free_delivery_threshold`, `deliverySettings { minimumOrderAmount, deliveryFee, freeDeliveryThreshold }`, `timezone` (default `Asia/Manila`).
- Proof of 1:N intent: `Products.ts:383-391` queries `merchants where vendor == vendorId`; `MerchantProducts.ts:139-177` resolves `merchant.vendor → createdByVendor`.

### 1.2 Catalog ownership (master + join)

- `Products.ts:40-57` — master product has **XOR ownership**: `createdByVendor → vendors` or `createdByMerchant → merchants` (enforced `beforeValidate:267-286`).
- `MerchantProducts.ts` (slug `merchant-products`) — branch listing join: `merchant_id → merchants` (required), `product_id → products` (required, `filterOptions` restricts to same-vendor products), `price_override` (null = master price), `stock_quantity`, `is_active / is_available`, `added_by: vendor|merchant`.
- Vendor bulk-assign: `Products.ts:353-411 beforeChange` collects active branch ids, `afterChange:550-610` creates missing `merchant-products` rows.

### 1.3 Order lifecycle and pricing (today — no coupons)

```
cart-items (active) → orders + order-items + delivery-locations + transactions(pending)
  → POST /create-payment-intent → PayMongo → POST /paymongo/webhook
  → transactions(paid/failed), orders(accepted), cart-items(ordered)
  → POST /delivery/book → delivery-bookings + orders(delivery_fee/total/...)
  → webhooks/track → delivery statuses → reviews + order-tracking
```

- `CartItems.ts:251-279,533-548` — line `subtotal = (priceAtAdd + modifiers + addons*qty) * quantity` (`beforeChange`, server-authoritative). No discount term.
- `Orders.ts:154-186` — `total` ("Grand total (Subtotal + Fees − Discounts)"), `subtotal`, `delivery_fee` (default 0), `platform_fee` (default 0). **No `discount_total` column** — the "− Discounts" is aspirational. No total-recompute hook (only `afterChange` notifications).
- `OrderItems.ts:110-140` — `price_at_purchase`, `quantity`, `total_price`; `beforeValidate` only validates `options_snapshot`.
- `Transactions.ts:55-81` — `amount`, `payment_method`, `status: pending|paid|failed|refunded`.
- `payload.config.ts:1132-1224 POST /create-payment-intent` — takes client `amount` (centavos, ≥100), creates PayMongo intent. **Does not see cart/order/discount.**
- `endpoints/paymongoWebhook.ts:38-98` — on `payment.paid`, marks `transactions → paid`, `orders → accepted`, `cart-items → ordered` by `payment_intent_id`. No amount-vs-total check.
- `endpoints/deliveryBook.ts:277-293` — **recalculates** `total = subtotal + deliveryFee + platform_fee + priorityFee` (discount-ignorant; would wipe a coupon). `deliveryCancel.ts:97,122-132` — `newTotal = subtotal + platform_fee` (same issue).
- Mobile checkout (`CheckoutScreen.tsx:155,447-465,694-714`) — `orderTotal = subtotal + deliveryFee + priorityFee`, `platform_fee: 0`; writes `orders`, `order-items`, `transactions { amount: orderTotal }` with the same client number. No coupon field sent.

### 1.4 What exists for promos today

- `OrderDiscounts.ts` (slug `order-discounts`) — **audit log only**: `order → orders` (required), `code` text (e.g. `WELCOME100`), `amount_off` number, `type: percentage|fixed`. Access `service|admin` only. **Zero writers** — nothing creates these rows at checkout. The only reader is `apps/cms/src/app/api/admin/orders/[id]/route.ts:184-191` (surfaced as `discounts[]`). Commented-out `source_voucher → 'vouchers'` (lines 68-76) references a collection that **does not exist**.
- `Customers.ts:89-94 couponCode` — free-text marketing code at registration. No validation, never applied to orders.
- `Products.compareAtPrice`, `CartItems.compareAtPrice` — strikethrough display only.
- `ProductCategories promotions_*` — removed (`migrations/20251124_021145.ts:14-18`). `ProdTags.tag_type = 'promotion'` — tagging only.
- web-admin sidebar has dead `/promotions/*` links with no pages.

### 1.5 Coupon integration points (exact)

1. Cart line pricing (`CartItems beforeChange`) — scope/snapshot hook.
2. Checkout quote (`deliveryQuote` + client `orderTotal`) — show discounted total pre-pay.
3. Order creation (`Orders` + client POST) — persist `discount_total`, enforce `total = subtotal + delivery + platform + priority − discount`.
4. `OrderDiscounts` write — create row(s) atomically with order.
5. `Transactions.amount` + `/create-payment-intent` — charge discounted total; server must recompute, not trust client.
6. `deliveryBook` / `deliveryCancel` re-totals — must preserve discount / free-delivery.
7. Admin order detail (`admin/orders/[id]`) + list (`admin/orders`) — expose discount; list currently omits it.
8. Reports/payouts (`admin/reports`, `admin/transactions`, `vendor/payouts`, `analytics`, `dashboard`) — all derive revenue from `transactions.amount / orders.total` with no discount split; must add discount accounting or vendors get overpaid.
9. Customer order views (`app/api/orders/aggregate`) — add discount row.

---

## 2. WooCommerce coupon design (proven pattern to copy)

Sources: [Coupon management](https://woocommerce.com/document/coupon-management/), [Coupons REST API v3](https://developer.woocommerce.com/docs/apis/rest-api/v3/coupons/), [`WC_Coupon`](https://github.com/woocommerce/woocommerce/blob/trunk/plugins/woocommerce/includes/class-wc-coupon.php), [`WC_Discounts`](https://raw.githubusercontent.com/woocommerce/woocommerce/trunk/plugins/woocommerce/includes/class-wc-discounts.php), [`WC_Coupon_Data_Store_CPT`](https://github.com/woocommerce/woocommerce/blob/dcecf0f22890f3cd92fbea13a98c11b2537df2a8/includes/data-stores/class-wc-coupon-data-store-cpt.php), [coupon functions](https://github.com/woocommerce/woocommerce/blob/10.2.2/plugins/woocommerce/includes/wc-coupon-functions.php), [`WC_Cart::apply_coupon`](https://github.com/woocommerce/woocommerce/blob/76cf1e4e93a9205e5639b5c773f43daff485688a/includes/class-wc-cart.php), [Coupons report](https://woocommerce.com/document/woocommerce-analytics/coupons-report/), [order coupon line storage change](https://developer.woocommerce.com/2024/02/08/changes-in-order-coupons-line-item-storage/).

### 2.1 Core coupon object (`WC_Coupon::$data`)

| Field | Semantics (adopt) |
|---|---|
| `code` | Case-insensitive unique string (`wc_format_coupon_code`); lookup `LOWER(title)`; duplicate codes resolve newest-first |
| `discount_type` | `percent` \| `fixed_cart` \| `fixed_product` (default `fixed_cart`); legacy `percent_product` aliased to `percent` |
| `amount` | Numeric string, no symbols; percent validated 0–100 |
| `description` | Admin-internal only |
| `status` | `publish` = usable; `draft`/trash unusable (trash ≡ nonexistent) |
| `date_expires` (+ created/modified) | Expiry compare `now > expires` fails; **no native start date** (scheduling = future publish) |
| `usage_count` (read-only) | Global counter, atomic SQL `SET = +1/−1` |
| `used_by[]` (read-only) | One row per redemption: user ID **or** lowercase guest email; lazy-loaded |
| `usage_limit` / `usage_limit_per_user` | `0`/empty = unlimited |
| `limit_usage_to_x_items` | Only meaningful when product allowlist set; null = unlimited |
| `free_shipping` | Flag enabling a `free_shipping` shipping method (does **not** itself discount shipping) |
| `product_ids` / `excluded_product_ids` | CSV ids, variation-aware (checks id + parent) |
| `product_categories` / `excluded_product_categories` | Serialized term ids |
| `exclude_sale_items` | Skip sale lines |
| `minimum_amount` / `maximum_amount` | `''/0` = unbounded; joint `min <= max`; checked against displayed subtotal |
| `email_restrictions[]` | Sanitized lowercase, `*` wildcards (`*@gmail.com`) |
| `individual_use` | If set on new coupon → evict existing; if set on existing → block new (filter-overridable) |
| `virtual` | Non-stored, on-the-fly (deleted-coupon reconstruction) |

### 2.2 Discount math (all in cents, `WC_Discounts`)

- Eligible lines: skip zero-price/qty; keep line if valid-for-product **or** valid-for-cart; sort high-price-first for deterministic remainder.
- `percent`: per eligible line `floor(price × pct)`, then 1¢ remainder distribution. Sequential mode uses already-discounted base, else original.
- `fixed_product`: `min(amount, unit_price) × qty`, capped so lines never go negative.
- `fixed_cart`: `per_item = floor(amount / total_qty)` → delegate to fixed-product logic recursively + remainder pass (proportional split keeps tax fair).
- Stacking: `discounts[code][line]` accumulates; views by coupon and by line.
- Tax note: discounts apply **before tax**; shipping untouched except via `free_shipping` method gating.

Example (cart 3×$20=$60): `percent:10` → $6 off; `fixed_cart:10` → $10 off; `fixed_product:10` → $30 off.

### 2.3 Validation order (`WC_Discounts::is_coupon_valid`, codes in parens)

1. Exists (105) — `id==0`/virtual/trash.
2. Global usage limit (106/115/116, incl. tentative holds for races).
3. Per-user limit (106/115; guest email deferred to checkout-validation).
4. Expiry (107).
5. Minimum spend (108) vs displayed subtotal.
6. Maximum spend (112).
7. Product allowlist (109) — ≥1 line must intersect.
8. Category allowlist (109).
9. Excluded items (109) — product types only: ≥1 line must survive full composite.
10. Eligible items — cart types only: any sale line (110) / excluded id (113) / excluded category (114) invalidates whole coupon (vs product types which merely skip lines).
11. Email allowlist (102, wildcard match on user + billing email).
12. `woocommerce_coupon_is_valid` filter veto (100).

Cart wrapper adds: global kill-switch, code normalization, already-applied (103), `individual_use` evict/block (104), success (200). Re-validation on cart change auto-removes (101); post-email checkout validation re-checks email + guest per-user limit.

`is_valid_for_product` composite: (in allowlist-ids OR allowlist-cats OR no allowlist) AND NOT excluded-id AND NOT excluded-cat AND NOT (exclude-sale AND on-sale).

### 2.4 Usage tracking

- `usage_count` atomic increment/decrement; `used_by` add-one-row / delete-one-row (not delete-all).
- Increment on order pay; decrement on coupon-remove / refund-cancel paths.
- **Tentative holds** (`check_and_hold_coupon[for_user]`) so concurrent checkouts can't both pass a nearly-exhausted limit.

### 2.5 Persistence: cart (ephemeral) vs order (durable)

- Cart: `applied_coupons[]` (session) + `discounts[code][line]` cents map.
- Order: `WC_Order_Item_Coupon` (`order_item_type='coupon'`) `{ code, discount (actual ex-tax), discount_tax }`; order aggregates `discount_total/discount_tax`.
- Snapshot per line (**`coupon_info`** JSON `[id, code, type, nominal_amount, free_shipping?]`; replaced legacy full-object `coupon_data` in WC 8.7). Later edits/deletes don't rewrite history; recalc uses live definition or virtual-from-snapshot fallback.
- Reporting: `wc_order_coupon_lookup (order_id, coupon_id, discount_amount, date)`; deleted coupons get synthetic negative ids.

### 2.6 Admin UX + REST

- Settings → General → *Enable coupons* kill-switch. Marketing → Coupons list: `Code | Type | Amount | Description | Products | Usage/Limit | Expiry`; filter by type; search by code.
- Edit tabs: **General** (type, amount, free-shipping, expiry) / **Usage restriction** (min/max, individual-use, exclude-sale, products±, categories±, emails) / **Usage limits** (per-coupon, per-X-items, per-user). Publish box doubles as scheduler.
- Shopper: cart/checkout code box → Apply → reason-specific error. Manual-order coupon apply on unpaid orders.
- REST `/wc/v3/coupons` CRUD + `batch` (≤100) + `?code=` filter, `force` delete, read-only counters; orders expose `coupon_lines[]` with `discount` (actual) vs `nominal_amount` (defined) vs `discount_type`.

---

## 3. Adaptation: what changes for multi-vendor food delivery

| WooCommerce assumption | Our reality | Decision |
|---|---|---|
| Global `product_ids/categories` scoping | Hierarchy **platform → vendor (brand) → merchant (branch) → items/categories**. "Jollibee coupon" must not leak to McDonald's, nor necessarily to every Jollibee branch | Add **vendor/merchant gate** (new step 6.5 in validation): `vendor` (required for brand coupons) + `merchants[]` (empty = all branches of that vendor) + `merchant scoping mode: all_vendor_branches | selected_branches`; basket is single-merchant per order, so eligibility = order.merchant ∈ coupon scope |
| `free_shipping` flag + zone method | Delivery fee is first-class, distance-based, per merchant; free-delivery is the dominant promo, often capped/min-gated | Model `applies_to: food_subtotal \| delivery_fee \| both` + `free_delivery: bool` + `delivery_discount_cap`. Food and delivery discounts computed as **separate lines** |
| Multi-coupon stacking default | One coupon per food order (branch-exclusive); stacking causes payout disputes | Default **`individual_use = true` / `max_coupons_per_order = 1`**; keep Woo evict/block logic but inverted default |
| Tax-split proportional math | PH VAT-inclusive menu prices, fees separate; percent-off-food vs percent-off-delivery must not mix | Simplify: percent/fixed apply to **food subtotal ex-fees** unless `applies_to = delivery`; keep Woo caps (never negative) + 1¢ remainder, drop inc/ex-tax branching |
| CPT + postmeta | Payload collections + Postgres; need atomic counters + case-insensitive uniqueness | Typed `coupons` collection; **unique index on `(lower(code), vendor)`**; atomic `usage_count ± 1`; `used_by` as separate **`coupon-redemptions`** collection (not unbounded array) |
| No start date | Campaign scheduling needed | Add **`starts_at`** (Woo has none) + `expires_at`; both enforced |
| Email-only allowlist | OTP/phone guests, segments | Keep `email_restrictions`, add **`phone_restrictions`, `first_order_only`, `allowed_payment_methods[]`** |
| Implicit coupon cost | Must attribute cost for settlement | Add **`funded_by: platform \| vendor \| split` + `vendor_share_pct`**; persist `discount_alloc { platform, vendor }` per order-coupon line |
| Coupon-only reports | Ops need brand/branch/fee-type cuts | Lookup extended with `vendorId, merchantId, food_discount, delivery_discount` |
| Uncapped percent | Food margins thin | Add **`max_discount_amount`** (cap for percent; e.g. 20% up to ₱100) |
| Anytime coupons | Daypart campaigns (lunch rush) | Add optional **`time_windows[] { days[], start, end }`** |

---

## 4. Proposed schema

### 4.1 New `coupons` collection (slug `coupons`, group `Marketing`)

Mirrors Woo fields + vendor-delivery extensions. Access: `read: service|admin` (+ vendor read-own for future portal), `create/update/delete: admin` (Phase 2: vendor create-own subject to approval).

```
code: text, required, unique-per-vendor (enforced by DB index lower(code)+vendor)
  admin.description: 'Uppercase, letters/numbers/-/_ only. Case-insensitive at checkout (WELCOME50 == welcome50).'
description: textarea (admin-internal, like Woo post_excerpt)
status: select draft | scheduled | published | paused | archived, default draft
  (published + within [starts_at, expires_at] = usable; mirrors Woo publish-gating)
discount_type: select percent | fixed_cart | fixed_product, default fixed_cart, required
amount: number, required, min 0 (percent: 0–100 enforced in hook)
max_discount_amount: number, nullable — cap for percent (e.g. 20% max ₱100)
applies_to: select food_subtotal | delivery_fee | both, default food_subtotal
free_delivery: checkbox default false (+ delivery_discount_cap: number nullable)
vendor: relationship → vendors, required for brand coupons (null = platform-wide)
merchant_scope: select all_vendor_branches | selected_branches, default all_vendor_branches
merchants: relationship → merchants, hasMany (empty = all branches; required iff selected_branches)
menu scoping (mirrors Woo product/category allowlists):
  menu_items: relationship → products, hasMany
  excluded_menu_items: relationship → products, hasMany
  menu_categories: relationship → product-categories, hasMany
  excluded_menu_categories: relationship → product-categories, hasMany
exclude_promo_items: checkbox default false (≈ Woo exclude_sale_items; lines with compareAtPrice < basePrice are "promo")
minimum_basket / maximum_basket: number nullable (''/null = unbounded; min <= max; checked vs food subtotal)
limit_per_order_items: number nullable (only meaningful with menu allowlist, like Woo limit_usage_to_x_items)
individual_use: checkbox default TRUE (inverted Woo default; one coupon per food order)
  + max_coupons_per_order: number default 1
starts_at / expires_at: date (both enforced; Woo has no starts_at)
usage_limit / usage_limit_per_user: number default 0 (= unlimited, Woo convention)
usage_count: number default 0, readOnly/admin readOnly (atomic ±1, like Woo meta)
email_restrictions / phone_restrictions: text hasMany (lowercased; '*' wildcard, Woo-style)
first_order_only: checkbox default false
allowed_payment_methods: select hasMany (card/gcash/grab_pay/paymaya/billease/dob/qrph — same set as /create-payment-intent)
time_windows: array { days: select hasMany mon..sun, start_time: text HH:mm, end_time: text HH:mm }
funded_by: select platform | vendor | split, default platform
vendor_share_pct: number 0–100, required iff split
minimum_platform_fee_guard: (policy, not field — percent coupons never erode platform_fee)
```

Hooks: `beforeValidate` — normalize `code` (trim/upper, charset), `percent ≤ 100`, `min ≤ max`, `split ⇒ share 1–99`, `selected_branches ⇒ merchants nonempty`, `limit_per_order_items ⇒ menu allowlist nonempty`; `beforeChange` — set `scheduled ⇒ published` auto-transition helper or admin cron note.

### 4.2 New `coupon-redemptions` collection (slug `coupon-redemptions`, ≈ Woo `_used_by` rows + `wc_order_coupon_lookup`)

One row per successful redemption (replaces unbounded `used_by[]` array for scale):

```
coupon: relationship → coupons, required, index
order: relationship → orders, required, unique-per-(coupon,order)
customer: relationship → customers, required, index
customer_email / customer_phone: text (lowercased snapshot for guest matching)
code_snapshot: text (coupon.code at redeem time)
food_discount / delivery_discount / total_discount: number required
funded split snapshot: funded_by + vendor_share_pct + platform_share + vendor_share (money)
status: select held | applied | refunded | cancelled, default held
tentative hold: held_until: date + hold_key: text (Woo check_and_hold_* equivalent; TTL ~15 min)
```

`held → applied` on `payment.paid`; `→ refunded/cancelled` on refund/cancel (decrements `coupons.usage_count`, mirrors Woo `decrease_usage_count`).

### 4.3 Extend `order-discounts` (keep slug; add snapshot + allocation)

Keep existing rows compatible; add:

```
coupon: relationship → coupons, nullable (null = legacy manual code)
coupon_snapshot: json { id, code, type, amount, applies_to, free_delivery } (≈ Woo coupon_info)
food_discount / delivery_discount: number default 0 (split; amount_off stays = total)
max_cap_applied / percent_base: number nullable (audit for capped percents)
funded_by / vendor_share_pct / platform_share / vendor_share: snapshot numbers
source: select manual | coupon | auto_campaign, default coupon
```

Uncomment-and-replace the `source_voucher` TODO with `coupon`.

### 4.4 Extend `orders`

```
discount_total: number default 0 (the missing "− Discounts" column)
coupon_code: text nullable (denorm for ops search)
free_delivery_applied: checkbox default false
```

Invariant (new `beforeValidate` on Orders): `total == subtotal + delivery_fee + platform_fee + priorityFee? − discount_total`. Note: `priorityFee` currently lives only in `delivery-bookings.priority_fee` + client math — decide in build whether to add `priority_fee` column to `orders` or fold into `delivery_fee`; either way the invariant must include it.

---

## 5. Validation + math engine (port Woo order, insert vendor gate)

New server util, e.g. `apps/cms/src/services/CouponService.ts` (pure + payload-backed), consumed by validate endpoint and `/create-payment-intent`:

```
validate(coupon, ctx { customer, merchant, vendorOfMerchant, foodSubtotal, deliveryFee,
           paymentMethod, email, phone, isFirstOrder, now, orderDate }) → { ok, code, message, discount }
```

Order (Woo codes kept for client messages):

1. `enabled` — global kill-switch (settings) — cf. `wc_coupons_enabled`.
2. `exists` (105) — found by `LOWER(code)` (+ vendor scope), `status == published`.
3. `active_window` (107) — `starts_at <= now <= expires_at` (Woo has only expiry; we add start).
4. `global_limit` (106/115/116) — `usage_count + tentative_holds < usage_limit` (0 = ∞).
5. `per_user_limit` (106/115) — redemptions by customer id + email + phone `< usage_limit_per_user`.
6. `min_basket` (108) / `max_basket` (112) vs **food subtotal**.
6.5 **`vendor_merchant_gate` (new, 109-class)** — `order.merchant.vendor == coupon.vendor` (if set); `merchant_scope == all` OR `merchant ∈ coupon.merchants`.
7. `menu_allowlist` (109) — if items/cats set, ≥1 line intersects (variation-aware: check `product` + `merchant_product`).
8. `excludes` (109/113/114) — product types: skip non-matching lines; cart-type (`fixed_cart` on food subtotal): any excluded/promo line present ⇒ whole coupon invalid (Woo §4 step 10 semantics).
9. `sale_guard` (110) — `exclude_promo_items` + any promo line ⇒ invalid for `fixed_cart`; skipped for per-item types.
10. `contact_allowlist` (102) — email/phone wildcard match if either list nonempty.
11. `first_order / payment_method / time_window` — platform extensions.
12. `individual_use` (104) — order already has a coupon ⇒ reject (default 1/order).
13. Filter hook (100) — `coupon.is_valid` extension point.

Math (cents, Woo semantics, fees separated):

- Eligible food lines sorted high→low; skip zero-price/qty.
- `percent`: `floor(eligible_line × pct)`, cap total at `max_discount_amount`, remainder 1¢ distribution.
- `fixed_product`: `min(amount, unit) × qty` (capped per line, never negative); `limit_per_order_items` caps units.
- `fixed_cart` (food subtotal): `per_item = floor(amount / qty)` → fixed-product pass + remainder (Woo recursion).
- `delivery`: if `free_delivery` → `delivery_discount = min(deliveryFee, cap ?? ∞)`; if `applies_to ∈ {delivery_fee, both}` percent/fixed applies to delivery leg separately.
- Never-negative guard on every line and on order total; `min(orderTotal, discount)` clamp.
- Funding split: `vendor_share = total × pct`, `platform_share = total − vendor_share` (`funded_by = vendor ⇒ 100/0`, `platform ⇒ 0/100`).

Error taxonomy (keep Woo 100–116/200–201) so mobile/web-admin show reason-specific messages ("expired", "minimum ₱X", "not valid for this store", …).

---

## 6. Checkout integration (close the trust + re-total gaps)

1. **New `POST /api/coupons/validate`** (service-auth, explicit `customerId + merchantId + code`): runs §5, returns `{ food_discount, delivery_discount, total, funded split, reasons }`. No side effects (holds only, TTL). Called pre-pay for display; also callable by web-admin manual-order flow.
2. **Harden `POST /create-payment-intent`**: accept optional `couponCode + merchantId + customerId`; server recomputes cart food subtotal (`cart-items active` for customer+merchant) + fresh `deliveryQuote` + `CouponService.validate`; **reject on mismatch** (`expected_total*100 != amount`). This fixes today's blind-trust (`payload.config.ts:1150-1184`).
3. **Atomic order write**: create `orders { discount_total, coupon_code, free_delivery_applied, total = subtotal+delivery+platform+priority−discount }` + `order-discounts` row(s) + `coupon-redemptions (held)` + `transactions { amount = total }` under the same service credential. `transactions.amount == orders.total` invariant (today assumed by webhook + reports).
4. **Webhook**: `paymongoWebhook payment.paid` → `redemptions held → applied`, `coupons.usage_count + 1` (atomic); `payment.failed` → release hold. Refund/cancel paths → `refunded/cancelled` + `usage_count − 1` (Woo `decrease_usage_count` parity).
5. **Fix re-totals**: `deliveryBook` (`:277-293`) and `deliveryCancel` (`:97-132`) must subtract `discount_total` and respect `free_delivery_applied` (delivery leg already zeroed ⇒ don't double-subtract).
6. **Customer views**: `orders/aggregate` + `OrderDetailScreen` gain discount rows (`food_discount`, `delivery_discount`, `total`).

---

## 7. Admin (CMS BFF + web-admin)

- **CMS BFF** (`apps/cms/src/app/api/admin/`, pattern per `docs/BFF-pattern.md`): new `coupons` routes (list/search/filter by `code/type/vendor/status`, get, create, update, archive, usage `?couponId` redemptions) + `coupons/validate` (admin preview) — all `authenticateAdmin` + `overrideAccess:true` + sanitize + `limit ≤ 100`, mirroring `orders`/`transactions` routes.
- **Order detail**: extend `admin/orders/[id]` sanitizer with `discount_total / coupon_code / discounts[]` (already reads `order-discounts`; add coupon join + allocation).
- **Order list**: add `hasDiscount` filter + discount column (currently omitted).
- **Reports/payouts/analytics/dashboard**: add `discountsRes` join; `netRevenue = gross − discounts − refunds`; `vendorPayouts.net = amount − platform − delivery − vendor_share_of_discount` (platform-funded discounts must **not** reduce vendor payout — the key settlement rule).
- **web-admin**: new `Marketing → Coupons` section (list `Code|Type|Amount|Vendor/Branches|Usage/Limit|Expiry`, edit tabs General/Restrictions/Limits mirroring Woo §2.6 + vendor/branch + funding tabs); order detail discount block; reports net-of-discounts. Replace dead `/promotions/*` sidebar links.

---

## 8. Migrations + codegen

- New migration (mirror `20260120_152616_ordering_system.ts`): `CREATE TABLE coupons`, `coupon_redemptions`, `ALTER TABLE orders ADD discount_total/coupon_code/free_delivery_applied`, `ALTER TABLE order_discounts ADD coupon/snapshot/allocation columns`, `CREATE UNIQUE INDEX lower(code)+vendor`, supporting indexes (`coupon_redemptions(coupon, customer, order)`, `orders(coupon_code)`); symmetric `down`.
- `payload.config.ts`: register `Coupons`, `CouponRedemptions`; extend `Orders`, `OrderDiscounts`.
- Regenerate `payload-types.ts` + `payload-generated-schema.ts` (`generate:types`), commit all three (code + types + migration) per `docs/database-modification-guide.md` convention.

---

## 9. Rollout phases + acceptance

**Phase 0 — guardrails**: `discount_total`/`coupon_code` columns + invariant + fix `deliveryBook`/`deliveryCancel` re-totals + surface `order-discounts` in list/reports (no new coupons yet). Acceptance: existing orders unaffected (`discount_total = 0`).

**Phase 1 — MVP (platform %/fixed, single branch scope)**: `coupons` + `coupon-redemptions` + `CouponService` + `/coupons/validate` + hardened intent + atomic write + webhook transitions + admin CRUD + order-detail block. Acceptance (Jollibee test):
- `JOLLIBEE10` (vendor=Jollibee, all branches, `percent 10`, max ₱100, min ₱299, `food_subtotal`, usage 1000/1) on ₱500 Jollibee-Pasig cart → ₱50 off, charged ₱450+fees; same code at McDonald's → 109 rejection; expired/paused/over-limit → 107/106; second use by same customer → per-user rejection; capped case ₱2000 cart → ₱100 off.
- `FREEDEL150` (`free_delivery`, min ₱150, cap ₱80) → delivery leg zeroed up to cap; `deliveryBook` doesn't resurrect fee.

**Phase 2 — vendor portal + campaigns**: vendor-scoped create/approve flow, `selected_branches`, menu/category scoping, `time_windows`, `first_order_only`, payment-method gating, platform/vendor/split funding + payout allocation, coupons report (`orders × amount_discounted` per coupon/vendor/branch, Woo Analytics parity).

**Phase 3 — hardening**: tentative-hold TTL sweeper, refund/cancel decrement paths, rate-limit validate, abuse dashboards, batch import (`batch ≤ 100`, Woo parity), `?code=` exact filter.

---

## 10. Key risks

- **Client-computed totals today** — any coupon math must move server-side with mismatch rejection, or discounts are forgeable (same flaw already exists for totals).
- **Service-key auth** — mobile uses a shared `service` API key; coupon endpoints must take explicit `customerId` and verify ownership server-side + enforce limits by customer/email/phone.
- **Race on limited coupons** — requires Woo-style tentative holds + atomic `usage_count`; naive read-modify-write oversells.
- **Settlement disputes** — `funded_by`/split must be snapshotted per redemption; platform-funded discounts must not reduce vendor payouts.
- **Single-merchant orders** — keep coupon eligibility per order-merchant; split-basket (multi-branch cart) needs per-merchant coupon lines, explicitly out of MVP.

*No code changed in this analysis — docs only.*

---

## 11. Build notes (implemented 2026-09-03, `apps/cms` only)

`pnpm exec tsc --noEmit` → 0, `pnpm exec eslint .` → 0. Migration reviewed by hand.

**New files**
- `src/collections/Coupons.ts` (slug `coupons`, group Marketing) — Woo fields + vendor-delivery
  extensions; `validateCouponFields()` shared by hook and BFF; code upper-normalized in
  `beforeValidate`; access read service|admin, write admin.
- `src/collections/CouponRedemptions.ts` (slug `coupon-redemptions`) — one row per redemption
  (`held|applied|refunded|cancelled` + 15-min `held_until` + funding snapshot); unique
  `(coupon, order)`.
- `src/services/CouponService.ts` — `validate()` (13-step Woo order + vendor/branch gate 6.5,
  Woo 100–116 error codes), cents math (percent floor+remainder, fixed_product, fixed_cart
  recursion, delivery leg, `max_discount_amount` cap, never-negative), `splitFunding()`,
  `applyToOrder()` (pending orders only, ownership check, writes order-discount + held
  redemption + rewrites order totals), `finalizeForOrder()` / `reverseForOrder()`
  (usage_count ±1, never throws).
- `src/endpoints/couponsValidate.ts` → `POST /api/coupons/validate` (preview, no writes).
- `src/endpoints/couponsAttach.ts` → `POST /api/coupons/attach` (server-side apply).
- `src/app/api/admin/coupons/route.ts` (list/search/filter + create, 409 on duplicate code),
  `src/app/api/admin/coupons/[id]/route.ts` (get/patch — code+vendor+discount_type locked —
  /delete), `src/app/api/admin/coupons/redemptions/route.ts` (history + page totals).
- `src/migrations/20260903_115731(.ts/.json)` — auto-generated via `payload migrate:create`,
  reviewed, plus hand-added `coupons_code_platform_unique` partial index (NULL-vendor gap).

**Modified**
- `Orders.ts`: `+discount_total / coupon_code / free_delivery_applied / priority_fee`;
  `beforeValidate` totals invariant on create only (partial PATCH re-totals skip it).
- `OrderDiscounts.ts`: `+coupon, coupon_snapshot, food/delivery_discount, funded_by,
  vendor_share_pct, platform/vendor_share, source`; `source_voucher` TODO replaced;
  indexes `(order,coupon)`, `(coupon)`.
- `payload.config.ts`: collections + `/coupons/validate|attach` registered;
  `/create-payment-intent` cross-checks `orderId` totals or server-recomputes coupon totals
  (`AMOUNT_MISMATCH` 400 / 422 on invalid coupon). Back-compatible when coupon fields absent.
- `deliveryBook.ts`: re-total subtracts `discount_total`, persists `priority_fee`.
- `deliveryCancel.ts`: re-total keeps discount + priority; bogus `order_status` write removed.
- `paymongoWebhook.ts`: paid → held→applied +1; failed → held→cancelled; `*refund*` →
  applied→refunded −1. All best-effort, ack never blocked.
- `admin/orders/route.ts` + `[id]/route.ts`: discount fields surfaced, `coupon_code` search,
  `?has_discount=` filter, full allocation block in detail.
- `admin/reports/route.ts`: `order-discounts` join; `summary.totalDiscounts /
  vendorFundedDiscounts`; reconciliation rows carry `discount/couponCode`;
  `vendorPayouts.net` deducts only the **vendor-funded** share (platform-funded never cuts
  vendor pay). Revenue itself is untouched (charged amounts are already net).
- `SystemSettings.ts`: `+couponsEnabled` global kill-switch (checked in `validate()`).
- `payload-types.ts` regenerated; `migrations/index.ts` auto-registered.

**Deliberate deviations from §4/§8**
- `text hasMany` (contact allowlists) + nested `select hasMany` (time-window days) codegen'd
  cleanly (`coupons_texts`, `coupons_time_windows_days`) — no fallback needed.
- `allowed_payment_methods` includes `brankas` (matches intent handler set).
- Unique `(code, vendor_id)` is case-sensitive at DB level; app-level upper-normalization makes
  it effectively case-insensitive. Platform-wide dupes closed by partial unique index.
- No `orders.priority_fee` existed, so the column was added (book step sets it).

**Not in this build (follow-ups)**
- ~~Run `payload migrate` on dev DB, then prod (never `migrate:fresh`).~~ DONE 2026-09-03:
  `migrate:status` showed `20260903_115731` pending → `pnpm payload migrate` (dev-mode prompt
  answered `y` per this guide) → `Migrated: 20260903_115731`, status now Yes (batch 36).
  DB-verified: `coupons`, `coupon_redemptions`, `coupons_rels`, `coupons_texts`,
  `coupons_time_windows`, `coupons_allowed_payment_methods` tables exist; `orders` gained
  `discount_total/coupon_code/free_delivery_applied/priority_fee`; both unique indexes
  (`code_vendor_idx`, `coupons_code_platform_unique`) exist; `payload_migrations` row recorded.
  `tsc --noEmit` 0 + `eslint .` 0 after migrate. Temp DB-check script removed.
- web-admin Marketing → Coupons UI (replace dead `/promotions/*` sidebar links), order-detail
  discount block, reports copy for `totalDiscounts`.
- Mobile checkout: validate → attach → intent-with-orderId flow + discount row UI.
- Vendor-portal create/approve flow, batch import, hold-TTL sweeper cron, abuse dashboards.
