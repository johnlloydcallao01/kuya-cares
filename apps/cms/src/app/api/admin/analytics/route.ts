import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached } from '@encreasl/cache'

// Helpers
function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}
function daysAgoDateStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0] // YYYY-MM-DD
}
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function formatMonthShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
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

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function parseCsvParam(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.get(key) || ''
  if (!raw) return []
  return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
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
    const cacheKey = `admin:analytics:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Analytics-Cache': 'HIT' } })

    const { days, label } = parseRange(searchParams)

    // Search + advanced filters (all optional, AND combined)
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const statusFilter = parseCsvParam(searchParams, 'status') // order status
    const fulfillmentFilter = parseCsvParam(searchParams, 'fulfillment')
    const businessTypeFilter = parseCsvParam(searchParams, 'businessType')
    const paymentMethodFilter = parseCsvParam(searchParams, 'paymentMethod')
    const vendorStatusFilter = parseCsvParam(searchParams, 'vendorStatus') // vendor verification
    const deliveryStatusFilter = parseCsvParam(searchParams, 'deliveryStatus')

    // Thresholds
    const now = new Date()
    const periodStart = days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const prevPeriodStart = days === 0 ? null : new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000)
    const prevPeriodEnd = periodStart

    // Fetch all collections in parallel (BFF aggregation)
    const [
      vendorsRes,
      merchantsRes,
      ordersRes,
      driversRes,
      customersRes,
      transactionsRes,
      orderItemsRes,
      reviewsRes,
      cartItemsRes,
      deliveryBookingsRes,
      productsRes,
      productCategoriesRes,
      wishlistsRes,
    ] = await Promise.all([
      payload.find({ collection: 'vendors', limit: 2000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'merchants', limit: 2000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'orders', limit: 3000, sort: '-createdAt', depth: 1, overrideAccess: true }),
      payload.find({ collection: 'drivers', limit: 2000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'customers', limit: 2000, overrideAccess: true }),
      payload.find({ collection: 'transactions', limit: 3000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'order-items', limit: 5000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'reviews', limit: 2000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'cart-items', limit: 3000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'delivery-bookings', limit: 2000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'products', limit: 2000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'product-categories', limit: 1000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'wishlists', limit: 2000, depth: 0, overrideAccess: true }),
    ])

    const vendorsDocs = vendorsRes.docs as unknown as Record<string, unknown>[]
    const merchantsDocs = merchantsRes.docs as unknown as Record<string, unknown>[]
    const ordersDocs = ordersRes.docs as unknown as Record<string, unknown>[]
    const driversDocs = driversRes.docs as unknown as Record<string, unknown>[]
    const customersDocs = customersRes.docs as unknown as Record<string, unknown>[]
    const transactionsDocs = transactionsRes.docs as unknown as Record<string, unknown>[]
    const orderItemsDocs = orderItemsRes.docs as unknown as Record<string, unknown>[]
    const reviewsDocs = reviewsRes.docs as unknown as Record<string, unknown>[]
    const cartItemsDocs = cartItemsRes.docs as unknown as Record<string, unknown>[]
    const deliveryBookingsDocs = deliveryBookingsRes.docs as unknown as Record<string, unknown>[]
    const productsDocs = productsRes.docs as unknown as Record<string, unknown>[]
    const categoriesDocs = productCategoriesRes.docs as unknown as Record<string, unknown>[]

    const paidTransactions = transactionsDocs.filter((t) => String(t.status) === 'paid')
    const refundedTransactions = transactionsDocs.filter((t) => String(t.status) === 'refunded')
    const failedTransactions = transactionsDocs.filter((t) => String(t.status) === 'failed')

    // Helpers to check if doc is inside current/prev period
    function isInCurrentPeriod(doc: Record<string, unknown>, dateField: string): boolean {
      if (!periodStart) return true // all
      const raw = String(doc[dateField] ?? doc.createdAt ?? '')
      if (!raw) return false
      const d = new Date(raw)
      if (isNaN(d.getTime())) return false
      return d >= periodStart && d <= now
    }
    function isInPrevPeriod(doc: Record<string, unknown>, dateField: string): boolean {
      if (!prevPeriodStart || !prevPeriodEnd) return false
      const raw = String(doc[dateField] ?? doc.createdAt ?? '')
      if (!raw) return false
      const d = new Date(raw)
      if (isNaN(d.getTime())) return false
      return d >= prevPeriodStart && d < prevPeriodEnd
    }

    // Period-filtered sets (before search/advanced filters — prev period stays unfiltered for change calc)
    const ordersPeriodCurrent = days === 0 ? ordersDocs : ordersDocs.filter((o) => isInCurrentPeriod(o, 'createdAt'))
    const ordersPrev = days === 0 ? [] : ordersDocs.filter((o) => isInPrevPeriod(o, 'createdAt'))
    const paidPeriodCurrent = days === 0 ? paidTransactions : paidTransactions.filter((t) => {
      const field = String(t.paid_at ?? t.createdAt ?? '')
      if (!field) return false
      const d = new Date(field)
      if (isNaN(d.getTime())) return false
      return d >= (periodStart as Date) && d <= now
    })
    const paidPrev = days === 0 ? [] : paidTransactions.filter((t) => {
      const field = String(t.paid_at ?? t.createdAt ?? '')
      if (!field) return false
      const d = new Date(field)
      if (isNaN(d.getTime())) return false
      return d >= (prevPeriodStart as Date) && d < (prevPeriodEnd as Date)
    })

    // Maps for lookups (needed before filtering)
    const merchantMap = new Map<string, Record<string, unknown>>()
    merchantsDocs.forEach((m: any) => merchantMap.set(String(m.id), m as Record<string, unknown>))
    const vendorMap = new Map<string, Record<string, unknown>>()
    vendorsDocs.forEach((v: any) => vendorMap.set(String(v.id), v as Record<string, unknown>))
    const productMap = new Map<string, Record<string, unknown>>()
    productsDocs.forEach((p: any) => productMap.set(String(p.id), p as Record<string, unknown>))
    const categoryMap = new Map<string, Record<string, unknown>>()
    categoriesDocs.forEach((c: any) => categoryMap.set(String(c.id), c as Record<string, unknown>))
    const orderMap = new Map<string, Record<string, unknown>>()
    ordersDocs.forEach((o: any) => orderMap.set(String(o.id), o as Record<string, unknown>))

    // OrderItems grouped for search
    const orderItemsByOrderId = new Map<string, Record<string, unknown>[]>()
    orderItemsDocs.forEach((oi) => {
      const oid = resolveId(oi.order)
      if (!oid) return
      if (!orderItemsByOrderId.has(oid)) orderItemsByOrderId.set(oid, [])
      orderItemsByOrderId.get(oid)!.push(oi as Record<string, unknown>)
    })

    // Helpers for advanced filtering
    function merchantForOrder(order: Record<string, unknown>): Record<string, unknown> | null {
      const raw = order.merchant as unknown
      const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
      const id = obj ? String(obj.id ?? '') : String(raw ?? '')
      return id ? merchantMap.get(id) || (obj as Record<string, unknown>) || null : null
    }
    function vendorForMerchant(merchant: Record<string, unknown> | null): Record<string, unknown> | null {
      if (!merchant) return null
      const raw = (merchant as any).vendor as unknown
      const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
      const id = obj ? String(obj.id ?? '') : String(raw ?? '')
      return id ? vendorMap.get(id) || (obj as Record<string, unknown>) || null : null
    }
    function orderMatchesSearch(order: Record<string, unknown>): boolean {
      if (!q) return true
      const oid = String(order.id || '').toLowerCase()
      if (oid.includes(q)) return true
      const merchant = merchantForOrder(order)
      if (merchant && getStr(merchant.outletName, '').toLowerCase().includes(q)) return true
      const vendor = vendorForMerchant(merchant)
      if (vendor && getStr(vendor.businessName, '').toLowerCase().includes(q)) return true
      const items = orderItemsByOrderId.get(String(order.id)) || []
      for (const it of items) {
        if (getStr(it.product_name_snapshot, '').toLowerCase().includes(q)) return true
      }
      return false
    }

    // Apply advanced filters + search to current period orders
    let ordersCurrent = ordersPeriodCurrent.filter((o) => {
      if (statusFilter.length && !statusFilter.includes(String(o.status || '').toLowerCase())) return false
      if (fulfillmentFilter.length && !fulfillmentFilter.includes(String(o.fulfillment_type || '').toLowerCase())) return false
      if (deliveryStatusFilter.length && !deliveryStatusFilter.includes(String(o.delivery_status || '').toLowerCase())) return false
      if (businessTypeFilter.length) {
        const merchant = merchantForOrder(o as Record<string, unknown>)
        const vendor = vendorForMerchant(merchant)
        const bt = vendor ? String((vendor as any).businessType || '').toLowerCase() : 'unknown'
        if (!businessTypeFilter.includes(bt)) return false
      }
      if (vendorStatusFilter.length) {
        const merchant = merchantForOrder(o as Record<string, unknown>)
        const vendor = vendorForMerchant(merchant)
        const vs = vendor ? String((vendor as any).verificationStatus || '').toLowerCase() : 'unknown'
        if (!vendorStatusFilter.includes(vs)) return false
      }
      if (!orderMatchesSearch(o as Record<string, unknown>)) return false
      return true
    })

    // Filter paid transactions to ordersCurrent + paymentMethod filter
    const allowedOrderIds = new Set(ordersCurrent.map((o) => String((o as any).id)))
    let paidCurrent = paidPeriodCurrent.filter((t) => {
      const oid = resolveId(t.order)
      if (oid && allowedOrderIds.size && !allowedOrderIds.has(oid)) return false
      if (paymentMethodFilter.length) {
        const pm = String((t as any).payment_method || 'unknown').toLowerCase()
        if (!paymentMethodFilter.includes(pm)) return false
      }
      // also enforce search/product filter already via allowedOrderIds (product search narrows ordersCurrent)
      return true
    })

    // Verified revenue map: orderId -> sum of paid transaction amounts in current period (by paid_at) — after filters
    const verifiedRevenueByOrderId = new Map<string, number>()
    paidCurrent.forEach((t) => {
      const orderId = resolveId(t.order)
      if (!orderId) return
      verifiedRevenueByOrderId.set(orderId, (verifiedRevenueByOrderId.get(orderId) || 0) + getNum(t.amount))
    })
    const verifiedOrderIdsInPeriod = new Set(verifiedRevenueByOrderId.keys())

    // Also filter prev period for fair pctChange comparison (same search/filters)
    const ordersPrevFiltered = ordersPrev.filter((o) => {
      if (statusFilter.length && !statusFilter.includes(String(o.status || '').toLowerCase())) return false
      if (fulfillmentFilter.length && !fulfillmentFilter.includes(String(o.fulfillment_type || '').toLowerCase())) return false
      if (deliveryStatusFilter.length && !deliveryStatusFilter.includes(String(o.delivery_status || '').toLowerCase())) return false
      if (businessTypeFilter.length) {
        const merchant = merchantForOrder(o as Record<string, unknown>)
        const vendor = vendorForMerchant(merchant)
        const bt = vendor ? String((vendor as any).businessType || '').toLowerCase() : 'unknown'
        if (!businessTypeFilter.includes(bt)) return false
      }
      if (vendorStatusFilter.length) {
        const merchant = merchantForOrder(o as Record<string, unknown>)
        const vendor = vendorForMerchant(merchant)
        const vs = vendor ? String((vendor as any).verificationStatus || '').toLowerCase() : 'unknown'
        if (!vendorStatusFilter.includes(vs)) return false
      }
      if (q) {
        // reuse search logic for prev as well
        if (!orderMatchesSearch(o as Record<string, unknown>)) return false
      }
      return true
    })
    const allowedPrevOrderIds = new Set(ordersPrevFiltered.map((o) => String((o as any).id)))
    const paidPrevFiltered = paidPrev.filter((t) => {
      const oid = resolveId(t.order)
      if (oid && allowedPrevOrderIds.size && businessTypeFilter.length + vendorStatusFilter.length + statusFilter.length + fulfillmentFilter.length + deliveryStatusFilter.length + (q ? 1 : 0) > 0) {
        if (!allowedPrevOrderIds.has(oid)) return false
      }
      if (paymentMethodFilter.length) {
        const pm = String((t as any).payment_method || 'unknown').toLowerCase()
        if (!paymentMethodFilter.includes(pm)) return false
      }
      return true
    })

    // KPIs — revenue is verified transaction based
    const totalRevenueCurrent = paidCurrent.reduce((s, t) => s + getNum(t.amount), 0)
    const totalRevenuePrev = paidPrevFiltered.reduce((s, t) => s + getNum(t.amount), 0)
    const totalOrdersCurrent = ordersCurrent.length
    const totalOrdersPrev = ordersPrevFiltered.length
    const paidOrdersCurrent = new Set(paidCurrent.map((t) => resolveId(t.order)).filter(Boolean)).size
    const paidOrdersPrev = new Set(paidPrevFiltered.map((t) => resolveId(t.order)).filter(Boolean)).size
    const aovCurrent = totalOrdersCurrent > 0 ? totalRevenueCurrent / totalOrdersCurrent : 0
    const verifiedAovCurrent = paidOrdersCurrent > 0 ? totalRevenueCurrent / paidOrdersCurrent : 0
    const aovPrev = totalOrdersPrev > 0 ? totalRevenuePrev / totalOrdersPrev : 0
    const refundRateCurrent = transactionsDocs.length > 0 ? (refundedTransactions.filter((t) => isInCurrentPeriod(t, 'createdAt')).length / Math.max(1, ordersCurrent.length)) * 100 : 0

    const activeMerchants = merchantsDocs.filter((m: any) => m.isActive === true).length
    const totalVendorsActive = vendorsDocs.filter((v: any) => v.isActive === true).length
    const totalCustomers = customersDocs.length
    const newCustomersCurrent = days === 0 ? totalCustomers : customersDocs.filter((c: any) => isInCurrentPeriod(c as Record<string, unknown>, 'createdAt')).length
    const newCustomersPrev = days === 0 ? 0 : customersDocs.filter((c: any) => isInPrevPeriod(c as Record<string, unknown>, 'createdAt')).length

    // Revenue trend
    let revenueTrend: { date: string; revenue: number; orders: number; aov: number }[] = []
    if (days === 0 || days >= 90) {
      // Monthly buckets last 12 months
      const months = days === 0 ? 12 : 12
      for (let i = months - 1; i >= 0; i--) {
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

    // Order status breakdown (current period)
    const statusMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      const s = getStr(o.status, 'unknown')
      statusMap.set(s, (statusMap.get(s) || 0) + 1)
    })
    const orderStatusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))

    // Fulfillment mix
    const fulfillmentMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      const f = getStr(o.fulfillment_type, 'unknown')
      fulfillmentMap.set(f, (fulfillmentMap.get(f) || 0) + 1)
    })
    const fulfillmentMix = Array.from(fulfillmentMap.entries()).map(([type, count]) => ({ type, count }))

    // Delivery status breakdown (ordersCurrent delivery_status or bookings)
    const deliveryStatusMap = new Map<string, number>()
    ordersCurrent.forEach((o) => {
      const ds = getStr(o.delivery_status, 'none')
      deliveryStatusMap.set(ds, (deliveryStatusMap.get(ds) || 0) + 1)
    })
    const deliveryStatusBreakdown = Array.from(deliveryStatusMap.entries()).map(([status, count]) => ({ status, count }))
    // Alternative booking status
    const bookingStatusMap = new Map<string, number>()
    deliveryBookingsDocs.forEach((b) => {
      const s = getStr(b.status, 'unknown')
      // only count bookings whose order is in current period
      const orderId = resolveId(b.order)
      const order = orderId ? ordersDocs.find((o) => String(o.id) === orderId) : null
      if (!order) return
      if (days !== 0 && !isInCurrentPeriod(order, 'createdAt')) return
      bookingStatusMap.set(s, (bookingStatusMap.get(s) || 0) + 1)
    })
    const bookingStatusBreakdown = Array.from(bookingStatusMap.entries()).map(([status, count]) => ({ status, count }))

    // Payment method & transaction status
    const paymentMethodMap = new Map<string, number>()
    const txStatusMap = new Map<string, number>()
    transactionsDocs.filter((t) => isInCurrentPeriod(t, 'createdAt')).forEach((t) => {
      const pm = getStr(t.payment_method, 'unknown')
      paymentMethodMap.set(pm, (paymentMethodMap.get(pm) || 0) + 1)
      const st = getStr(t.status, 'unknown')
      txStatusMap.set(st, (txStatusMap.get(st) || 0) + 1)
    })
    const paymentMethodBreakdown = Array.from(paymentMethodMap.entries()).map(([method, count]) => ({ method, count }))
    const transactionStatusBreakdown = Array.from(txStatusMap.entries()).map(([status, count]) => ({ status, count }))

    // Revenue by businessType (vendor.businessType) — verified revenue only
    const revenueByBusinessTypeMap = new Map<string, { revenue: number; orders: number }>()
    verifiedRevenueByOrderId.forEach((rev, orderId) => {
      const order = orderMap.get(orderId)
      if (!order) return
      const merchantRaw = order.merchant as unknown
      const merchantObj = merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as Record<string, unknown>) : null
      const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
      const merchant = merchantId ? merchantMap.get(merchantId) : null
      const vendorRaw = merchant ? (merchant.vendor as unknown) : null
      const vendorObj = vendorRaw && typeof vendorRaw === 'object' ? (vendorRaw as Record<string, unknown>) : null
      const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
      const vendor = vendorId ? vendorMap.get(vendorId) : null
      const btype = vendor ? getStr(vendor.businessType, 'other') : 'unknown'
      const entry = revenueByBusinessTypeMap.get(btype) || { revenue: 0, orders: 0 }
      entry.revenue += rev
      entry.orders += 1
      revenueByBusinessTypeMap.set(btype, entry)
    })
    const revenueByBusinessType = Array.from(revenueByBusinessTypeMap.entries()).map(([businessType, v]) => ({ businessType, ...v }))

    // Revenue by category (via orderItems) — only verified paid orders
    const categoryRevenueMap = new Map<string, { revenue: number; quantity: number }>()
    orderItemsDocs.forEach((oi) => {
      const orderId = resolveId(oi.order)
      if (!verifiedOrderIdsInPeriod.has(orderId)) return
      const productRaw = oi.product as unknown
      const prodId = productRaw && typeof productRaw === 'object' ? String((productRaw as any).id ?? '') : String(productRaw ?? '')
      const product = prodId ? productMap.get(prodId) : null
      if (!product) return
      const cats = product.categories as unknown
      const catIds: string[] = Array.isArray(cats) ? cats.map((c: any) => String(c?.id ?? c ?? '')) : []
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
    const revenueByCategory = Array.from(categoryRevenueMap.entries()).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 8)

    // Top products — only verified paid orders (revenue = snapshot total_price, but filtered to paid)
    const productAgg = new Map<string, { name: string; revenue: number; quantity: number; orders: number }>()
    orderItemsDocs.forEach((oi) => {
      const orderId = resolveId(oi.order)
      if (!verifiedOrderIdsInPeriod.has(orderId)) return
      const name = getStr(oi.product_name_snapshot, 'Unknown')
      const key = getStr(oi.product, name) || name
      const existing = productAgg.get(key) || { name, revenue: 0, quantity: 0, orders: 0 }
      existing.revenue += getNum(oi.total_price)
      existing.quantity += getNum(oi.quantity)
      existing.orders += 1
      productAgg.set(key, existing)
    })
    const topProducts = Array.from(productAgg.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

    // Top merchants — verified revenue only (group paid transactions by order->merchant)
    const merchantAgg = new Map<string, { name: string; orders: number; revenue: number; rating: number }>()
    verifiedRevenueByOrderId.forEach((rev, orderId) => {
      const order = orderMap.get(orderId)
      if (!order) return
      const merchantRaw = order.merchant as unknown
      const merchantObj = merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as Record<string, unknown>) : null
      const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
      if (!merchantId || merchantId === 'undefined') return
      const merchantName = getStr(merchantObj?.outletName, `Merchant #${merchantId}`)
      const existing = merchantAgg.get(merchantId) || { name: merchantName, orders: 0, revenue: 0, rating: 0 }
      existing.orders += 1
      existing.revenue += rev
      merchantAgg.set(merchantId, existing)
    })
    // Enrich with rating/name from merchant docs and ensure all merchants with zero revenue still appear if they have ordersCurrent but no paid tx? we keep only verified, so no zero rows
    merchantsDocs.forEach((m: any) => {
      const id = String(m.id)
      const e = merchantAgg.get(id)
      if (e) { e.rating = getNum(m.ratingAverage); e.name = getStr(m.outletName, e.name) }
    })
    const topMerchants = Array.from(merchantAgg.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 10)

    // Top vendors — verified revenue aggregated through merchants
    const vendorAgg = new Map<string, { orders: number; revenue: number }>()
    merchantAgg.forEach((data, merchantId) => {
      const merch = merchantMap.get(merchantId)
      if (!merch) return
      const vendorRaw = merch.vendor as unknown
      const vendorObj = vendorRaw && typeof vendorRaw === 'object' ? (vendorRaw as Record<string, unknown>) : null
      const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
      if (!vendorId || vendorId === 'undefined') return
      const e = vendorAgg.get(vendorId) || { orders: 0, revenue: 0 }
      e.orders += data.orders
      e.revenue += data.revenue
      vendorAgg.set(vendorId, e)
    })
    const topVendors = vendorsDocs
      .map((v: any) => {
        const id = String(v.id)
        const comp = vendorAgg.get(id) || { orders: 0, revenue: 0 }
        return { id, businessName: getStr(v.businessName), orders: comp.orders, revenue: comp.revenue, totalMerchants: getNum(v.totalMerchants), averageRating: getNum(v.averageRating), verificationStatus: getStr(v.verificationStatus, 'unknown') }
      })
      .filter((v) => v.orders > 0) // only vendors with verified revenue in range
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    // Hourly distribution — orders by createdAt hour, revenue = verified amount attributed to order's hour
    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: 0, revenue: 0 }))
    ordersCurrent.forEach((o) => {
      const raw = String(o.createdAt ?? o.placed_at ?? '')
      const d = new Date(raw)
      if (isNaN(d.getTime())) return
      const h = d.getHours()
      hourly[h].orders += 1
      const rev = verifiedRevenueByOrderId.get(String(o.id)) || 0
      hourly[h].revenue += rev
    })

    // Weekday distribution — verified revenue
    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weekday = Array.from({ length: 7 }, (_, i) => ({ day: weekdayLabels[i], orders: 0, revenue: 0 }))
    ordersCurrent.forEach((o) => {
      const raw = String(o.createdAt ?? '')
      const d = new Date(raw)
      if (isNaN(d.getTime())) return
      const w = d.getDay()
      weekday[w].orders += 1
      const rev = verifiedRevenueByOrderId.get(String(o.id)) || 0
      weekday[w].revenue += rev
    })

    // Cart funnel
    const cartStatusMap = new Map<string, number>()
    cartItemsDocs.forEach((c) => {
      const s = getStr(c.status, 'unknown')
      cartStatusMap.set(s, (cartStatusMap.get(s) || 0) + 1)
    })
    // Filter carts to current period by createdAt
    const cartCurrent = cartItemsDocs.filter((c) => isInCurrentPeriod(c, 'createdAt'))
    const cartAbandonmentRate = (() => {
      const abandoned = cartStatusMap.get('abandoned') || 0
      const total = cartItemsDocs.length
      return total ? (abandoned / total) * 100 : 0
    })()

    // Wishlists
    const wishlistCount = wishlistsRes.totalDocs || wishlistsRes.docs.length

    // Reviews rating
    const ratingBuckets = [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: 0 }))
    const merchantRatingSum: Map<number, { sum: number; cnt: number }> = new Map()
    reviewsDocs.filter((r) => days === 0 || isInCurrentPeriod(r, 'createdAt')).forEach((r) => {
      const v = Math.round(getNum(r.merchant_rating))
      const b = ratingBuckets.find((x) => x.rating === v)
      if (b) b.count += 1
    })
    const avgMerchantRating = (() => {
      const filtered = reviewsDocs.filter((r) => days === 0 || isInCurrentPeriod(r, 'createdAt'))
      if (!filtered.length) return 0
      const sum = filtered.reduce((s, r) => s + getNum(r.merchant_rating), 0)
      return sum / filtered.length
    })()

    // Driver status
    const driverStatusMap = new Map<string, number>()
    driversDocs.forEach((d) => {
      const s = getStr(d.status, 'unknown')
      driverStatusMap.set(s, (driverStatusMap.get(s) || 0) + 1)
    })
    const driverStatusBreakdown = Array.from(driverStatusMap.entries()).map(([status, count]) => ({ status, count }))

    // Vendor verification breakdown
    const vendorVerificationMap = new Map<string, number>()
    vendorsDocs.forEach((v: any) => {
      const s = getStr(v.verificationStatus, 'unknown')
      vendorVerificationMap.set(s, (vendorVerificationMap.get(s) || 0) + 1)
    })
    const vendorVerificationBreakdown = Array.from(vendorVerificationMap.entries()).map(([status, count]) => ({ status, count }))

    const kpis = {
      totalRevenue: totalRevenueCurrent,
      totalOrders: totalOrdersCurrent,
      aov: aovCurrent,
      activeMerchants,
      totalVendors: vendorsDocs.length,
      totalCustomers,
      newCustomers: newCustomersCurrent,
      paidTransactions: paidCurrent.length,
      refundedTransactions: refundedTransactions.filter((t) => isInCurrentPeriod(t, 'createdAt')).length,
      failedTransactions: failedTransactions.filter((t) => isInCurrentPeriod(t, 'createdAt')).length,
      wishlistCount,
      avgRating: avgMerchantRating,
      revenueChange: pctChange(totalRevenueCurrent, totalRevenuePrev),
      ordersChange: pctChange(totalOrdersCurrent, totalOrdersPrev),
      aovChange: pctChange(aovCurrent, aovPrev),
      customersChange: pctChange(newCustomersCurrent, newCustomersPrev),
      totalRevenueAllTime: paidTransactions.reduce((s, t) => s + getNum(t.amount), 0),
      totalOrdersAllTime: ordersDocs.length,
    }

    const funnel = {
      cartByStatus: Array.from(cartStatusMap.entries()).map(([status, count]) => ({ status, count })),
      cartCurrentByStatus: (() => {
        const m = new Map<string, number>()
        cartCurrent.forEach((c) => {
          const s = getStr(c.status, 'unknown')
          m.set(s, (m.get(s) || 0) + 1)
        })
        return Array.from(m.entries()).map(([status, count]) => ({ status, count }))
      })(),
      abandonmentRate: cartAbandonmentRate,
      totalCarts: cartItemsDocs.length,
      totalCartsCurrent: cartCurrent.length,
    }

    const response = {
      meta: { range: label, days, generatedAt: now.toISOString(), totalOrdersAllTime: ordersDocs.length },
      kpis,
      revenueTrend,
      orderStatusBreakdown,
      fulfillmentMix,
      deliveryStatusBreakdown,
      bookingStatusBreakdown,
      paymentMethodBreakdown,
      transactionStatusBreakdown,
      revenueByBusinessType,
      revenueByCategory,
      topProducts,
      topMerchants,
      topVendors,
      hourlyDistribution: hourly,
      weekdayDistribution: weekday,
      ratingDistribution: ratingBuckets,
      vendorVerificationBreakdown,
      driverStatusBreakdown,
      funnel,
    }
    await setCached(cacheKey, response, 30)
    return NextResponse.json(response, { headers: { 'X-Analytics-Cache': 'MISS' } })
    } catch (error) {
      console.error('Analytics aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 })
    }
  })
}
