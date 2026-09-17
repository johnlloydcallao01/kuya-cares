import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached } from '@encreasl/cache'
import {
  ReportsDoc,
  buildReportsCacheQuery,
  buildReportsCore,
  getNum,
  getStr,
  parseReportsParams,
  resolveId,
} from '@/utils/reportsShared'

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { searchParams } = new URL(request.url)
      const cacheKey = `admin:reports:catalog:${admin.id}:${buildReportsCacheQuery(searchParams)}`
      const cached = await getCached<Record<string, unknown>>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-Reports-Cache': 'HIT' } })

      const params = parseReportsParams(searchParams)

      const [vendorsRes, ordersRes, transactionsRes, orderItemsRes, deliveryBookingsRes] = await Promise.all([
        payload.find({ collection: 'vendors', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'orders', limit: 3000, sort: '-createdAt', depth: 0, overrideAccess: true }),
        payload.find({ collection: 'transactions', limit: 3000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'order-items', limit: 5000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'delivery-bookings', limit: 2000, depth: 0, overrideAccess: true }),
      ])

      const vendorsDocs = vendorsRes.docs as unknown as ReportsDoc[]
      const ordersDocs = ordersRes.docs as unknown as ReportsDoc[]
      const transactionsDocs = transactionsRes.docs as unknown as ReportsDoc[]
      const orderItemsDocs = orderItemsRes.docs as unknown as ReportsDoc[]
      const deliveryBookingsDocs = deliveryBookingsRes.docs as unknown as ReportsDoc[]

      const core = buildReportsCore(params, {
        vendorsDocs,
        ordersDocs,
        transactionsDocs,
      })
      const { orderMap, ordersPeriod, paidTxPeriod } = core

      const dailyMap = new Map<string, { date: string; orders: number; revenue: number }>()
      ordersPeriod.forEach((o) => {
        const d = new Date(String(o.createdAt ?? '')).toISOString().split('T')[0]
        const entry = dailyMap.get(d) || { date: d, orders: 0, revenue: 0 }
        entry.orders += 1
        dailyMap.set(d, entry)
      })
      paidTxPeriod.forEach((t) => {
        const d = new Date(String(t.paid_at ?? t.createdAt ?? '')).toISOString().split('T')[0]
        const entry = dailyMap.get(d) || { date: d, orders: 0, revenue: 0 }
        entry.revenue += getNum(t.amount)
        dailyMap.set(d, entry)
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

      const vendorCompliance = vendorsDocs.map((v) => ({
        vendorId: String(v.id),
        businessName: getStr(v.businessName),
        businessType: getStr(v.businessType, 'other'),
        verificationStatus: getStr(v.verificationStatus, 'unknown'),
        isActive: !!v.isActive,
        totalMerchants: getNum(v.totalMerchants),
        averageRating: getNum(v.averageRating),
        totalOrders: getNum(v.totalOrders),
      }))

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
      const byStatusMap = new Map<string, number>()
      bookingsPeriod.forEach((b) => {
        const s = getStr(b.status, 'unknown')
        byStatusMap.set(s, (byStatusMap.get(s) || 0) + 1)
      })

      const response = {
        orderVolume: { daily: orderVolumeDaily, totalOrders, totalRevenue },
        productPerformance: { rows: productPerformance, count: productPerformance.length },
        vendorCompliance: { rows: vendorCompliance, count: vendorCompliance.length },
        deliveryLogistics: {
          totalBookings: bookingsPeriod.length,
          byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
          sampleRows: bookingsPeriod.slice(0, 20).map((b) => ({
            orderId: resolveId(b.order),
            status: getStr(b.status),
            deliveryFee: getNum(b.delivery_fee),
            serviceType: getStr(b.service_type, 'MOTORCYCLE'),
            driverName: getStr(b.driver_name, '—'),
          })),
        },
      }
      await setCached(cacheKey, response, 120)
      return NextResponse.json(response, { headers: { 'X-Reports-Cache': 'MISS' } })
    } catch (error) {
      console.error('Reports catalog aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load reports catalog' }, { status: 500 })
    }
  })
}
