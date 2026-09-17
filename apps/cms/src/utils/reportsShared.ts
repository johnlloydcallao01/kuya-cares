/**
 * Shared core for the split admin reports endpoints
 * (summary / financial / catalog under app/api/admin/reports/).
 *
 * Logic is copied verbatim from the monolith reports route so every group
 * produces numbers identical to the single endpoint: same range parsing,
 * same period windows, same maps and join indexes.
 * Each group fetches only the collections it needs (all depth: 0) and calls
 * buildReportsCore() to get the shared intermediates.
 */

export type ReportsDoc = Record<string, unknown>

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

export interface ReportsParams {
  days: number
  label: string
  now: Date
  periodStart: Date | null
}

export function parseReportsParams(searchParams: URLSearchParams): ReportsParams {
  const { days, label } = parseRange(searchParams)
  const now = new Date()
  return {
    days,
    label,
    now,
    periodStart: days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
  }
}

export interface ReportsDocs {
  vendorsDocs: ReportsDoc[]
  merchantsDocs?: ReportsDoc[]
  ordersDocs: ReportsDoc[]
  transactionsDocs: ReportsDoc[]
  discountsDocs?: ReportsDoc[]
}

export interface ReportsCore extends ReportsParams {
  merchantMap: Map<string, ReportsDoc>
  vendorMap: Map<string, ReportsDoc>
  orderMap: Map<string, ReportsDoc>
  ordersPeriod: ReportsDoc[]
  paidTxPeriod: ReportsDoc[]
  refundedTxPeriod: ReportsDoc[]
  failedTxPeriod: ReportsDoc[]
  discountsPeriod: ReportsDoc[]
  discountByOrder: Map<string, { total: number; vendorShare: number; code: string }>
}

function isInPeriod(params: ReportsParams, doc: ReportsDoc, field: string): boolean {
  if (!params.periodStart) return true
  const raw = String(doc[field] ?? doc.createdAt ?? '')
  if (!raw) return false
  const d = new Date(raw)
  return !isNaN(d.getTime()) && d >= params.periodStart && d <= params.now
}

export function buildReportsCore(params: ReportsParams, docs: ReportsDocs): ReportsCore {
  const { vendorsDocs, ordersDocs, transactionsDocs } = docs
  const merchantsDocs = docs.merchantsDocs ?? []
  const discountsDocs = docs.discountsDocs ?? []

  const merchantMap = new Map<string, ReportsDoc>()
  merchantsDocs.forEach((m) => merchantMap.set(String(m.id), m))
  const vendorMap = new Map<string, ReportsDoc>()
  vendorsDocs.forEach((v) => vendorMap.set(String(v.id), v))
  const orderMap = new Map<string, ReportsDoc>()
  ordersDocs.forEach((o) => orderMap.set(String(o.id), o))

  const ordersPeriod = ordersDocs.filter((o) => isInPeriod(params, o, 'createdAt'))
  const paidTxPeriod = transactionsDocs.filter(
    (t) => String(t.status) === 'paid' && isInPeriod(params, t, 'paid_at'),
  )
  const refundedTxPeriod = transactionsDocs.filter(
    (t) => String(t.status) === 'refunded' && isInPeriod(params, t, 'createdAt'),
  )
  const failedTxPeriod = transactionsDocs.filter(
    (t) => String(t.status) === 'failed' && isInPeriod(params, t, 'createdAt'),
  )

  const discountsPeriod = discountsDocs.filter((d) => isInPeriod(params, d, 'createdAt'))
  const discountByOrder = new Map<string, { total: number; vendorShare: number; code: string }>()
  for (const d of discountsPeriod) {
    const oid = resolveId(d.order)
    if (!oid) continue
    const prev = discountByOrder.get(oid) || { total: 0, vendorShare: 0, code: '' }
    prev.total += getNum(d.amount_off)
    prev.vendorShare += getNum(d.vendor_share)
    if (!prev.code) prev.code = getStr(d.code)
    discountByOrder.set(oid, prev)
  }

  return {
    ...params,
    merchantMap,
    vendorMap,
    orderMap,
    ordersPeriod,
    paidTxPeriod,
    refundedTxPeriod,
    failedTxPeriod,
    discountsPeriod,
    discountByOrder,
  }
}

/** Canonical cache-query string shared by all reports group routes. */
export function buildReportsCacheQuery(searchParams: URLSearchParams): string {
  return (
    Array.from(searchParams.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'range=30d'
  )
}
