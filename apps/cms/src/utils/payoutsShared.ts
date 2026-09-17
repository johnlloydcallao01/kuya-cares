/**
 * Shared core for the split admin vendor-payouts endpoints
 * (summary / rows / daily under app/api/admin/vendors/payouts/).
 *
 * Logic is copied verbatim from the monolith payouts route so every group
 * produces numbers identical to the single endpoint: same range/search/filter
 * parsing, same period windows, same transaction→order→merchant→vendor join,
 * same net math. Each group fetches only the collections it needs
 * (all depth: 0) and reuses these helpers.
 */

export type PayoutDoc = Record<string, unknown>

export function getNum(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : fb
  }
  return fb
}

export function getStr(v: unknown, fb = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('businessName' in o) return String(o.businessName ?? fb)
    if ('outletName' in o) return String(o.outletName ?? fb)
  }
  return fb
}

export function resolveId(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as Record<string, unknown>))
    return String((v as Record<string, unknown>).id)
  return ''
}

export function parseRange(sp: URLSearchParams): { days: number; label: string } {
  const r = (sp.get('range') || '30d').toLowerCase()
  if (r === '7d') return { days: 7, label: '7d' }
  if (r === '30d') return { days: 30, label: '30d' }
  if (r === '90d') return { days: 90, label: '90d' }
  if (r === '1y' || r === '365d' || r === '12m') return { days: 365, label: '1y' }
  if (r === 'all' || r === '0') return { days: 0, label: 'all' }
  const n = parseInt(r, 10)
  if (!Number.isNaN(n) && n > 0) return { days: n, label: `${n}d` }
  return { days: 30, label: '30d' }
}

export function parseCsv(sp: URLSearchParams, key: string): string[] {
  const raw = sp.get(key) || ''
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function sanitizeMediaRef(value: unknown): { id: number; url: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const media = value as Record<string, unknown>
  const id = Number(media.id)
  if (Number.isNaN(id)) return null
  const url =
    typeof media.cloudinaryURL === 'string'
      ? media.cloudinaryURL
      : typeof media.url === 'string'
        ? media.url
        : null
  return { id, url }
}

export interface PayoutsParams {
  days: number
  label: string
  search: string
  verificationFilter: string[]
  businessTypeFilter: string[]
  isActiveFilter: boolean | null
  now: Date
  periodStart: Date | null
}

export function parsePayoutsParams(searchParams: URLSearchParams): PayoutsParams {
  const { days, label } = parseRange(searchParams)
  const isActiveParam = searchParams.get('isActive')
  const now = new Date()
  return {
    days,
    label,
    search: (searchParams.get('search') || '').trim().toLowerCase(),
    verificationFilter: parseCsv(searchParams, 'verificationStatus'),
    businessTypeFilter: parseCsv(searchParams, 'businessType'),
    isActiveFilter: isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null,
    now,
    periodStart: days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
  }
}

export interface PayoutsDocs {
  vendorsDocs: PayoutDoc[]
  merchantsDocs: PayoutDoc[]
  ordersDocs: PayoutDoc[]
  transactionsDocs: PayoutDoc[]
}

export interface PayoutsCore extends PayoutsParams {
  merchantMap: Map<string, PayoutDoc>
  vendorMap: Map<string, PayoutDoc>
  orderMap: Map<string, PayoutDoc>
  vendorsForAgg: PayoutDoc[]
  filteredVendorIds: Set<string> | null
  paidTxPeriod: PayoutDoc[]
  refundedTxPeriod: PayoutDoc[]
}

function isInPeriod(params: PayoutsParams, doc: PayoutDoc, field: string): boolean {
  if (!params.periodStart) return true
  const raw = String(doc[field] ?? doc.createdAt ?? '')
  if (!raw) return false
  const d = new Date(raw)
  return !Number.isNaN(d.getTime()) && d >= params.periodStart && d <= params.now
}

export function buildPayoutsCore(params: PayoutsParams, docs: PayoutsDocs): PayoutsCore {
  const { vendorsDocs, merchantsDocs, ordersDocs, transactionsDocs } = docs

  const merchantMap = new Map<string, PayoutDoc>()
  merchantsDocs.forEach((m) => merchantMap.set(String(m.id), m))
  const vendorMap = new Map<string, PayoutDoc>()
  vendorsDocs.forEach((v) => vendorMap.set(String(v.id), v))
  const orderMap = new Map<string, PayoutDoc>()
  ordersDocs.forEach((o) => orderMap.set(String(o.id), o))

  let filteredVendorIds: Set<string> | null = null
  if (
    params.search ||
    params.verificationFilter.length ||
    params.businessTypeFilter.length ||
    params.isActiveFilter !== null
  ) {
    const matched = vendorsDocs.filter((v) => {
      if (
        params.verificationFilter.length &&
        !params.verificationFilter.includes(String(v.verificationStatus || '').toLowerCase())
      )
        return false
      if (
        params.businessTypeFilter.length &&
        !params.businessTypeFilter.includes(String(v.businessType || '').toLowerCase())
      )
        return false
      if (params.isActiveFilter !== null && !!v.isActive !== params.isActiveFilter) return false
      if (params.search) {
        const hay =
          `${getStr(v.businessName)} ${getStr(v.legalName)} ${getStr(v.businessRegistrationNumber)} ${getStr(v.primaryContactEmail)}`.toLowerCase()
        if (!hay.includes(params.search)) return false
      }
      return true
    })
    filteredVendorIds = new Set(matched.map((v) => String(v.id)))
  }
  const vendorsForAgg = filteredVendorIds
    ? vendorsDocs.filter((v) => filteredVendorIds!.has(String(v.id)))
    : vendorsDocs

  const paidTxPeriod = transactionsDocs.filter(
    (t) => String(t.status) === 'paid' && isInPeriod(params, t, 'paid_at'),
  )
  const refundedTxPeriod = transactionsDocs.filter(
    (t) => String(t.status) === 'refunded' && isInPeriod(params, t, 'createdAt'),
  )

  return {
    ...params,
    merchantMap,
    vendorMap,
    orderMap,
    vendorsForAgg,
    filteredVendorIds,
    paidTxPeriod,
    refundedTxPeriod,
  }
}

export interface PayoutVendorRef {
  vendorId: string
  order: PayoutDoc
  amount: number
  platformFee: number
  deliveryFee: number
}

/** Shared transaction→order→merchant→vendor join (respects vendor filters). */
export function resolvePayoutVendor(core: PayoutsCore, t: PayoutDoc): PayoutVendorRef | null {
  const orderId = resolveId(t.order)
  const order = orderId ? (core.orderMap.get(orderId) ?? null) : null
  if (!order) return null
  const merchantRaw = order.merchant as unknown
  const merchantObj =
    merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as PayoutDoc) : null
  const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
  const merchant = merchantId ? (core.merchantMap.get(merchantId) ?? null) : null
  // NOTE: mirrors the monolith — merchants missing from the map contribute
  // nothing (no populated-object fallback at depth 0).
  if (!merchant) return null
  const vendorRaw = merchant.vendor as unknown
  const vendorObj = vendorRaw && typeof vendorRaw === 'object' ? (vendorRaw as PayoutDoc) : null
  const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
  if (!vendorId || (core.filteredVendorIds && !core.filteredVendorIds.has(vendorId))) return null
  return {
    vendorId,
    order,
    amount: getNum(t.amount),
    platformFee: getNum(order.platform_fee),
    deliveryFee: getNum(order.delivery_fee),
  }
}

export interface VendorAggEntry {
  businessName: string
  legalName: string
  businessType: string
  verificationStatus: string
  isActive: boolean
  logo: { id: number; url: string | null } | null
  totalMerchants: number
  averageRating: number
  orders: number
  gross: number
  platformFees: number
  deliveryFees: number
  net: number
  refunded: number
}

export function buildVendorAgg(core: PayoutsCore): Map<string, VendorAggEntry> {
  const vendorAgg = new Map<string, VendorAggEntry>()
  for (const v of core.vendorsForAgg) {
    const id = String(v.id)
    vendorAgg.set(id, {
      businessName: getStr(v.businessName),
      legalName: getStr(v.legalName),
      businessType: getStr(v.businessType, 'other'),
      verificationStatus: getStr(v.verificationStatus, 'pending'),
      isActive: !!v.isActive,
      logo: sanitizeMediaRef(v.logo),
      totalMerchants: getNum(v.totalMerchants),
      averageRating: getNum(v.averageRating),
      orders: 0,
      gross: 0,
      platformFees: 0,
      deliveryFees: 0,
      net: 0,
      refunded: 0,
    })
  }
  for (const t of core.paidTxPeriod) {
    const ref = resolvePayoutVendor(core, t)
    if (!ref) continue
    const agg = vendorAgg.get(ref.vendorId)
    if (!agg) continue
    agg.orders += 1
    agg.gross += ref.amount
    agg.platformFees += ref.platformFee
    agg.deliveryFees += ref.deliveryFee
    agg.net += Math.max(0, ref.amount - ref.platformFee - ref.deliveryFee)
  }
  for (const t of core.refundedTxPeriod) {
    const ref = resolvePayoutVendor(core, t)
    if (!ref) continue
    const agg = vendorAgg.get(ref.vendorId)
    if (!agg) continue
    agg.refunded += getNum(t.amount)
  }
  return vendorAgg
}

/** Live outlet counts override the stored denormalized counter. */
export function enrichMerchantCounts(
  core: PayoutsCore,
  vendorAgg: Map<string, VendorAggEntry>,
): void {
  const merchantCountByVendor = new Map<string, number>()
  for (const m of core.merchantMap.values()) {
    const raw = m.vendor as unknown
    const vid = raw && typeof raw === 'object' ? String((raw as PayoutDoc).id ?? '') : String(raw ?? '')
    if (!vid) continue
    merchantCountByVendor.set(vid, (merchantCountByVendor.get(vid) || 0) + 1)
  }
  for (const [vid, cnt] of merchantCountByVendor.entries()) {
    const agg = vendorAgg.get(vid)
    if (agg) agg.totalMerchants = cnt
  }
}

export interface PayoutRow extends VendorAggEntry {
  vendorId: string
  avgOrder: number
  avgNet: number
}

export function toPayoutRows(vendorAgg: Map<string, VendorAggEntry>): PayoutRow[] {
  const rows = Array.from(vendorAgg.entries()).map(([vendorId, v]) => ({
    vendorId,
    ...v,
    avgOrder: v.orders ? v.gross / v.orders : 0,
    avgNet: v.orders ? v.net / v.orders : 0,
  }))
  return rows.sort((a, b) => b.net - a.net || b.gross - a.gross)
}

export function toPayoutSummary(rows: PayoutRow[]) {
  const totalGross = rows.reduce((s, r) => s + r.gross, 0)
  const totalNet = rows.reduce((s, r) => s + r.net, 0)
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0)
  const totalVendors = rows.length
  return {
    totalGross,
    totalNet,
    totalPlatformFees: rows.reduce((s, r) => s + r.platformFees, 0),
    totalDeliveryFees: rows.reduce((s, r) => s + r.deliveryFees, 0),
    totalRefunded: rows.reduce((s, r) => s + r.refunded, 0),
    totalOrders,
    totalVendors,
    activeVendors: rows.filter((r) => r.isActive).length,
    avgPayout: totalVendors ? totalNet / totalVendors : 0,
    avgOrder: totalOrders ? totalGross / totalOrders : 0,
  }
}

export function buildDaily(core: PayoutsCore): { date: string; gross: number; net: number; orders: number }[] {
  const dailyMap = new Map<string, { date: string; gross: number; net: number; orders: number }>()
  for (const t of core.paidTxPeriod) {
    const ref = resolvePayoutVendor(core, t)
    if (!ref) continue
    const d = new Date(String(t.paid_at ?? t.createdAt ?? '')).toISOString().split('T')[0]
    if (d) {
      const e = dailyMap.get(d) || { date: d, gross: 0, net: 0, orders: 0 }
      e.gross += ref.amount
      e.net += Math.max(0, ref.amount - ref.platformFee - ref.deliveryFee)
      e.orders += 1
      dailyMap.set(d, e)
    }
  }
  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))
}

export function buildVerificationBreakdown(core: PayoutsCore): Record<string, number> {
  const breakdown: Record<string, number> = { pending: 0, verified: 0, rejected: 0, suspended: 0 }
  for (const v of core.vendorsForAgg) {
    const s = String(v.verificationStatus || 'pending').toLowerCase()
    breakdown[s] = (breakdown[s] || 0) + 1
  }
  return breakdown
}

/** Canonical cache-query string shared by all payouts group routes. */
export function buildPayoutsCacheQuery(searchParams: URLSearchParams): string {
  return (
    Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'range=30d'
  )
}
