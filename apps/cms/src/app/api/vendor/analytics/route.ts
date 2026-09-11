import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
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
function parseCsvParam(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.get(key) || ''
  if (!raw) return []
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function formatMonthShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    const cacheQuery = Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'range=30d'
    const cacheKey = `vendor:analytics:${userId}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VendorAnalytics-Cache': 'HIT' } })

    const { days, label } = parseRange(searchParams)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const statusFilter = parseCsvParam(searchParams, 'status')
    const fulfillmentFilter = parseCsvParam(searchParams, 'fulfillment')
    const deliveryStatusFilter = parseCsvParam(searchParams, 'deliveryStatus')
    const paymentMethodFilter = parseCsvParam(searchParams, 'paymentMethod')
    const outletFilter = parseCsvParam(searchParams, 'outlet') // outletId or outletName lowercased

    const now = new Date()
    const periodStart = days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const prevPeriodStart = days === 0 ? null : new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000)
    const prevPeriodEnd = periodStart

    // 1. Resolve vendor from user (BFF owns vendor lookup, overrideAccess)
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

    // 2. Merchants for this vendor (outlets)
    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 1,
      overrideAccess: true,
    })
    const merchantsDocs = merchantsRes.docs as unknown as Record<string, unknown>[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))
    const merchantMap = new Map<string, Record<string, unknown>>()
    merchantsDocs.forEach((m: any) => merchantMap.set(String(m.id), m as Record<string, unknown>))

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
        revenueTrend: [],
        orderStatusBreakdown: [],
        fulfillmentMix: [],
        deliveryStatusBreakdown: [],
        paymentMethodBreakdown: [],
        revenueByOutlet: [],
        revenueByCategory: [],
        topProducts: [],
        hourlyDistribution: [],
        weekdayDistribution: [],
        ratingDistribution: [],
      }
      await setCached(cacheKey, emptyBody, 20)
      return NextResponse.json(emptyBody, { headers: { 'X-VendorAnalytics-Cache': 'MISS' } })
    }

    // 3. Orders scoped to vendor merchants
    const ordersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: Array.from(merchantIds) } },
      limit: 3000,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })
    const ordersDocs = ordersRes.docs as unknown as Record<string, unknown>[]
    const orderMap = new Map<string, Record<string, unknown>>()
    ordersDocs.forEach((o: any) => orderMap.set(String(o.id), o as Record<string, unknown>))

    const orderIds = Array.from(new Set(ordersDocs.map((o) => String(o.id))))

    // 4. Transactions for these orders
    const transactionsRes = orderIds.length ? await payload.find({
      collection: 'transactions',
      where: { order: { in: orderIds } },
      limit: 3000,
      depth: 0,
      overrideAccess: true,
    }) : { docs: [] as unknown[] }
    const transactionsDocs = (transactionsRes.docs as unknown as Record<string, unknown>[])
    const paidTransactions = transactionsDocs.filter((t) => String(t.status) === 'paid')
    const refundedTransactions = transactionsDocs.filter((t) => String(t.status) === 'refunded')
    const failedTransactions = transactionsDocs.filter((t) => String(t.status) === 'failed')

    // 5. Order items for product/category analytics
    const orderItemsRes = orderIds.length ? await payload.find({
      collection: 'order-items',
      where: { order: { in: orderIds } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    }) : { docs: [] as unknown[] }
    const orderItemsDocs = orderItemsRes.docs as unknown as Record<string, unknown>[]

    // 6. Reviews for these merchants
    const reviewsRes = await payload.find({
      collection: 'reviews',
      where: { merchant: { in: Array.from(merchantIds) } },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    const reviewsDocs = reviewsRes.docs as unknown as Record<string, unknown>[]

    // 7. Delivery bookings for logistics
    const deliveryBookingsRes = orderIds.length ? await payload.find({
      collection: 'delivery-bookings',
      where: { order: { in: orderIds } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    }) : { docs: [] as unknown[] }
    const deliveryBookingsDocs = deliveryBookingsRes.docs as unknown as Record<string, unknown>[]

    // Product/category maps for product performance
    const productsRes = await payload.find({ collection: 'products', limit: 2000, depth: 0, overrideAccess: true })
    const productMap = new Map<string, Record<string, unknown>>()
    ;(productsRes.docs as unknown as Record<string, unknown>[]).forEach((p: any) => productMap.set(String(p.id), p as Record<string, unknown>))
    const categoriesRes = await payload.find({ collection: 'product-categories', limit: 1000, depth: 0, overrideAccess: true })
    const categoryMap = new Map<string, Record<string, unknown>>()
    ;(categoriesRes.docs as unknown as Record<string, unknown>[]).forEach((c: any) => categoryMap.set(String(c.id), c as Record<string, unknown>))

    // Helpers for period
    function isInCurrentPeriod(doc: Record<string, unknown>, field: string): boolean {
      if (!periodStart) return true
      const raw = String(doc[field] ?? doc.createdAt ?? '')
      if (!raw) return false
      const d = new Date(raw)
      return !isNaN(d.getTime()) && d >= periodStart && d <= now
    }
    function isInPrevPeriod(doc: Record<string, unknown>, field: string): boolean {
      if (!prevPeriodStart || !prevPeriodEnd) return false
      const raw = String(doc[field] ?? doc.createdAt ?? '')
      if (!raw) return false
      const d = new Date(raw)
      return !isNaN(d.getTime()) && d >= prevPeriodStart && d < prevPeriodEnd
    }

    const ordersPeriodCurrent = days === 0 ? ordersDocs : ordersDocs.filter((o) => isInCurrentPeriod(o as Record<string, unknown>, 'createdAt'))
    const ordersPrev = days === 0 ? [] : ordersDocs.filter((o) => isInPrevPeriod(o as Record<string, unknown>, 'createdAt'))
    const paidPeriodCurrent = days === 0 ? paidTransactions : paidTransactions.filter((t) => {
      const raw = String(t.paid_at ?? t.createdAt ?? '')
      const d = new Date(raw)
      return !isNaN(d.getTime()) && d >= (periodStart as Date) && d <= now
    })
    const paidPrev = days === 0 ? [] : paidTransactions.filter((t) => {
      const raw = String(t.paid_at ?? t.createdAt ?? '')
      const d = new Date(raw)
      return !isNaN(d.getTime()) && d >= (prevPeriodStart as Date) && d < (prevPeriodEnd as Date)
    })

    // OrderItems grouped for search
    const orderItemsByOrderId = new Map<string, Record<string, unknown>[]>()
    orderItemsDocs.forEach((oi) => {
      const oid = resolveId(oi.order)
      if (!oid) return
      if (!orderItemsByOrderId.has(oid)) orderItemsByOrderId.set(oid, [])
      orderItemsByOrderId.get(oid)!.push(oi as Record<string, unknown>)
    })

    function outletForOrder(order: Record<string, unknown>): Record<string, unknown> | null {
      const raw = order.merchant as unknown
      const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
      const id = obj ? String(obj.id ?? '') : String(raw ?? '')
      return id ? merchantMap.get(id) || (obj as Record<string, unknown>) || null : null
    }
    function orderMatchesSearch(order: Record<string, unknown>): boolean {
      if (!q) return true
      const oid = String(order.id || '').toLowerCase()
      if (oid.includes(q)) return true
      const outlet = outletForOrder(order)
      if (outlet && getStr(outlet.outletName, '').toLowerCase().includes(q)) return true
      if (outlet && getStr((outlet as any).outletCode, '').toLowerCase().includes(q)) return true
      const items = orderItemsByOrderId.get(String(order.id)) || []
      for (const it of items) {
        if (getStr(it.product_name_snapshot, '').toLowerCase().includes(q)) return true
      }
      return false
    }

    // Apply advanced filters to current period
    let ordersCurrent = ordersPeriodCurrent.filter((o) => {
      if (statusFilter.length && !statusFilter.includes(String(o.status || '').toLowerCase())) return false
      if (fulfillmentFilter.length && !fulfillmentFilter.includes(String(o.fulfillment_type || '').toLowerCase())) return false
      if (deliveryStatusFilter.length && !deliveryStatusFilter.includes(String(o.delivery_status || '').toLowerCase())) return false
      if (outletFilter.length) {
        const outlet = outletForOrder(o as Record<string, unknown>)
        const oid = outlet ? String(outlet.id ?? '').toLowerCase() : ''
        const oname = outlet ? getStr(outlet.outletName, '').toLowerCase() : ''
        if (!outletFilter.includes(oid) && !outletFilter.includes(oname)) return false
      }
      if (!orderMatchesSearch(o as Record<string, unknown>)) return false
      return true
    })
    const allowedOrderIds = new Set(ordersCurrent.map((o) => String((o as any).id)))
    let paidCurrent = paidPeriodCurrent.filter((t) => {
      const oid = resolveId(t.order)
      if (oid && allowedOrderIds.size && !allowedOrderIds.has(oid)) return false
      if (paymentMethodFilter.length) {
        const pm = String((t as any).payment_method || 'unknown').toLowerCase()
        if (!paymentMethodFilter.includes(pm)) return false
      }
      return true
    })

    // Prev filtered for change
    const ordersPrevFiltered = ordersPrev.filter((o) => {
      if (statusFilter.length && !statusFilter.includes(String(o.status || '').toLowerCase())) return false
      if (fulfillmentFilter.length && !fulfillmentFilter.includes(String(o.fulfillment_type || '').toLowerCase())) return false
      if (deliveryStatusFilter.length && !deliveryStatusFilter.includes(String(o.delivery_status || '').toLowerCase())) return false
      if (outletFilter.length) {
        const outlet = outletForOrder(o as Record<string, unknown>)
        const oid = outlet ? String(outlet.id ?? '').toLowerCase() : ''
        const oname = outlet ? getStr(outlet.outletName, '').toLowerCase() : ''
        if (!outletFilter.includes(oid) && !outletFilter.includes(oname)) return false
      }
      if (q && !orderMatchesSearch(o as Record<string, unknown>)) return false
      return true
    })
    const allowedPrevOrderIds = new Set(ordersPrevFiltered.map((o) => String((o as any).id)))
    const paidPrevFiltered = paidPrev.filter((t) => {
      const oid = resolveId(t.order)
      if (oid && allowedPrevOrderIds.size && (statusFilter.length || fulfillmentFilter.length || deliveryStatusFilter.length || outletFilter.length || q)) {
        if (!allowedPrevOrderIds.has(oid)) return false
      }
      if (paymentMethodFilter.length) {
        const pm = String((t as any).payment_method || 'unknown').toLowerCase()
        if (!paymentMethodFilter.includes(pm)) return false
      }
      return true
    })

    // Verified revenue map
    const verifiedRevenueByOrderId = new Map<string, number>()
    paidCurrent.forEach((t) => {
      const oid = resolveId(t.order)
      if (!oid) return
      verifiedRevenueByOrderId.set(oid, (verifiedRevenueByOrderId.get(oid) || 0) + getNum(t.amount))
    })
    const verifiedOrderIds = new Set(verifiedRevenueByOrderId.keys())

    // KPIs
    const totalRevenueCurrent = paidCurrent.reduce((s, t) => s + getNum(t.amount), 0)
    const totalRevenuePrev = paidPrevFiltered.reduce((s, t) => s + getNum(t.amount), 0)
    const totalOrdersCurrent = ordersCurrent.length
    const totalOrdersPrev = ordersPrevFiltered.length
    const aovCurrent = totalOrdersCurrent ? totalRevenueCurrent / totalOrdersCurrent : 0
    const aovPrev = totalOrdersPrev ? totalRevenuePrev / totalOrdersPrev : 0
    const todayStr = daysAgo(0)
    const todayRevenue = paidCurrent.filter((t) => String(t.paid_at ?? '').startsWith(todayStr)).reduce((s, t) => s + getNum(t.amount), 0)
    const pendingOrders = ordersCurrent.filter((o) => String(o.status) === 'pending').length
    const activeOrders = ordersCurrent.filter((o) => ['accepted','preparing','ready_for_pickup','on_delivery'].includes(String(o.status))).length
    const totalOutlets = merchantsDocs.length
    const openOutlets = merchantsDocs.filter((m) => getStr(m.operationalStatus) === 'open').length
    const acceptingOrders = merchantsDocs.filter((m) => (m as any).isAcceptingOrders === true).length
    const vendorAvgRating = (() => {
      const filtered = reviewsDocs.filter((r) => isInCurrentPeriod(r as Record<string, unknown>, 'createdAt'))
      if (!filtered.length) {
        const all = reviewsDocs
        return all.length ? all.reduce((s, r) => s + getNum(r.merchant_rating), 0) / all.length : 0
      }
      return filtered.reduce((s, r) => s + getNum(r.merchant_rating), 0) / filtered.length
    })()

    // Revenue trend (30d or 12m)
    let revenueTrend: { date: string; revenue: number; orders: number }[] = []
    if (days === 0 || days >= 90) {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
        const key = formatMonthShort(d.toISOString())
        const rev = paidCurrent.filter((t) => {
          const dd = new Date(String(t.paid_at ?? t.createdAt ?? ''))
          return dd >= d && dd < next
        }).reduce((s, t) => s + getNum(t.amount), 0)
        const ord = ordersCurrent.filter((o) => {
          const dd = new Date(String(o.createdAt ?? ''))
          return dd >= d && dd < next
        }).length
        revenueTrend.push({ date: key, revenue: rev, orders: ord })
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const ds = daysAgo(i)
        const rev = paidCurrent.filter((t) => String(t.paid_at ?? '').startsWith(ds)).reduce((s, t) => s + getNum(t.amount), 0)
        const ord = ordersCurrent.filter((o) => String(o.createdAt ?? '').startsWith(ds)).length
        revenueTrend.push({ date: formatDate(ds), revenue: rev, orders: ord })
      }
    }

    // Order status breakdown
    const statusMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      const s = getStr(o.status, 'unknown')
      statusMap.set(s, (statusMap.get(s) || 0) + 1)
    })
    const orderStatusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))

    // Fulfillment mix
    const fulfillMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      const f = getStr(o.fulfillment_type, 'unknown')
      fulfillMap.set(f, (fulfillMap.get(f) || 0) + 1)
    })
    const fulfillmentMix = Array.from(fulfillMap.entries()).map(([type, count]) => ({ type, count }))

    // Delivery status
    const deliveryMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      const ds = getStr(o.delivery_status, 'none')
      deliveryMap.set(ds, (deliveryMap.get(ds) || 0) + 1)
    })
    const deliveryStatusBreakdown = Array.from(deliveryMap.entries()).map(([status, count]) => ({ status, count }))

    // Payment method
    const pmMap = new Map<string, number>()
    paidCurrent.forEach((t) => {
      const pm = getStr(t.payment_method, 'unknown')
      pmMap.set(pm, (pmMap.get(pm) || 0) + 1)
    })
    const paymentMethodBreakdown = Array.from(pmMap.entries()).map(([method, count]) => ({ method, count }))

    // Revenue by outlet (vendor's outlets)
    const outletRevenueMap = new Map<string, { outletName: string; revenue: number; orders: number }>()
    verifiedRevenueByOrderId.forEach((rev, oid) => {
      const order = orderMap.get(oid)
      if (!order) return
      const outlet = outletForOrder(order)
      const oid2 = outlet ? String(outlet.id) : 'unknown'
      const name = outlet ? getStr(outlet.outletName, oid2) : 'Unknown'
      const e = outletRevenueMap.get(oid2) || { outletName: name, revenue: 0, orders: 0 }
      e.revenue += rev
      e.orders += 1
      outletRevenueMap.set(oid2, e)
    })
    const revenueByOutlet = Array.from(outletRevenueMap.entries()).map(([outletId, v]) => ({ outletId, ...v })).sort((a, b) => b.revenue - a.revenue)

    // Outlets status grid data
    const todayOrderMap = new Map<string, number>()
    const todayRevenueMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      if (!String(o.createdAt ?? '').startsWith(todayStr)) return
      const outlet = outletForOrder(o as Record<string, unknown>)
      const id = outlet ? String(outlet.id) : ''
      if (!id) return
      todayOrderMap.set(id, (todayOrderMap.get(id) || 0) + 1)
    })
    paidCurrent.forEach((t) => {
      if (!String(t.paid_at ?? '').startsWith(todayStr)) return
      const oid = resolveId(t.order)
      const order = oid ? orderMap.get(oid) : null
      if (!order) return
      const outlet = outletForOrder(order)
      const id = outlet ? String(outlet.id) : ''
      if (!id) return
      todayRevenueMap.set(id, (todayRevenueMap.get(id) || 0) + getNum(t.amount))
    })
    const outlets = merchantsDocs.map((m: any) => ({
      id: String(m.id),
      name: getStr(m.outletName),
      operationalStatus: getStr(m.operationalStatus, 'closed'),
      isAcceptingOrders: !!m.isAcceptingOrders,
      todayOrders: todayOrderMap.get(String(m.id)) || 0,
      todayRevenue: todayRevenueMap.get(String(m.id)) || 0,
      avgDeliveryTime: getNum(m.avg_delivery_time_minutes),
    }))

    // Revenue by category (verified) — reuse categoryMap built earlier

    // Product performance - top products by revenue (verified)
    const productAgg = new Map<string, { name: string; quantity: number; revenue: number; orders: number }>()
    orderItemsDocs.forEach((oi) => {
      const oid = resolveId(oi.order)
      if (!verifiedOrderIds.has(oid)) return
      const name = getStr(oi.product_name_snapshot, 'Unknown')
      const key = String(oi.product ?? name)
      const e = productAgg.get(key) || { name, quantity: 0, revenue: 0, orders: 0 }
      e.quantity += getNum(oi.quantity)
      e.revenue += getNum(oi.total_price)
      e.orders += 1
      productAgg.set(key, e)
    })
    const topProducts = Array.from(productAgg.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8)

    // Category revenue - via product categories
    const catRevenueMap = new Map<string, { category: string; revenue: number; quantity: number }>()
    orderItemsDocs.forEach((oi) => {
      const oid = resolveId(oi.order)
      if (!verifiedOrderIds.has(oid)) return
      const prodRaw: any = oi.product
      const pid = prodRaw && typeof prodRaw === 'object' ? String(prodRaw.id ?? '') : String(prodRaw ?? '')
      const prod = pid ? productMap.get(pid) : null
      const cats: any = prod ? (prod as any).categories : null
      const catIds: string[] = Array.isArray(cats) ? cats.map((c: any) => String(c?.id ?? c ?? '')) : []
      const rev = getNum(oi.total_price)
      const qty = getNum(oi.quantity)
      if (!catIds.length) {
        const e = catRevenueMap.get('uncategorized') || { category: 'uncategorized', revenue: 0, quantity: 0 }
        e.revenue += rev; e.quantity += qty; catRevenueMap.set('uncategorized', e)
      } else {
        catIds.forEach((cid) => {
          const cat = categoryMap.get(cid)
          const cname = cat ? getStr(cat.name, cid) : cid
          const e = catRevenueMap.get(cname) || { category: cname, revenue: 0, quantity: 0 }
          e.revenue += rev; e.quantity += qty; catRevenueMap.set(cname, e)
        })
      }
    })
    const revenueByCategory = Array.from(catRevenueMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8)

    // Hourly / weekday
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }))
    ordersCurrent.forEach((o) => {
      const d = new Date(String(o.createdAt ?? ''))
      if (isNaN(d.getTime())) return
      const h = d.getHours()
      hourly[h].orders += 1
      hourly[h].revenue += verifiedRevenueByOrderId.get(String(o.id)) || 0
    })
    const weekdayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const weekday = Array.from({ length: 7 }, (_, i) => ({ day: weekdayLabels[i], orders: 0, revenue: 0 }))
    ordersCurrent.forEach((o) => {
      const d = new Date(String(o.createdAt ?? ''))
      if (isNaN(d.getTime())) return
      const w = d.getDay()
      weekday[w].orders += 1
      weekday[w].revenue += verifiedRevenueByOrderId.get(String(o.id)) || 0
    })

    // Rating distribution (own reviews filtered by period)
    const ratingBuckets = [1,2,3,4,5].map((r) => ({ rating: r, count: 0 }))
    const periodReviews = days === 0 ? reviewsDocs : reviewsDocs.filter((r) => isInCurrentPeriod(r as Record<string, unknown>, 'createdAt'))
    periodReviews.forEach((r) => {
      const v = Math.round(getNum(r.merchant_rating))
      const b = ratingBuckets.find((x) => x.rating === v)
      if (b) b.count += 1
    })
    const avgRating = periodReviews.length ? periodReviews.reduce((s, r) => s + getNum(r.merchant_rating), 0) / periodReviews.length : 0

    const responseBody = {
      meta: { range: label, days, generatedAt: now.toISOString(), vendorId, vendorName, totalOrdersAllTime: ordersDocs.length, periodStart: periodStart ? periodStart.toISOString() : null, periodEnd: now.toISOString() },
      kpis: {
        totalRevenue: totalRevenueCurrent,
        revenueChange: pctChange(totalRevenueCurrent, totalRevenuePrev),
        todayRevenue,
        totalOrders: totalOrdersCurrent,
        ordersChange: pctChange(totalOrdersCurrent, totalOrdersPrev),
        pendingOrders,
        activeOrders,
        totalOutlets,
        openOutlets,
        acceptingOrders,
        averageRating: Math.round(avgRating * 10) / 10,
        totalReviews: periodReviews.length,
        aov: aovCurrent,
        paidCount: paidCurrent.length,
        refundedCount: refundedTransactions.filter((t) => isInCurrentPeriod(t as Record<string, unknown>, 'createdAt')).length,
        failedCount: failedTransactions.filter((t) => isInCurrentPeriod(t as Record<string, unknown>, 'createdAt')).length,
      },
      outlets,
      revenueTrend,
      orderStatusBreakdown,
      fulfillmentMix,
      deliveryStatusBreakdown,
      paymentMethodBreakdown,
      revenueByOutlet,
      revenueByCategory,
      topProducts,
      hourlyDistribution: hourly,
      weekdayDistribution: weekday,
      ratingDistribution: ratingBuckets,
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-VendorAnalytics-Cache': 'MISS' } })
  } catch (error) {
    console.error('Vendor analytics error:', error)
    return NextResponse.json({ error: 'Failed to load vendor analytics' }, { status: 500 })
  }
}
