import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCached, setCached } from '@encreasl/cache'
import {
  VendorDoc,
  buildVendorAnalyticsCacheQuery,
  buildVendorAnalyticsCore,
  daysAgo,
  getNum,
  getStr,
  isInCurrentPeriod,
  parseVendorAnalyticsParams,
  pctChange,
} from '@/utils/vendorAnalyticsShared'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    const cacheKey = `vendor:analytics:summary:${userId}:${buildVendorAnalyticsCacheQuery(searchParams)}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VendorAnalytics-Cache': 'HIT' } })

    const params = parseVendorAnalyticsParams(searchParams)
    const { days, label, now, periodStart } = params

    const vendorsRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorsRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    const vendorId = String(vendor.id)
    const vendorName = getStr(vendor.businessName, 'Vendor')

    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantsDocs = merchantsRes.docs as unknown as VendorDoc[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))

    if (merchantIds.size === 0) {
      const emptyBody = {
        meta: { range: label, days, generatedAt: now.toISOString(), vendorId, vendorName, totalOrdersAllTime: 0 },
        kpis: {
          totalRevenue: 0, revenueChange: 0, todayRevenue: 0,
          totalOrders: 0, ordersChange: 0, pendingOrders: 0, activeOrders: 0,
          totalOutlets: 0, openOutlets: 0, acceptingOrders: 0,
          averageRating: 0, totalReviews: 0, ratingChange: 0,
          aov: 0, paidCount: 0, refundedCount: 0, failedCount: 0,
        },
        outlets: [],
      }
      await setCached(cacheKey, emptyBody, 20)
      return NextResponse.json(emptyBody, { headers: { 'X-VendorAnalytics-Cache': 'MISS' } })
    }

    const ordersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: Array.from(merchantIds) } },
      limit: 3000,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })
    const ordersDocs = ordersRes.docs as unknown as VendorDoc[]
    const orderIds = Array.from(new Set(ordersDocs.map((o) => String(o.id))))

    const [transactionsRes, orderItemsRes, reviewsRes] = await Promise.all([
      orderIds.length
        ? payload.find({
            collection: 'transactions',
            where: { order: { in: orderIds } },
            limit: 3000,
            depth: 0,
            overrideAccess: true,
          })
        : Promise.resolve({ docs: [] as unknown[] } as unknown as Awaited<ReturnType<typeof payload.find>>),
      orderIds.length
        ? payload.find({
            collection: 'order-items',
            where: { order: { in: orderIds } },
            limit: 5000,
            depth: 0,
            overrideAccess: true,
          })
        : Promise.resolve({ docs: [] as unknown[] } as unknown as Awaited<ReturnType<typeof payload.find>>),
      payload.find({
        collection: 'reviews',
        where: { merchant: { in: Array.from(merchantIds) } },
        limit: 2000,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    const transactionsDocs = transactionsRes.docs as unknown as VendorDoc[]
    const orderItemsDocs = orderItemsRes.docs as unknown as VendorDoc[]
    const reviewsDocs = reviewsRes.docs as unknown as VendorDoc[]

    const core = buildVendorAnalyticsCore(params, {
      merchantsDocs,
      ordersDocs,
      transactionsDocs,
      orderItemsDocs,
    })
    const {
      paidCurrent,
      ordersCurrent,
      ordersPrevFiltered,
      paidPrevFiltered,
      refundedTransactions,
      failedTransactions,
      merchantMap,
      orderMap,
    } = core

    const totalRevenueCurrent = paidCurrent.reduce((s, t) => s + getNum(t.amount), 0)
    const totalRevenuePrev = paidPrevFiltered.reduce((s, t) => s + getNum(t.amount), 0)
    const totalOrdersCurrent = ordersCurrent.length
    const totalOrdersPrev = ordersPrevFiltered.length
    const aovCurrent = totalOrdersCurrent ? totalRevenueCurrent / totalOrdersCurrent : 0
    const todayStr = daysAgo(0)
    const todayRevenue = paidCurrent
      .filter((t) => String(t.paid_at ?? '').startsWith(todayStr))
      .reduce((s, t) => s + getNum(t.amount), 0)
    const pendingOrders = ordersCurrent.filter((o) => String(o.status) === 'pending').length
    const activeOrders = ordersCurrent.filter((o) =>
      ['accepted', 'preparing', 'ready_for_pickup', 'on_delivery'].includes(String(o.status)),
    ).length

    const periodReviews = days === 0 ? reviewsDocs : reviewsDocs.filter((r) => isInCurrentPeriod(params, r, 'createdAt'))
    const avgRating = periodReviews.length
      ? periodReviews.reduce((s, r) => s + getNum(r.merchant_rating), 0) / periodReviews.length
      : (() => {
          const all = reviewsDocs
          return all.length ? all.reduce((s, r) => s + getNum(r.merchant_rating), 0) / all.length : 0
        })()

    // Outlet resolution mirrors the monolith's outletForOrder (map-first,
    // populated-object fallback) so per-outlet today stats match exactly.
    const outletIdOf = (order: VendorDoc): string => {
      const raw = order.merchant as unknown
      const obj = raw && typeof raw === 'object' ? (raw as VendorDoc) : null
      const id = obj ? String(obj.id ?? '') : String(raw ?? '')
      if (!id) return ''
      const mapped = merchantMap.get(id)
      return mapped ? String(mapped.id) : obj ? id : ''
    }
    const todayOrderMap = new Map<string, number>()
    const todayRevenueMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      if (!String(o.createdAt ?? '').startsWith(todayStr)) return
      const id = outletIdOf(o)
      if (!id) return
      todayOrderMap.set(id, (todayOrderMap.get(id) || 0) + 1)
    })
    paidCurrent.forEach((t) => {
      if (!String(t.paid_at ?? '').startsWith(todayStr)) return
      const raw = t.order as unknown
      const oid = raw && typeof raw === 'object' ? String((raw as VendorDoc).id ?? '') : String(raw ?? '')
      const order = oid ? orderMap.get(oid) : null
      if (!order) return
      const id = outletIdOf(order)
      if (!id) return
      todayRevenueMap.set(id, (todayRevenueMap.get(id) || 0) + getNum(t.amount))
    })
    const outlets = merchantsDocs.map((m) => ({
      id: String(m.id),
      name: getStr(m.outletName),
      operationalStatus: getStr(m.operationalStatus, 'closed'),
      isAcceptingOrders: !!m.isAcceptingOrders,
      todayOrders: todayOrderMap.get(String(m.id)) || 0,
      todayRevenue: todayRevenueMap.get(String(m.id)) || 0,
      avgDeliveryTime: getNum(m.avg_delivery_time_minutes),
    }))

    const responseBody = {
      meta: {
        range: label,
        days,
        generatedAt: now.toISOString(),
        vendorId,
        vendorName,
        totalOrdersAllTime: ordersDocs.length,
        periodStart: periodStart ? periodStart.toISOString() : null,
        periodEnd: now.toISOString(),
      },
      kpis: {
        totalRevenue: totalRevenueCurrent,
        revenueChange: pctChange(totalRevenueCurrent, totalRevenuePrev),
        todayRevenue,
        totalOrders: totalOrdersCurrent,
        ordersChange: pctChange(totalOrdersCurrent, totalOrdersPrev),
        pendingOrders,
        activeOrders,
        totalOutlets: merchantsDocs.length,
        openOutlets: merchantsDocs.filter((m) => getStr(m.operationalStatus) === 'open').length,
        acceptingOrders: merchantsDocs.filter((m) => m.isAcceptingOrders === true).length,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: periodReviews.length,
        aov: aovCurrent,
        paidCount: paidCurrent.length,
        refundedCount: refundedTransactions.filter((t) => isInCurrentPeriod(params, t, 'createdAt')).length,
        failedCount: failedTransactions.filter((t) => isInCurrentPeriod(params, t, 'createdAt')).length,
      },
      outlets,
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-VendorAnalytics-Cache': 'MISS' } })
  } catch (error) {
    console.error('Vendor analytics summary error:', error)
    return NextResponse.json({ error: 'Failed to load vendor analytics' }, { status: 500 })
  }
}
