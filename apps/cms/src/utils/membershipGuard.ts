/**
 * @file apps/cms/src/utils/membershipGuard.ts
 * @description Payload-only membership enforcement helper (no Next imports).
 * Finds an active/trialing vendor-subscription, honors manual waivers and
 * the grandfathered-Basic fallback, otherwise throws MembershipBlockedError
 * (HTTP 402 shape shared by hooks and BFF routes).
 *
 * MembershipBlockedError extends Payload's APIError so collection
 * beforeChange hooks (`e instanceof APIError && status === 402`) rethrow it
 * instead of swallowing it.
 */

import { APIError } from 'payload'
import type { Payload } from 'payload'

export class MembershipBlockedError extends APIError {
  code = 'MEMBERSHIP_REQUIRED'
  requiredPlan: string
  vendorId: string | null
  subscriptionStatus: string | null

  constructor(
    opts: {
      message?: string
      vendorId?: string | number | null
      subscriptionStatus?: string | null
      requiredPlan?: string
    } = {},
  ) {
    const vendorId = opts.vendorId == null ? null : String(opts.vendorId)
    const subscriptionStatus = opts.subscriptionStatus ?? null
    const requiredPlan = opts.requiredPlan ?? 'Basic'
    super(opts.message ?? 'Active membership required to sell', 402, {
      code: 'MEMBERSHIP_REQUIRED',
      requiredPlan,
      vendorId,
      subscriptionStatus,
    } as unknown as Record<string, unknown>, true)
    this.name = 'MembershipBlockedError'
    this.vendorId = vendorId
    this.subscriptionStatus = subscriptionStatus
    this.requiredPlan = requiredPlan
  }

  toJSON(): {
    error: string
    code: string
    vendorId: string | null
    subscriptionStatus: string | null
    requiredPlan: string
    status: number
  } {
    return {
      error: this.message,
      code: this.code,
      vendorId: this.vendorId,
      subscriptionStatus: this.subscriptionStatus,
      requiredPlan: this.requiredPlan,
      status: this.status,
    }
  }
}

function docId(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).id)
  }
  return ''
}

function pickDateMs(doc: Record<string, any>, keys: string[]): number {
  for (const key of keys) {
    const raw = doc?.[key]
    if (raw == null || raw === '') continue
    const ms = new Date(raw).getTime()
    if (Number.isFinite(ms)) return ms
  }
  return NaN
}

function userIdFrom(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (obj.userId != null) return String(obj.userId)
    if (obj.user != null) return docId(obj.user) || null
    if (obj.id != null && (obj.collection === 'users' || obj.role === 'vendor')) return String(obj.id)
  }
  return null
}

/** Resolve the vendor id that owns a user (vendors.user -> users). */
export async function vendorIdForVendorUser(
  payload: any,
  userId: string | number | { userId?: string | number | null; user?: unknown },
): Promise<string | null> {
  const id = userIdFrom(userId)
  if (!id) return null
  try {
    const res = await (payload as Payload).find({
      collection: 'vendors',
      where: { user: { equals: id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    } as any)
    const found = docId((res as any)?.docs?.[0]?.id)
    return found || null
  } catch {
    return null
  }
}

/** Resolve the owning vendor id for a merchant doc. */
export async function resolveVendorIdFromMerchant(
  payload: any,
  merchantId: string | number,
): Promise<string | null> {
  try {
    const merchant = await (payload as Payload).findByID({
      collection: 'merchants',
      id: merchantId as never,
      depth: 0,
      overrideAccess: true,
    } as any)
    const id = docId((merchant as any)?.vendor)
    return id || null
  } catch {
    return null
  }
}

/**
 * Resolve the owning vendor id for a product doc (direct or via merchant).
 * Also accepts `{ userId }` to resolve via the vendor-user link (used by the
 * products beforeChange hook when only req.user is available).
 */
export async function resolveVendorIdFromProduct(
  payload: any,
  productId: string | number | { userId?: string | number | null; user?: unknown },
): Promise<string | null> {
  const asUser = userIdFrom(productId)
  if (asUser && (typeof productId === 'object' || Number.isNaN(Number(productId)))) {
    return vendorIdForVendorUser(payload, asUser)
  }
  try {
    const product = await (payload as Payload).findByID({
      collection: 'products',
      id: productId as never,
      depth: 0,
      overrideAccess: true,
    } as any)
    const direct = docId(
      (product as any)?.createdByVendor ?? (product as any)?.vendor ?? (product as any)?.created_by_vendor,
    )
    if (direct) return direct
    const merchantRef =
      (product as any)?.createdByMerchant ?? (product as any)?.merchant ?? (product as any)?.created_by_merchant
    const merchantId = docId(merchantRef)
    if (merchantId) return resolveVendorIdFromMerchant(payload, merchantId)
    return null
  } catch {
    return null
  }
}

/**
 * Read the membership settings group from the System Settings global (DB,
 * admin-editable). Returns null when unreadable (fail-open callers decide).
 * Env vars remain as emergency overrides only (see each consumer).
 */
export async function getMembershipSettings(payload?: any): Promise<Record<string, any> | null> {
  try {
    if (payload?.findGlobal) {
      const settings = await payload.findGlobal({ slug: 'system-settings' })
      const group = (settings as any)?.membership
      if (group && typeof group === 'object') return group as Record<string, any>
    }
  } catch {
    // Best effort; callers fall back to env/defaults.
  }
  return null
}

/**
 * Kill-switch read (DB-first): enforced when SystemSettings.membership
 * (membershipEnabled && membershipEnforced) is on. Env
 * BILLING_ENFORCE_MEMBERSHIP=true forces on (emergency); 'false' forces off.
 * Defaults to false (log-only allow).
 */
export async function isMembershipEnforced(payload?: any): Promise<boolean> {
  const env = process.env.BILLING_ENFORCE_MEMBERSHIP
  if (env === 'true') return true
  try {
    const group = await getMembershipSettings(payload)
    if (group) {
      if (group.membershipEnabled === true && group.membershipEnforced === true) return true
    }
  } catch {
    // Fall through to env check below.
  }
  return env === 'true'
}

/**
 * Pure, synchronous sellability check over a denormalized vendor doc
 * (GeospatialService hide-listings post-filter). Never throws; fail-open
 * for bare ids and docs without membership fields (pre-migration).
 */
export function isVendorSellable(vendorDoc: unknown): boolean {
  try {
    if (vendorDoc == null) return true
    if (typeof vendorDoc === 'string' || typeof vendorDoc === 'number') return true
    if (typeof vendorDoc !== 'object') return true
    const doc = vendorDoc as Record<string, any>
    const waivedMs = pickDateMs(doc, ['waivedUntil', 'waived_until'])
    if (Number.isFinite(waivedMs) && waivedMs > Date.now()) return true
    if (doc.grandfatheredBasic === true || doc.grandfathered_basic === true) return true
    const statusRaw = doc.subscriptionStatus ?? doc.subscription_status
    const hasMembershipFields =
      statusRaw !== undefined ||
      doc.waivedUntil !== undefined ||
      doc.waived_until !== undefined ||
      doc.subscriptionExpiresAt !== undefined ||
      doc.subscription_expires_at !== undefined ||
      doc.grandfatheredBasic !== undefined ||
      doc.grandfathered_basic !== undefined
    if (!hasMembershipFields) return true
    const status = String(statusRaw ?? 'none')
    if (status === 'active' || status === 'trialing') {
      const expMs = pickDateMs(doc, ['subscriptionExpiresAt', 'subscription_expires_at'])
      if (!Number.isFinite(expMs) || expMs > Date.now()) return true
      return false
    }
    return false
  } catch {
    return true
  }
}

async function fallbackPlanName(payload: any, slug: string): Promise<string> {
  try {
    const res = await (payload as Payload).find({
      collection: 'membership-plans',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    } as any)
    const name = (res as any)?.docs?.[0]?.name
    if (typeof name === 'string' && name.trim()) return name.trim()
  } catch {
    // Best effort; fall back to slug-derived label below.
  }
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : 'Basic'
}

export interface MembershipCheck extends Record<string, any> {
  status: string
  waived: boolean
}

interface CacheSlot {
  at: number
  check?: any
  blocked?: { message: string; vendorId: string | null; subscriptionStatus: string | null; requiredPlan: string }
}

function cacheFor(req: any): Map<string, CacheSlot> | null {
  try {
    const ctx = req?.context
    if (!ctx || typeof ctx !== 'object') return null
    if (!(ctx.membershipCache instanceof Map)) ctx.membershipCache = new Map<string, CacheSlot>()
    return ctx.membershipCache as Map<string, CacheSlot>
  } catch {
    return null
  }
}

/**
 * Require an active (or trialing, in-period) subscription for a vendor.
 * Resolves to the subscription doc (hook/route callers may read
 * plan_snapshot from it); waived/grandfathered/bypassed cases resolve to a
 * lightweight subscription-shaped pseudo-doc. Honors
 * vendors.waivedUntil and the grandfathered-Basic fallback. Throws
 * MembershipBlockedError (402) when paywalled. When enforcement is off,
 * allows with a warn log. Results are cached 60s per request via
 * req.context.membershipCache.
 */
export async function requireActiveMembership(
  payload: any,
  vendorId: string | number,
  opts?: { fn?: string; fallbackPlanSlug?: string; req?: any },
): Promise<any> {
  const id = String(vendorId ?? '')
  if (!id) {
    throw new MembershipBlockedError({ message: 'Active membership required to sell', vendorId: null })
  }

  const cache = cacheFor(opts?.req)
  const cacheKey = `membership:${id}`
  const cached = cache?.get(cacheKey)
  if (cached && Date.now() - cached.at < 60000) {
    if (cached.blocked) {
      throw new MembershipBlockedError(cached.blocked)
    }
    return cached.check
  }

  const remember = (check: any): any => {
    try {
      cache?.set(cacheKey, { at: Date.now(), check })
    } catch {
      // Cache is best effort.
    }
    return check
  };
  const rememberBlocked = (blocked: CacheSlot['blocked'] & {}): never => {
    try {
      cache?.set(cacheKey, { at: Date.now(), blocked: blocked as NonNullable<CacheSlot['blocked']> })
    } catch {
      // Cache is best effort.
    }
    throw new MembershipBlockedError(blocked)
  };

  const enforced = await isMembershipEnforced(payload)
  if (!enforced) {
    try {
      console.warn(`[membership] bypass (not enforced) fn=${opts?.fn ?? 'unknown'} vendor=${id}`)
    } catch {
      // Logging must never break the request path.
    }
    return remember({ status: 'bypassed', waived: false, vendor: id } as MembershipCheck)
  }

  let lastStatus: string | null = null
  let lastPlanName = ''

  try {
    const res = await (payload as Payload).find({
      collection: 'vendor-subscriptions',
      where: { and: [{ vendor: { equals: id } }, { status: { in: ['active', 'trialing'] } }] },
      limit: 5,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    } as any)
    const docs = (((res as any)?.docs ?? []) as any[])
    if (docs[0]?.status) lastStatus = String(docs[0].status)
    for (const sub of docs) {
      const endMs = pickDateMs(sub, ['current_period_end', 'currentPeriodEnd', 'current_period_end_at'])
      if (Number.isFinite(endMs) && endMs > Date.now()) {
        return remember(sub)
      }
    }
    const snap = docs[0]?.plan_snapshot ?? docs[0]?.planSnapshot
    if (snap && typeof snap.name === 'string') lastPlanName = snap.name
  } catch {
    // Read failure below surfaces as paywalled with captured lastStatus.
  }

  let vendorDoc: any = null
  try {
    vendorDoc = await (payload as Payload).findByID({
      collection: 'vendors',
      id: id as never,
      depth: 0,
      overrideAccess: true,
    } as any)
  } catch {
    vendorDoc = null
  }

  const waivedMs = vendorDoc ? pickDateMs(vendorDoc, ['waivedUntil', 'waived_until']) : NaN
  if (Number.isFinite(waivedMs) && waivedMs > Date.now()) {
    return remember({
      status: String(vendorDoc?.subscriptionStatus ?? vendorDoc?.subscription_status ?? lastStatus ?? 'waived'),
      waived: true,
      vendor: id,
      waivedUntil: vendorDoc?.waivedUntil ?? vendorDoc?.waived_until ?? null,
      plan_snapshot: lastPlanName ? { name: lastPlanName } : null,
    } as MembershipCheck)
  }

  const settings = await getMembershipSettings(payload)
  const grandfatherEnv = process.env.BILLING_GRANDFATHER_BASIC
  const grandfatherEnabled =
    grandfatherEnv === 'true' ||
    (grandfatherEnv !== 'false' &&
      (settings ? settings.grandfatherBasicEnabled !== false : true))
  const grandfathered =
    grandfatherEnabled &&
    (vendorDoc?.grandfatheredBasic === true || vendorDoc?.grandfathered_basic === true)
  if (grandfathered) {
    return remember({
      status: 'active',
      waived: false,
      grandfathered: true,
      vendor: id,
      plan_snapshot: { name: 'Basic' },
    } as MembershipCheck)
  }

  if (!lastStatus && vendorDoc?.subscriptionStatus) lastStatus = String(vendorDoc.subscriptionStatus)
  const slug =
    opts?.fallbackPlanSlug ??
    (typeof settings?.fallbackBasicPlanSlug === 'string' && settings.fallbackBasicPlanSlug.trim()
      ? settings.fallbackBasicPlanSlug.trim()
      : null) ??
    process.env.BILLING_DEFAULT_PLAN ??
    'basic'
  const requiredPlan = await fallbackPlanName(payload, slug)
  return rememberBlocked({
    vendorId: id,
    subscriptionStatus: lastStatus ?? 'none',
    requiredPlan,
    message: 'Active membership required to sell',
  })
}
