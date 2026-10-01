/**
 * @file apps/cms/src/services/CommissionService.ts
 * @description Commission pct resolution chain + vendor-net math.
 * Never mutates order totals; mirrors payoutsShared max(0, ...) parity.
 */

import type { Payload } from 'payload'
import { roundMoney } from '../utils/membershipShared'

export type CommissionSource = 'vendor' | 'category' | 'plan' | 'global'

export interface CommissionResolution {
  pct: number
  source: CommissionSource
}

function clampPct(value: unknown): number | null {
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.min(100, Math.max(0, n))
}

function docId(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).id)
  }
  return ''
}

/**
 * Resolve the effective commission pct for a vendor (optionally scoped to a
 * merchant for category overrides):
 * vendors.commissionOverride.commission_percent -> merchant category
 * commissionOverridePct -> plan_snapshot.commission_percent ->
 * SystemSettings membership.commissionDefaultPct -> 8.
 */
export async function resolvePct(
  payload: any,
  vendorId: string | number,
  merchantId?: string | number | null,
): Promise<CommissionResolution> {
  const p = payload as any

  try {
    const vendor = await (p as Payload).findByID({
      collection: 'vendors',
      id: String(vendorId) as never,
      depth: 0,
      overrideAccess: true,
    } as any)
    const override = (vendor as any)?.commissionOverride ?? (vendor as any)?.commission_override
    const pct = clampPct(override?.commission_percent ?? override?.commissionPercent)
    if (pct !== null) return { pct, source: 'vendor' }
  } catch {
    // Best effort; continue down the chain.
  }

  if (merchantId !== undefined && merchantId !== null && String(merchantId) !== '') {
    try {
      const merchant = await (p as Payload).findByID({
        collection: 'merchants',
        id: merchantId as never,
        depth: 0,
        overrideAccess: true,
      } as any)
      const categoryRef =
        (merchant as any)?.category ??
        (merchant as any)?.merchant_category ??
        (merchant as any)?.merchantCategory ??
        (merchant as any)?.categoryId
      const categoryId = docId(categoryRef)
      if (categoryId) {
        for (const slug of ['merchant-categories', 'product-categories']) {
          try {
            const category = await (p as Payload).findByID({
              collection: slug,
              id: categoryId as never,
              depth: 0,
              overrideAccess: true,
            } as any)
            const pct = clampPct((category as any)?.commissionOverridePct ?? (category as any)?.commission_override_pct)
            if (pct !== null) return { pct, source: 'category' }
            break
          } catch {
            continue
          }
        }
      }
    } catch {
      // Best effort; continue down the chain.
    }
  }

  try {
    const res = await (p as Payload).find({
      collection: 'vendor-subscriptions',
      where: { and: [{ vendor: { equals: String(vendorId) } }, { status: { in: ['active', 'trialing'] } }] },
      limit: 1,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    } as any)
    const sub = (res as any)?.docs?.[0]
    const snapshot = sub?.plan_snapshot ?? sub?.planSnapshot
    const pct = clampPct(snapshot?.commission_percent ?? snapshot?.commissionPercent)
    if (pct !== null) return { pct, source: 'plan' }
  } catch {
    // Best effort; continue to global default.
  }

  try {
    const settings = await p.findGlobal({ slug: 'system-settings' })
    const group = (settings as any)?.membership
    const raw =
      (group && typeof group === 'object' ? group.commissionDefaultPct : undefined) ??
      (settings as any)?.commissionDefaultPct
    const pct = clampPct(raw)
    if (pct !== null) return { pct, source: 'global' }
  } catch {
    // Fall through to hard default.
  }

  return { pct: 8, source: 'global' }
}

/** Vendor net for a gross amount after commission pct and optional flat fee. */
export function computeVendorNet(gross: number, pct: number, fee = 0): number {
  const clamped = clampPct(pct) ?? 0
  const flat = Number(fee) || 0
  return roundMoney(Math.max(0, Number(gross) * (1 - clamped / 100) - flat))
}
