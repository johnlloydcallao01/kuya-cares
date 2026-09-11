Recently Viewed History Schema Plan
===================================

Context and Existing Collections
--------------------------------

- **Merchants** ([Merchants.ts](../src/collections/Merchants.ts)):
  - Represents individual merchant outlets (per-location records).
  - Key identifiers:
    - `id` (Payload primary key).
    - `outletName`, `outletCode` (unique), `vendor` relationship.
  - Operational fields:
    - Status flags: `isActive`, `isAcceptingOrders`, `operationalStatus`.
    - Delivery configuration: `delivery_radius_meters`, `is_currently_delivering`, fees, timing metrics.
  - Geospatial data:
    - Denormalized fields: `merchant_latitude`, `merchant_longitude`.
    - PostGIS/GeoJSON fields: `merchant_coordinates`, `service_area_geometry`, `service_area`, etc.
  - Indexes:
    - `vendor`, `outletCode`, `isActive + isAcceptingOrders`, operational metrics.
  - No fields today for:
    - Per-user history.
    - View counters or popularity metrics.

- **Products** ([Products.ts](../src/collections/Products.ts)):
  - Master product catalog across vendors and merchants.
  - Ownership:
    - `createdByVendor` relationship to `vendors`.
    - `createdByMerchant` relationship to `merchants` (mutually exclusive with `createdByVendor`).
  - Product model:
    - `productType` (`simple`, `variable`, `grouped`) with optional `parentProduct`.
    - Core fields: `name`, `slug`, `description`, `shortDescription`, `categories`.
  - Pricing and media:
    - `sku`, `basePrice`, `compareAtPrice`.
    - `media` group with `primaryImage` and gallery.
  - Visibility and distribution:
    - `isActive`, `catalogVisibility`.
    - `assign_to_all_vendor_merchants` flag and hooks that auto-create `merchant-products` records.
  - Hooks:
    - Enforce exactly one owner (vendor or merchant).
    - Auto-generate `slug`.
    - After-change logic to fan-out to `merchant-products` for all vendor merchants.
  - No fields today for:
    - View counts or popularity signals.
    - Per-user viewing history.

- **MerchantProducts** ([MerchantProducts.ts](../src/collections/MerchantProducts.ts)):
  - Junction collection between `merchants` and `products`.
  - Core fields:
    - `merchant_id` → relationship to `merchants`.
    - `product_id` → relationship to `products`.
    - `added_by` (`vendor` | `merchant`).
  - Merch-specific overrides:
    - `price_override` (per-merchant pricing).
    - `stock_quantity`.
    - `is_active`, `is_available`.
  - Product filtering:
    - `product_id` filter ensures only products belonging to the same vendor as the merchant appear.
  - No direct “view tracking”:
    - Does not store per-user or global view counts.
    - Does not expose any history or last-viewed metadata.

High-Level Requirements
-----------------------

1. Track **recently viewed merchants** per user to power:
   - “Recently viewed” sections on home/profile.
   - Personalized ranking/boosting based on past interaction.
2. Track **recently viewed merchant products** per user:
   - Product-level history scoped to a specific merchant context.
   - Support for cases where a product appears at multiple merchants.
3. Ensure the design is:
   - **Scalable**:
     - Supports many views per user over time.
     - Avoids unbounded growth in the primary “recently viewed” list.
     - Supports efficient queries with minimal joins.
   - **Correct and unambiguous**:
     - Correctly distinguishes between:
       - Pure merchant views (merchant page).
       - Merchant product views (item on a merchant menu).
     - Handles repeated views (same item viewed many times by the same user).
     - Plays well with existing collections (`merchants`, `products`, `merchant-products`).

Design Overview
---------------

- Use a **single aggregated history collection** to represent the latest view state per user and per item.
  - One document per unique triple: `(user, itemType, itemIdentity)`.
  - Store:
    - `firstViewedAt`, `lastViewedAt`, and `viewCount`.
    - References back to the underlying merchant/product records.
  - This design:
    - Avoids unbounded growth from raw event logging in the core collection.
    - Makes “recently viewed” queries straightforward and efficient.
- Optionally, a **separate raw event log** collection can be added later for deep analytics.
  - This is not required to power the product UI for “recently viewed”.
  - Keeping it optional avoids premature complexity.

Proposed Collection: `recent-views`
-----------------------------------

- **Slug**: `recent-views`
- **Purpose**:
  - Store the **latest viewing state** per user and per item.
  - Power “recently viewed merchants” and “recently viewed merchant products” in apps/web.
- **Admin**:
  - Group: `History` or `Analytics`.
  - Title: derived from `itemType` + merchant/product name (can be computed in admin UI).

Core Fields
-----------

1. **User association**
   - `user`: relationship → `users` (required)
     - The authenticated user that owns this history row.
   - `deviceId`: text (optional)
     - Anonymous/guest tracking key to be merged later when user logs in.
     - Pattern copied from `recent-searches`.

2. **Item type and identity**
   - `itemType`: select (required)
     - Options:
       - `merchant`
       - `merchant_product`
   - `merchant`: relationship → `merchants`
     - Required when `itemType === 'merchant'` or `itemType === 'merchant_product'`.
     - For `merchant_product`:
       - Points to the parent merchant that owns the product record.
   - `merchantProduct`: relationship → `merchant-products`
     - Required when `itemType === 'merchant_product'`.
     - Null when `itemType === 'merchant'`.
   - `product`: relationship → `products`
     - Optional denormalized pointer.
     - For `itemType === 'merchant_product'`, this can be populated from `merchantProduct.product_id` for easier querying and joins.
   - Rationale:
     - Merchant views are modeled directly via `merchant`.
     - Merchant product views are modeled via `merchantProduct` and linked back to both `merchant` and `product`.
     - Having `product` reachable enables “recently viewed items” even in product-centric UIs.

3. **Aggregation and recency**
   - `viewCount`: number (required, default: `1`)
     - Total number of times this user viewed this specific item.
   - `firstViewedAt`: date (required)
     - Timestamp of the first time this user viewed the item.
   - `lastViewedAt`: date (required)
     - Timestamp of the most recent view.
   - Behavior:
     - On the first view:
       - Create a new `recent-views` doc for `(user, itemType, itemIdentity)` with `viewCount = 1`.
     - On subsequent views:
       - Update the existing doc:
         - `viewCount = viewCount + 1`
         - `lastViewedAt = now`
       - `firstViewedAt` remains unchanged.

4. **Source and context metadata**
   - `source`: select (default: `unknown`)
     - Options:
       - `web`
       - `mobile`
       - `unknown`
   - `addressText`: text (optional)
     - Snapshot of the active delivery address when the view occurred.
   - `referrer`: text (optional)
     - High-level referrer such as:
       - `home_hero_carousel`
       - `location_based_merchants_section`
       - `merchant_search_results`
       - `recommendations`
   - `meta`: JSON (optional)
     - Flexible metadata for experimentation (e.g., campaign tags, A/B test bucket).

5. **Uniqueness and deduplication**
   - `compositeKey`: text (unique, required)
     - Encodes the logical uniqueness constraint for each row.
     - Proposed format:
       - For merchants:
         - `"{userId}:merchant:{merchantId}"`
       - For merchant products:
         - `"{userId}:merchant_product:{merchantId}:{merchantProductId}"`
     - Rationale:
       - Keeps a single document per logical item per user.
       - Makes upsert operations simpler (find-or-create by `compositeKey`).

Access Control
--------------

Pattern mirrors `recent-searches`:

- `read`:
  - `admin` and `service` roles:
    - Can read all history (for analytics/operations).
  - Regular authenticated users:
    - Can read only records where `user` equals their own user id.
  - Anonymous:
    - No direct read access from public API (handled at app layer with deviceId if needed).

- `create`, `update`, `delete`:
  - Require an authenticated user.
  - Non-admin users can only mutate rows where `user` equals their own id.
  - Admin/service can manage all.

Indexes and Scalability
-----------------------

1. **Uniqueness index**
   - `compositeKey`:
     - Unique index to guarantee one row per `(user, itemType, itemIdentity)`.
     - Drives efficient upsert logic:
       - On view event, compute `compositeKey`.
       - Try to find existing row by `compositeKey`.
       - If found, update in-place.
       - If not found, create new record.

2. **Per-user recency index**
   - Compound index: `['user', 'lastViewedAt']`
     - Enables queries like:
       - “Give me the last N items viewed by this user, ordered by `lastViewedAt` desc.”
   - Optional variation:
     - `['user', 'itemType', 'lastViewedAt']` to support type-filtered queries efficiently:
       - “Recently viewed merchants only.”
       - “Recently viewed merchant products only.”

3. **Cleanup and retention**
   - Application-level approach:
     - Enforce a **maximum number of rows per user per itemType** (e.g., 100–200).
     - On insert:
       - After upsert, count rows for `(user, itemType)`.
       - If over the limit, delete the oldest rows (`lastViewedAt` ascending).
   - Optional database-level support:
     - Scheduled background job (cron/worker) that:
       - Trims older rows beyond the N most recent per user.
       - Optionally archives them into a long-term “view-events” collection if analytics are needed.

Future Extension: Raw View Events (Optional)
-------------------------------------------

If deeper analytics are later required (e.g., per-hour view patterns, funnels), we can add a separate collection:

- **Slug**: `view-events` (or similar).
- **Purpose**:
  - Append-only log of every view event.
  - Used only for analytics, not for powering the “recently viewed” UI.
- **Minimal fields**:
  - `user` (relationship to `users`, optional for anonymous).
  - `deviceId` (for anonymous).
  - `itemType`, `merchant`, `merchantProduct`, `product`.
  - `viewedAt` timestamp.
  - `source`, `referrer`, `meta`.
- **Aggregation strategy**:
  - Periodic batch jobs can roll up `view-events` into:
    - Global metrics on `merchants` / `merchant-products` / `products`.
    - Additional per-user insights if needed.

How This Integrates With apps/web
---------------------------------

- When a user opens a **merchant page**:
  - apps/web calls a backend endpoint (or direct Payload API) that:
    - Identifies the `user` (and `deviceId` if available).
    - Computes `compositeKey = "{userId}:merchant:{merchantId}"`.
    - Upserts into `recent-views`:
      - If not exists: create with `viewCount = 1`, `firstViewedAt = lastViewedAt = now`.
      - If exists: increment `viewCount`, update `lastViewedAt`.

- When a user opens a **merchant product page**:
  - apps/web knows both:
    - `merchantId` (from route context).
    - `merchantProductId` (from item id).
  - It calls the backend to upsert:
    - `itemType = 'merchant_product'`.
    - `merchant` and `merchantProduct` relationships.
    - Optionally `product` from the `merchant-products` record.
    - `compositeKey = "{userId}:merchant_product:{merchantId}:{merchantProductId}"`.

- When rendering **“Recently Viewed” sections**:
  - For merchants:
    - Query `recent-views` filtered by:
      - `user = currentUserId`.
      - `itemType = 'merchant'`.
    - Sort by `lastViewedAt DESC`, limit N (e.g., 20).
    - Populate `merchant` relationship for display.
  - For merchant products:
    - Same pattern but with `itemType = 'merchant_product'`.
    - Populate `merchantProduct` (and its `product`/`merchant`) relationships for display.

Correctness Considerations
--------------------------

- **Disambiguation of products**:
  - A single `product` can be offered by multiple merchants via `merchant-products`.
  - By keying history on `merchantProduct` plus `merchant`, we:
    - Distinguish “Chicken Joy at Jollibee Manila” vs “Chicken Joy at Jollibee Cebu”.
    - Align with how menus are actually modeled and priced per merchant.

- **Idempotency for repeated views**:
  - The `compositeKey` ensures multiple views of the same item for the same user update a single row.
  - This avoids explosion of rows in the `recent-views` collection.

- **Backwards compatibility**:
  - No changes are required to `merchants`, `products`, or `merchant-products`.
  - The new collection is additive and can be introduced without touching existing schemas.

Summary
-------

- Introduce a **single aggregated history collection** `recent-views` that:
  - Supports both **recently viewed merchants** and **recently viewed merchant products**.
  - Uses a `compositeKey` and indexes to remain **scalable** and **query-efficient**.
  - Keeps one row per logical item per user, with `viewCount`, `firstViewedAt`, and `lastViewedAt`.
- Optionally add a raw `view-events` collection later for deeper analytics without affecting the core UI-driven history.

