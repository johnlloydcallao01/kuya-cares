import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCached, setCached } from '@encreasl/cache'
import {
  VendorReportDoc,
  buildVendorReportsCacheQuery,
  buildVendorReportsCore,
  getNum,
  getStr,
  parseVendorReportsParams,
  resolveId,
} from '@/utils/vendorReportsShared'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const cacheKey = `vendor:reports:catalog:${userId}:${buildVendorReportsCacheQuery(searchParams)}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VendorReports-Cache': 'HIT' } })

    const params = parseVendorReportsParams(searchParams)

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
    const merchantsDocs = merchantsRes.docs as unknown as VendorReportDoc[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))

    if (merchantIds.size === 0) {
      const emptyBody = {
        orderVolume: { daily: [], totalOrders: 0, totalRevenue: 0 },
        productPerformance: { rows: [], count: 0 },
        deliveryLogistics: { totalBookings: 0, byStatus: [], sampleRows: [] },
      }
      await setCached(cacheKey, emptyBody, 20)
      return NextResponse.json(emptyBody, { headers: { 'X-VendorReports-Cache': 'MISS' } })
    }

    const ordersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: Array.from(merchantIds) } },
      limit: 3000,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })
    const ordersDocs = ordersRes.docs as unknown as VendorReportDoc[]
    const orderIds = Array.from(new Set(ordersDocs.map((o) => String(o.id))))

    const [transactionsRes, orderItemsRes, deliveryBookingsRes] = await Promise.all([
      orderIds.length
        ? payload.find({
            collection: 'transactions',
            where: { order: { in: orderIds } },
            limit: 3000,
            depth: 0,
            overrideAccess: true,
          })
        : ({ docs: [] as unknown[] } as unknown as Awaited<ReturnType<typeof payload.find>>),
      orderIds.length
        ? payload.find({
            collection: 'order-items',
            where: { order: { in: orderIds } },
            limit: 5000,
            depth: 0,
            overrideAccess: true,
          })
        : ({ docs: [] as unknown[] } as unknown as Awaited<ReturnType<typeof payload.find>>),
      orderIds.length
        ? payload.find({
            collection: 'delivery-bookings',
            where: { order: { in: orderIds } },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })
        : ({ docs: [] as unknown[] } as unknown as Awaited<ReturnType<typeof payload.find>>),
    ])
    const transactionsDocs = transactionsRes.docs as unknown as VendorReportDoc[]
    const orderItemsDocs = orderItemsRes.docs as unknown as VendorReportDoc[]
    const deliveryBookingsDocs = deliveryBookingsRes.docs as unknown as VendorReportDoc[]

    const core = buildVendorReportsCore(params, { merchantsDocs, ordersDocs, transactionsDocs })
    const { orderMap, ordersPeriod, paidTxPeriod } = core

    const dailyMap = new Map<string, { date: string; orders: number; revenue: number }>()
    ordersPeriod.forEach((o) => {
      const d = new Date(String(o.createdAt ?? '')).toISOString().split('T')[0]
      const e = dailyMap.get(d) || { date: d, orders: 0, revenue: 0 }
      e.orders += 1
      dailyMap.set(d, e)
    })
    paidTxPeriod.forEach((t) => {
      const d = new Date(String(t.paid_at ?? t.createdAt ?? '')).toISOString().split('T')[0]
      const e = dailyMap.get(d) || { date: d, orders: 0, revenue: 0 }
      e.revenue += getNum(t.amount)
      dailyMap.set(d, e)
    })
    const orderVolumeDaily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    const totalOrders = ordersPeriod.length
    const totalRevenue = paidTxPeriod.reduce((s, t) => s + getNum(t.amount), 0)

    const paidOrderIds = new Set(paidTxPeriod.map((t) => resolveId(t.order)).filter(Boolean))
    const productAgg = new Map<string, { name: string; quantity: number; revenue: number; orders: number }>()
    orderItemsDocs.forEach((oi) => {
      const oid = resolveId(oi.order)
      if (!paidOrderIds.has(oid)) return
      const name = getStr(oi.product_name_snapshot, 'Unknown')
      const key = String(oi.product ?? name)
      const e = productAgg.get(key) || { name, quantity: 0, revenue: 0, orders: 0 }
      e.quantity += getNum(oi.quantity)
      e.revenue += getNum(oi.total_price)
      e.orders += 1
      productAgg.set(key, e)
    })
    const productPerformance = Array.from(productAgg.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20)

    const bookingsPeriod = deliveryBookingsDocs.filter((b) => {
      const oid = resolveId(b.order)
      const order = oid ? (orderMap.get(oid) ?? null) : null
      if (!order) return false
      if (!params.periodStart) return true
      const raw = String(order.createdAt ?? '')
      if (!raw) return false
      const d = new Date(raw)
      return !isNaN(d.getTime()) && d >= params.periodStart && d <= params.now
    })
    const deliveryByStatus = new Map<string, number>()
    bookingsPeriod.forEach((b) => {
      const s = getStr(b.status, 'unknown')
      deliveryByStatus.set(s, (deliveryByStatus.get(s) || 0) + 1)
    })

    const responseBody = {
      orderVolume: { daily: orderVolumeDaily, totalOrders, totalRevenue },
      productPerformance: { rows: productPerformance, count: productPerformance.length },
      deliveryLogistics: {
        totalBookings: bookingsPeriod.length,
        byStatus: Array.from(deliveryByStatus.entries()).map(([status, count]) => ({ status, count })),
        sampleRows: bookingsPeriod.slice(0, 20).map((b) => ({
          orderId: resolveId(b.order),
          status: getStr(b.status),
          deliveryFee: getNum(b.delivery_fee),
          serviceType: getStr(b.service_type, 'MOTORCYCLE'),
          driverName: getStr(b.driver_name, '—'),
        })),
      },
    }
    await setCached(cacheKey, responseBody, 120)
    return NextResponse.json(responseBody, { headers: { 'X-VendorReports-Cache': 'MISS' } })
  } catch (e) {
    console.error('Vendor reports catalog error:', e)
    return NextResponse.json({ error: 'Failed to load vendor reports' }, { status: 500 })
  }
}
