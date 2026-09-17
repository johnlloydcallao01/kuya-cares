/**
 * Shared core for the split vendor reports endpoints
 * (summary / financial / catalog under app/api/vendor/reports/).
 *
 * Logic is copied verbatim from the monolith vendor reports route so every
 * group produces numbers identical to the single endpoint: same range
 * parsing, same period windows, same outlet join. Each group fetches only
 * the collections it needs (all depth: 0).
 */

export type VendorReportDoc = Record<string, unknown>

export function getNum(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') return parseFloat(v) || fb
  return fb
}

export function getStr(v: unknown, fb = ''): string {
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('outletName' in o) return String(o.outletName ?? fb)
    if ('businessName' in o) return String(o.businessName ?? fb)
    if ('name' in o) return String(o.name ?? fb)
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
  if (r === '1y' || r === '365d') return { days: 365, label: '1y' }
  if (r === 'all') return { days: 0, label: 'all' }
  const p = parseInt(r, 10)
  if (!isNaN(p) && p > 0) return { days: p, label: `${p}d` }
  return { days: 30, label: '30d' }
}

export interface VendorReportsParams {
  days: number
  label: string
  now: Date
  periodStart: Date | null
}

export function parseVendorReportsParams(searchParams: URLSearchParams): VendorReportsParams {
  const { days, label } = parseRange(searchParams)
  const now = new Date()
  return {
    days,
    label,
    now,
    periodStart: days === 0 ? null : new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
  }
}

export interface VendorReportsDocs {
  merchantsDocs: VendorReportDoc[]
  ordersDocs: VendorReportDoc[]
  transactionsDocs: VendorReportDoc[]
}

export interface VendorReportsCore extends VendorReportsParams {
  merchantMap: Map<string, VendorReportDoc>
  orderMap: Map<string, VendorReportDoc>
  ordersPeriod: VendorReportDoc[]
  paidTxPeriod: VendorReportDoc[]
  refundedTxPeriod: VendorReportDoc[]
  failedTxPeriod: VendorReportDoc[]
}

function isInPeriod(params: VendorReportsParams, doc: VendorReportDoc, field: string): boolean {
  if (!params.periodStart) return true
  const raw = String(doc[field] ?? doc.createdAt ?? '')
  const d = new Date(raw)
  return !isNaN(d.getTime()) && d >= params.periodStart && d <= params.now
}

export function buildVendorReportsCore(
  params: VendorReportsParams,
  docs: VendorReportsDocs,
): VendorReportsCore {
  const { merchantsDocs, ordersDocs, transactionsDocs } = docs

  const merchantMap = new Map<string, VendorReportDoc>()
  merchantsDocs.forEach((m) => merchantMap.set(String(m.id), m))
  const orderMap = new Map<string, VendorReportDoc>()
  ordersDocs.forEach((o) => orderMap.set(String(o.id), o))

  return {
    ...params,
    merchantMap,
    orderMap,
    ordersPeriod: ordersDocs.filter((o) => isInPeriod(params, o, 'createdAt')),
    paidTxPeriod: transactionsDocs.filter(
      (t) => String(t.status) === 'paid' && isInPeriod(params, t, 'paid_at'),
    ),
    refundedTxPeriod: transactionsDocs.filter(
      (t) => String(t.status) === 'refunded' && isInPeriod(params, t, 'createdAt'),
    ),
    failedTxPeriod: transactionsDocs.filter(
      (t) => String(t.status) === 'failed' && isInPeriod(params, t, 'createdAt'),
    ),
  }
}

/** Canonical cache-query string shared by all vendor reports group routes. */
export function buildVendorReportsCacheQuery(searchParams: URLSearchParams): string {
  return (
    Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'range=30d'
  )
}
