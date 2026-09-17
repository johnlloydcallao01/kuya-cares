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
  pctChange,
} from '@/utils/analyticsShared'

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { searchParams } = new URL(request.url)
      const cacheKey = `admin:analytics:summary:${admin.id}:${buildAnalyticsCacheQuery(searchParams)}`
      const cached = await getCached<Record<string, unknown>>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-Analytics-Cache': 'HIT' } })

      const params = parseAnalyticsParams(searchParams)
      const { days, label, now, periodStart, prevPeriodStart, prevPeriodEnd } = params

      const [
        vendorsRes,
        merchantsRes,
        ordersRes,
        customersRes,
        transactionsRes,
        orderItemsRes,
        reviewsRes,
        cartItemsRes,
        wishlistsRes,
      ] = await Promise.all([
        payload.find({ collection: 'vendors', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'merchants', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'orders', limit: 3000, sort: '-createdAt', depth: 0, overrideAccess: true }),
        payload.find({ collection: 'customers', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'transactions', limit: 3000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'order-items', limit: 5000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'reviews', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'cart-items', limit: 3000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'wishlists', limit: 0, depth: 0, overrideAccess: true, pagination: false } as any),
      ])

      const vendorsDocs = vendorsRes.docs as unknown as AnalyticsDoc[]
      const merchantsDocs = merchantsRes.docs as unknown as AnalyticsDoc[]
      const ordersDocs = ordersRes.docs as unknown as AnalyticsDoc[]
      const customersDocs = customersRes.docs as unknown as AnalyticsDoc[]
      const transactionsDocs = transactionsRes.docs as unknown as AnalyticsDoc[]
      const orderItemsDocs = orderItemsRes.docs as unknown as AnalyticsDoc[]
      const reviewsDocs = reviewsRes.docs as unknown as AnalyticsDoc[]
      const cartItemsDocs = cartItemsRes.docs as unknown as AnalyticsDoc[]

      const core = buildAnalyticsCore(params, {
        vendorsDocs,
        merchantsDocs,
        ordersDocs,
        transactionsDocs,
        orderItemsDocs,
      })
      const {
        paidTransactions,
        refundedTransactions,
        failedTransactions,
        ordersCurrent,
        paidCurrent,
        ordersPrevFiltered,
        paidPrevFiltered,
      } = core

      function inCurrent(doc: AnalyticsDoc, dateField: string): boolean {
        if (!periodStart) return true
        const raw = String(doc[dateField] ?? doc.createdAt ?? '')
        if (!raw) return false
        const d = new Date(raw)
        if (isNaN(d.getTime())) return false
        return d >= periodStart && d <= now
      }
      function inPrev(doc: AnalyticsDoc, dateField: string): boolean {
        if (!prevPeriodStart || !prevPeriodEnd) return false
        const raw = String(doc[dateField] ?? doc.createdAt ?? '')
        if (!raw) return false
        const d = new Date(raw)
        if (isNaN(d.getTime())) return false
        return d >= prevPeriodStart && d < prevPeriodEnd
      }

      const totalRevenueCurrent = paidCurrent.reduce((s, t) => s + getNum(t.amount), 0)
      const totalRevenuePrev = paidPrevFiltered.reduce((s, t) => s + getNum(t.amount), 0)
      const totalOrdersCurrent = ordersCurrent.length
      const totalOrdersPrev = ordersPrevFiltered.length
      const aovCurrent = totalOrdersCurrent > 0 ? totalRevenueCurrent / totalOrdersCurrent : 0
      const aovPrev = totalOrdersPrev > 0 ? totalRevenuePrev / totalOrdersPrev : 0

      const activeMerchants = merchantsDocs.filter((m) => m.isActive === true).length
      const totalCustomers = customersDocs.length
      const newCustomersCurrent =
        days === 0 ? totalCustomers : customersDocs.filter((c) => inCurrent(c, 'createdAt')).length
      const newCustomersPrev = days === 0 ? 0 : customersDocs.filter((c) => inPrev(c, 'createdAt')).length

      const wishlistCount =
        (wishlistsRes as { totalDocs?: number }).totalDocs ?? (wishlistsRes.docs as unknown[]).length

      const periodReviews = reviewsDocs.filter((r) => days === 0 || inCurrent(r, 'createdAt'))
      const avgMerchantRating = periodReviews.length
        ? periodReviews.reduce((s, r) => s + getNum(r.merchant_rating), 0) / periodReviews.length
        : 0

      const kpis = {
        totalRevenue: totalRevenueCurrent,
        totalOrders: totalOrdersCurrent,
        aov: aovCurrent,
        activeMerchants,
        totalVendors: vendorsDocs.length,
        totalCustomers,
        newCustomers: newCustomersCurrent,
        paidTransactions: paidCurrent.length,
        refundedTransactions: refundedTransactions.filter((t) => inCurrent(t, 'createdAt')).length,
        failedTransactions: failedTransactions.filter((t) => inCurrent(t, 'createdAt')).length,
        wishlistCount,
        avgRating: avgMerchantRating,
        revenueChange: pctChange(totalRevenueCurrent, totalRevenuePrev),
        ordersChange: pctChange(totalOrdersCurrent, totalOrdersPrev),
        aovChange: pctChange(aovCurrent, aovPrev),
        customersChange: pctChange(newCustomersCurrent, newCustomersPrev),
        totalRevenueAllTime: paidTransactions.reduce((s, t) => s + getNum(t.amount), 0),
        totalOrdersAllTime: ordersDocs.length,
      }

      const cartStatusMap = new Map<string, number>()
      cartItemsDocs.forEach((c) => {
        const s = getStr(c.status, 'unknown')
        cartStatusMap.set(s, (cartStatusMap.get(s) || 0) + 1)
      })
      const cartCurrent = cartItemsDocs.filter((c) => inCurrent(c, 'createdAt'))
      const cartCurrentByStatus = (() => {
        const m = new Map<string, number>()
        cartCurrent.forEach((c) => {
          const s = getStr(c.status, 'unknown')
          m.set(s, (m.get(s) || 0) + 1)
        })
        return Array.from(m.entries()).map(([status, count]) => ({ status, count }))
      })()
      const funnel = {
        cartByStatus: Array.from(cartStatusMap.entries()).map(([status, count]) => ({ status, count })),
        cartCurrentByStatus,
        abandonmentRate: cartItemsDocs.length
          ? ((cartStatusMap.get('abandoned') || 0) / cartItemsDocs.length) * 100
          : 0,
        totalCarts: cartItemsDocs.length,
        totalCartsCurrent: cartCurrent.length,
      }

      const response = {
        meta: { range: label, days, generatedAt: now.toISOString(), totalOrdersAllTime: ordersDocs.length },
        kpis,
        funnel,
      }
      await setCached(cacheKey, response, 30)
      return NextResponse.json(response, { headers: { 'X-Analytics-Cache': 'MISS' } })
    } catch (error) {
      console.error('Analytics summary aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load analytics summary' }, { status: 500 })
    }
  })
}
