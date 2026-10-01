/**
 * @file apps/cms/src/utils/membershipShared.ts
 * @description Shared membership helpers: money math, relationship ids,
 * response sanitizers, proration and commission math. Next-free so both
 * Payload hooks and route handlers can import it.
 */

/** Pesos rounded to 2dp. Compatible with CouponService/WalletService roundMoney. */
export function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100
}

/** Extract a string id from a raw id or a populated relationship doc. */
export function relId(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).id)
  }
  return ''
}

/** Convert PHP pesos to integer centavos at the provider boundary. */
export function toCentavos(pesos: number): number {
  return Math.round(Number(pesos) * 100)
}

function stripRaw<T>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc
  if (Array.isArray(doc)) return doc.map((d) => stripRaw(d)) as unknown as T
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(doc as Record<string, unknown>)) {
    if (key === 'raw' || key === 'provider_raw' || key === 'rawResponse') continue
    out[key] = value
  }
  return out as T
}

/** Remove raw provider blobs from a plan doc before sending to clients. */
export function sanitizePlan<T>(plan: T): T {
  return stripRaw(plan)
}

/** Remove raw provider blobs from a subscription doc before sending to clients. */
export function sanitizeSubscription<T>(sub: T): T {
  return stripRaw(sub)
}

/** Remove raw provider blobs from an invoice doc before sending to clients. */
export function sanitizeInvoice<T>(invoice: T): T {
  return stripRaw(invoice)
}

/** Standard 400 payload shape for membership route handlers. */
export function badRequest(msg: string, details?: unknown): { error: string; details?: unknown; status: 400 } {
  return details === undefined ? { error: msg, status: 400 } : { error: msg, details, status: 400 }
}

export interface ProrateDeltaArgs {
  oldPrice: number
  newPrice: number
  periodEnd: Date | string | number
  now?: Date | string | number
  /** Days in the billing cycle. Defaults to 30 (month) or 365 (year) by remaining time. */
  daysInCycle?: number
}

/**
 * Proration delta for a mid-cycle plan switch (pesos, signed).
 * Positive = amount due now (upgrade); negative = credit (downgrade deferred).
 */
export function prorateDelta(args: ProrateDeltaArgs): number {
  const nowMs = new Date(args.now ?? new Date()).getTime()
  const endMs = new Date(args.periodEnd).getTime()
  if (!Number.isFinite(nowMs) || !Number.isFinite(endMs)) return 0
  const remainingMs = endMs - nowMs
  if (remainingMs <= 0) return 0
  const remainingDays = Math.ceil(remainingMs / 86400000)
  const daysInCycle =
    args.daysInCycle && args.daysInCycle > 0 ? args.daysInCycle : remainingDays > 62 ? 365 : 30
  const dailyOld = Number(args.oldPrice) / daysInCycle
  const dailyNew = Number(args.newPrice) / daysInCycle
  if (!Number.isFinite(dailyOld) || !Number.isFinite(dailyNew)) return 0
  return roundMoney((dailyNew - dailyOld) * remainingDays)
}

/** Vendor net after commission pct and optional flat fee. Never negative. */
export function netAfterCommission(gross: number, pct: number, fee = 0): number {
  const clamped = Math.min(100, Math.max(0, Number(pct) || 0))
  const flat = Number(fee) || 0
  return roundMoney(Math.max(0, Number(gross) * (1 - clamped / 100) - flat))
}
