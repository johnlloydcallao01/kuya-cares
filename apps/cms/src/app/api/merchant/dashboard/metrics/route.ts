import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCached, setCached } from '@encreasl/cache'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function getNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || fallback
  return fallback
}

function getStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>
    if ('outletName' in obj) return String(obj.outletName ?? fallback)
    if ('businessName' in obj) return String(obj.businessName ?? fallback)
    if ('email' in obj) return String(obj.email ?? fallback)
  }
  return fallback
}

function resolveId(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string' || typeof val === 'number') return String(val)
  if (typeof val === 'object' && val !== null && 'id' in (val as Record<string, unknown>))
    return String((val as Record<string, unknown>).id)
  return ''
}

const EMPTY_BODY = {
  metrics: {
    totalRevenue: 0,
    revenueChange: 0,
    todayRevenue: 0,
    totalOrders: 0,
    ordersChange: 0,
    pendingOrders: 0,
    activeOrders: 0,
    totalOutlets: 0,
    openOutlets: 0,
    acceptingOrders: 0,
    averageRating: 0,
    totalReviews: 0,
    ratingChange: 0,
  },
  outlets: [],
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const cacheKey = `merchant:dashboard:metrics:${userId}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-MerchantDashboard-Cache': 'HIT' } })

    const payload = await getPayload({ config: configPromise })

    const vendorsRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorsRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }
    const vendorId = String(vendor.id)

    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantsDocs = merchantsRes.docs as unknown as Record<string, unknown>[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))

    if (merchantIds.size === 0) {
      await setCached(cacheKey, EMPTY_BODY, 20)
      return NextResponse.json(EMPTY_BODY, { headers: { 'X-MerchantDashboard-Cache': 'MISS' } })
    }

    const [ordersRes, reviewsRes] = await Promise.all([
      payload.find({
        collection: 'orders',
        where: { merchant: { in: Array.from(merchantIds) } },
        limit: 1000,
        sort: '-createdAt',
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'reviews',
        where: { merchant: { in: Array.from(merchantIds) } },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    const ordersDocs = ordersRes.docs as unknown as Record<string, unknown>[]
    const reviewsDocs = reviewsRes.docs as unknown as Record<string, unknown>[]

    const orderIds = new Set(ordersDocs.map((o) => String(o.id)))
    const transactionsRes = await payload.find({
      collection: 'transactions',
      where: {
        and: [{ order: { in: Array.from(orderIds) } }, { status: { equals: 'paid' } }],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const paidTransactions = transactionsRes.docs as unknown as Record<string, unknown>[]

    const thirtyDaysAgo = daysAgo(30)
    const sixtyDaysAgo = daysAgo(60)
    const today = daysAgo(0)

    const recentOrders = ordersDocs.filter((o) => String(o.createdAt ?? '') >= thirtyDaysAgo)
    const previousOrders = ordersDocs.filter((o) => {
      const c = String(o.createdAt ?? '')
      return c >= sixtyDaysAgo && c < thirtyDaysAgo
    })
    const recentTransactions = paidTransactions.filter((t) => {
      const paidAt = String(t.paid_at ?? '')
      return paidAt >= thirtyDaysAgo
    })
    const previousTransactions = paidTransactions.filter((t) => {
      const paidAt = String(t.paid_at ?? '')
      return paidAt >= sixtyDaysAgo && paidAt < thirtyDaysAgo
    })

    const totalRevenue = paidTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)
    const recentRevenue = recentTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)
    const previousRevenue = previousTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)

    const todayRevenue = paidTransactions
      .filter((t) => String(t.paid_at ?? '').startsWith(today))
      .reduce((sum, t) => sum + getNum(t.amount), 0)

    const pendingOrdersCount = ordersDocs.filter((o) => getStr(o.status) === 'pending').length
    const activeOrdersCount = ordersDocs.filter((o) => {
      const s = getStr(o.status)
      return s === 'accepted' || s === 'preparing' || s === 'ready_for_pickup' || s === 'on_delivery'
    }).length

    const totalReviewsCount = reviewsDocs.length
    const avgRating =
      totalReviewsCount > 0
        ? reviewsDocs.reduce((sum, r) => sum + getNum(r.merchant_rating, 0), 0) / totalReviewsCount
        : 0

    const metrics = {
      totalRevenue,
      revenueChange: previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
      todayRevenue,
      totalOrders: ordersDocs.length,
      ordersChange:
        previousOrders.length > 0 ? ((recentOrders.length - previousOrders.length) / previousOrders.length) * 100 : 0,
      pendingOrders: pendingOrdersCount,
      activeOrders: activeOrdersCount,
      totalOutlets: merchantsDocs.length,
      openOutlets: merchantsDocs.filter((m) => getStr(m.operationalStatus) === 'open').length,
      acceptingOrders: merchantsDocs.filter((m) => m.isAcceptingOrders === true).length,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: totalReviewsCount,
      ratingChange: 0,
    }

    const todayOrderMap = new Map<string, number>()
    ordersDocs.forEach((o) => {
      const mId = resolveId(o.merchant)
      if (!mId) return
      if (String(o.createdAt ?? '').startsWith(today)) {
        todayOrderMap.set(mId, (todayOrderMap.get(mId) || 0) + 1)
      }
    })

    // orderId → merchantId index (same result as the monolith's O(T×O) find, O(1) lookup)
    const orderMerchantMap = new Map<string, string>()
    ordersDocs.forEach((o) => {
      const mId = resolveId(o.merchant)
      if (mId) orderMerchantMap.set(String(o.id), mId)
    })
    const todayRevenueMap = new Map<string, number>()
    paidTransactions.forEach((t) => {
      if (!String(t.paid_at ?? '').startsWith(today)) return
      const orderId = resolveId(t.order)
      if (!orderId) return
      const mId = orderMerchantMap.get(orderId)
      if (!mId) return
      todayRevenueMap.set(mId, (todayRevenueMap.get(mId) || 0) + getNum(t.amount))
    })

    const outlets = merchantsDocs.map((m) => {
      const mId = String(m.id)
      return {
        id: mId,
        name: getStr(m.outletName, `Outlet #${mId}`),
        operationalStatus: getStr(m.operationalStatus, 'closed'),
        isAcceptingOrders: m.isAcceptingOrders === true,
        todayOrders: todayOrderMap.get(mId) || 0,
        todayRevenue: todayRevenueMap.get(mId) || 0,
        avgDeliveryTime: getNum(m.avg_delivery_time_minutes),
      }
    })

    const responseBody = { metrics, outlets }
    await setCached(cacheKey, responseBody, 60)
    return NextResponse.json(responseBody, { headers: { 'X-MerchantDashboard-Cache': 'MISS' } })
  } catch (error) {
    console.error('Merchant dashboard metrics aggregation error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
