import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached } from '@encreasl/cache'
import {
  AnalyticsDoc,
  buildAnalyticsCacheQuery,
  buildAnalyticsCore,
  getNum,
  getStr,
  parseAnalyticsParams,
  resolveId,
} from '@/utils/analyticsShared'

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { searchParams } = new URL(request.url)
      const cacheKey = `admin:analytics:tops:${admin.id}:${buildAnalyticsCacheQuery(searchParams)}`
      const cached = await getCached<Record<string, unknown>>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-Analytics-Cache': 'HIT' } })

      const params = parseAnalyticsParams(searchParams)
      const { days, now, periodStart } = params

      const [vendorsRes, merchantsRes, ordersRes, transactionsRes, orderItemsRes, productsRes, reviewsRes] =
        await Promise.all([
          payload.find({ collection: 'vendors', limit: 2000, depth: 0, overrideAccess: true }),
          payload.find({ collection: 'merchants', limit: 2000, depth: 0, overrideAccess: true }),
          payload.find({ collection: 'orders', limit: 3000, sort: '-createdAt', depth: 0, overrideAccess: true }),
          payload.find({ collection: 'transactions', limit: 3000, depth: 0, overrideAccess: true }),
          payload.find({ collection: 'order-items', limit: 5000, depth: 0, overrideAccess: true }),
          payload.find({ collection: 'products', limit: 2000, depth: 0, overrideAccess: true }),
          payload.find({ collection: 'reviews', limit: 2000, depth: 0, overrideAccess: true }),
        ])

      const vendorsDocs = vendorsRes.docs as unknown as AnalyticsDoc[]
      const merchantsDocs = merchantsRes.docs as unknown as AnalyticsDoc[]
      const ordersDocs = ordersRes.docs as unknown as AnalyticsDoc[]
      const transactionsDocs = transactionsRes.docs as unknown as AnalyticsDoc[]
      const orderItemsDocs = orderItemsRes.docs as unknown as AnalyticsDoc[]
      const productsDocs = productsRes.docs as unknown as AnalyticsDoc[]
      const reviewsDocs = reviewsRes.docs as unknown as AnalyticsDoc[]

      const core = buildAnalyticsCore(params, {
        vendorsDocs,
        merchantsDocs,
        ordersDocs,
        transactionsDocs,
        orderItemsDocs,
        productsDocs,
      })
      const { merchantMap, productMap, verifiedRevenueByOrderId, verifiedOrderIdsInPeriod } = core

      // Top products — verified paid orders only. Product names resolve via the
      // products map (depth-0 docs) instead of populated relations: identical
      // while products < 2000 docs, snapshot fallback otherwise (as monolith).
      const productAgg = new Map<string, { name: string; revenue: number; quantity: number; orders: number }>()
      orderItemsDocs.forEach((oi) => {
        const orderId = resolveId(oi.order)
        if (!verifiedOrderIdsInPeriod.has(orderId)) return
        const name = getStr(oi.product_name_snapshot, 'Unknown')
        const prodId = resolveId(oi.product)
        const product = prodId ? productMap.get(prodId) : null
        const resolved = product ? getStr(product.name, name) : name
        const key = resolved || name
        const existing = productAgg.get(key) || { name: resolved || name, revenue: 0, quantity: 0, orders: 0 }
        existing.revenue += getNum(oi.total_price)
        existing.quantity += getNum(oi.quantity)
        existing.orders += 1
        productAgg.set(key, existing)
      })
      const topProducts = Array.from(productAgg.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      const merchantAgg = new Map<string, { name: string; orders: number; revenue: number; rating: number }>()
      verifiedRevenueByOrderId.forEach((rev, orderId) => {
        const order = core.orderMap.get(orderId)
        if (!order) return
        const merchantId = resolveId(order.merchant)
        if (!merchantId || merchantId === 'undefined') return
        const existing = merchantAgg.get(merchantId) || {
          name: `Merchant #${merchantId}`,
          orders: 0,
          revenue: 0,
          rating: 0,
        }
        existing.orders += 1
        existing.revenue += rev
        merchantAgg.set(merchantId, existing)
      })
      merchantsDocs.forEach((m) => {
        const id = String(m.id)
        const e = merchantAgg.get(id)
        if (e) {
          e.rating = getNum(m.ratingAverage)
          e.name = getStr(m.outletName, e.name)
        }
      })
      const topMerchants = Array.from(merchantAgg.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      const vendorAgg = new Map<string, { orders: number; revenue: number }>()
      merchantAgg.forEach((data, merchantId) => {
        const merch = merchantMap.get(merchantId)
        if (!merch) return
        const vendorId = resolveId(merch.vendor)
        if (!vendorId || vendorId === 'undefined') return
        const e = vendorAgg.get(vendorId) || { orders: 0, revenue: 0 }
        e.orders += data.orders
        e.revenue += data.revenue
        vendorAgg.set(vendorId, e)
      })
      const topVendors = vendorsDocs
        .map((v) => {
          const id = String(v.id)
          const comp = vendorAgg.get(id) || { orders: 0, revenue: 0 }
          return {
            id,
            businessName: getStr(v.businessName),
            orders: comp.orders,
            revenue: comp.revenue,
            totalMerchants: getNum(v.totalMerchants),
            averageRating: getNum(v.averageRating),
            verificationStatus: getStr(v.verificationStatus, 'unknown'),
          }
        })
        .filter((v) => v.orders > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10)

      const ratingBuckets = [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: 0 }))
      reviewsDocs
        .filter((r) => {
          if (days === 0) return true
          if (!periodStart) return true
          const raw = String(r.createdAt ?? '')
          if (!raw) return false
          const d = new Date(raw)
          if (isNaN(d.getTime())) return false
          return d >= periodStart && d <= now
        })
        .forEach((r) => {
          const v = Math.round(getNum(r.merchant_rating))
          const b = ratingBuckets.find((x) => x.rating === v)
          if (b) b.count += 1
        })

      const response = { topProducts, topMerchants, topVendors, ratingDistribution: ratingBuckets }
      await setCached(cacheKey, response, 60)
      return NextResponse.json(response, { headers: { 'X-Analytics-Cache': 'MISS' } })
    } catch (error) {
      console.error('Analytics tops aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load analytics tops' }, { status: 500 })
    }
  })
}
