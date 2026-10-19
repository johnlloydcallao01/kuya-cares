# Seller-Managed Shipping Plan

> **Purpose:** A WooCommerce-inspired guide for letting marketplace sellers define delivery terms and fulfill orders themselves, without the marketplace operating or booking a delivery service.
>
> **Status:** CMS seller-shipping backend and migration `20261019_032834` are implemented and applied to the shared database. Seller outlet shipping configuration and fulfillment/tracking controls are now wired in the web `/seller` experience. Buyer checkout quote/order/payment integration and customer-facing seller tracking remain follow-up work.

## Executive Summary

Use WooCommerce's core shipping principles, adapted for a multi-seller marketplace:

1. Sellers define where they deliver and what delivery or pickup options they offer.
2. Checkout uses the customer's address and cart to determine eligible options and prices.
3. The customer sees the selected shipping charge and complete total before payment.
4. The order stores a snapshot of the shipping method, fee, and promise accepted at checkout.
5. The seller arranges delivery and updates fulfillment; the marketplace records and communicates progress but does not book a courier.

WooCommerce core is configured at the store level. It is an inspiration for shipping zones, methods, rates, free shipping, and pickup—not a ready-made per-seller marketplace implementation. Kuya Cares must enforce seller ownership and calculate each seller's rate independently.

## Current Backend Implementation

- Sellers configure ordered Philippine locality/postal-code zones and optional drawn map boundaries, with flat delivery rates, minimum order amounts, free-delivery thresholds, estimates, and pickup through the authenticated vendor outlet API. A zone matches when its textual area rules match or the saved Philippine address coordinates fall inside its GeoJSON boundary.
- Customer quote and checkout APIs authenticate the customer, verify address ownership, load the merchant's active cart, reprice current catalog items, and sign short-lived quote tokens. Checkout revalidates the cart and settings and creates order/item snapshots without accepting client-supplied prices or totals.
- Orders keep the seller's method, delivery address, rate, and terms as a snapshot. Seller-owned delivery proceeds are added to vendor net after payment, while merchandise commission bases and volume-tier sales remain merchandise-only; refund reversals include the shipping proceeds.
- Sellers can update seller-managed fulfillment status and optional HTTPS tracking details through an ownership-checked API. Status changes are written to the order-tracking audit collection, and the vendor orders API returns the shipping snapshot and tracking details.
- The web seller portal now has an outlet-specific shipping settings page for ordered zones, Google Maps polygon boundaries, multiple textual coverage areas, delivery rates, minimum/free-delivery thresholds, estimates, pickup instructions, and saving with server read-back verification. Sellers can search Philippine locations, draw/adjust a zone boundary, and assign the zone's delivery fee and terms. Outlet lists and details link to these settings.
- Polygon boundaries are stored inside the existing seller-shipping JSONB settings; this addition does not require a relational schema migration. Polygon matching runs server-side against coordinates on the buyer's saved address. If an address has no usable coordinates, polygon coverage does not match; existing textual area matching and pickup remain available.
- The map uses the web app's `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` or `NEXT_PUBLIC_MAPS_BACKEND_KEY` and Google Places autocomplete. Configure a restricted Google Maps key with the required Maps JavaScript and Places APIs and billing. No Google Maps result is trusted for shipping price calculation; the CMS validates geometry and determines coverage.
- The web seller orders page displays accepted shipping terms and provides fulfillment transitions plus optional carrier/reference/HTTPS tracking updates through an authenticated web proxy to the CMS ownership-checked endpoint. Legacy Lalamove fields remain visible only for historical orders.
- Legacy Lalamove fields remain for historical orders. This CMS backend does not book or cancel a courier.
- The shared database migration history is reconciled. Existing commission and withdrawal structures were verified before their pending migrations were recorded; only the missing volume-query index and seller-shipping schema were applied. The `_payload_migration_reconciliation` table records which schemas predated their migration entries so rollback does not remove pre-existing structures.

The backend routes are [shipping quote](../apps/cms/src/app/api/customer/checkout/shipping/quote/route.ts), [checkout order creation](../apps/cms/src/app/api/customer/checkout/route.ts), and [seller fulfillment updates](../apps/cms/src/app/api/vendor/orders/[id]/fulfillment/route.ts).

## Current Application Context

- Web checkout is scoped to one merchant's cart, which is a useful starting point for seller-specific shipping.
- Checkout still requires a buyer delivery address; the CMS shipping quote and order-creation APIs are not yet wired into the web checkout.
- Until that frontend integration is complete, the web checkout does not assess the new seller shipping rates. Do not launch paid delivery orders relying on the CMS quote API alone.
- Map-drawn delivery zones require valid latitude and longitude on the buyer's saved address. Keep textual areas configured as a fallback for addresses without coordinates.
- The CMS retains older merchant delivery fields; seller shipping settings are now the separate authoritative configuration for the new quote API. Keep the older values clearly distinguished and avoid using them to calculate the new seller shipping quote.
- Orders currently have `fulfillment_type`, `delivery_fee`, `priority_fee`, and Lalamove-specific fields. New seller-managed orders must not be coupled to courier bookings. Existing courier data must remain readable for historical orders.

Relevant implementation surfaces:

- [Checkout page](../apps/web/src/app/(main)/checkout/[merchantId]/page.tsx)
- [Checkout service](../apps/web/src/lib/client-services/checkout-service.ts)
- [Checkout return page](../apps/web/src/app/checkout/[merchantId]/return/page.tsx)
- [Orders collection](../apps/cms/src/collections/Orders.ts)
- [Merchants collection](../apps/cms/src/collections/Merchants.ts)
- [Seller orders page](../apps/web/src/app/seller/orders/page.tsx)
- [Customer order service](../apps/web/src/lib/client-services/order-service.ts)
- [Customer order tracking page](../apps/web/src/app/(main)/orders/[orderId]/tracking/page.tsx)

## WooCommerce Principles to Borrow

### Shipping zones and ordered matching

WooCommerce zones are geographic areas; the shipping address determines which zone applies. A customer matches the first zone in the configured order, so narrower areas precede broader ones. A zone can offer one or more shipping methods, and unmatched areas can have no methods.

**Marketplace adaptation:** zones and methods belong to each seller, not globally to the marketplace. A seller could offer:

- Barangay or city-level local delivery
- Wider provincial delivery
- Pickup only in a defined location
- No service for addresses outside the defined coverage

Do not copy WooCommerce's first-match behavior blindly if a seller needs overlapping choices. Define a predictable rule: select the most specific matching seller zone, then offer only that zone's enabled methods.

### Methods are seller offers, not courier integrations

WooCommerce's core Flat Rate, Free Shipping, and Local Pickup methods describe the checkout options and their price. A configured rate does not itself dispatch a carrier.

**Marketplace adaptation:** use customer-facing names such as “Seller-arranged delivery” and “Pickup from seller.” Do not imply live tracking, carrier service guarantees, or platform-provided delivery unless a real integration supports them.

### Pricing options should be understandable

WooCommerce supports order/item flat rates and shipping-class costs; free shipping can be unconditional or conditional, such as a minimum order amount. Classes are useful when products have meaningfully different handling costs.

**Marketplace adaptation:** begin with simple seller-managed options. Add product-level classes or package-weight calculation only if sellers need them; mixed baskets and rate aggregation add meaningful complexity.

### Checkout price and fulfillment are separate

A checkout shipping method can calculate a charge without the platform buying a label or assigning a driver. WooCommerce's label-purchasing features are separate from checkout-rate methods.

**Marketplace adaptation:** calculate and collect the seller's disclosed fee before payment, then let the seller choose and operate their own courier or delivery arrangement.

## Recommended MVP Product Rules

1. **Seller is the delivery operator.** The seller is responsible for arranging the courier/local delivery, packaging, dispatch, and delivery updates. The marketplace records and presents order information.
2. **Shipping is explicit and priced before payment.** For paid seller delivery, never collect payment first and surprise the customer with an unknown shipping charge later.
3. **Offer simple methods first:**
   - Seller-arranged delivery with a seller-configured fee.
   - Free seller-arranged delivery, optionally conditional on a minimum merchandise amount.
   - Pickup, only when the seller enables it.
4. **Support clear coverage.** Start with the simplest reliable coverage representation already supported by the address data (for example, barangay/city or a validated radius). Avoid exposing complex polygons to sellers until there is a usable editor and validation.
5. **Show the seller's estimate honestly.** Present preparation/delivery estimates as seller-provided estimates, not a platform guarantee.
6. **Snapshot terms on the order.** Later seller setting changes must not rewrite the amount or method the buyer accepted.
7. **Keep checkout seller-scoped.** For current one-merchant checkout, calculate that merchant's shipping independently. If multi-seller checkout is added later, calculate per seller shipment and show the combined amount rather than applying one seller's rate to another seller's goods.
8. **No courier dependence.** New orders must not require a Lalamove quote, booking, cancellation, or driver assignment to be paid or finalized.

## Proposed Buyer and Seller Workflow

### Seller setup

1. Seller enables delivery, pickup, or both.
2. For each enabled method, seller sets:
   - Display name and short terms.
   - Eligible delivery area(s), or pickup availability/location.
   - Delivery fee, including zero when the seller offers free delivery.
   - Optional free-delivery threshold.
   - Preparation time and estimated delivery window.
   - Optional delivery instructions/contact expectations.
3. Validate non-negative fees, sensible threshold relationships, and valid coverage. Preview the customer-facing option and total.
4. Seller saves/publishes settings. Disabled or incomplete options are not shown at checkout.

### Buyer checkout

1. Buyer selects or confirms the delivery address.
2. The platform resolves the seller's eligible options for that address. If no delivery option covers the address, explain that delivery is unavailable; show pickup only if enabled.
3. Buyer chooses a method. Checkout shows a breakdown such as:

   | Line | Example |
   | --- | ---: |
   | Items subtotal | ₱500.00 |
   | Seller-arranged delivery | ₱60.00 |
   | Discount | -₱20.00 |
   | **Total** | **₱540.00** |

4. Before initiating payment, the server validates the selected method, address coverage, current rate, discounts, and final payable amount. The same authoritative total is used for the payment intent, transaction, and order.
5. If the quote/configuration changed between display and payment, return the updated total and require buyer confirmation rather than silently charging a different amount.

### Seller fulfillment after payment

1. Paid order appears in seller order management with delivery method, fee, address/contact snapshot, seller estimate, buyer instructions, and any selected pickup details.
2. Seller accepts or declines according to marketplace policy, then marks preparation and fulfillment progress.
3. For delivery, seller records dispatched/handed to courier and may enter a carrier name, tracking URL/reference, or proof. Those fields are optional for untracked local delivery.
4. For pickup, seller marks ready for pickup and later picked up/completed.
5. Buyer receives notifications on meaningful status changes and can see whether tracking is seller-provided. Marketplace support can review the order's status history and communication evidence.

## Data and Service Design

### Seller shipping configuration

Audit and consolidate the existing `Merchants` delivery fields before schema expansion. Prefer one clearly documented, validated settings structure instead of maintaining similarly named `deliverySettings`, radius, base/per-kilometer, thresholds, and zone fields with ambiguous ownership or usage.

Potential MVP concepts:

- `enabled` delivery and pickup flags
- seller-defined service areas
- one or more methods per area
- pricing strategy: flat, free, or free above threshold
- seller-entered preparation/estimated delivery window
- pickup instructions/location

Keep courier/provider fields optional metadata; do not make a provider integration a prerequisite for a seller's method.

### Order pricing snapshot

For new orders, preserve or add explicit snapshot fields sufficient to explain the charge:

- `fulfillment_type` (`delivery` or `pickup`)
- shipping method identifier and customer-facing name at purchase
- seller-managed fulfillment mode/owner
- `delivery_fee` charged to the buyer (zero for pickup/free delivery)
- pricing rule/threshold result needed for audit
- estimated delivery window/terms shown at checkout
- immutable delivery-address and contact snapshot for delivery
- optional seller-entered carrier/tracking reference after dispatch

Do not rely on current merchant settings to reconstruct an old order's fee. Keep item subtotal, discounts, fee, and total internally consistent.

### Quote and payment authority

The server/CMS should be the authority for eligibility and price. A client-only calculation is insufficient because seller rates may change and requests can be modified. Prefer a quote/validation operation that takes the authenticated customer, merchant, address, cart lines, and selected method; it should return eligible options, fee, and an expiry or version. Revalidate at order creation/payment authorization.

Payment sequencing must avoid a paid transaction with an order total that differs from the charge. Store the accepted quote/rate snapshot with the pending order and use its total for the payment intent and transaction. Preserve the current pending-payment recovery behavior.

### Fulfillment status and tracking

Do not overload courier-specific `delivery_status` as the seller fulfillment state. Use a clear seller-managed lifecycle, such as:

- `awaiting_seller` / `accepted`
- `preparing`
- `ready_for_pickup` (where relevant)
- `dispatched` or `out_for_delivery`
- `delivered` / `picked_up`
- `cancelled`

Map these to existing order-level statuses only where that mapping is unambiguous. Prefer an order-tracking history with timestamp and actor for the detailed timeline. A seller must not be able to claim platform-verified courier tracking if they only entered a free-text status.

## Phased Implementation Plan

### Phase 0 — Product and data audit

- [x] Confirm who receives the buyer-paid shipping amount and how it is represented in vendor payouts, commissions, and refunds: the seller receives shipping proceeds; merchandise commission bases remain unchanged.
- [ ] Audit all existing merchant delivery settings and identify which fields are active, duplicated, legacy, or backed by UI/API behavior.
- [ ] Audit coupons/discount rules that can target `delivery_fee`; confirm compatibility with seller rates.
- [ ] Document existing Lalamove orders, webhooks, CMS routes, seller order displays, tracking displays, cancellation, and historical-data requirements.
- [ ] Decide the MVP geographic coverage representation and whether delivery, pickup, or both launch first.

**Exit condition:** Product and finance owners approve fee ownership, refund handling, coverage, and legacy-order policy.

### Phase 1 — Seller settings and validation

- [x] Add validated seller-owned methods and areas without removing legacy merchant delivery fields.
- [x] Validate fee, thresholds, coverage, estimates, and enabled/disabled states.
- [ ] Add seller-facing configuration UI with preview and clear help text.
- [x] Allow no-delivery, delivery-only, pickup-only, or delivery-plus-pickup configurations in the backend settings model.

**Exit condition:** A seller can configure supported options, and invalid/unpublished options cannot be offered to customers.

### Phase 2 — Authoritative quote and checkout

- [x] Implement server-side eligible-method and fee calculation for a seller/address/cart.
- [x] Return a signed short-lived quote and revalidate it at order creation.
- [ ] Show methods and a full price breakdown before payment.
- [x] Apply zone minimums and free-delivery thresholds; retain the existing order-coupon path for applicable discounts.
- [x] Save the method, address, rate, and terms snapshot on the order.
- [ ] Make the payment intent amount, transaction amount, and order total agree exactly.
- [ ] Provide an address-not-served state and a seller-quote-required fallback only if explicitly approved; do not invent a fee.

**Exit condition:** Tests prove the displayed total equals the persisted order and payment amounts for delivery, free shipping, pickup, discount, and threshold cases.

### Phase 3 — Seller fulfillment and buyer timeline

- [x] Return the selected method and fulfillment details in the vendor orders API.
- [x] Add seller status updates and optional HTTPS tracking fields.
- [x] Persist status changes with actor and timestamp in the order-tracking collection.
- [ ] Update buyer order detail/tracking screens to use seller-managed status and label manual information accurately.
- [ ] Notify buyers about acceptance, dispatch/ready-for-pickup, delivery completion, delays, and failed handoff.
- [ ] Define seller decline/cancel, customer cancellation, refund, late dispatch, no-show pickup, and failed-delivery paths.

**Exit condition:** A seller can fulfill an order end-to-end without a platform driver, and the buyer sees truthful progress.

### Phase 4 — Legacy coexistence, rollout, and operations

- [ ] Keep legacy courier fields and tracking readable for historical orders; do not bulk-delete or reinterpret old records.
- [ ] Ensure new seller-managed orders never call Lalamove quote/book/cancel endpoints.
- [ ] Ensure cancellation only contacts an external courier for orders actually booked through a supported integration.
- [ ] Roll out behind a feature flag or merchant cohort; monitor quote failures, checkout conversion, fee mismatches, seller acceptance/dispatch times, cancellations, and support disputes.
- [ ] Document seller policies and buyer-facing delivery expectations before broad release.

**Exit condition:** New seller-managed orders work in production while historical courier-backed orders remain understandable.

## Acceptance Criteria

- Buyers can see the selected seller delivery fee, item subtotal, discounts, and exact total before paying.
- An address outside all seller delivery areas cannot be checked out with delivery; pickup is offered only when enabled.
- Seller rates and settings cannot be changed by another seller or by an unauthenticated customer.
- Price and eligibility are validated server-side and snapshotted on the order.
- The payment intent, transaction, and order have matching totals.
- Checkout finalization succeeds when no courier integration exists and does not call Lalamove.
- A delivery-fee coupon/discount is applied only when compatible with the seller's method and the stored breakdown remains consistent.
- Seller delivery status updates appear in the buyer's order timeline with their source identified.
- Cancellation, refund, and payout calculations account for the seller delivery fee according to the approved business policy.
- Existing courier-backed orders continue to display their legacy tracking details where available.

## Remaining Decisions and Integration

1. Integrate the web checkout with the CMS quote and order-creation endpoints, then ensure payment intent and transaction totals follow coupon adjustments.
2. Build seller configuration UI and buyer checkout/tracking UI for the implemented API contracts.
3. Confirm the initial locality data source and seller-facing location search; the backend currently matches normalized text on saved Philippine addresses and does not geocode.
4. Define cancellation/refund rules after the seller has independently arranged delivery.
5. Decide whether untracked seller deliveries are allowed and what evidence is required for a “delivered” status or dispute.

## WooCommerce References

- [Setting up shipping zones](https://woocommerce.com/document/setting-up-shipping-zones/) — address matching, zone ordering, and methods per zone.
- [Flat Rate Shipping](https://woocommerce.com/document/flat-rate-shipping/) — per-order, per-item, and shipping-class pricing.
- [Free Shipping](https://woocommerce.com/document/free-shipping/) — unconditional, coupon-based, and minimum-order options.
- [Local Pickup](https://woocommerce.com/document/local-pickup/) — pickup as a checkout method.
- [Product Shipping Classes](https://woocommerce.com/document/product-shipping-classes/) — grouping products for different rates.
- [WooCommerce Shipping](https://woocommerce.com/document/woocommerce-shipping/) — distinction between label purchasing/fulfillment tools and live checkout rates.

These references describe WooCommerce behavior. The marketplace-specific ownership, fee settlement, seller permissions, seller fulfillment timeline, and dispute policy above are recommendations for Kuya Cares, not claims about WooCommerce core.
