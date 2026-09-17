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
  daysAgoDateStr,
  formatDateShort,
  formatMonthShort,
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
      const cacheKey = `admin:analytics:charts:${admin.id}:${buildAnalyticsCacheQuery(searchParams)}`
      const cached = await getCached<Record<string, unknown>>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-Analytics-Cache': 'HIT' } })

      const params = parseAnalyticsParams(searchParams)
      const { days, now, periodStart } = params

      const [
        vendorsRes,
        merchantsRes,
        ordersRes,
        driversRes,
        transactionsRes,
        orderItemsRes,
        productsRes,
        productCategoriesRes,
        deliveryBookingsRes,
      ] = await Promise.all([
        payload.find({ collection: 'vendors', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'merchants', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'orders', limit: 3000, sort: '-createdAt', depth: 0, overrideAccess: true }),
        payload.find({ collection: 'drivers', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'transactions', limit: 3000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'order-items', limit: 5000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'products', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'product-categories', limit: 1000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'delivery-bookings', limit: 2000, depth: 0, overrideAccess: true }),
      ])

      const vendorsDocs = vendorsRes.docs as unknown as AnalyticsDoc[]
      const merchantsDocs = merchantsRes.docs as unknown as AnalyticsDoc[]
      const ordersDocs = ordersRes.docs as unknown as AnalyticsDoc[]
      const driversDocs = driversRes.docs as unknown as AnalyticsDoc[]
      const transactionsDocs = transactionsRes.docs as unknown as AnalyticsDoc[]
      const orderItemsDocs = orderItemsRes.docs as unknown as AnalyticsDoc[]
      const productsDocs = productsRes.docs as unknown as AnalyticsDoc[]
      const categoriesDocs = productCategoriesRes.docs as unknown as AnalyticsDoc[]
      const deliveryBookingsDocs = deliveryBookingsRes.docs as unknown as AnalyticsDoc[]

      const core = buildAnalyticsCore(params, {
        vendorsDocs,
        merchantsDocs,
        ordersDocs,
        transactionsDocs,
        orderItemsDocs,
        productsDocs,
        categoriesDocs,
      })
      const {
        paidTransactions,
        merchantMap,
        vendorMap,
        productMap,
        categoryMap,
        orderMap,
        ordersCurrent,
        verifiedRevenueByOrderId,
        verifiedOrderIdsInPeriod,
      } = core

      function inCurrent(doc: AnalyticsDoc, dateField: string): boolean {
        if (!periodStart) return true
        const raw = String(doc[dateField] ?? doc.createdAt ?? '')
        if (!raw) return false
        const d = new Date(raw)
        if (isNaN(d.getTime())) return false
        return d >= periodStart && d <= now
      }

      // Revenue trend (same raw-docs semantics as the monolith: unfiltered by q/filters)
      const revenueTrend: { date: string; revenue: number; orders: number; aov: number }[] = []
      if (days === 0 || days >= 90) {
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
          const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
          const key = formatMonthShort(d.toISOString())
          const dayTransactions = paidTransactions.filter((t) => {
            const raw = String(t.paid_at ?? t.createdAt ?? '')
            if (!raw) return false
            const dd = new Date(raw)
            return dd >= d && dd < next
          })
          const dayOrders = ordersDocs.filter((o) => {
            const raw = String(o.createdAt ?? '')
            const dd = new Date(raw)
            return dd >= d && dd < next
          })
          const rev = dayTransactions.reduce((s, t) => s + getNum(t.amount), 0)
          revenueTrend.push({ date: key, revenue: rev, orders: dayOrders.length, aov: dayOrders.length ? rev / dayOrders.length : 0 })
        }
      } else {
        for (let i = days - 1; i >= 0; i--) {
          const dateStr = daysAgoDateStr(i)
          const fmt = formatDateShort(dateStr)
          const dayTransactions = paidTransactions.filter((t) => String(t.paid_at ?? '').startsWith(dateStr))
          const dayOrders = ordersDocs.filter((o) => String(o.createdAt ?? '').startsWith(dateStr))
          const rev = dayTransactions.reduce((s, t) => s + getNum(t.amount), 0)
          revenueTrend.push({ date: fmt, revenue: rev, orders: dayOrders.length, aov: dayOrders.length ? rev / dayOrders.length : 0 })
        }
      }

      const statusMap = new Map<string, number>()
      ordersCurrent.forEach((o) => {
        const s = getStr(o.status, 'unknown')
        statusMap.set(s, (statusMap.get(s) || 0) + 1)
      })
      const orderStatusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))

      const fulfillmentMap = new Map<string, number>()
      ordersCurrent.forEach((o) => {
        const f = getStr(o.fulfillment_type, 'unknown')
        fulfillmentMap.set(f, (fulfillmentMap.get(f) || 0) + 1)
      })
      const fulfillmentMix = Array.from(fulfillmentMap.entries()).map(([type, count]) => ({ type, count }))

      const deliveryStatusMap = new Map<string, number>()
      ordersCurrent.forEach((o) => {
        const ds = getStr(o.delivery_status, 'none')
        deliveryStatusMap.set(ds, (deliveryStatusMap.get(ds) || 0) + 1)
      })
      const deliveryStatusBreakdown = Array.from(deliveryStatusMap.entries()).map(([status, count]) => ({ status, count }))

      const bookingStatusMap = new Map<string, number>()
      deliveryBookingsDocs.forEach((b) => {
        const s = getStr(b.status, 'unknown')
        const orderId = resolveId(b.order)
        const order = orderId ? orderMap.get(orderId) : null
        if (!order) return
        if (days !== 0 && !inCurrent(order, 'createdAt')) return
        bookingStatusMap.set(s, (bookingStatusMap.get(s) || 0) + 1)
      })
      const bookingStatusBreakdown = Array.from(bookingStatusMap.entries()).map(([status, count]) => ({ status, count }))

      const paymentMethodMap = new Map<string, number>()
      const txStatusMap = new Map<string, number>()
      transactionsDocs.filter((t) => inCurrent(t, 'createdAt')).forEach((t) => {
        const pm = getStr(t.payment_method, 'unknown')
        paymentMethodMap.set(pm, (paymentMethodMap.get(pm) || 0) + 1)
        const st = getStr(t.status, 'unknown')
        txStatusMap.set(st, (txStatusMap.get(st) || 0) + 1)
      })
      const paymentMethodBreakdown = Array.from(paymentMethodMap.entries()).map(([method, count]) => ({ method, count }))
      const transactionStatusBreakdown = Array.from(txStatusMap.entries()).map(([status, count]) => ({ status, count }))

      const revenueByBusinessTypeMap = new Map<string, { revenue: number; orders: number }>()
      verifiedRevenueByOrderId.forEach((rev, orderId) => {
        const order = orderMap.get(orderId)
        if (!order) return
        const merchantRaw = order.merchant as unknown
        const merchantObj = merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as AnalyticsDoc) : null
        const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
        const merchant = merchantId ? merchantMap.get(merchantId) : null
        const vendorRaw = merchant ? merchant.vendor : null
        const vendorObj = vendorRaw && typeof vendorRaw === 'object' ? (vendorRaw as AnalyticsDoc) : null
        const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
        const vendor = vendorId ? vendorMap.get(vendorId) : null
        const btype = vendor ? getStr(vendor.businessType, 'other') : 'unknown'
        const entry = revenueByBusinessTypeMap.get(btype) || { revenue: 0, orders: 0 }
        entry.revenue += rev
        entry.orders += 1
        revenueByBusinessTypeMap.set(btype, entry)
      })
      const revenueByBusinessType = Array.from(revenueByBusinessTypeMap.entries()).map(([businessType, v]) => ({ businessType, ...v }))

      const categoryRevenueMap = new Map<string, { revenue: number; quantity: number }>()
      orderItemsDocs.forEach((oi) => {
        const orderId = resolveId(oi.order)
        if (!verifiedOrderIdsInPeriod.has(orderId)) return
        const productRaw = oi.product as unknown
        const prodId =
          productRaw && typeof productRaw === 'object' ? String((productRaw as AnalyticsDoc).id ?? '') : String(productRaw ?? '')
        const product = prodId ? productMap.get(prodId) : null
        if (!product) return
        const cats = product.categories as unknown
        const catIds: string[] = Array.isArray(cats) ? cats.map((c: unknown) => String((c as AnalyticsDoc)?.id ?? c ?? '')) : []
        const rev = getNum(oi.total_price)
        const qty = getNum(oi.quantity)
        if (catIds.length === 0) {
          const entry = categoryRevenueMap.get('uncategorized') || { revenue: 0, quantity: 0 }
          entry.revenue += rev
          entry.quantity += qty
          categoryRevenueMap.set('uncategorized', entry)
        } else {
          catIds.forEach((cid) => {
            const cat = categoryMap.get(cid)
            const name = cat ? getStr(cat.name, cid) : cid
            const entry = categoryRevenueMap.get(name) || { revenue: 0, quantity: 0 }
            entry.revenue += rev
            entry.quantity += qty
            categoryRevenueMap.set(name, entry)
          })
        }
      })
      const revenueByCategory = Array.from(categoryRevenueMap.entries())
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 8)

      const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }))
      ordersCurrent.forEach((o) => {
        const raw = String(o.createdAt ?? o.placed_at ?? '')
        const d = new Date(raw)
        if (isNaN(d.getTime())) return
        const h = d.getHours()
        hourly[h].orders += 1
        hourly[h].revenue += verifiedRevenueByOrderId.get(String(o.id)) || 0
      })

      const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const weekday = Array.from({ length: 7 }, (_, i) => ({ day: weekdayLabels[i], orders: 0, revenue: 0 }))
      ordersCurrent.forEach((o) => {
        const raw = String(o.createdAt ?? '')
        const d = new Date(raw)
        if (isNaN(d.getTime())) return
        weekday[d.getDay()].orders += 1
        weekday[d.getDay()].revenue += verifiedRevenueByOrderId.get(String(o.id)) || 0
      })

      const driverStatusMap = new Map<string, number>()
      driversDocs.forEach((d) => {
        const s = getStr(d.status, 'unknown')
        driverStatusMap.set(s, (driverStatusMap.get(s) || 0) + 1)
      })
      const driverStatusBreakdown = Array.from(driverStatusMap.entries()).map(([status, count]) => ({ status, count }))

      const vendorVerificationMap = new Map<string, number>()
      vendorsDocs.forEach((v) => {
        const s = getStr(v.verificationStatus, 'unknown')
        vendorVerificationMap.set(s, (vendorVerificationMap.get(s) || 0) + 1)
      })
      const vendorVerificationBreakdown = Array.from(vendorVerificationMap.entries()).map(([status, count]) => ({ status, count }))

      const response = {
        revenueTrend,
        orderStatusBreakdown,
        fulfillmentMix,
        deliveryStatusBreakdown,
        bookingStatusBreakdown,
        paymentMethodBreakdown,
        transactionStatusBreakdown,
        revenueByBusinessType,
        revenueByCategory,
        hourlyDistribution: hourly,
        weekdayDistribution: weekday,
        vendorVerificationBreakdown,
        driverStatusBreakdown,
      }
      await setCached(cacheKey, response, 120)
      return NextResponse.json(response, { headers: { 'X-Analytics-Cache': 'MISS' } })
    } catch (error) {
      console.error('Analytics charts aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load analytics charts' }, { status: 500 })
    }
  })
}
