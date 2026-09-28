/**
 * Shared helpers for customer voucher BFF routes (not a route).
 * Customer-safe: never leaks vendor_share, allowlists, or snapshots.
 */

import { CouponService, isInTimeWindows } from '@/services/CouponService'

export function relId(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return String((v as any).id)
  return null
}

export async function resolveCustomer(payload: any, userId: string) {
  const numericUser = Number(userId)
  const { docs } = await payload.find({
    collection: 'customers',
    where: { user: { equals: Number.isFinite(numericUser) ? numericUser : userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (docs[0]) return docs[0]
  try {
    return await payload.create({
      collection: 'customers',
      data: { user: Number.isFinite(numericUser) ? numericUser : (userId as any) },
      overrideAccess: true,
    })
  } catch {
    return null
  }
}

function imageUrlOf(image: any): string | null {
  if (!image || typeof image !== 'object') return null
  return image.cloudinaryURL || image.url || image.thumbnailURL || null
}

function daysUntil(iso: unknown): number | null {
  if (!iso) return null
  const ms = new Date(String(iso)).getTime() - Date.now()
  if (!Number.isFinite(ms)) return null
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

/**
 * Lightweight claimability (browse context, no basket):
 * published + claimable + date window + global/per-user limits.
 * Scoped rules (branch, basket, payment, contact) need checkout context
 * and are enforced by CouponService.validate at apply time.
 */
export async function previewClaimable(
  payload: any,
  coupon: any,
  customerId: number | string,
  contact: { email?: string; phone?: string },
  now: Date,
): Promise<{ ok: boolean; reason?: string; usesLeft: number | null; usesLeftForUser: number | null }> {
  if (coupon.status !== 'published') return { ok: false, reason: 'Not published', usesLeft: null, usesLeftForUser: null }
  if (coupon.claimable === false) return { ok: false, reason: 'Not claimable', usesLeft: null, usesLeftForUser: null }
  const startsAt = coupon.starts_at ? new Date(coupon.starts_at).getTime() : NaN
  const expiresAt = coupon.expires_at ? new Date(coupon.expires_at).getTime() : NaN
  if (Number.isFinite(startsAt) && now.getTime() < startsAt) {
    return { ok: false, reason: 'Not started', usesLeft: null, usesLeftForUser: null }
  }
  if (Number.isFinite(expiresAt) && now.getTime() > expiresAt) {
    return { ok: false, reason: 'Expired', usesLeft: null, usesLeftForUser: null }
  }

  const service = new CouponService(payload)
  const usageLimit = Number(coupon.usage_limit ?? 0)
  let usesLeft: number | null = null
  if (usageLimit > 0) {
    const holds = await service.countActiveHolds(coupon.id, now)
    usesLeft = Math.max(0, usageLimit - (Number(coupon.usage_count ?? 0) + holds))
    if (usesLeft <= 0) return { ok: false, reason: 'Fully claimed', usesLeft: 0, usesLeftForUser: null }
  }

  const perUser = Number(coupon.usage_limit_per_user ?? 0)
  let usesLeftForUser: number | null = null
  if (perUser > 0) {
    const used = await service.countRedemptions(coupon.id, { customerId, ...contact })
    usesLeftForUser = Math.max(0, perUser - used)
    if (usesLeftForUser <= 0) {
      return { ok: false, reason: 'Limit reached', usesLeft, usesLeftForUser: 0 }
    }
  }

  return { ok: true, usesLeft, usesLeftForUser }
}

export function sanitizeCoupon(
  coupon: any,
  extra: {
    usesLeft: number | null
    usesLeftForUser: number | null
    claimed: boolean
    claimStatus: string | null
    used: boolean
    discountPreview?: { food: number; delivery: number; total: number } | null
  },
) {
  const expiresAt = coupon.expires_at || null
  const isExpired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false
  return {
    id: coupon.id,
    code: coupon.code,
    title: coupon.title || coupon.code,
    shortCopy: coupon.short_copy || null,
    imageUrl: imageUrlOf(coupon.image),
    discountType: coupon.discount_type,
    amount: Number(coupon.amount ?? 0),
    maxDiscount: coupon.max_discount_amount ?? null,
    appliesTo: coupon.applies_to,
    freeDelivery: !!coupon.free_delivery,
    deliveryCap: coupon.delivery_discount_cap ?? null,
    minBasket: coupon.minimum_basket ?? null,
    maxBasket: coupon.maximum_basket ?? null,
    firstOrderOnly: !!coupon.first_order_only,
    allowedPaymentMethods: coupon.allowed_payment_methods ?? null,
    startsAt: coupon.starts_at || null,
    expiresAt,
    expiresInDays: daysUntil(expiresAt),
    isExpired,
    featured: !!coupon.featured,
    priority: Number(coupon.priority ?? 0),
    vendorName:
      coupon.vendor && typeof coupon.vendor === 'object'
        ? coupon.vendor.businessName || coupon.vendor.business_name || null
        : null,
    usesLeft: extra.usesLeft,
    usesLeftForUser: extra.usesLeftForUser,
    claimed: extra.claimed,
    claimStatus: extra.claimStatus,
    used: extra.used,
    discountPreview: extra.discountPreview ?? null,
  }
}

export async function customerContact(payload: any, customer: any): Promise<{ email?: string; phone?: string }> {
  try {
    const full = await payload.findByID({
      collection: 'customers',
      id: customer.id,
      depth: 1,
      overrideAccess: true,
    })
    const out: { email?: string; phone?: string } = {}
    if (typeof full?.email === 'string' && full.email.trim()) out.email = full.email.trim()
    const user = (full as any)?.user
    if (user && typeof user === 'object' && typeof user.phone === 'string' && user.phone.trim()) {
      out.phone = user.phone.trim()
    }
    return out
  } catch {
    return {}
  }
}

export function windowNowActive(coupon: any, now: Date, timeZone = 'Asia/Manila'): boolean {
  return isInTimeWindows((coupon as any).time_windows, now, timeZone)
}
