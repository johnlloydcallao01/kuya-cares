/**
 * Shared filter-core for the split vendor analytics endpoints
 * (summary / charts / tops under app/api/vendor/analytics/).
 *
 * Logic is copied verbatim from the monolith vendor analytics route so every
 * group produces numbers identical to the single endpoint: same range/search/
 * filter parsing, same period windows, same outlet join + verified-revenue hub.
 * Each group fetches only the collections it needs (all depth: 0) and calls
 * buildVendorAnalyticsCore() to get the shared intermediates.
 */

export type VendorDoc = Record<string, unknown>

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

export function parseCsvParam(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.get(key) || ''
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatMonthShort(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

export interface VendorAnalyticsParams {
  days: number
  label: string
  q: string
  statusFilter: string[]
  fulfillmentFilter: string[]
  deliveryStatusFilter: string[]
  paymentMethodFilter: string[]
  outletFilter: string[]
  now: Date
  periodStart: Date | null
  prevPeriodStart: Date | null
  prevPeriodEnd: Date | null
}

export function parseVendorAnalyticsParams(searchParams: URLSearchParams): VendorAnalyticsParams {
  const { days, label } = parseRange(searchParams)
  const now = new Date()
  return {
    days,
    label,
    q: (searchParams.get('q') || '').trim().toLowerCase(),
    statusFilter: parseCsvParam(searchParams, 'status'),
    fulfillmentFilter: parseCsvParam(searchParams, 'fulfillment'),
    deliveryStatusFilter: parseCsvParam(searchParams, 'deliveryStatus'),
    paymentMethodFilter: parseCsvParam(searchParams, 'paymentMethod'),
    outletFilter: parseCsvParam(searchParams, 'outlet'),
    now,
    periodStart: days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    prevPeriodStart: days === 0 ? null : new Date(now.getTime() - days * 2 * 24 * 60 * 60 * 1000),
    prevPeriodEnd: days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
  }
}

export interface VendorAnalyticsDocs {
  merchantsDocs: VendorDoc[]
  ordersDocs: VendorDoc[]
  transactionsDocs: VendorDoc[]
  orderItemsDocs: VendorDoc[]
  productsDocs?: VendorDoc[]
  categoriesDocs?: VendorDoc[]
}

export interface VendorAnalyticsCore extends VendorAnalyticsParams {
  paidTransactions: VendorDoc[]
  refundedTransactions: VendorDoc[]
  failedTransactions: VendorDoc[]
  merchantMap: Map<string, VendorDoc>
  productMap: Map<string, VendorDoc>
  categoryMap: Map<string, VendorDoc>
  orderMap: Map<string, VendorDoc>
  ordersCurrent: VendorDoc[]
  paidCurrent: VendorDoc[]
  verifiedRevenueByOrderId: Map<string, number>
  verifiedOrderIds: Set<string>
  ordersPrevFiltered: VendorDoc[]
  paidPrevFiltered: VendorDoc[]
}

export function isInCurrentPeriod(
  params: VendorAnalyticsParams,
  doc: VendorDoc,
  field: string,
): boolean {
  if (!params.periodStart) return true
  const raw = String(doc[field] ?? doc.createdAt ?? '')
  if (!raw) return false
  const d = new Date(raw)
  return !isNaN(d.getTime()) && d >= params.periodStart && d <= params.now
}

function isInPrevPeriod(params: VendorAnalyticsParams, doc: VendorDoc, field: string): boolean {
  if (!params.prevPeriodStart || !params.prevPeriodEnd) return false
  const raw = String(doc[field] ?? doc.createdAt ?? '')
  if (!raw) return false
  const d = new Date(raw)
  return !isNaN(d.getTime()) && d >= params.prevPeriodStart && d < params.prevPeriodEnd
}

export function buildVendorAnalyticsCore(
  params: VendorAnalyticsParams,
  docs: VendorAnalyticsDocs,
): VendorAnalyticsCore {
  const { merchantsDocs, ordersDocs, transactionsDocs, orderItemsDocs } = docs
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
          const raw = String(t.paid_at ?? t.createdAt ?? '')
          const d = new Date(raw)
          return !isNaN(d.getTime()) && d >= (params.periodStart as Date) && d <= params.now
        })
  const paidPrev =
    params.days === 0
      ? []
      : paidTransactions.filter((t) => {
          const raw = String(t.paid_at ?? t.createdAt ?? '')
          const d = new Date(raw)
          return !isNaN(d.getTime()) && d >= (params.prevPeriodStart as Date) && d < (params.prevPeriodEnd as Date)
        })

  const merchantMap = new Map<string, VendorDoc>()
  merchantsDocs.forEach((m) => merchantMap.set(String(m.id), m))
  const productMap = new Map<string, VendorDoc>()
  productsDocs.forEach((p) => productMap.set(String(p.id), p))
  const categoryMap = new Map<string, VendorDoc>()
  categoriesDocs.forEach((c) => categoryMap.set(String(c.id), c))
  const orderMap = new Map<string, VendorDoc>()
  ordersDocs.forEach((o) => orderMap.set(String(o.id), o))

  const orderItemsByOrderId = new Map<string, VendorDoc[]>()
  orderItemsDocs.forEach((oi) => {
    const oid = resolveId(oi.order)
    if (!oid) return
    if (!orderItemsByOrderId.has(oid)) orderItemsByOrderId.set(oid, [])
    orderItemsByOrderId.get(oid)!.push(oi)
  })

  function outletForOrder(order: VendorDoc): VendorDoc | null {
    const raw = order.merchant as unknown
    const obj = raw && typeof raw === 'object' ? (raw as VendorDoc) : null
    const id = obj ? String(obj.id ?? '') : String(raw ?? '')
    return id ? merchantMap.get(id) || obj || null : null
  }
  function orderMatchesSearch(order: VendorDoc): boolean {
    if (!params.q) return true
    const oid = String(order.id || '').toLowerCase()
    if (oid.includes(params.q)) return true
    const outlet = outletForOrder(order)
    if (outlet && getStr(outlet.outletName, '').toLowerCase().includes(params.q)) return true
    if (outlet && getStr(outlet.outletCode, '').toLowerCase().includes(params.q)) return true
    const items = orderItemsByOrderId.get(String(order.id)) || []
    for (const it of items) {
      if (getStr(it.product_name_snapshot, '').toLowerCase().includes(params.q)) return true
    }
    return false
  }
  function matchesOrderFilters(o: VendorDoc): boolean {
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
    if (params.outletFilter.length) {
      const outlet = outletForOrder(o)
      const oid = outlet ? String(outlet.id ?? '').toLowerCase() : ''
      const oname = outlet ? getStr(outlet.outletName, '').toLowerCase() : ''
      if (!params.outletFilter.includes(oid) && !params.outletFilter.includes(oname)) return false
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
      (params.statusFilter.length ||
        params.fulfillmentFilter.length ||
        params.deliveryStatusFilter.length ||
        params.outletFilter.length ||
        params.q)
    ) {
      if (!allowedPrevOrderIds.has(oid)) return false
    }
    if (params.paymentMethodFilter.length) {
      const pm = String(t.payment_method || 'unknown').toLowerCase()
      if (!params.paymentMethodFilter.includes(pm)) return false
    }
    return true
  })

  const verifiedRevenueByOrderId = new Map<string, number>()
  paidCurrent.forEach((t) => {
    const oid = resolveId(t.order)
    if (!oid) return
    verifiedRevenueByOrderId.set(oid, (verifiedRevenueByOrderId.get(oid) || 0) + getNum(t.amount))
  })
  const verifiedOrderIds = new Set(verifiedRevenueByOrderId.keys())

  return {
    ...params,
    paidTransactions,
    refundedTransactions,
    failedTransactions,
    merchantMap,
    productMap,
    categoryMap,
    orderMap,
    ordersCurrent,
    paidCurrent,
    verifiedRevenueByOrderId,
    verifiedOrderIds,
    ordersPrevFiltered,
    paidPrevFiltered,
  }
}

/** Canonical cache-query string shared by all vendor analytics group routes. */
export function buildVendorAnalyticsCacheQuery(searchParams: URLSearchParams): string {
  return (
    Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'range=30d'
  )
}
