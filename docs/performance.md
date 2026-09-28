# Dashboard Performance Blueprint — `/dashboard/overview` + `/dashboard/analytics` + `/dashboard/reports` + `/vendors` + `/merchants` + `/products` + `/orders` + `/customers` + `/business-zones` + `/profile` + `/media`

Date: 2026-09-18
Scope: `apps/web-admin` Overview + Analytics + Reports + Vendors + Merchants + Products/Catalog + Orders + Customers + Business Zones + Profile + Media + `apps/cms` admin dashboard/analytics/reports/vendors/merchants/products/catalog/orders/customers/business-zones/profile/media APIs + Postgres + Upstash Redis + Cloud Run
Status: Implemented and verified (`tsc`, `eslint`, `migrate:status Yes` ×2). No `migrate:fresh` used.

This document is the reproduction guide for applying the same optimization to other pages (analytics, reports, vendor payouts, merchant dashboard, lists).

---

## 1. Problem (before)

Cold load of `/dashboard/overview` was a textbook CSR-slow case: fast Cloud Run, slow page.

- 3 parallel browser fetches (`metrics/charts/tables`) → 3 BFF proxies → 3 CMS handlers
- 14 data `payload.find` + 3 auth `findByID users` = **17 Payload ops** for ~60 small rows
- `metrics`: 7× find (6× `limit:0` + 1× `transactions limit:1000 depth:0`)
- `charts`: 3× `limit:1000 depth:0` (transactions paid+30d, orders unfiltered, merchants unfiltered)
- `tables`: 4× (`vendors 1000`, `merchants 1000`, `orders 1000`, `orders 10 depth:1`)
- Hydrated vs returned: metrics ~1000 docs → 8 scalars; charts ~3000 docs → ~42 rows; tables ~3010 docs → 15 rows
- `select:` 0/19, `payload.count` 0/19, `pagination:false` missing on all `limit:1000`
- Unindexed predicates: `transactions.status/paid_at`, `orders.status`, bare `ORDER BY created_at`
- `Merchants afterRead` ran `getStoreHoursStatus` + up to 11520 `isStoreOpen` loops per doc ×1000, even at `depth:0`
- Gate `MAX_CONCURRENT_ADMIN_REQUESTS=2` vs 3 parallel → 1 queued every cold load
- Legacy monolith (`5× limit:1000 depth:1` + O(30N) loop) still live
- Cache: per-`admin.id` keys, TTL 60/300/30/20s, TTL-only, fail-open Redis, BFF `cache:no-store`, no coalescing

---

## 2. Architecture (after)

```text
Browser useDashboardOverview()
  → GET /api/dashboard/overview (BFF, 15s timeout, no-store upstream)
  → GET /api/admin/dashboard/overview (CMS)
  → getPayload → authenticateAdmin(findByID users)
  → getOrBuildDashboard(admin:dashboard:overview:v1, 300s)
      L1 5s fresh / 30s stale → Redis → singleflight builder
      MISS only → withAdminRequestSlot(MAX 8) → buildOverview()
        6× payload.count + 8× indexed SQL (SUM/GROUP BY/JOIN LIMIT)
  → X-Dashboard-Cache: HIT/STALE/MISS + Cache-Control: private, max-age=30, SWR=60
```

Cold MISS now: 1 browser → 1 BFF → 1 CMS → ~14 cheap DB statements, zero doc hydration.
HIT: no aggregates, no gate queue (gate inside builder only).

---

## 3. What was implemented

### Q1 — Indexes (DB change, per `docs/database-modification-guide.md`)

Collections:

- `apps/cms/src/collections/Transactions.ts:32-36`
  `indexes: [{fields:['status','paid_at']},{fields:['status','createdAt']}]`
- `apps/cms/src/collections/Orders.ts:206-210`
  `indexes: [{fields:['status','createdAt']},{fields:['merchant','createdAt']}]`
- `apps/cms/src/collections/Users.ts:117-120`
  `indexes: [{fields:['role']}]` — fixes `role==admin` fanout scan
- `apps/cms/src/collections/Merchants.ts:581-610`
  Pre-existing `['vendor'],['outletCode'],['isActive'],['isActive','isAcceptingOrders']` kept. `afterRead` guarded (see Q5).

Migration (Step 2–4 of guide):

- `pnpm payload migrate:create` → `apps/cms/src/migrations/20260918_041730.ts` (+ `.json`, registered in `migrations/index.ts:430-434`)
- Reviewed: index-only (`CREATE INDEX role_idx`, `isActive_1_idx` merchants, `isActive_2_idx` drivers rename, `status_createdAt_idx` orders, `merchant_createdAt_idx` orders, `status_paid_at_idx` + `status_createdAt_1_idx` transactions). No column drops, no data loss.
- `echo y | pnpm payload migrate --force` → `Migrated: 20260918_041730 (347ms)`. `migrate:status Yes`.
- Pool unchanged: `apps/cms/src/payload.config.ts:192-203` `max 8 / min 1 / idle 30s / connectionTimeout 10s / statement_timeout 20s`.

NOT done: single-column `orders(created_at)` index; duplicate `vendor/outletCode` name dedup.

### Q2/Q3 — Counts + DB aggregation (no hydration)

New shared lib `apps/cms/src/utils/dashboardOverview.ts`:

- `drizzleRows():37-40` — `payload.db.drizzle.execute()` → `rows[]`, no access/depth/hooks
- `fetchDashboardCounts():78-121` — 6× `payload.count({overrideAccess:true, context:{skipStoreHours:true}})` (vendors, customers, merchants `isActive`, orders total, orders ≥30d, orders 60–30d)
- `fetchRevenueMetrics():127-146` — 3× `SELECT SUM(amount::numeric) FROM transactions WHERE status='paid' [AND paid_at window]`
- `fetchRevenueChart():148-166` — `date_trunc('day',paid_at) GROUP BY` + JS 30-day zero-fill
- `fetchOrderStatusChart():168-171` — `SELECT status,COUNT(*) GROUP BY`
- `fetchTopMerchants():173-188` — `orders LEFT JOIN merchants GROUP BY merchant_id ORDER BY COUNT DESC LIMIT 5` (`rating:0` preserved — merchants have no rating field)
- `fetchTopVendors():190-202` — `vendors LEFT JOIN merchants LEFT JOIN orders GROUP BY v.id ORDER BY COUNT(o.id) DESC LIMIT 5`
- `fetchRecentOrders():204-217` — `orders LEFT JOIN merchants/customers ORDER BY created_at DESC LIMIT 10`, uses `customers.email` directly (fixes `customer.user.email` depth:1 bug)
- `buildMetricsGroup():219-239`, `buildChartsGroup():241-249`, `buildTablesGroup():251-254`, `buildOverview():256-263` (`Promise.all`)

CMS routes refactored to global keys + MISS-only gate:

- `overview/route.ts:22-27` `admin:dashboard:overview:v1` TTL 300
- `metrics/route.ts:22-29` `admin:dashboard:metrics:v1` TTL 300 (was 60, per-admin)
- `charts/route.ts:23-30` `admin:dashboard:charts:v1` TTL 300 (was 300, per-admin)
- `tables/route.ts:22-29` `admin:dashboard:tables:v1` TTL 300 (was 30, per-admin)

### Q4 — Dedupe to single call

- CMS new `apps/cms/src/app/api/admin/dashboard/overview/route.ts:1-36` — single `buildOverview()`
- BFF new `apps/web-admin/src/app/api/dashboard/overview/route.ts:1-33` — `CMS_BASE`, `tap2go-admin-token` → `401`, `fetch(CMS/admin/dashboard/overview,{cache:no-store,timeout 15s})`, forwards `X-Dashboard-Cache`, sets `Cache-Control: private, max-age=30, stale-while-revalidate=60`
- Frontend `apps/web-admin/src/hooks/useDashboard.ts:32-36,117-124` new `fetchDashboardOverview()` + `useDashboardOverview()` (`QUERY_KEYS.adminDashboardOverview`, `staleTime 30s`). Old `useDashboardMetrics/Charts/Tables` kept for compat.
- `packages/client-services/src/query/keys.ts:7` new `adminDashboardOverview:['admin','dashboard','overview','v1']`
- `apps/web-admin/src/app/(main)/dashboard/overview/page.tsx:152-175,192-217` — single `overviewQuery`, single `refetch`, `removeQueries` clears overview+metrics+charts+tables+legacy. Skeletons preserved (`DashboardSkeleton:39-123`, `SectionSkeleton:125-132`, `SectionError:134-147`, `ClientOnly:319-326`).

NOT done: `?range/fields` forwarding (BFF hardcodes CMS path), prefetch/SSR dehydrate, `Cache-Control` on splits, BFF-local Redis.

### Q5 — Entry overhead

- `apps/cms/src/utils/adminRequestGate.ts:1` `MAX 2 → 8`. Gate wraps builder only (`overview/route.ts:24-26`, same splits), so HIT never queues.
- `apps/cms/src/collections/Merchants.ts:642-650` `afterRead` returns early when `req.context.skipStoreHours`. `dashboardOverview.ts:42` `DASH_CTX` passes it to counts (moot for `count`, protective for any residual `find`).
- Auth still runs on every hit (`getPayload` + `authenticateAdmin: findByID users depth:0` before cache). No JWT-before-payload fast-path (intentional — secure, listed as future).

### Q6 — Email fix + legacy retirement

- Recent orders email now comes from `customers.email` JOIN, fallback `Customer #id` (`dashboardOverview.ts:209-216`).
- `apps/cms/src/app/api/admin/dashboard/route.ts:1-14` → `410 Gone`
- `apps/web-admin/src/app/api/dashboard/route.ts:1-12` → `410 Gone`

### Herd + write-through (FB-next 1+2)

New `apps/cms/src/utils/dashboardCache.ts`:

- No top-level `@encreasl/cache` import (payload-bin ESM safe — dynamic `import()` at runtime only: `redisGet:7-14`, `redisSet:16-24`, `redisBustPrefix:25-33`)
- L1 `L1_FRESH_MS 5000 / L1_STALE_MS 30000` (`36-44`), `inflight` singleflight map
- `getOrBuildDashboard():77-133` — L1 fresh HIT → inflight HIT → Redis HIT → stale SWR (serve `STALE`, background rebuild) → MISS build. All writes update L1 + Redis.
- `bustDashboardL1()` + `bustDashboardCache(prefix='admin:dashboard:')`

Write-through hooks (best-effort `try/catch`, `afterChange` + `afterDelete`):

- `Orders.ts:167-185`, `Transactions.ts:131-149`, `Merchants.ts:625-641`, `Vendors.ts:310-326`, `Customers.ts:25-41`

This allows TTL 300s with immediate freshness on writes. `Users.ts` has no bust (no dashboard dependency).

---

## 4. Reproduction blueprint (other pages)

Use for analytics, reports, payouts, merchant dashboard, any `limit:1000 + JS aggregate` page.

1. **Map fan-out.** Find page → hooks → BFF `route.ts` → CMS `route.ts`. Count `payload.find` + auth hits. Assert rows hydrated vs returned. If ratio >10:1, proceed.
2. **Indexes first (DB change).** Add composite `indexes: [{fields:[equality..., range/sort]}]` matching `where + sort`. `pnpm payload migrate:create`, review SQL (index-only?), `echo y | pnpm payload migrate --force`, verify `migrate:status`. Never `migrate:fresh`.
3. **Shared builder.** Create `apps/cms/src/utils/<page>Overview.ts`: `payload.count` for counts, `drizzle.execute` `SUM/COUNT/GROUP BY/JOIN LIMIT` for aggregates, single `ORDER BY ... LIMIT N` JOIN for recent rows. No `limit:1000`, no JS `filter/reduce/sort.slice` over docs. Fix email/name via JOIN, not `depth:2`.
4. **Cache wrapper.** Reuse `getOrBuildDashboard(globalKey, 300, () => withAdminRequestSlot(builder))`. Global key if data is platform-wide, per-user key only if truly personal. HIT must bypass gate; gate wraps builder only. Keep `skipStoreHours` context if merchants are read via `find`.
5. **Single endpoint.** Add CMS `.../overview/route.ts` (all groups) + keep splits as thin slices if UI needs progressive. Add BFF `.../overview/route.ts` (15s timeout, `X-Dashboard-Cache` passthrough, `Cache-Control: private, max-age=30, SWR=60`). Retire monolith to `410`.
6. **Frontend single query.** Add `QUERY_KEYS.<page>Overview`, `use<Page>Overview(staleTime 30s)`, switch page to 1 query + `removeQueries` all variants on hard refresh. Keep skeletons (`allLoading`, per-section, `ClientOnly` if echarts/date).
7. **Write-through.** Add `bustDashboardCache()` (or `<page>` prefix variant) to `afterChange+afterDelete` of every collection the builder reads. Dynamic import only — never top-level `@encreasl/cache` in collections.
8. **Verify.** `tsc --noEmit` (cms + consumer), `eslint` changed files, `migrate:status`, `git status` (no secrets). Then `EXPLAIN ANALYZE` new SQL, k6 cold/HIT p95, HIT% dashboard.

---

## 4b. Conditional extras — entity-list pages (`/merchants`-kind) vs aggregate pages (`/dashboard/overview`-kind)

Steps 1–8 above are always required. Steps below apply **only** when the page hydrates real entity rows (table/pagination: merchants, vendors, products, orders, customers lists). They do **not** apply to aggregate pages (`/dashboard/overview` returns ~60 precomputed numbers with zero doc hydration — there is nothing per-row to trim, paginate, or search).

For first-visit raw speed (cache gives nothing), ranked by impact:

1. **Kill per-row CPU the table never displays.** Example: list `sanitizeMerchantDoc` ran `getStoreHoursStatus` (up to 11,520 `isStoreOpen` loops/doc) yet the table shows only the `operationalStatus` badge (`page.tsx` + `useMerchants` type read none of `isOpenNow/storeHoursStatus/nextOpeningAt`; pickers neither). Fix: drop the call + output keys from list sanitize, keep them on `[id]` detail (or precompute at write time into columns). Verify zero readers via Grep before deleting.
2. **Narrow the page query.** Paginated `find` with `select:` of only consumed fields (verify each key against sanitize + page reads; relations in `select` stay populated per `depth`); `depth:2` only if a nested relation is actually rendered (e.g. vendor `logo` stays an ID at `depth:1` — then depth:2 replaces a second re-fetch, else keep `depth:1`); delete redundant re-fetch/merge blocks; add composite `(filter…, sort)` + sort-column indexes via migration.
3. **First paint carries real rows.** Restore `prefetch` prop passthrough (`LinkWrapper` drops it from types although runtime forwards via `...props`); set `prefetch` on the sidebar entry; replace barrel `IconWrapper` (`import *`) with direct `lucide-react` imports on the page (wrapper only forwards props — identical rendering); server-prefetch the default qs (`page=1&limit=10&sort=…`) into a dehydrated `QUERY_KEYS` cache in a server `page.tsx` wrapper, keeping `ClientOnly` + #441 guards and CSR filters, with empty-cache fallback to client fetch.
4. **Index-backed search.** `%ILIKE%` scans need `pg_trgm` (`CREATE EXTENSION IF NOT EXISTS pg_trgm` + `USING gin (… gin_trgm_ops)`); Payload/Drizzle can't generate these — hand-write the migration per `database-modification-guide.md` Example 2, register in `migrations/index.ts`, review + `migrate --force` + `migrate:status`. Keep `LIMIT 200/500` pushdown. Dedicated search engine is overkill until typo-tolerance/cross-entity relevance is required.
5. **Cached stats rollup.** Move unfiltered totals into a global `admin:<ns>:stats:v1` TTL-300 builder (`getOrBuildDashboard`, gate-inside); list MISS becomes paginated `find` + one rollup HIT; filtered `totalDocs` stays exact from `paginated`. Covered by existing prefix busts — no new bust function.

---

## 5. Verification record

- `pnpm exec tsc --noEmit` CMS + web-admin: clean
- `eslint` on `dashboardCache.ts`, `dashboardOverview.ts`, 4 CMS routes, 5 collections: clean
- `pnpm payload migrate:status`: `20260918_041730 Yes` (Batch 37)
- `git status`: only intended CMS collections/routes/utils, web-admin BFF/hooks/page, `keys.ts`, new `overview/` dirs, `20260918_041730.*`. No `migrate:fresh`, no secrets.

---

## 6. Known gaps (do not claim as done)

- `orders(created_at)`: covered by auto `orders_created_at_idx` (`payload-generated-schema.ts:1717`) — no extra migration needed. Verified 2026-09-18, no duplicate index created.
- SQL dates parameterized 2026-09-18 via `drizzle-orm sql` (`dashboardOverview.ts`: `sql`...`${thirtyDaysAgoISO}` bound params, `drizzleRows(payload, string | SQL)`). No string interpolation remaining for dates.
- Duplicate `vendor/outletCode` index names kept.
- Auth (`getPayload + findByID users`) runs on every HIT; no JWT-before-payload fast-path.
- No read replica; `drizzleRows` hits primary; pool `max 8` vs BFF 15s vs DB 20s.
- No `searchParams` forwarding, no prefetch/SSR dehydrate, splits lack `Cache-Control`, BFF has no local Redis.
- First visit is still CSR + `no-store` waterfall; 1M-row scale needs rollup/materialized view + BRIN + HLL.

Next highest leverage if needed: auth fast-path → EXPLAIN + p95/HIT% + k6 → replica/rollup.

---

## 7. Analytics application (`/dashboard/analytics`, 2026-09-18)

Same principles, filter-aware variant. Before: 3 parallel `summary/charts/tops` (same `qs`) → 3 BFF → 3 CMS handlers re-hydrating overlapping collections (~25 finds + 3 auth, up to ~31k docs with `limit:2000-5000 depth:0`, monolith 13× `depth:1`), all-JS `filter/reduce/Map/sort.slice`, per-`admin.id` + raw-qs keys, TTL 30/120/60, gate-outside-cache, no L1/singleflight, no analytics bust.

After: 1 browser → 1 BFF → 1 CMS `buildAnalyticsOverview()`.

- **Indexes:** `Vendors(businessType, verificationStatus, isActive)`, `Transactions(payment_method)`, `Orders(fulfillment_type, delivery_status)` added to collections. `pnpm payload migrate:create` → `20260918_053029.ts` (index-only, reviewed), `echo y | pnpm payload migrate --force` → `Migrated (368ms)`, `migrate:status Yes` (Batch 38). `order_items(order,product)` already auto-indexed — not duplicated.
- **Shared builder** `apps/cms/src/utils/analyticsOverview.ts`: reuses `parseAnalyticsParams`; `buildAnalyticsNormalizedKey()` (global, no `admin.id`; range aliases `1y/365d/12m→1y`, `all/0→all`; lowercase `q`; sorted CSV); filtered-orders WHERE (date + `LOWER(status/fulfillment/delivery)` + vendor `COALESCE(LOWER(business_type/verification_status),'unknown')` + `q` ILIKE across `o.id/m.outlet_name/v.business_name/EXISTS order_items`) + verified-revenue JOIN (paid window + `LOWER(payment_method)` + filtered orders); `payload.count` globals + parameterized `drizzle-orm sql` `SUM/COUNT/GROUP BY/JOIN LIMIT 5/8/10`; unfiltered revenue trend preserved (monolith semantics); hourly/weekday via `EXTRACT(HOUR/DOW)` + verified-revenue subquery; category via `order_items→products→products_rels→prod_categories` + uncategorized fallback. Returns `{summary, charts, tops}` matching `analytics-types.ts` shapes.
- **Cache:** CMS new `analytics/overview/route.ts` (`admin:analytics:overview:v1:<normalized>`, TTL 300, `getOrBuildDashboard` + gate-inside-builder, `X-Analytics-Cache`). Splits (`summary/charts/tops`) refactored to same global key + builder slices (identical numbers). Monoliths retired: CMS `analytics/route.ts` → `410`, BFF `api/analytics/route.ts` → `410`.
- **BFF:** new `api/analytics/overview/route.ts` (forwards all 7 params + `range` default, 25s timeout, `X-Analytics-Cache` passthrough, `Cache-Control: private, max-age=30, SWR=60`).
- **Frontend:** `keys.ts` new `adminAnalyticsOverview(qs)`, `useAnalyticsOverview(qs)` (`staleTime 60s`, `keepPreviousData`), page switched to single `overviewQuery` with adapters preserving per-section skeleton/error UX. Old split hooks kept for compat.
- **Write-through:** `dashboardCache.ts` new `bustAnalyticsCache()` (`admin:analytics:` L1+Redis); `Orders/Transactions/Merchants/Vendors/Customers` hooks now bust both dashboard + analytics prefixes (`afterChange+afterDelete`).
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean, `migrate:status` both `Yes`, no `migrate:fresh`.

---

## 8. Reports application (`/dashboard/reports`, 2026-09-18)

Same principles, range-only variant (no `q`/status filters — only `range`). Before: 3 parallel `summary/financial/catalog` (same `range`) → 3 BFF → 3 CMS handlers re-hydrating overlapping collections (15 finds + 3 auth, `vendors/orders/transactions` 2–3× each; monolith 9× `depth:1` incl. dead `products` + `reviews` fetches), all-JS `filter/reduce/Map/sort.slice(0,20/100/200)`, per-`admin.id` + raw-qs keys, TTL 30/60/120, gate-outside-cache, no L1/singleflight, no reports bust.

After: 1 browser → 1 BFF → 1 CMS `buildReportsOverview()`.

- **Indexes:** `Vendors(businessType, verificationStatus, isActive)`, `Transactions(payment_method)`, `Orders(fulfillment_type, delivery_status)` added under analytics migration `20260918_053029.ts` (index-only, reviewed, `migrate --force` 368ms, status Yes Batch 38). `order_items(order,product)`, `order_discounts(order)`, `delivery_bookings(order)`, `orders(created_at)` already auto-indexed — not duplicated. No new migration for reports (code-only after analytics migration).
- **Shared builder** `apps/cms/src/utils/reportsOverview.ts`: `buildReportsNormalizedKey()` (global, no `admin.id`, range-only normalized); period windows from `parseReportsParams`; `payload.count` globals (vendors, merchants, orders, transactions, wishlists) + parameterized `drizzle-orm sql` aggregates — summary KPIs (`SUM FILTER`, discounts `amount_off/vendor_share`, active counts, ratings `AVG`), financial 200-row reconciliation JOIN (transactions+orders+merchants+vendors+discount sums, totals preserve truncated-200 semantics for fees + full-period gross), vendor payouts `GROUP BY` with `GREATEST(0,…)` net, refunds `UNION ALL LIMIT 100`, catalog daily `GROUP BY day`, products `GROUP BY snapshot LIMIT 20`, vendors full list (denormalized fields preserved), bookings JOIN + `byStatus`. Returns `{summary, financial, catalog}` matching CMS route shapes.
- **Cache:** CMS new `reports/overview/route.ts` (`admin:reports:overview:v1:<range>`, TTL 300, `getOrBuildDashboard` + gate-inside-builder, `X-Reports-Cache`). Splits refactored to same global key + builder slices. Monoliths retired: CMS `reports/route.ts` → `410`, BFF `api/reports/route.ts` → `410`.
- **BFF:** new `api/reports/overview/route.ts` (forwards `range` + default `30d`, 25s timeout, `X-Reports-Cache` passthrough, `Cache-Control: private, max-age=30, SWR=60`).
- **Frontend:** `keys.ts` new `adminReportsOverview(range)`, `useReportsOverview(range)` (`staleTime 60s`, `keepPreviousData`), page switched to single `overviewQuery` with adapters preserving per-section skeleton/error UX. Old split hooks kept for compat.
- **Write-through:** `dashboardCache.ts` new `bustReportsCache()` (`admin:reports:` L1+Redis); `Orders/Transactions/Merchants/Vendors/Customers` hooks now bust all three prefixes; `OrderDiscounts.ts` new `afterChange+afterDelete` bust reports (dynamic import only, no top-level `@encreasl/cache` in collections).
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean, `migrate:status` both `Yes`, no `migrate:fresh`.

---

## 9. Vendors application (`/vendors`, `/vendors/payouts`, 2026-09-18)

Same principles, payouts = full port, list = sidecar port, detail = bounded + cached. Before: payouts 3 parallel `summary/rows/daily` (same `qs`) → 3 BFF → 3 CMS handlers re-hydrating identical 4 collections (12 finds + 3 auth, ~36k docs `vendors/merchants/orders/transactions 2000/2000/5000/5000 depth:0`, monolith 5× `depth:1` ~12k), all-JS `filter/Map/reduce/sort(net)`, per-`admin.id` raw-qs keys TTL 30/60/120, no gate/L1/singleflight/bust; vendors list paginated display correct but stats sidecars (`vendors 2000 + merchants 5000` + JS breakdowns, per-admin 20s, gate-outside); detail `findByID depth:2 + merchants 50` + dead `orders limit:0`, no cache.

After: payouts 1 browser → 1 BFF → 1 CMS `buildPayoutsOverview()`; list keeps paginated `find` + SQL sidecars; detail cached single-doc.

- **Indexes:** reused `20260918_041730` + `20260918_053029` (`Vendors(businessType,verificationStatus,isActive)`, `Transactions(status,paid_at/payment_method)`, `Orders(status/merchant/fulfillment/delivery)`). `order_items(order,product)`, `delivery_bookings(order)`, `orders(created_at)` already auto-indexed — not duplicated. No new migration (code-only).
- **Shared builder** `apps/cms/src/utils/payoutsOverview.ts`: `buildPayoutsNormalizedKey()` (global, no `admin.id`; range aliases, lowercase search, sorted CSV, `isActive` tri-state); vendor filter WHERE (`LOWER(verification/businessType)`, `is_active`, ILIKE across `business_name/legal_name/regNumber/email`) + verified-revenue JOIN (paid window + filtered vendors); parameterized `drizzle-orm sql` — single vendor agg (all filtered vendors incl. zero-payout, live `COUNT(DISTINCT merchants)`, `SUM/COUNT`, `GREATEST(0,…)` net, media logo JOIN), separate per-vendor refunded (avoids fan-out double-count), daily `GROUP BY day`, verification `GROUP BY`. Returns `{meta, summary, vendorPayouts, daily, verificationBreakdown}` matching monolith shape (splits slice it).
- **Cache:** CMS new `vendors/payouts/overview/route.ts` (`admin:payouts:overview:v1:<normalized>`, TTL 300, `getOrBuildDashboard` + gate-inside, `X-Payouts-Cache`). Splits refactored to same key + slices. Monoliths retired: CMS `vendors/payouts/route.ts` → `410`, BFF `vendors/payouts/route.ts` → `410`. Vendors list `route.ts` → global `admin:vendors:v1:<qs>` TTL 60, gate-inside; detail `[id]/route.ts` → `admin:vendors:detail:v1:<id>` TTL 120, gate-inside, dead `orders limit:0` removed.
- **BFF:** new `api/vendors/payouts/overview/route.ts` (qs forward + `range` default, 30s timeout, `X-Payouts-Cache` + `Cache-Control`).
- **Frontend:** `keys.ts` new `adminVendorPayoutsOverview(qs)`, `usePayoutsOverview(qs)` (`staleTime 60s`), payouts page single `overviewQuery` with adapters (client `slice` pagination kept — cheap over aggregated rows). Old split hooks kept.
- **Write-through:** `dashboardCache.ts` new `bustPayoutsCache()` + `bustVendorsCache()`; `Orders/Transactions` bust dashboard+analytics+reports+payouts; `Merchants/Vendors` bust all five incl. vendors; `OrderDiscounts` bust reports (payouts unaffected — no discount reads).
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean, `migrate:status` both `Yes`, no `migrate:fresh`.

---

## 10. Merchants application (`/merchants`, 2026-09-18)

Same principles, list-sidecar variant (display already paginated; stats + vendor-search fallback were the blowup). Before: list `GET` gate-outside + per-`admin.id` raw-qs key TTL 20 → 12 concurrent `find` (paginated `depth:1` + `vendors limit:1`×2 + conditional `vendors 2000` + `merchants limit:1`×8 incl. 5× operational) + unbounded `vendors IN (pageIds) depth:1` + worst-case `merchants 5000 depth:2` vendor-search fallback with in-memory `filter/sort/slice` + pagination override; stats read `totalDocs` off `limit:1` finds; `sanitizeMerchantDoc:getStoreHoursStatus` per doc doubled by collection `afterRead` (no `skipStoreHours`); detail `findByID depth:2` + dead `orders limit:0` count-via-find, no cache/gate; `peak-hours` unbounded `orders limit:0` + per-order `Intl` loop; `timezone POST` no bust; BFF list 20s timeout no `Cache-Control`, detail drops `X-Cache`.

After: list keeps paginated `find` (correct) + counts/SQL sidecars; detail + peak-hours cached.

- **Indexes:** reused `20260918_041730` + `20260918_053029` (no new migration, code-only). Vendor-search ILIKE uses existing `business_name` pattern + `Vendors(businessType,verificationStatus)` for constrained resolution; `merchants(vendor)`, `orders(created_at)` auto-indexed.
- **List builder** (in-route `buildMerchantsList`): vendor verification/businessType resolved via bounded SQL (500) and pushed as `vendor IN` (fixes post-filter pagination drift); vendor businessName search via bounded SQL ILIKE (200) OR-ed with direct `outletName/outletCode/contact` matches (replaces `merchants 5000 depth:2` fallback, respects requested `sort` + DB pagination totals); stats via `payload.count` (merchants total/active/accepting, vendors total/active) + SQL `GROUP BY operational_status`; merchant counts per vendor via SQL `GROUP BY vendor_id`; page-vendor enrichment kept bounded (≤100, `skipStoreHours`); empty-constraint short-circuit returns zero page without queries. Global `admin:merchants:v1:<sorted-qs>` TTL 60, `getOrBuildDashboard` + gate-inside, `X-Merchants-Cache`.
- **Detail `[id]`:** wrapped in `admin:merchants:detail:v1:<id>` TTL 120 + gate-inside; dead `orders limit:0` replaced by `payload.count(vendor)`; `findByID` + sibling finds pass `skipStoreHours` (route-level sanitize keeps single `getStoreHoursStatus`).
- **Peak-hours `[id]/peak-hours`:** unbounded `orders limit:0` + JS cutoff + per-order `Intl` → single SQL `EXTRACT(HOUR FROM created_at AT TIME ZONE <validated-tz>)` + `COUNT FILTER (delivered/cancelled)`, `GROUP BY 1`, gate-inside, `admin:merchants:peak:v1:<id>:<days>` TTL 300. Timezone POST adds missing `bustMerchantsCache()`.
- **Write-through:** `dashboardCache.ts` new `bustMerchantsCache()`; `Merchants` hooks bust all six prefixes; list POST + `[id]` PATCH/DELETE switched from `deleteCachedByPrefix` to `bustMerchantsCache()` (L1+Redis).
- **BFF:** list GET adds `Cache-Control: private, max-age=30, SWR=60`; detail GET forwards `X-Merchants-Cache`. Frontend unchanged (list already single `useMerchants(qs)`; detail/edit direct-fetch now HIT-cached server-side).
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean, `migrate:status` both `Yes`, no `migrate:fresh`.

---

## 15. Merchants cold-speed pass (first-visit raw speed, 2026-09-18)

Cache helps only revisits. These five cut the cold MISS itself (ranked by impact):

- **Item 1 — no per-row store-hours on list.** `merchants/route.ts sanitizeMerchantDoc` no longer calls `getStoreHoursStatus` (up to 11,520 `isStoreOpen` loops/doc) nor returns `isOpenNow/storeHoursStatus/nextOpeningAt`. Verified zero readers in list table, `useMerchants` type, and all picker consumers (`OrderForm`, `CouponForm`, `MerchantProductForm`, vendor pages); detail `[id]`, vendor outlets, storefront, and mobile keep them.
- **Item 2 — narrow page query.** Paginated `find` is now `depth:2` (vendor `logo`/media populated in-trip) + `select:` dropping unread heavy blobs (`operatingHours`, `specialHours`, `delivery_hours`, geometries, coordinates, interior/menu images); the second `vendors IN (pageIds)` find + merge block is deleted. New composite `isActive_operationalStatus_createdAt_idx` + `outletName_idx` via migration `20260918_141028.ts` (index-only, 391ms, status Yes Batch 42).
- **Item 5 — stats rollup split.** New global `admin:merchants:stats:v1` TTL-300 builder (`getMerchantStats()`); list MISS is now paginated `find` + one rollup HIT instead of 5 counts + `GROUP BY` per qs.
- **Item 4 — trigram search.** Manual migration `20260918_143000_merchants_vendors_trgm.ts` (`CREATE EXTENSION IF NOT EXISTS pg_trgm` + GIN `gin_trgm_ops` on `merchants(outlet_name,outlet_code)`, `vendors(business_name,legal_name)`; registered in `migrations/index.ts`, 1061ms, status Yes Batch 43). Payload/Drizzle can't generate these — hand-written per `database-modification-guide.md` Example 2.
- **Item 3 — first render.** `LinkWrapper` accepts `prefetch` again (runtime already forwarded it); sidebar `All Merchants` link prefetches; merchants page icons import directly from `lucide-react` (wrapper only forwards props, identical rendering; drops the `import *` barrel from the chunk). First rows: `merchants/page.tsx` is now a server wrapper prefetching default `page=1&limit=10&sort=-createdAt` into a dehydrated `QUERY_KEYS.adminMerchants` cache — cold open paints real rows on first client commit; `ClientOnly` + #441 guards preserved, filters stay CSR, empty-cache fallback is the old client fetch.
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean, `migrate:status` all `Yes`, no `migrate:fresh`. Retest cold load empty-cache: expect cover → shell → real rows, no blank stage.

---

## 11. Products/Catalog application (`/products`, `/catalog/*`, 2026-09-18)

Same principles, list-sidecar variant (displays already paginated; stats hydration was the blowup; no fan-out to dedupe — each list is already a single query). Before: every list did paginated `find depth:1/2` + unbounded stats `find limit:2000 depth:0` (+ `products 5000` for categories, 2× `2000` + re-fetch for terms/values) with JS `filter/Map` breakdowns; `merchant-products` filtered path hydrated 11k docs (`vendors/merchants/merchant-products/products 2000/2000/5000/2000`) + N+1 per-vendor counts unfiltered; per-admin raw-qs keys TTL 20, gate-outside (products) or no gate (merchant-products, all catalog); no L1/singleflight; prefix-SCAN bust only.

After: same single queries, global keys, gate-inside, SQL stats, bounded hydration.

- **Indexes:** `Products(productType, isActive, catalogVisibility)` added. `pnpm payload migrate:create` → `20260918_102102.ts` (index-only, reviewed), `echo y | pnpm payload migrate --force` → `Migrated (386ms)`, `migrate:status Yes` (Batch 39). FKs (`merchant_id/product_id`, `product_id`, `attribute/ variation/term_id`, `parentCategory`, `sku` unique) already auto-indexed — not duplicated.
- **List builders** (in-route, shapes preserved): `products` stats → single SQL `COUNT + COUNT FILTER (simple/variable/grouped/active)`; `merchant-products` unfiltered N+1 → single SQL `GROUP BY merchant vendor` + `payload.count` totals, filtered 11k → SQL vendor page (`DISTINCT` + `ORDER BY business_name LIMIT/OFFSET`, `COUNT DISTINCT` total) + bounded hydration (page vendors → merchants → mps → products via `product_id_id IN`); `variations` → `COUNT + FILTER (mode×3/stock/active)`; `attributes` → `FILTER (type×4/active)`; `attribute-terms` → global `GROUP BY attribute_id` + `FILTER active` + filtered exact via WHERE fragment (replaces bounded-2000 re-fetch + cap fallback), term search pre-pass via SQL ILIKE `LIMIT 200`; `variation-values` → 3× `GROUP BY` (variation/attribute/term) + filtered variants; `product-categories` → `FILTER (active/featured/top)` + `GROUP BY level/type` + `products_rels GROUP BY "product-categoriesID"` (replaces `products 5000` scan). All parameterized `drizzle-orm sql`, all TTL 60 globals (`admin:products:v1`, `admin:merchant-products:v1`, `admin:catalog-<ns>:v1`).
- **Details `[id]`** (products, merchant-products, variations, attributes, terms, values, categories): wrapped in `…:detail:v1:<id>` TTL 120 + gate-inside; categories 5000-scan fallback → SQL rels `COUNT`; merchant-products detail passes `skipEffectiveModifierPreview`; PATCH/DELETE busts switched to `bustProductsCache()/bustCatalogCache()` (L1+Redis).
- **Write-through:** `dashboardCache.ts` new `bustProductsCache()` (`admin:products:` + `admin:merchant-products:`) + `bustCatalogCache()` (`admin:catalog-` + `admin:product-categories:`); `Products` afterChange, `MerchantProducts` afterChange/afterDelete, `ProdVariations` afterChange/afterDelete, `ProdAttributes/Terms/Values/Categories` afterChange/afterDelete. Dynamic import only in collections.
- **BFF:** lists add `Cache-Control: private, max-age=30, SWR=60` + `X-*-Cache` forward (products, merchant-products, product-categories, 4 catalog groups); `[id]` GETs forward `X-*-Cache`. Frontend unchanged (lists already single `useQuery`; details direct-fetch now HIT-cached).
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean, `migrate:status` 3× `Yes`, no `migrate:fresh`.

---

## 12. Orders application (`/orders`, `/order-items`, `/transactions`, 2026-09-18)

Same principles, list-sidecar variant (displays already single-query with correct pagination; stats hydration was the blowup; no fan-out to dedupe). Before: lists did paginated `find depth:2` (correct, bounded ≤100) + unbounded stats hydration (`orders 2000 + transactions paid 2000`, `order-items 2000`, `transactions 2000`) with JS `for` breakdowns/sums/Sets; per-`admin.id` raw-qs keys TTL 20, no gate/L1/singleflight; details uncached (`orders/[id]` 1+7 aggregates per view, `transactions/[id]` 1+1, `order-items/[id]` single) with dead `orders limit:0` count-via-find; BFF no timeout/`Cache-Control`, detail drops `X-Cache`; frontend `fulfillmentType/deliveryStatus` camelCase never matched CMS `fulfillment_type/delivery_status` (filters silently ignored).

After: same single queries, global keys, gate-inside, SQL stats, cached details.

- **Indexes:** `Orders(placed_at)` (list default sort `-placed_at` was unindexed) + `OrderTracking(order,timestamp)` (detail timeline `WHERE order + ORDER BY timestamp`). `pnpm payload migrate:create` → `20260918_103301.ts` (index-only, reviewed), `echo y | pnpm payload migrate --force` → `Migrated (399ms)`, `migrate:status Yes` (Batch 40). Status/payment/FK sorts already covered by `041730`/`053029`/auto indexes; `LIKE %…%` search and `discount_total` expression intentionally not indexed.
- **List builders** (in-route, shapes preserved, stats stay global per existing contract): `orders` stats → `COUNT` + `GROUP BY status/fulfillment_type/delivery_status` + `SUM(paid)`, later consolidated into a cached rollup (§12b); `order-items` → `COUNT + SUM(total_price/quantity) + COUNT DISTINCT order/product + FILTER (options_snapshot not empty)` (avgQuantity divisor fixed to `totalAll` instead of capped-2000 length); `transactions` → `COUNT + SUM FILTER (paid/refunded/failed/pending)` + `GROUP BY status/payment_method`. All parameterized `drizzle-orm sql`, all TTL 60 globals (`admin:orders:v1`, `admin:order-items:v1`, `admin:transactions:v1`).
- **Details:** `orders/[id]` (1+7 aggregates) + `transactions/[id]` (1+1) + `order-items/[id]` wrapped in `:detail:v1:<id>` TTL 120 + gate-inside; dead `orders limit:0` replaced by `payload.count(vendor)`; PATCH busts switched to `bustOrdersCache()/bustOrderItemsCache()` (L1+Redis).
- **Write-through:** `dashboardCache.ts` new `bustOrdersCache()`, `bustOrderItemsCache()`, `bustTransactionsCache()`; `Orders` hooks bust all eight prefixes; `Transactions` bust six; `OrderItems` new `afterChange+afterDelete` bust items+orders. Dynamic import only in collections.
- **BFF:** lists add 20s timeout + `Cache-Control` + existing `X-*-Cache` forward; details forward `X-*-Cache`. Frontend one-line fix: `fulfillmentType/deliveryStatus` → `fulfillment_type/delivery_status` (filters now actually apply).
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean, `migrate:status` 4× `Yes`, no `migrate:fresh`. Known remaining gap (documented, not changed): list `search` covers `id/lalamove/notes/coupon` only, not merchant/customer/outlet despite placeholder text — needs JOIN search if desired.

---

## 12b. Orders list-speed pass (stats rollup + first paint, 2026-09-18)

`/orders` is a §4b entity-list page: the base port (§12) fixed the 2000-doc hydration blowup; this pass removes the remaining per-request recounts + cold-start waterfall. Code-only, no migration.

- **Repeated-scan consolidation — one `admin:orders:stats:v1` rollup.** The 5 global stat queries ran on every list MISS of every qs. Moved into a TTL-300 builder (`getOrdersStats`) sharing `bustOrdersCache` coverage; inside it, `COUNT` + the 3 dimension `GROUP BY`s collapse into a SINGLE `GROUPING SETS ((status),(fulfillment_type),(delivery_status),())` scan (`GROUPING()` flags disambiguate rows; total row = all-1s), revenue (transactions table) stays the second query. Verified identical numbers vs the old 5-query shape: total=5, status facet matches original `GROUP BY status`, revenue=76. Recurring scans per qs: 5→0; per-build: 5→2. §17c 42803 rule applied — matched set includes all three dims. Stats stay global per contract.
- **`skipStoreHours` on the list find.** `depth:2` populates a full merchant per order and its `afterRead` runs `getStoreHoursStatus` (≤11,520 loops) — the table renders only `outletName` + `vendor.businessName/logo`. One-line `context` guard (same as §17c item 3). Note: Payload can't project nested merchant/customer docs via `select`, so full bounded enrichment (`depth:0` + projected finds) is deferred until profiling shows merchant/customer payload dominates.
- **First paint carries real rows (§4b item 3).** Orders page split into `content.tsx` (client, `OrdersPageContent`/`OrdersSkeleton` exported) + server `page.tsx` wrapper prefetching default `page=1&limit=10&sort=-placed_at` into the dehydrated `QUERY_KEYS.adminOrders` cache (`next: { revalidate: 30 }`); sidebar `All Orders` now `prefetch={true}`; icons import direct from `lucide-react` (dropped the `IconWrapper` barrel + 6 unused: `Users/ShieldAlert/TrendingUp/Filter/Star/Award`).
- **Fixed dead AOV field.** CMS has always sent `stats.avgOrderValue` but the page read `stats.averageOrderValue` — the average order value KPI never rendered. Renamed the frontend type + read to `avgOrderValue`.
- **Verify:** GROUPING SETS + revenue queries run against Supabase via `pg` (numbers match old shapes); `tsc --noEmit` CMS + web-admin clean; `eslint` clean on changed files; no new migration, no `migrate:fresh`.

---

## 13. Customers application (`/customers`, addresses, emergency-contacts, activity, 2026-09-18)

Same principles, list-sidecar variant (displays already single-query with correct pagination; stats hydration was the blowup; no fan-out to dedupe except addresses 2-query page). Before: customers list did level `customers 5000` + `has_active` `customers 5000` + paginated `users depth:2` + stats `users limit:0` (docs empty → stats zeros) + profile `customers 5000 depth:2` + page-scoped `orders/addresses 5000`; addresses list did `customers 5000` + users search 200 + paginated `depth:2` + discarded `limit:0` + stats `addresses 2000` + per-page active fetch; emergency list did users search 200 + paginated `depth:2` + discarded `limit:0` + stats 2000; activity `depth:3`; all per-`admin.id` raw-qs keys TTL 20, gate-outside (customers) or no gate, no L1/singleflight/bust.

After: same single queries, global keys, gate-inside, SQL stats + id sets.

- **Indexes:** `Customers(currentLevel)`, `Users(isActive)`, `Addresses(address_type,is_default)`, `EmergencyContacts(relationship,isPrimary)` added. `pnpm payload migrate:create` → `20260918_105206.ts` (index-only incl. `isActive` renames, reviewed), `echo y | pnpm payload migrate --force` → `Migrated (342ms)`, `migrate:status Yes` (Batch 41). FK/search `contains` intentionally not indexed (`LIKE %…%`).
- **List builders** (in-route, shapes preserved): `customers` level/has_active pre-filters → SQL id sets (`SELECT user_id … LIMIT 10000`, `active_address_id IS NOT NULL`), profiles page-scoped (`user IN pageIds depth:1`, was 5000 `depth:2`), stats via SQL (`COUNT`, `GROUP BY current_level`, active/inactive, monthly enrollment, active-address) — also fixes stats previously returning zeros; `addresses` active-map → SQL id pairs, user search → SQL ILIKE `LIMIT 200`, stats via `GROUP BY` + `FILTER` + pre-sorted top-localities, enrichment page-scoped; `emergency` user search → SQL ILIKE, stats via `COUNT + GROUP BY relationship`; `activity` `depth:3` → `depth:2` (covers `customer.user.profilePicture` + nested product). All parameterized `drizzle-orm sql`, TTL 60 globals (`admin:customers:v1`, `admin:customer-addresses:v1`, `admin:emergency-contacts:v1`, `admin:customer-activity:v1:<activity>`).
- **Details `[id]`** (customers, addresses, emergency): wrapped in `:detail:v1:<id>` TTL 120 + gate-inside; bounded finds kept (orders 10, addresses 50, events 8, wishlists 50); PATCH/DELETE/POST add missing `bustCustomersCache()`.
- **Write-through:** `dashboardCache.ts` new `bustCustomersCache()` (all four customer-domain prefixes L1+Redis); `Customers` hooks extend to it; `Addresses` afterChange (sync-safe `void …catch`) + afterDelete; `EmergencyContacts` new `afterChange+afterDelete`. Dynamic import only in collections.
- **BFF:** lists add 20s timeout (addresses/emergency) + `Cache-Control` (all four); details forward `X-*-Cache`. Frontend unchanged (lists already single `useQuery`; details direct-fetch now HIT-cached).
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean, `migrate:status` 5× `Yes`, no `migrate:fresh`.

---

## 14. First-paint fix (`/dashboard/overview` blank before skeleton, 2026-09-18)

Same principles applied to rendering: never serve blank. Before: cold open showed blank tab → gradient cover → blank/`Checking…` → skeleton. Causes: RootLayout awaited CMS `users/me` before streaming any byte (up to 10s); `(main)/layout` `Suspense fallback={null}` swallowed the skeleton on prerender (`useSearchParams` suspend); `ProtectedRoute` returned literal `null`; skeleton is pure Tailwind (invisible pre-CSS); Font-Awesome CDN link render-blocked first paint.

After (`apps/web-admin/src/app/layout.tsx`, `app/(main)/layout.tsx`):
- RootLayout is sync; session resolves in `ProvidersWithSession` (async, `Promise.all(user, token)`) inside `Suspense` — static shell streams on first byte, auth fills in when ready. Client revalidation on null seed unchanged.
- New `AdminShellFallback` (inline styles only, no hooks/Tailwind) used as `Suspense` fallback AND `ProtectedRoute` fallback — first paint is always a shell, never blank/null.
- FA stylesheet loaded via `FontAwesomeLoader` client component (DOM-injected on mount, never render-blocking; `noscript` fallback). NOTE: a `media="print"` + `onLoad` link was tried first and reverted — event handlers are illegal on `<link>` in Server Components (500 on every route).
- **Verify:** `tsc` + `eslint` clean. Retest cold load with empty cache + throttled network; back-nav unaffected.

---

## 16. Products cold-speed pass (first-visit raw speed, 2026-09-18)

§4b items 2–5 applied to `/products` (merchant-encapsulated `merchant-products` landing + master `products` list). **Architectural change (2026-09-20):** the landing now pages outlets (merchants) directly — Vendors→Merchants→Products simplified to Merchants→Products — and clicking an outlet drills into its products via `?merchant=<id>` on the same endpoint. Item 1 N/A — products have no per-row CPU loop (modifier-preview resolver already bypassed via `skipEffectiveModifierPreview`); verified via agents.

- **Item 2 — narrow page query.** Master list `depth:2` → `depth:1` (categories/vendor/media resolve at depth 1; depth 2 only re-hydrated nested uploads) + `select:` dropping `description` richtext + `parentProduct` (agent-verified unread in table, detail, forms, pickers; detail `[id]` keeps full fetch). Merchant-products bounded hydration kept (page merchants → mps → products).
- **Item 5 — stats rollup split.** New globals `admin:products:stats:v1` + `admin:merchant-products:stats:v1` TTL-300 (`getProductsStats()`, `getMerchantProductStats()`); list MISS is now paginated `find` + one rollup HIT. Shapes identical; busts already covered by `bustProductsCache()` (both prefixes).
- **Item 4 — trigram search.** Manual migration `20260918_144500_products_trgm.ts` (`pg_trgm` + GIN on `products(name,slug,sku,short_description)`; registered in `migrations/index.ts`, 791ms, status Yes Batch 44). Vendors/merchants names covered by `20260918_143000`. `LIMIT 200` pushdown kept.
- **Item 3 — first render.** Products page icons import directly from `lucide-react` (drops 2 unused + the `import *` barrel; wrapper only forwards props); `SidebarItem` accepts `prefetch` (like `renderChildLink`), `Products` entry prefetches; `products/page.tsx` is now a server wrapper prefetching default `page=1&limit=10` into dehydrated `QUERY_KEYS.adminMerchantProducts` cache — cold open paints real rows on first commit. `ClientOnly` + #441 guards preserved, search/pagination stay CSR. Outlet drill-in moved to `/products/merchants/[merchantId]` (single fetch via `?merchant=<id>`, no vendor layer).
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean, `migrate:status` all `Yes`, no `migrate:fresh`. Scales to thousands of products: outlet page + `COUNT` totals in SQL, bounded hydration per page, exact `filteredTotal` from `paginated.totalDocs`.

---

## 17. Products marketplace upgrades (`/products` outlet landing, 2026-09-18; merchant-encapsulated, 2026-09-20)

Alibaba/Amazon patterns applied where they fit this stack (studied via agents + web research). **Post-2026-09-20**: the `/products` landing was simplified from Vendors→Merchants→Products to **Merchants→Products**. The `admin/merchant-products` GET now pages outlets (merchants) directly instead of vendor-encapsulated grouping. Backend supports two modes on the same endpoint: landing (no `merchant` filter — outlets with per-merchant product counts) and drill-in (`merchant=<id>` — that outlet's products). Deliberately NOT built: dedicated search engine (overkill — trigram + pushdown suffice), denormalized matview (current SQL page is the pragmatic equivalent at this scale), cursor pagination (would break numbered Prev/1..5/Next UI), ISR landing (per-admin token + `private` make it uncacheable at edge).

- **Facets (defunct).** The old vendor-encapsulated `business_type`/`verification_status` facets were vendor-level and not rendered by the UI; they have been removed with the merchant-encapsulated rewrite. Future merchant-level facets (operationalStatus, isActive) can be added via the same `GROUPING SETS` pattern if needed.
- **Image variants.** `sanitizeMediaRef` now also returns `thumbUrl` (`/upload/w_80,q_auto,f_auto/` injected into Cloudinary fetch URLs; non-cloudinary/already-transformed/null pass through safely). Outlet thumbnail in `content.tsx` uses `next/image` (`40×40`, `sizes="40px"`, `loading="lazy"`, thumb preferred) — remote hosts already allowlisted in `next.config.ts`. Biggest LCP/bandwidth win on the page.
- **Verify:** `tsc` CMS + web-admin clean, `eslint` clean. NOTE: `thumbUrl` must stay module-private in route files — Next.js route type-check rejects non-route exports. The `products/vendors/**` route tree has been deleted; the drill-in page now lives at `products/merchants/[merchantId]/page.tsx`.

---

## 17c. Filtered-path single-scan pass (`/products` searches, 2026-09-18; merchant-encapsulated, 2026-09-20)

Follow-up to §17. Agent-verified diagnosis + fix in `apps/cms/src/app/api/admin/merchant-products/route.ts`. **Post-2026-09-20:** rewritten alongside §17 — the endpoint now handles merchant-encapsulated landing + drill-in instead of vendor-encapsulated grouping.

**Default landing (merchant-encapsulated, post-2026-09-20):** outlet page via paginated `find` (projected, `depth:2`, `skipStoreHours`) + per-merchant product counts via single `GROUP BY merchant_id_id` + 4 cached `payload.count` totals from `getMerchantProductStats`. Search covers outlet `outlet_name/outlet_code` OR product `name/slug/sku` via `EXISTS` subquery. Zero mp/product docs hydrated for the landing.

**Drill-in (`merchant=<id>`, post-2026-09-20):** product counts + product list bounded via `WHERE merchant_id_id = <id>` + optional product search/type/active filters in SQL. Products hydrated per-page only (bounded by SQL `LIMIT`).

**Legacy vendor-encapsulated (pre-2026-09-20, preserved for reference):** 7 cheap ops (vendors page via paginated `find depth:1` + scoped merchants `IN (pageIds) depth:0` + one SQL `GROUP BY vendor_id` for product counts + 4 cached `payload.count` totals from `getMerchantProductStats`). Zero mp/product docs hydrated. Relations are all FK-indexed; JOIN order is not the problem.

- **Verify:** `CREATE INDEX` + all three query shapes (facet aggregate, EXISTS variant with `p.name ILIKE`, distinct page) run against Supabase via `pg`; `tsc --noEmit` CMS clean, `eslint` clean, `migrate:status` Batch 45 `Yes`. Sample: 9 vendors total, facet rows `restaurant:5 / other:5` on `%chicken%` search.

---

## 17b. Marketplace patterns — conditional status for `/products`-kind pages

The Alibaba/Amazon study (agents + web research) produced six patterns. Only two are built unconditionally; the rest are **explicitly deferred with build triggers**. Do NOT build them speculatively — each changes contracts, freshness, or infra. Note: §17b items 2–4 reference the vendor-encapsulated model (pre-2026-09-20); the landing now pages outlets directly (merchant-encapsulated). Apply these conditionals to any future vendor-centric or category-centric landing variant.

1. **Search leaves Postgres → inverted index (Typesense/Meilisearch/ES).** CONDITIONAL — build when: trigram `%ILIKE%` p95 exceeds budget at scale, or typo-tolerance/cross-entity relevance becomes a product requirement. Until then trigram + `LIMIT` pushdown suffices. Note the search stays in-DB so today's `matchWhere` SQL is the future indexer's filter spec — keep it exact.
2. **Denormalized read model (`merchant_list_v1` or `vendor_list_v1` matview/table).** CONDITIONAL — build when: the filtered landing page (now a single outlet `COUNT + GROUP BY` or, for vendor variants, `GROUPING SETS` aggregate + indexed distinct page) breaches budget, or counts must stay correct past the hydration caps. Refresh via existing `bustProductsCache` write hooks + 60s rebuild (same pattern as stats rollups). Until then the SQL page IS the pragmatic equivalent.
3. **Cursor pagination (`search_after` on `(outlet_name, id)`).** CONDITIONAL — build when: deep pages are actually used or OFFSET cost shows in `EXPLAIN`. It breaks the numbered Prev/1..5/Next UI, so it requires a frontend contract change (`hasNextPage` via `LIMIT+1`, cursor in URL, exact totals only for the unfiltered head). Do not half-build backend cursors the UI ignores.
4. **Tiles-not-groups contract split.** CONDITIONAL — build when: hydration dominates despite caps (media-heavy groups). Landing returns entity + counts only; products move to drill-down pages. Requires frontend + BFF contract versioning.
5. **Image variants.** BUILT (§17: `thumbUrl` + `next/image` 40×40 lazy). Extend to product tiles if a product-grid view ships (same helper pattern, `w_320`).
6. **ISR/edge landing.** CONDITIONAL — build when: anonymous or shared-token traffic exists. Today per-admin JWT + `private` make even the identical landing uncacheable at the edge; making it public requires separating the auth gate from the cached payload first. Do not mark filtered/search responses public.

---

## 18. Business Zones application (`/business-zones/admin`, 2026-09-18)

Same principles, list-sidecar variant with an unfiltered overview for the map — both were legacy "before" state (not part of the original port). Before: list GET did paginated `find` (correct) + `business-zones 5000` + `merchants 5000 depth:0` hydration with JS `Map`/`filter` counts; overview did `business-zones 1000` + `merchants 1000 depth:2` (full vendor + upload hydration) or `merchants 5000` when merchants were skipped, again JS counts; both per-`admin.id` raw-qs keys TTL 20, no gate/L1/singleflight; `[id]` DELETE used `limit:0` count-via-find, no bust helper; BFF no `Cache-Control`/`X-*`; page used `IconWrapper` barrel + no prefetch.

After: same single queries, global keys, gate-inside, SQL stats rollup.

- **Shared stats rollup** `apps/cms/src/utils/businessZoneStats.ts`: new `getBusinessZoneStats()` under `admin:business-zones:stats:v1` (TTL 300, gate-inside, shares `bustBusinessZonesCache` coverage). Two indexed SQL statements — `business_zones` total/active via `COUNT(*) FILTER (WHERE is_active)`, merchant assignment via `merchants GROUP BY business_zone_id` (FK-indexed) → `merchantCountByZone` map + unassigned/total. Verified against Supabase: total=2/active=2, 9 merchants all unassigned → matches old JS semantics exactly (`MATCH: true`).
- **List `route.ts`** → global `admin:business-zones:v1:<sorted-qs>` TTL 60, `getOrBuildDashboard` + gate-inside, `X-BusinessZones-Cache` forward; MISS = paginated `find` (bounded ≤100, `depth:0` — zones are scalar) + one rollup HIT. No 5000-doc hydration per request.
- **Overview `route.ts`** → global `admin:business-zones-overview:v1:<sorted-qs>` TTL 300 + gate-inside. Merchant fetch stays `depth:2` but gets `select:` of only the ~17 rendered render fields (drops hours/geometry/media blobs) + `context: { skipStoreHours: true }` (guards the afterRead loop); `includeMerchants=false` path now runs zero merchant query (counts come from the rollup). Zone counts use the global rollup — exact even under `zoneId` filter (old code's map was wrong there).
- **`[id]` route**: dead `limit:0` count-via-find → `payload.count` (merchants by zone, `skipStoreHours`); PATCH/DELETE busts switched from raw `deleteCachedByPrefix`×2 to `bustBusinessZonesCache()`.
- **Write-through**: `dashboardCache.ts` new `bustBusinessZonesCache()` (both `admin:business-zones:` + `admin:business-zones-overview:` prefixes, L1+Redis); `Merchants` hooks extend to it (zone assignment moves counts); `BusinessZones` gets new `afterChange+afterDelete` hooks. Top-level `dashboardCache` import (dynamic cache import internally — no top-level `@encreasl/cache` in collections).
- **BFF**: list + overview GETs add `Cache-Control: private, max-age=30, SWR=60` + forward `X-BusinessZones-Cache` / `X-BusinessZonesOverview-Cache`.
- **First paint (§4b item 3)**: admin page split into `content.tsx` (client) + server `page.tsx` wrapper prefetching the default list qs (`page=1&limit=10&sort=-createdAt`) AND the unfiltered overview into dehydrated caches (`QUERY_KEYS.adminBusinessZones` + `adminBusinessZoneOverview`); sidebar `Business Zones → Admin` child `prefetch={true}`; icons import direct from `lucide-react` (barrel dropped, `Clock` unused removed).
- **Merchants page `/business-zones/merchants` (2026-09-18, same pass)**: consumes the same two optimized endpoints (zone list `limit=100` + overview, zone-filtered client-side), so backend work was already covered by the above; applied §4b item 3 — page split into `content.tsx` + server wrapper prefetching `QUERY_KEYS.adminBusinessZones('limit=100')` + default overview; sidebar `Business Zones → Merchants` child `prefetch={true}`; icons direct from `lucide-react` (`Pencil` unused dropped).
- **Detail `[id]` GET**: now `admin:business-zones:detail:v1:<id>` TTL 120 + gate-in (`X-BusinessZoneDetail-Cache` via BFF); preview merchants find gained `select:` (scalars + vendor only) + `context: { skipStoreHours: true }`; `findByID` 404 returns `null` from the builder (never cached) and the route maps it to 404. PATCH/DELETE busts already live under the same `bustBusinessZonesCache()` prefix.
- **Verify**: `pg` script ran both SQL statements + old-JS semantics — identical; `tsc --noEmit` CMS + web-admin clean; `eslint` clean; no new migration (SQL uses existing indexes: `merchants_business_zone_idx`, `business_zones isActive_idx`), no `migrate:fresh`.

---

## 19. Profile application (`/profile`, 2026-09-18)

Per-user detail page (not a list) — the dataset is one user + one admins row + 8 user-events, so there was no hydration blowup to kill; the misses were cache mechanics + one redundant auth query. Before: CMS GET wrapped the WHOLE handler in `withAdminRequestSlot` (gate-outside — every HIT queued on the gate) with `admin:profile:<userId>` raw-qs-less key, TTL 15, `getCached/setCached` (no L1/singleflight/Redis-swap for reads), and an `admins` level lookup ran on EVERY self-fetch (cross-user fetch is a rare system-admin action); PATCH busted via raw `deleteCached`, and password + avatar writes did NOT bust at all; page was a single CSR `IconWrapper`-barrel client component with no prefetch; sidebar profile entries unprefetched.

After (code-only, no migration):

- **Gate-inside + L1/singleflight**: CMS GET rebuilt on `getOrBuildDashboard('admin:profile:v1:<userId>', 60, () => withAdminRequestSlot(builder))` — cached HIT never queues; per-user key (profile is genuinely personal data, §4 step 4). `X-Profile-Cache` HIT/STALE/MISS. 404 (missing/non-admin user) returns `null` from the builder — never cached.
- **Auth trimmed on the hot path**: self-fetch (the normal case) skips the `admins` level lookup entirely; only cross-user fetches run it and enforce the system-admin gate. So a self-fetch is exactly 1 `findByID users depth:2` + 1 `admins find` + 1 `user-events find limit:8` on MISS, zero Payload ops on HIT beyond `authenticateAdmin`.
- **Write-through**: `dashboardCache.ts` new `bustProfileCache(userId?)` (exact scoped selector `admin:profile:v1:<id>`, L1+Redis; domain-wide prefix when no id). Wired into PATCH (replaces `deleteCached`), password POST (new), avatar POST + DELETE (new) — password/session/avatar changes now refresh the profile instantly instead of waiting out the TTL.
- **First paint (§4b item 3)**: page split into `content.tsx` (client, `ProfileInner`/`ProfileSkeleton` exported) + server `page.tsx` wrapper prefetching `QUERY_KEYS.adminProfile()` (`['admin','profile','default']`) from the CMS GET into the dehydrated cache (`next: { revalidate: 30 }`); empty-cache/auth-failure falls back to the client's `getProfileData` server action. Icons direct from `lucide-react` (barrel dropped, identical rendering; all 37 icons used — no drops). Sidebar `Your Profile` + `Account Settings` entries get `prefetch`.
- **Verify**: `tsc --noEmit` CMS + web-admin clean; `eslint` clean on changed CMS routes + web-admin page/content/Sidebar; no new migration, no `migrate:fresh`.

---

## 20. Media Library application (`/media`, 2026-09-18)

Direct-CMS page (no BFF — the hook + page call `{CMS}/media/library` directly with the client JWT). `Media.read` is public, so the library is a platform-wide asset pool. Before: list GET wrapped the WHOLE handler in `withAdminRequestSlot` (gate-outside — every HIT queued) with per-`admin.id` raw-qs keys `admin:media-library:<adminId>:<qs>`, TTL 15, `getCached/setCached` (no L1/singleflight); detail GET uncached (findByID + full usage aggregation per view); upload/update/delete busted nothing; page was a single CSR `IconWrapper`-barrel client component with no prefetch; sidebar `Media Library` unprefetched.

After (code-only, no migration):

- **Global key + gate-inside**: list GET now `getOrBuildDashboard('admin:media-library:v1:<sorted-qs>', 60, () => withAdminRequestSlot(builder))` — platform-wide key per qs, cached HIT never queues; `X-Media-Cache` HIT/STALE/MISS. Builder keeps the bounded paginated `find` (≤60, `depth:0`) + per-page usage aggregation.
- **Detail `[id]` GET**: `admin:media-library:detail:v1:<id>` TTL 120 + gate-inside; 404 returns `null` from the builder (never cached) → route 404.
- **Write-through**: `dashboardCache.ts` new `bustMediaLibraryCache()` (`admin:media-library:` L1+Redis covers both list+detail prefixes); wired into upload POST (new), PATCH (alt rename, new), DELETE (new).
- **First paint (§4b item 3)**: page split into `content.tsx` (client, `MediaLibraryPageContent`/`MediaLibrarySkeleton` exported) + server `page.tsx` wrapper prefetching default `page=1&limit=24` into the dehydrated `QUERY_KEYS.adminMediaLibrary('page=1&limit=24')` cache (`next: { revalidate: 30 }`); empty-cache/auth-failure falls back to the client's direct fetch. Icons direct from `lucide-react` (barrel dropped; all 19 used — no drops). Sidebar `Media Library` entry gets `prefetch`.
- **Search — NO trigram index (explicitly deferred)**: `contains` on `filename/alt/cloudinaryPublicId` is a bare `%ILIKE%` scan, but the media table is 188 rows (verified) and `pg_trgm` is already installed — a seq scan is sub-ms. Per §4b item 4 / §17b item 1 the GIN indexes are conditional on `%ILIKE%` p95 exceeding budget at scale; documented as a known gap, not built.
- **Verify**: `pg` script confirmed media columns (`filename/alt/cloudinary_public_id` varchar), count 188, `pg_trgm` present; `tsc --noEmit` CMS + web-admin clean; `eslint` clean; no new migration, no `migrate:fresh`.

---

## 21. Product Categories application (`/product-categories`, 2026-09-21)

§4b cold-speed pass over the §11 base port (global keys + gate-inside + SQL stats were already in place). Before: list MISS ran 4 inline SQL statements per qs + unprojected paginated `find depth:1` (full docs incl. `seo` group, 3 upload hydrations, unread attribute keys); POST busted via raw `deleteCachedByPrefix` (Redis-only — L1 kept serving stale up to 30s); detail product count did find-then-SQL fallback; DELETE in-use guard fell back to a `products 5000` scan; **the per-category product-count SQL referenced a nonexistent `"product-categoriesID"` column (real column: `prod_categories_id`) — every list MISS threw, so the list was hard-500**; page was a single CSR `IconWrapper`-barrel component with no prefetch; sidebar entry unprefetched; BFF list had no timeout.

After (code-only, no migration):

- **Fixed the broken product-count SQL.** `products_rels` join column is `prod_categories_id` (verified via `information_schema`; 570 rel rows, 31/32 categories mapped, single-id COUNT matches the GROUP BY map). List `countRows`, detail count, and DELETE guard all use it now.
- **Stats rollup (§4b item 5).** New `getProductCategoryStats()` under `admin:product-categories:stats:v1` TTL-300 (totals/active/featured/top + level/type breakdowns + full `productCountByCategory` map). List MISS is now paginated `find` + one rollup HIT; `filteredCount` stays exact from `paginated.totalDocs`. Covered by the existing `bustCatalogCache()` prefix — no new bust function. `Products.afterChange` (fires on create/update/delete) now also calls `bustCatalogCache()` so re-categorization refreshes the map (import already present; `ProductCategories` hooks already bust it).
- **Narrow page query (§4b item 2).** List `find` gains `select:` of only rendered fields (`name/slug/description/parentCategory/level/path/order/badges/categoryType/createdAt/updatedAt` + `media: { icon: true }`); `seo`, banner/thumbnail uploads, and unread attribute keys dropped (sanitize nulls them — response shape unchanged; nested group select verified against `sanitizeSelect` recursion). `parentCategory` stays populated at `depth:1`.
- **Detail + DELETE guard.** Detail product count is a single `COUNT(DISTINCT parent_id)` (drops the find-then-SQL fallback); DELETE in-use guard is the same single SQL (drops the `products 5000` scan). Child-count `limit:1` check kept (bounded).
- **Write-through.** POST bust switched from raw `deleteCachedByPrefix('admin:product-categories:')` (missed L1) to `bustCatalogCache()` (L1+Redis); top-level `@encreasl/cache` import removed from the route file.
- **First paint (§4b item 3).** Page split into `content.tsx` (client, `ProductCategoriesPageContent`/`ProductCategoriesSkeleton` exported) + server `page.tsx` wrapper prefetching default `page=1&limit=10&sort=displayOrder` into the dehydrated `QUERY_KEYS.adminProductCategories` cache (`next: { revalidate: 30 }`); empty-cache/auth-failure falls back to the client fetch. Icons direct from `lucide-react` (barrel dropped; `FileText/Globe/ShieldCheck/CalendarDays` unused removed). Sidebar `Product Categories` entry gets `prefetch`. BFF list GET gains `AbortSignal.timeout(20000)` (matches merchants BFF).
- **Search/indexes — NO new migration (explicitly deferred).** Table is 32 rows with existing `slug`/`parent_category`/`created_at` indexes — sorts and `contains` ILIKE are sub-ms seq scans. Per §4b item 4 the trigram GIN + sort-column indexes are conditional on row growth or p95 evidence; documented as a known gap, not built.
- **Verify**: `pg` scripts confirmed the column fix (per-category counts, 31 mapped, single-id match), stats shapes, and index list; `tsc --noEmit` CMS + web-admin clean; `eslint` clean on changed files; no new migration, no `migrate:fresh`.

---

## 22. Transactions application (`/transactions`, 2026-09-21)

§4b cold-speed pass over the §12 base port (global keys + gate-inside + inline SQL stats were already in place; BFF already had timeout + `Cache-Control` + `X-*-Cache` forward). Before: list MISS ran 3 inline SQL statements per qs + `find depth:2` hydrating full transaction → order → merchant/customer docs (with the merchant afterRead store-hours loop, unguarded); **vendor names and customer user names never rendered on the list** — at `depth:2`, `order.merchant.vendor` and `order.customer.user` stay raw IDs (verified against `relationshipPopulationPromise`: `shouldPopulate = depth && currentDepth <= depth`), so the vendor row hid itself and names fell back to email; page was a single CSR `IconWrapper`-barrel component with no prefetch; sidebar entry unprefetched.

After (code-only, no migration):

- **Stats rollup (§4b item 5).** New `getTransactionStats()` under `admin:transactions:stats:v1` TTL-300 (revenue/refund/failed/pending SUMs + counts, status + payment-method breakdowns, derived net/avg). List MISS is now paginated `find` + one rollup HIT; `filteredTotal` stays exact from `paginated.totalDocs`. Covered by the existing `bustTransactionsCache()` prefix (Transactions hooks already bust it on afterChange + afterDelete) — no new bust function.
- **Bounded enrichment replaces `depth:2` (§4 §4b item 2).** Phase 1 pages transactions at `depth:1` (all top-level fields consumed by sanitize, so no `select:` trim applies) + `skipStoreHours`; phase 2 hydrates page orders (`depth:0`, projected scalars — drops `priority_fee/discount_total/coupon_code/notes/delivery_service_type` and friends); phase 3 hydrates page merchants (projected + `skipStoreHours`) + customers (projected `email/user`); phase 4 hydrates vendors (`depth:1` for logo, projected) + users (projected names). All bounded by page IDs, assembled via maps, existing sanitize functions reused unchanged. Zero full merchant/customer/user/vendor docs per request — and vendor + user names now actually render.
- **Detail `[id]`.** Transaction `findByID depth:2` → `depth:1` (the dedicated orders `depth:2` enrichment already populates vendor/user; success path identical); both fetches gain `context: { skipStoreHours: true }` (detail never renders live hours).
- **First paint (§4b item 3).** Page split into `content.tsx` (client, `TransactionsPageContent`/`TransactionsSkeleton` exported) + server `page.tsx` wrapper prefetching default `page=1&limit=10&sort=-paid_at` into the dehydrated `QUERY_KEYS.adminTransactions` cache (`next: { revalidate: 30 }`); empty-cache/auth-failure falls back to the client fetch. Icons direct from `lucide-react` (barrel dropped; `TrendingUp/Plus/Filter/Star/Award/Pencil/ShieldCheck/Package` unused removed). Sidebar `Transactions` entry gets `prefetch`.
- **Search/indexes — NO new migration (explicitly deferred).** Table is 2 rows with existing `(status,paid_at)`, `(status,createdAt)`, `payment_method`, `order` indexes — every sort/filter is indexed or trivial. Per §4b item 4 the trigram GIN is conditional on row growth; documented as a known gap, not built.
- **Verify**: `pg` script confirmed table size (2), index list, and stats shapes (total=2, revenue=76, paid=2, gcash=2); Payload depth semantics verified in `relationshipPopulationPromise.js`; `tsc --noEmit` CMS + web-admin clean; `eslint` clean on changed files; no new migration, no `migrate:fresh`.

---

## 23. Global search application (`/search`, header typeahead, 2026-09-21)

§4 fan-out variant (not a list page — no pagination/stats; the blowup was parallel full-doc hydration per keystroke). Before: `/api/search` + `/api/search/suggestions` BFFs each fanned out to **6 parallel direct-REST calls** (merchants/products/orders/vendors/customers/drivers, `contains` + `depth` up to 2), each with its own auth + full-doc hydration — merchants at `depth:2` ran the unguarded store-hours afterRead loop per doc plus full vendor + upload hydration; the header SearchBar/SearchModal fire BOTH endpoints per debounced keystroke (12 REST calls); `/search` page fetched on every `?q=` navigation with no debounce, no abort (stale responses could overwrite newer ones), and a no-op refresh button; no cache anywhere (no BFF `Cache-Control`, no CMS key); icons via `IconWrapper` barrel.

After (code-only, no migration):

- **Single CMS endpoint** `apps/cms/src/app/api/admin/search/route.ts` (`GET ?q=&limit=&mode=results|suggestions`): one auth, 6 bounded `payload.find` in parallel (per-collection limit; suggestions fixed 2, results clamped 1–10) with `select:` projections (merchants `{outletName,description,media:{thumbnail,storeFrontImage},vendor}` + `skipStoreHours`; products `{name,media}` — `description` richText always resolved to `''` by the mapper, dropped; orders `{status,total}`; vendors `{businessName,legalName,logo}` — vendors has **no `businessEmail` field**, the old subtitle read always resolved `''`, dropped; customers/drivers `{user}`). Mapping logic (`getStringValue/getMediaUrl/getThumbnailUrl`, orders `?id=` href, suggestions top-8 slice) moved verbatim from the BFFs — response shapes byte-identical. Relative media URLs absolutized against `new URL(request.url).origin` (zero config, correct per environment).
- **Cache:** global `admin:search:v1:<mode>:<q>:<limit>` TTL 60, `getOrBuildDashboard` + gate-inside, `X-Search-Cache`. Write-through: new `bustSearchCache()` (`admin:search:` L1+Redis) wired into `Merchants/Vendors/Products/Orders/Customers` hooks (alongside existing busts) + new `afterChange+afterDelete` on `Drivers` (previously had none).
- **BFFs → thin proxies.** `/api/search/route.ts` + `/api/search/suggestions/route.ts` (470 lines → ~120) forward to the unified endpoint (suggestions appends `mode=suggestions`), keep the `q<2` short-circuit (preserves unauthenticated-200 behavior) + 401s, add 15s timeout + `Cache-Control: private, max-age=30, SWR=60` + `X-Search-Cache` forward. `/api/search/recent` untouched (per-user, bounded, `depth:0` — already fine).
- **Search page (`/search`).** `q` debounced 350ms via the shared `useDebounce` hook; in-flight fetches aborted via `AbortController` (stale-overwrite race fixed; unmount cancels); refresh button wired to re-fetch (was a no-op). Icons direct from `lucide-react` (all 7 used — no drops). No server prefetch: `q` is dynamic per navigation/keystroke, prefetched rows would never match — documented non-applicable §4b item 3. `ClientOnly` + #441 guard preserved. SearchBar/SearchModal untouched — they automatically collapse onto CMS HITs via the same BFF qs.
- **Verify**: `tsc --noEmit` CMS + web-admin clean; `eslint` clean on changed files; no new migration, no `migrate:fresh`.

---

## 24. Mobile home application (`apps/mobile-customer` `/`, 2026-09-26)

Client-side port of §4 (no Payload/Redis/BFF exists in this stack — the server half does not apply; no migration). Before (agent-audited): ~13–20 HTTP requests before first paint — hidden always-mounted `SearchModal` fired the full query set with the modal closed (customerId + `limit=9999` merchants + full categories chain + active address), `useLocationBasedMerchants`/`useLocationBasedCategories` queryKeys omitted `limit`/`includeInactive` so home `limit=20` and modal `limit=9999` poisoned each other's cache, `useWishlist` always fired both `limit=200 depth=0` IDs and `limit=200 depth=3` docs though only WishlistScreen reads docs, `loading = isLoading || isRefetching` flashed skeletons on every 1-min global revalidate, and `dataCache` had no in-flight coalescing.

After (code-only, `tsc` + `eslint` clean on `mobile-customer` + `@encreasl/client-services`):

- **Hidden fan-out gated.** `SearchModal` customerId/merchants/categories/active-address queries gain `enabled: visible` (same pattern as `AddressSelectionModal` + the modal's own recent/product effects). Modal-open pays one lazy fill; closed modal costs zero requests.
- **Keys carry params.** `MERCHANT_KEYS.list` now `(customerId, categoryId, limit)`, `CATEGORY_KEYS.list` now `(customerId, includeInactive, limit)` — 20-vs-9999 entries can no longer collide. Both hooks + `useActiveAddress` accept `{ enabled, staleTime }` options (backward compatible).
- **Wishlist docs split.** `useWishlist({ includeDocs })` (default true); the five list screens (`LocationBasedMerchants`, `Search`, `NewlyUpdated`, `Merchant`, `NearbyRestaurants`) pass `includeDocs: false` — home no longer hydrates 200 `depth=3` docs for heart state. `refetch`/loading respect the flag; `WishlistScreen` unchanged.
- **Skeleton only on true first paint.** Merchants rail + categories carousel use `isLoading && data.length === 0`; background revalidations keep rows. Both hooks get `staleTime` 5min matching the `dataCache` `MERCHANTS` TTL (was: 1-min global expiry → memory-hit refetch + visible skeleton flash).
- **Singleflight.** `dataCache.dedupe(key, fn)` coalesces concurrent same-key callers onto one promise; `clear()` also drops in-flight work so pull-to-refresh never awaits a pre-refresh response. Migrated `getLocationBasedMerchants` + `getLocationBasedMerchantCategories` (error paths still return uncached `[]`, semantics preserved).
- **Explicitly deferred (needs CMS work):** the carousel's `limit=9999` ID-extraction pull (only IDs consumed — the true fix is a dedicated categories endpoint per §4 step 5); the per-merchant `merchants/{id}?depth=1` subtitle N+1 (needs `activeAddress.formatted_address` on the display payload); per-user `user→customer` triplication across Auth/header/modal.
- **Verify:** `tsc --noEmit` mobile-customer + client-services clean; `eslint` clean on changed files; no backend change, no migration.

