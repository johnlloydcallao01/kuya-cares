import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached } from '@encreasl/cache'

function getNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val
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
    if ('name' in obj) return String(obj.name ?? fallback)
    if ('email' in obj) return String(obj.email ?? fallback)
  }
  return fallback
}
function resolveId(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string' || typeof val === 'number') return String(val)
  if (typeof val === 'object' && val !== null && 'id' in (val as any)) return String((val as any).id)
  return ''
}
function parseRange(searchParams: URLSearchParams): { days: number; label: string } {
  const r = (searchParams.get('range') || '30d').toLowerCase()
  if (r === '7d') return { days: 7, label: '7d' }
  if (r === '30d') return { days: 30, label: '30d' }
  if (r === '90d') return { days: 90, label: '90d' }
  if (r === '1y' || r === '365d' || r === '12m') return { days: 365, label: '1y' }
  if (r === 'all' || r === '0') return { days: 0, label: 'all' }
  const parsed = parseInt(r, 10)
  if (!isNaN(parsed) && parsed > 0) return { days: parsed, label: `${parsed}d` }
  return { days: 30, label: '30d' }
}

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const cacheQuery = Array.from(searchParams.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'range=30d'
    const cacheKey = `admin:reports:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Reports-Cache': 'HIT' } })

    const { days, label } = parseRange(searchParams)
    const now = new Date()
    const periodStart = days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    const [vendorsRes, merchantsRes, ordersRes, transactionsRes, orderItemsRes, deliveryBookingsRes, productsRes, reviewsRes, discountsRes] = await Promise.all([
      payload.find({ collection: 'vendors', limit: 2000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'merchants', limit: 2000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'orders', limit: 3000, sort: '-createdAt', depth: 1, overrideAccess: true }),
      payload.find({ collection: 'transactions', limit: 3000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'order-items', limit: 5000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'delivery-bookings', limit: 2000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'products', limit: 2000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'reviews', limit: 2000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'order-discounts', limit: 3000, depth: 0, overrideAccess: true }),
    ])

    const vendorsDocs = vendorsRes.docs as unknown as Record<string, unknown>[]
    const merchantsDocs = merchantsRes.docs as unknown as Record<string, unknown>[]
    const ordersDocs = ordersRes.docs as unknown as Record<string, unknown>[]
    const transactionsDocs = transactionsRes.docs as unknown as Record<string, unknown>[]
    const orderItemsDocs = orderItemsRes.docs as unknown as Record<string, unknown>[]
    const deliveryBookingsDocs = deliveryBookingsRes.docs as unknown as Record<string, unknown>[]
    const discountsDocs = (discountsRes.docs as unknown as Record<string, unknown>[]) ?? []

    const merchantMap = new Map<string, Record<string, unknown>>()
    merchantsDocs.forEach((m: any) => merchantMap.set(String(m.id), m as Record<string, unknown>))
    const vendorMap = new Map<string, Record<string, unknown>>()
    vendorsDocs.forEach((v: any) => vendorMap.set(String(v.id), v as Record<string, unknown>))
    const orderMap = new Map<string, Record<string, unknown>>()
    ordersDocs.forEach((o: any) => orderMap.set(String(o.id), o as Record<string, unknown>))

    function isInPeriod(doc: Record<string, unknown>, field: string): boolean {
      if (!periodStart) return true
      const raw = String(doc[field] ?? doc.createdAt ?? '')
      if (!raw) return false
      const d = new Date(raw)
      return !isNaN(d.getTime()) && d >= periodStart && d <= now
    }

    // Period-filtered sets (BFF owns period logic, frontend is thin)
    const ordersPeriod = ordersDocs.filter((o) => isInPeriod(o, 'createdAt'))
    const paidTxPeriod = transactionsDocs.filter((t) => String(t.status) === 'paid' && isInPeriod(t as Record<string, unknown>, 'paid_at'))
    const refundedTxPeriod = transactionsDocs.filter((t) => String(t.status) === 'refunded' && isInPeriod(t as Record<string, unknown>, 'createdAt'))
    const failedTxPeriod = transactionsDocs.filter((t) => String(t.status) === 'failed' && isInPeriod(t as Record<string, unknown>, 'createdAt'))

    const totalRevenue = paidTxPeriod.reduce((s, t) => s + getNum(t.amount), 0)
    const totalRefunded = refundedTxPeriod.reduce((s, t) => s + getNum(t.amount), 0)
    const netRevenue = totalRevenue - totalRefunded
    const totalOrders = ordersPeriod.length
    const avgOrder = totalOrders ? totalRevenue / totalOrders : 0

    // Coupon discounts in period. Charged amounts (transactions/orders totals) are
    // already net of discounts, so these are informational + settlement inputs —
    // never subtracted from revenue again.
    const discountsPeriod = discountsDocs.filter((d) => isInPeriod(d, 'createdAt'))
    const totalDiscounts = discountsPeriod.reduce((s, d) => s + getNum(d.amount_off), 0)
    const vendorFundedDiscounts = discountsPeriod.reduce((s, d) => s + getNum((d as any).vendor_share), 0)
    const discountByOrder = new Map<string, { total: number; vendorShare: number; code: string }>()
    for (const d of discountsPeriod) {
      const oid = resolveId(d.order)
      if (!oid) continue
      const prev = discountByOrder.get(oid) || { total: 0, vendorShare: 0, code: '' }
      prev.total += getNum(d.amount_off)
      prev.vendorShare += getNum((d as any).vendor_share)
      if (!prev.code) prev.code = getStr(d.code)
      discountByOrder.set(oid, prev)
    }

    // Financial reconciliation rows (one per paid transaction, joined to order/merchant/vendor)
    const financialRows = paidTxPeriod.slice(0, 200).map((t) => {
      const orderId = resolveId(t.order)
      const order = orderId ? orderMap.get(orderId) : null
      const merchantRaw = order ? (order.merchant as unknown) : null
      const merchantObj = merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as Record<string, unknown>) : null
      const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
      const merchant = merchantId ? merchantMap.get(merchantId) : merchantObj
      const merchantName = merchant ? getStr(merchant.outletName, `Merchant #${merchantId}`) : 'N/A'
      const vendorRaw = merchant ? (merchant as any).vendor : null
      const vendorObj = vendorRaw && typeof vendorRaw === 'object' ? (vendorRaw as Record<string, unknown>) : null
      const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
      const vendor = vendorId ? vendorMap.get(vendorId) : vendorObj
      const vendorName = vendor ? getStr(vendor.businessName, `Vendor #${vendorId}`) : 'N/A'
      const orderDiscount = orderId ? discountByOrder.get(orderId) : undefined
      return {
        transactionId: String(t.id),
        orderId: orderId || '—',
        date: String(t.paid_at ?? t.createdAt ?? ''),
        merchant: merchantName,
        vendor: vendorName,
        amount: getNum(t.amount),
        platformFee: order ? getNum((order as any).platform_fee) : 0,
        deliveryFee: order ? getNum((order as any).delivery_fee) : 0,
        discount: orderDiscount ? orderDiscount.total : 0,
        couponCode: orderDiscount ? orderDiscount.code : '',
        status: String(t.status),
        paymentMethod: getStr(t.payment_method, 'unknown'),
        gross: order ? getNum((order as any).total) : getNum(t.amount),
      }
    })

    // Vendor payouts aggregation (verified revenue per vendor).
    // Platform-funded discounts do NOT reduce vendor payouts; only the
    // vendor-funded share of a coupon is deducted from net.
    const vendorAgg = new Map<string, { businessName: string; orders: number; gross: number; platformFees: number; deliveryFees: number; discountShare: number; net: number }>()
    paidTxPeriod.forEach((t) => {
      const orderId = resolveId(t.order)
      const order = orderId ? orderMap.get(orderId) : null
      if (!order) return
      const merchantRaw = order.merchant as unknown
      const merchantObj = merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as Record<string, unknown>) : null
      const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
      const merchant = merchantId ? merchantMap.get(merchantId) : null
      const vendorRaw = merchant ? (merchant as any).vendor : null
      const vendorObj = vendorRaw && typeof vendorRaw === 'object' ? (vendorRaw as Record<string, unknown>) : null
      const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
      if (!vendorId) return
      const vDoc = vendorId ? vendorMap.get(vendorId) : null
      const businessName = vDoc ? getStr(vDoc.businessName, `Vendor #${vendorId}`) : getStr(vendorObj?.businessName, `Vendor #${vendorId}`)
      const agg = vendorAgg.get(vendorId) || { businessName, orders: 0, gross: 0, platformFees: 0, deliveryFees: 0, discountShare: 0, net: 0 }
      const amt = getNum(t.amount)
      const vendorDiscount = orderId ? discountByOrder.get(orderId)?.vendorShare ?? 0 : 0
      agg.orders += 1
      agg.gross += amt
      agg.platformFees += getNum((order as any).platform_fee)
      agg.deliveryFees += getNum((order as any).delivery_fee)
      agg.discountShare += vendorDiscount
      agg.net += Math.max(0, amt - getNum((order as any).platform_fee) - getNum((order as any).delivery_fee) - vendorDiscount)
      vendorAgg.set(vendorId, agg)
    })
    const vendorPayouts = Array.from(vendorAgg.entries())
      .map(([vendorId, v]) => ({ vendorId, ...v }))
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 20)

    // Order volume daily
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

    // Refunds / failures rows
    const refundsRows = [...refundedTxPeriod, ...failedTxPeriod].slice(0, 100).map((t) => ({
      transactionId: String(t.id),
      orderId: resolveId(t.order) || '—',
      date: String(t.createdAt ?? ''),
      amount: getNum(t.amount),
      status: String(t.status),
      paymentMethod: getStr(t.payment_method, 'unknown'),
    }))

    // Product performance (only verified paid orders)
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

    // Vendor compliance
    const vendorCompliance = vendorsDocs.map((v: any) => ({
      vendorId: String(v.id),
      businessName: getStr(v.businessName),
      businessType: getStr(v.businessType, 'other'),
      verificationStatus: getStr(v.verificationStatus, 'unknown'),
      isActive: !!v.isActive,
      totalMerchants: getNum(v.totalMerchants),
      averageRating: getNum(v.averageRating),
      totalOrders: getNum(v.totalOrders),
    }))

    // Delivery logistics
    const bookingsPeriod = deliveryBookingsDocs.filter((b) => {
      const oid = resolveId(b.order)
      const order = oid ? orderMap.get(oid) : null
      if (!order) return false
      return isInPeriod(order, 'createdAt')
    })
    const deliveryStatusBreakdownMap = new Map<string, number>()
    bookingsPeriod.forEach((b) => {
      const s = getStr(b.status, 'unknown')
      deliveryStatusBreakdownMap.set(s, (deliveryStatusBreakdownMap.get(s) || 0) + 1)
    })

    const periodLabel = days === 0 ? 'All time' : `${days}d`
    const periodStartIso = periodStart ? periodStart.toISOString() : ordersDocs.length ? String(ordersDocs[ordersDocs.length - 1]?.createdAt ?? '') : now.toISOString()

    const response = {
      meta: {
        range: label,
        periodLabel,
        days,
        generatedAt: now.toISOString(),
        periodStart: periodStartIso,
        periodEnd: now.toISOString(),
        totalDocs: { vendors: vendorsDocs.length, merchants: merchantsDocs.length, orders: ordersDocs.length, transactions: transactionsDocs.length },
      },
      summary: {
        totalRevenue,
        totalRefunded,
        netRevenue,
        totalDiscounts,
        vendorFundedDiscounts,
        totalOrders,
        avgOrder,
        totalVendors: vendorsDocs.length,
        activeVendors: vendorsDocs.filter((v: any) => v.isActive).length,
        totalMerchants: merchantsDocs.length,
        activeMerchants: merchantsDocs.filter((m: any) => m.isActive).length,
        failedCount: failedTxPeriod.length,
        refundedCount: refundedTxPeriod.length,
        paidCount: paidTxPeriod.length,
      },
      financialReconciliation: {
        rows: financialRows,
        totals: { gross: totalRevenue, platformFees: financialRows.reduce((s, r) => s + r.platformFee, 0), deliveryFees: financialRows.reduce((s, r) => s + r.deliveryFee, 0), discounts: financialRows.reduce((s, r) => s + (r.discount || 0), 0) },
        count: financialRows.length,
        totalCount: paidTxPeriod.length,
      },
      vendorPayouts: { rows: vendorPayouts, count: vendorPayouts.length },
      orderVolume: { daily: orderVolumeDaily, totalOrders, totalRevenue },
      refundsFailures: { rows: refundsRows, totals: { refunded: totalRefunded, failed: failedTxPeriod.reduce((s, t) => s + getNum(t.amount), 0) }, count: refundsRows.length },
      productPerformance: { rows: productPerformance, count: productPerformance.length },
      vendorCompliance: { rows: vendorCompliance, count: vendorCompliance.length },
      deliveryLogistics: {
        totalBookings: bookingsPeriod.length,
        byStatus: Array.from(deliveryStatusBreakdownMap.entries()).map(([status, count]) => ({ status, count })),
        sampleRows: bookingsPeriod.slice(0, 20).map((b: any) => ({
          orderId: resolveId(b.order),
          status: getStr(b.status),
          deliveryFee: getNum(b.delivery_fee),
          serviceType: getStr(b.service_type, 'MOTORCYCLE'),
          driverName: getStr(b.driver_name, '—'),
        })),
      },
    }
    await setCached(cacheKey, response, 30)
    return NextResponse.json(response, { headers: { 'X-Reports-Cache': 'MISS' } })
    } catch (error) {
      console.error('Reports aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
    }
  })
}
