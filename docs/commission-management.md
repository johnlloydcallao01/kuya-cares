# Commission management

## Calculation and rule matching

Commission calculations use merchandise only. Delivery charges and other non-product charges are excluded. The recorded `order-items.total_price` is the customer item subtotal at checkout, including quantity and modifiers/options, before order-level discounts. Product discounts (vendor- and platform-funded) are recorded on `order-discounts.food_discount`; those discounts reduce the discounted-sale commission base. Vendor-funded discounts still reduce vendor payout separately.

Rules can target a product, product category, vendor, merchant category, membership plan, or globally. Product and product-category rules are resolved per order line; products without a matching product/product-category rule use the best applicable fallback. Among matching non-global rules, the winner is highest priority, then product, product category, vendor, merchant category, and plan specificity, then latest effective start date, then lowest stable rule ID. A matching non-global rule takes precedence over a vendor volume tier; tiers take precedence over global rules. Existing paid orders retain their commission snapshots when rules change.

Commission methods:

- **Percentage of discounted subtotal** (existing default): rate × merchandise after product discounts. This preserves the existing discounted-sale behavior.
- **Percentage of pre-discount item price**: rate × the customer's recorded `order-items.total_price` allocation before discounts. Modifiers/options are included; delivery and order-level discounts are not.
- **Fixed amount per unit**: PHP amount × paid order-item quantity. Fixed amounts are configured to at most two decimal places.
- Existing vendor-cost percentage rules remain supported and use the private cost snapshot recorded on every order item in the applicable product group.

A rule may also include a fixed PHP transaction fee. The fee is charged once per paid order, weighted across product rules when several apply, capped at the applicable commission base, and reversed cumulatively with refunds.

### Vendor volume tiers

Optional vendor volume tiers are configured in the **Vendor volume tiers** tab on the web-admin Commission Management page (and under **CMS → System Settings → Vendor Commission Volume Tiers**). Each threshold is an inclusive PHP minimum and each rate is 0–100%; thresholds must be unique. Tier row order does not matter: the highest qualifying `minimumNetSales` threshold is selected. Changes are recorded in the commission rule audit history.

Qualifying volume is the vendor's net paid merchandise in the rolling 30 days ending at the payment timestamp, inclusive of both boundaries. It is calculated once per vendor order as:

`max(0, order product subtotal - product discounts - successful refund amounts)`

The order's product subtotal is taken from the recorded order subtotal (never delivery/platform/priority fees); product discounts are excluded, and all recorded successful refund amounts reduce product sales up to zero. Orders with cancelled/canceled status and transactions that are not paid, partially refunded, or refunded are excluded. The order currently being paid is included using its eligible product subtotal after product discounts, even if the payment transaction is not yet visible to the query. At that initial accrual it normally has no refunds yet.

Precedence is explicit non-global commission rules (product/product-category/vendor/merchant-category/plan, selected by priority and specificity), then the selected volume tier, then an explicit global rule, then legacy vendor/category/plan settings and the global default. Thus tiers provide a per-vendor fallback rate without overriding a matching product or other scoped rule. The selected tier, threshold, net qualifying volume, and 30-day window are saved in the immutable commission ledger and order snapshot at payment time.

An enabled rule must be within its effective date window. If both dates are set, the end must be later than the start. Overlapping matching non-global rules are resolved deterministically by the order above; global rules are selected by priority, latest effective start, then lowest stable rule ID.

Product discounts are allocated across products in proportion to their recorded item subtotals, with rounding remainder assigned deterministically. Commission ledger accruals retain the per-product method, rate/value, calculation base, discount allocation, quantity, amount, and fixed fee; order snapshots retain the same breakdown. Refund reversals continue to prorate the aggregate order accrual cumulatively.

## Ledger and manual adjustments

Commission entries are immutable. Accruals, refund reversals, and administrator-posted adjustments are stored as distinct entry types. Rule changes and vendor commission overrides are recorded in the commission audit history with the acting administrator and before/after values.

Manual adjustments require an administrator, a vendor, a non-zero financial change, and a reason. The commission and fixed-fee amounts affect platform income; the vendor balance amount affects the payable balance:

- Positive commission or fee amount: increases platform income.
- Negative commission or fee amount: decreases platform income.
- Positive vendor balance amount: increases the amount payable to the vendor.
- Negative vendor balance amount: decreases the amount payable to the vendor.

All amounts are PHP and must have no more than two decimal places. Adjustments are included in vendor payout summaries, daily payout totals, and exports. Use the admin UI rather than editing ledger records directly.

## Schema rollout

Commission rule scopes/methods, item cost snapshots, vendor volume tiers, and saved commission breakdowns are introduced by the registered commission migration. Apply registered Payload migrations using the CMS database migration guide before enabling new configuration. The rolling-volume query uses a supporting transactions status/payment-time index; register and apply the accompanying `20261016_125500_commission_volume_query_index` migration as part of this rollout.
