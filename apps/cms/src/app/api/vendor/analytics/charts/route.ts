import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCached, setCached } from '@encreasl/cache'
import {
  VendorDoc,
  buildVendorAnalyticsCacheQuery,
  buildVendorAnalyticsCore,
  daysAgo,
  formatDate,
  formatMonthShort,
  getNum,
  getStr,
  parseVendorAnalyticsParams,
} from '@/utils/vendorAnalyticsShared'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    const cacheKey = `vendor:analytics:charts:${userId}:${buildVendorAnalyticsCacheQuery(searchParams)}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VendorAnalytics-Cache': 'HIT' } })

    const params = parseVendorAnalyticsParams(searchParams)
    const { days, now } = params

    const vendorsRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorsRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: String(vendor.id) } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantsDocs = merchantsRes.docs as unknown as VendorDoc[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))

    if (merchantIds.size === 0) {
      const emptyBody = {
        revenueTrend: [],
        orderStatusBreakdown: [],
        fulfillmentMix: [],
        deliveryStatusBreakdown: [],
        paymentMethodBreakdown: [],
        revenueByOutlet: [],
        hourlyDistribution: [],
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

    const [transactionsRes, orderItemsRes] = await Promise.all([
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
    ])
    const transactionsDocs = transactionsRes.docs as unknown as VendorDoc[]
    const orderItemsDocs = orderItemsRes.docs as unknown as VendorDoc[]

    const core = buildVendorAnalyticsCore(params, {
      merchantsDocs,
      ordersDocs,
      transactionsDocs,
      orderItemsDocs,
    })
    const { paidCurrent, ordersCurrent, verifiedRevenueByOrderId, merchantMap, orderMap } = core

    const outletIdOf = (order: VendorDoc): { id: string; name: string } => {
      const raw = order.merchant as unknown
      const obj = raw && typeof raw === 'object' ? (raw as VendorDoc) : null
      const id = obj ? String(obj.id ?? '') : String(raw ?? '')
      if (!id) return { id: '', name: 'Unknown' }
      const mapped = merchantMap.get(id)
      if (mapped) return { id: String(mapped.id), name: getStr(mapped.outletName, id) }
      return obj ? { id, name: getStr(obj.outletName, id) } : { id: '', name: 'Unknown' }
    }

    let revenueTrend: { date: string; revenue: number; orders: number }[] = []
    if (days === 0 || days >= 90) {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        const key = formatMonthShort(d.toISOString())
        const rev = paidCurrent
          .filter((t) => {
            const dd = new Date(String(t.paid_at ?? t.createdAt ?? ''))
            return dd >= d && dd < next
          })
          .reduce((s, t) => s + getNum(t.amount), 0)
        const ord = ordersCurrent.filter((o) => {
          const dd = new Date(String(o.createdAt ?? ''))
          return dd >= d && dd < next
        }).length
        revenueTrend.push({ date: key, revenue: rev, orders: ord })
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const ds = daysAgo(i)
        const rev = paidCurrent
          .filter((t) => String(t.paid_at ?? '').startsWith(ds))
          .reduce((s, t) => s + getNum(t.amount), 0)
        const ord = ordersCurrent.filter((o) => String(o.createdAt ?? '').startsWith(ds)).length
        revenueTrend.push({ date: formatDate(ds), revenue: rev, orders: ord })
      }
    }

    const statusMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      const s = getStr(o.status, 'unknown')
      statusMap.set(s, (statusMap.get(s) || 0) + 1)
    })
    const orderStatusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))

    const fulfillMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      const f = getStr(o.fulfillment_type, 'unknown')
      fulfillMap.set(f, (fulfillMap.get(f) || 0) + 1)
    })
    const fulfillmentMix = Array.from(fulfillMap.entries()).map(([type, count]) => ({ type, count }))

    const deliveryMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      const ds = getStr(o.delivery_status, 'none')
      deliveryMap.set(ds, (deliveryMap.get(ds) || 0) + 1)
    })
    const deliveryStatusBreakdown = Array.from(deliveryMap.entries()).map(([status, count]) => ({ status, count }))

    const pmMap = new Map<string, number>()
    paidCurrent.forEach((t) => {
      const pm = getStr(t.payment_method, 'unknown')
      pmMap.set(pm, (pmMap.get(pm) || 0) + 1)
    })
    const paymentMethodBreakdown = Array.from(pmMap.entries()).map(([method, count]) => ({ method, count }))

    const outletRevenueMap = new Map<string, { outletName: string; revenue: number; orders: number }>()
    verifiedRevenueByOrderId.forEach((rev, oid) => {
      const order = orderMap.get(oid)
      if (!order) return
      const { id: oid2, name } = outletIdOf(order)
      const key = oid2 || 'unknown'
      const e = outletRevenueMap.get(key) || { outletName: name, revenue: 0, orders: 0 }
      e.revenue += rev
      e.orders += 1
      outletRevenueMap.set(key, e)
    })
    const revenueByOutlet = Array.from(outletRevenueMap.entries())
      .map(([outletId, v]) => ({ outletId, ...v }))
      .sort((a, b) => b.revenue - a.revenue)

    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }))
    ordersCurrent.forEach((o) => {
      const d = new Date(String(o.createdAt ?? ''))
      if (isNaN(d.getTime())) return
      const h = d.getHours()
      hourly[h].orders += 1
      hourly[h].revenue += verifiedRevenueByOrderId.get(String(o.id)) || 0
    })

    const responseBody = {
      revenueTrend,
      orderStatusBreakdown,
      fulfillmentMix,
      deliveryStatusBreakdown,
      paymentMethodBreakdown,
      revenueByOutlet,
      hourlyDistribution: hourly,
    }
    await setCached(cacheKey, responseBody, 120)
    return NextResponse.json(responseBody, { headers: { 'X-VendorAnalytics-Cache': 'MISS' } })
  } catch (error) {
    console.error('Vendor analytics charts error:', error)
    return NextResponse.json({ error: 'Failed to load vendor analytics' }, { status: 500 })
  }
}
