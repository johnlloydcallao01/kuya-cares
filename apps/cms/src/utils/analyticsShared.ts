/**
 * Shared filter-core for the split admin analytics endpoints
 * (summary / charts / tops under app/api/admin/analytics/).
 *
 * Logic is copied verbatim from the monolith analytics route so every group
 * produces numbers identical to the single endpoint: same range/search/filter
 * parsing, same period windows, same join + verified-revenue hub.
 * Each group fetches only the collections it needs (all depth: 0) and calls
 * buildAnalyticsCore() to get the shared intermediates.
 */

export type AnalyticsDoc = Record<string, unknown>

export function getNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string') return parseFloat(val) || fallback
  return fallback
}

export function getStr(val: unknown, fallback = ''): string {
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

export function resolveId(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string' || typeof val === 'number') return String(val)
  if (typeof val === 'object' && val !== null && 'id' in (val as Record<string, unknown>))
    return String((val as Record<string, unknown>).id)
  return ''
}

export function parseRange(searchParams: URLSearchParams): { days: number; label: string } {
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

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export function parseCsvParam(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.get(key) || ''
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function daysAgoDateStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0] // YYYY-MM-DD
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatMonthShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export interface AnalyticsParams {
  days: number
  label: string
  q: string
  statusFilter: string[]
  fulfillmentFilter: string[]
  businessTypeFilter: string[]
  paymentMethodFilter: string[]
  vendorStatusFilter: string[]
  deliveryStatusFilter: string[]
  now: Date
  periodStart: Date | null
  prevPeriodStart: Date | null
  prevPeriodEnd: Date | null
}

export function parseAnalyticsParams(searchParams: URLSearchParams): AnalyticsParams {
  const { days, label } = parseRange(searchParams)
  const q = (searchParams.get('q') || '').trim().toLowerCase()
  const now = new Date()
  return {
    days,
    label,
    q,
    statusFilter: parseCsvParam(searchParams, 'status'),
    fulfillmentFilter: parseCsvParam(searchParams, 'fulfillment'),
    businessTypeFilter: parseCsvParam(searchParams, 'businessType'),
    paymentMethodFilter: parseCsvParam(searchParams, 'paymentMethod'),
    vendorStatusFilter: parseCsvParam(searchParams, 'vendorStatus'),
    deliveryStatusFilter: parseCsvParam(searchParams, 'deliveryStatus'),
    now,
    periodStart: days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    prevPeriodStart: days === 0 ? null : new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000),
    prevPeriodEnd: days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
  }
}

export interface AnalyticsDocs {
  vendorsDocs: AnalyticsDoc[]
  merchantsDocs: AnalyticsDoc[]
  ordersDocs: AnalyticsDoc[]
  transactionsDocs: AnalyticsDoc[]
  orderItemsDocs: AnalyticsDoc[]
  productsDocs?: AnalyticsDoc[]
  categoriesDocs?: AnalyticsDoc[]
}

export interface AnalyticsCore extends AnalyticsParams {
  paidTransactions: AnalyticsDoc[]
  refundedTransactions: AnalyticsDoc[]
  failedTransactions: AnalyticsDoc[]
  merchantMap: Map<string, AnalyticsDoc>
  vendorMap: Map<string, AnalyticsDoc>
  productMap: Map<string, AnalyticsDoc>
  categoryMap: Map<string, AnalyticsDoc>
  orderMap: Map<string, AnalyticsDoc>
  ordersCurrent: AnalyticsDoc[]
  paidCurrent: AnalyticsDoc[]
  verifiedRevenueByOrderId: Map<string, number>
  verifiedOrderIdsInPeriod: Set<string>
  ordersPrevFiltered: AnalyticsDoc[]
  paidPrevFiltered: AnalyticsDoc[]
}

function isInCurrentPeriod(
  params: AnalyticsParams,
  doc: AnalyticsDoc,
  dateField: string,
): boolean {
  if (!params.periodStart) return true // all
  const raw = String(doc[dateField] ?? doc.createdAt ?? '')
  if (!raw) return false
  const d = new Date(raw)
  if (isNaN(d.getTime())) return false
  return d >= params.periodStart && d <= params.now
}

function isInPrevPeriod(params: AnalyticsParams, doc: AnalyticsDoc, dateField: string): boolean {
  if (!params.prevPeriodStart || !params.prevPeriodEnd) return false
  const raw = String(doc[dateField] ?? doc.createdAt ?? '')
  if (!raw) return false
  const d = new Date(raw)
  if (isNaN(d.getTime())) return false
  return d >= params.prevPeriodStart && d < params.prevPeriodEnd
}

export function buildAnalyticsCore(params: AnalyticsParams, docs: AnalyticsDocs): AnalyticsCore {
  const { vendorsDocs, merchantsDocs, ordersDocs, transactionsDocs, orderItemsDocs } = docs
  const productsDocs = docs.productsDocs ?? []
  const categoriesDocs = docs.categoriesDocs ?? []

  const paidTransactions = transactionsDocs.filter((t) => String(t.status) === 'paid')
  const refundedTransactions = transactionsDocs.filter((t) => String(t.status) === 'refunded')
  const failedTransactions = transactionsDocs.filter((t) => String(t.status) === 'failed')

  const ordersPeriodCurrent =
    params.days === 0 ? ordersDocs : ordersDocs.filter((o) => isInCurrentPeriod(params, o, 'createdAt'))
  const ordersPrev =
    params.days === 0 ? [] : ordersDocs.filter((o) => isInPrevPeriod(params, o, 'createdAt'))
  const paidPeriodCurrent =
    params.days === 0
      ? paidTransactions
      : paidTransactions.filter((t) => {
          const field = String(t.paid_at ?? t.createdAt ?? '')
          if (!field) return false
          const d = new Date(field)
          if (isNaN(d.getTime())) return false
          return d >= (params.periodStart as Date) && d <= params.now
        })
  const paidPrev =
    params.days === 0
      ? []
      : paidTransactions.filter((t) => {
          const field = String(t.paid_at ?? t.createdAt ?? '')
          if (!field) return false
          const d = new Date(field)
          if (isNaN(d.getTime())) return false
          return d >= (params.prevPeriodStart as Date) && d < (params.prevPeriodEnd as Date)
        })

  const merchantMap = new Map<string, AnalyticsDoc>()
  merchantsDocs.forEach((m) => merchantMap.set(String(m.id), m))
  const vendorMap = new Map<string, AnalyticsDoc>()
  vendorsDocs.forEach((v) => vendorMap.set(String(v.id), v))
  const productMap = new Map<string, AnalyticsDoc>()
  productsDocs.forEach((p) => productMap.set(String(p.id), p))
  const categoryMap = new Map<string, AnalyticsDoc>()
  categoriesDocs.forEach((c) => categoryMap.set(String(c.id), c))
  const orderMap = new Map<string, AnalyticsDoc>()
  ordersDocs.forEach((o) => orderMap.set(String(o.id), o))

  const orderItemsByOrderId = new Map<string, AnalyticsDoc[]>()
  orderItemsDocs.forEach((oi) => {
    const oid = resolveId(oi.order)
    if (!oid) return
    if (!orderItemsByOrderId.has(oid)) orderItemsByOrderId.set(oid, [])
    orderItemsByOrderId.get(oid)!.push(oi)
  })

  function merchantForOrder(order: AnalyticsDoc): AnalyticsDoc | null {
    const raw = order.merchant as unknown
    const obj = raw && typeof raw === 'object' ? (raw as AnalyticsDoc) : null
    const id = obj ? String(obj.id ?? '') : String(raw ?? '')
    return id ? merchantMap.get(id) || obj || null : null
  }
  function vendorForMerchant(merchant: AnalyticsDoc | null): AnalyticsDoc | null {
    if (!merchant) return null
    const raw = merchant.vendor as unknown
    const obj = raw && typeof raw === 'object' ? (raw as AnalyticsDoc) : null
    const id = obj ? String(obj.id ?? '') : String(raw ?? '')
    return id ? vendorMap.get(id) || obj || null : null
  }
  function orderMatchesSearch(order: AnalyticsDoc): boolean {
    if (!params.q) return true
    const oid = String(order.id || '').toLowerCase()
    if (oid.includes(params.q)) return true
    const merchant = merchantForOrder(order)
    if (merchant && getStr(merchant.outletName, '').toLowerCase().includes(params.q)) return true
    const vendor = vendorForMerchant(merchant)
    if (vendor && getStr(vendor.businessName, '').toLowerCase().includes(params.q)) return true
    const items = orderItemsByOrderId.get(String(order.id)) || []
    for (const it of items) {
      if (getStr(it.product_name_snapshot, '').toLowerCase().includes(params.q)) return true
    }
    return false
  }
  function matchesOrderFilters(o: AnalyticsDoc): boolean {
    if (params.statusFilter.length && !params.statusFilter.includes(String(o.status || '').toLowerCase()))
      return false
    if (
      params.fulfillmentFilter.length &&
      !params.fulfillmentFilter.includes(String(o.fulfillment_type || '').toLowerCase())
    )
      return false
    if (
      params.deliveryStatusFilter.length &&
      !params.deliveryStatusFilter.includes(String(o.delivery_status || '').toLowerCase())
    )
      return false
    if (params.businessTypeFilter.length) {
      const merchant = merchantForOrder(o)
      const vendor = vendorForMerchant(merchant)
      const bt = vendor ? String(vendor.businessType || '').toLowerCase() : 'unknown'
      if (!params.businessTypeFilter.includes(bt)) return false
    }
    if (params.vendorStatusFilter.length) {
      const merchant = merchantForOrder(o)
      const vendor = vendorForMerchant(merchant)
      const vs = vendor ? String(vendor.verificationStatus || '').toLowerCase() : 'unknown'
      if (!params.vendorStatusFilter.includes(vs)) return false
    }
    return true
  }

  const ordersCurrent = ordersPeriodCurrent.filter((o) => {
    if (!matchesOrderFilters(o)) return false
    if (!orderMatchesSearch(o)) return false
    return true
  })

  const allowedOrderIds = new Set(ordersCurrent.map((o) => String(o.id)))
  const paidCurrent = paidPeriodCurrent.filter((t) => {
    const oid = resolveId(t.order)
    if (oid && allowedOrderIds.size && !allowedOrderIds.has(oid)) return false
    if (params.paymentMethodFilter.length) {
      const pm = String(t.payment_method || 'unknown').toLowerCase()
      if (!params.paymentMethodFilter.includes(pm)) return false
    }
    return true
  })

  const verifiedRevenueByOrderId = new Map<string, number>()
  paidCurrent.forEach((t) => {
    const orderId = resolveId(t.order)
    if (!orderId) return
    verifiedRevenueByOrderId.set(orderId, (verifiedRevenueByOrderId.get(orderId) || 0) + getNum(t.amount))
  })
  const verifiedOrderIdsInPeriod = new Set(verifiedRevenueByOrderId.keys())

  const ordersPrevFiltered = ordersPrev.filter((o) => {
    if (!matchesOrderFilters(o)) return false
    if (params.q && !orderMatchesSearch(o)) return false
    return true
  })
  const allowedPrevOrderIds = new Set(ordersPrevFiltered.map((o) => String(o.id)))
  const paidPrevFiltered = paidPrev.filter((t) => {
    const oid = resolveId(t.order)
    if (
      oid &&
      allowedPrevOrderIds.size &&
      params.businessTypeFilter.length +
        params.vendorStatusFilter.length +
        params.statusFilter.length +
        params.fulfillmentFilter.length +
        params.deliveryStatusFilter.length +
        (params.q ? 1 : 0) >
        0
    ) {
      if (!allowedPrevOrderIds.has(oid)) return false
    }
    if (params.paymentMethodFilter.length) {
      const pm = String(t.payment_method || 'unknown').toLowerCase()
      if (!params.paymentMethodFilter.includes(pm)) return false
    }
    return true
  })

  return {
    ...params,
    paidTransactions,
    refundedTransactions,
    failedTransactions,
    merchantMap,
    vendorMap,
    productMap,
    categoryMap,
    orderMap,
    ordersCurrent,
    paidCurrent,
    verifiedRevenueByOrderId,
    verifiedOrderIdsInPeriod,
    ordersPrevFiltered,
    paidPrevFiltered,
  }
}

/** Canonical cache-query string shared by all analytics group routes. */
export function buildAnalyticsCacheQuery(searchParams: URLSearchParams): string {
  return (
    Array.from(searchParams.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'range=30d'
  )
}
