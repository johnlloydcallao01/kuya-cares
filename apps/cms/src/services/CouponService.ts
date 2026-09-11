import type { Payload } from 'payload'
import crypto from 'crypto'
import { normalizeCouponCode } from '../collections/Coupons'

export type DiscountType = 'percent' | 'fixed_cart' | 'fixed_product'
export type FundedBy = 'platform' | 'vendor' | 'split'

export type CouponLineItem = {
  productId: string
  merchantProductId?: string | null
  categoryIds?: string[]
  qty: number
  unitPrice: number
  lineTotal: number
  isPromo?: boolean
}

export type CouponValidateInput = {
  code: string
  customerId: number | string
  merchantId: number | string
  deliveryFee?: number
  paymentMethod?: string
  foodSubtotal?: number
  lineItems?: CouponLineItem[]
  isFirstOrder?: boolean
  now?: Date
  excludeOrderId?: number | string
  existingCouponCount?: number
}

export type CouponSuccess = {
  valid: true
  couponId: number | string
  code: string
  discountType: DiscountType
  foodDiscount: number
  deliveryDiscount: number
  totalDiscount: number
  platformShare: number
  vendorShare: number
  fundedBy: FundedBy
  vendorSharePct: number
  freeDeliveryApplied: boolean
  foodSubtotal: number
  maxCouponsPerOrder: number
  couponSnapshot: Record<string, unknown>
}

export type CouponFailure = {
  valid: false
  reason: string
  wooCode: number
  message: string
}

export type CouponValidation = CouponSuccess | CouponFailure

export const COUPON_HOLD_MINUTES = 15

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

export function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

export function toCents(n: number): number {
  return Math.round(Number(n) * 100)
}

export function relId(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in (value as any)) {
    return String((value as any).id)
  }
  return ''
}

export function relIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const single = relId(value)
    return single ? [single] : []
  }
  return value.map((v) => relId(v)).filter(Boolean)
}

export function matchWildcard(value: string, patterns: unknown): boolean {
  const v = String(value ?? '').trim().toLowerCase()
  if (!v) return false
  const list = (Array.isArray(patterns) ? patterns : [patterns])
    .map((p) => String(p ?? '').trim().toLowerCase())
    .filter(Boolean)
  if (list.length === 0) return false
  return list.some((p) => {
    const regex = new RegExp(
      `^${p
        .split('*')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*')}$`,
    )
    return regex.test(v)
  })
}

export function splitFunding(
  total: number,
  fundedBy: FundedBy,
  vendorSharePct: number,
): { platformShare: number; vendorShare: number } {
  const t = roundMoney(total)
  if (fundedBy === 'vendor') return { platformShare: 0, vendorShare: t }
  if (fundedBy === 'split') {
    const pct = Math.min(99, Math.max(1, Number(vendorSharePct) || 0))
    const vendorShare = roundMoney((t * pct) / 100)
    return { platformShare: roundMoney(t - vendorShare), vendorShare }
  }
  return { platformShare: t, vendorShare: 0 }
}

type FoodMath = {
  matched: boolean
  invalid?: boolean
  discount: number
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => String(v ?? '')).filter(Boolean)
}

/**
 * Food-subtotal discount math (pesos). WooCommerce semantics:
 * percent = per-line floor + remainder, fixed_product = min(unit, amount) x units,
 * fixed_cart = per-unit share + remainder. Never negative, never exceeds subtotal.
 */
export function computeFoodDiscount(
  coupon: Record<string, any>,
  lines: CouponLineItem[],
  foodSubtotal: number,
): FoodMath {
  const type = coupon.discount_type as DiscountType
  const amount = Number(coupon.amount) || 0
  const allowItems = new Set(strList(coupon.menu_items).map((v) => relId(v)))
  const allowCats = new Set(strList(coupon.menu_categories).map((v) => relId(v)))
  const exclItems = new Set(strList(coupon.excluded_menu_items).map((v) => relId(v)))
  const exclCats = new Set(strList(coupon.excluded_menu_categories).map((v) => relId(v)))
  const hasAllowlist = allowItems.size > 0 || allowCats.size > 0
  const excludePromo = coupon.exclude_promo_items === true

  const usable = lines.filter((l) => l.qty > 0 && l.lineTotal > 0)
  if (usable.length === 0) return { matched: false, discount: 0 }

  const inAllowlist = (l: CouponLineItem): boolean => {
    if (!hasAllowlist) return true
    if (allowItems.has(l.productId)) return true
    if (l.merchantProductId && allowItems.has(l.merchantProductId)) return true
    return (l.categoryIds ?? []).some((c) => allowCats.has(String(c)))
  }
  const isExcluded = (l: CouponLineItem): boolean => {
    if (exclItems.has(l.productId)) return true
    if (l.merchantProductId && exclItems.has(l.merchantProductId)) return true
    if ((l.categoryIds ?? []).some((c) => exclCats.has(String(c)))) return true
    if (excludePromo && l.isPromo) return true
    return false
  }

  if (type === 'fixed_cart') {
    if (hasAllowlist && !usable.some((l) => inAllowlist(l) && !isExcluded(l))) {
      return { matched: false, discount: 0 }
    }
    // Cart-type coupons: an excluded/promo line invalidates the whole coupon (Woo §4 step 10)
    if (usable.some((l) => isExcluded(l))) {
      return { matched: false, invalid: true, discount: 0 }
    }
    const eligible = hasAllowlist ? usable.filter((l) => inAllowlist(l)) : usable
    if (eligible.length === 0) return { matched: false, discount: 0 }
    const totalQty = eligible.reduce((s, l) => s + l.qty, 0)
    if (totalQty <= 0) return { matched: false, discount: 0 }
    const perUnitCents = Math.floor(toCents(amount) / totalQty)
    const fixedDiscount = fixedProductMath(perUnitCents / 100, eligible, null, foodSubtotal)
    const remainder = roundMoney(amount - fixedDiscount)
    return { matched: true, discount: roundMoney(Math.min(fixedDiscount + Math.max(0, remainder), foodSubtotal)) }
  }

  // Product types: skip non-matching lines; need at least one survivor
  const eligible = usable.filter((l) => inAllowlist(l) && !isExcluded(l))
  if (eligible.length === 0) return { matched: false, discount: 0 }

  if (type === 'percent') {
    const pct = Math.min(100, Math.max(0, amount))
    const sorted = [...eligible].sort((a, b) => b.lineTotal - a.lineTotal)
    let floored = 0
    const perLine: number[] = sorted.map((l) => {
      const d = Math.floor(toCents(l.lineTotal) * (pct / 100)) / 100
      floored = roundMoney(floored + d)
      return d
    })
    const raw = roundMoney((toCents(foodSubtotalEligible(eligible)) * pct) / 10000)
    let leftover = Math.max(0, roundMoney(raw - floored))
    const order = sorted.map((_, i) => i)
    for (const i of order) {
      if (leftover <= 0) break
      perLine[i] = roundMoney(perLine[i] + 0.01)
      leftover = roundMoney(leftover - 0.01)
    }
    let total = perLine.reduce((s, d) => s + d, 0)
    const cap = coupon.max_discount_amount !== undefined && coupon.max_discount_amount !== null
      ? Number(coupon.max_discount_amount)
      : NaN
    if (Number.isFinite(cap) && cap > 0) total = Math.min(total, cap)
    return { matched: true, discount: roundMoney(Math.min(total, foodSubtotal)) }
  }

  // fixed_product
  const limitRaw = coupon.limit_per_order_items
  const limit = limitRaw === undefined || limitRaw === null ? null : Number(limitRaw)
  const discount = fixedProductMath(amount, eligible, Number.isFinite(limit as number) ? (limit as number) : null, foodSubtotal)
  return { matched: true, discount }
}

function foodSubtotalEligible(lines: CouponLineItem[]): number {
  return roundMoney(lines.reduce((s, l) => s + l.lineTotal, 0))
}

function fixedProductMath(
  amountPerUnit: number,
  eligible: CouponLineItem[],
  unitLimit: number | null,
  foodSubtotal: number,
): number {
  const sorted = [...eligible].sort((a, b) => b.unitPrice - a.unitPrice)
  let unitsLeft = unitLimit && unitLimit > 0 ? Math.floor(unitLimit) : Number.POSITIVE_INFINITY
  let total = 0
  for (const l of sorted) {
    if (unitsLeft <= 0) break
    const units = Math.min(l.qty, unitsLeft)
    total = roundMoney(total + Math.min(amountPerUnit, l.unitPrice) * units)
    unitsLeft -= units
  }
  return roundMoney(Math.min(total, foodSubtotal))
}

function timeToMinutes(raw: unknown): number {
  const m = String(raw ?? '').trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return NaN
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return NaN
  return h * 60 + min
}

export function isInTimeWindows(windows: unknown, now: Date, timeZone: string): boolean {
  if (!Array.isArray(windows) || windows.length === 0) return true
  let day: string
  let minutes: number
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    const wd = get('weekday').toLowerCase().slice(0, 3)
    day = wd === 'thu' ? 'thu' : wd === 'tue' ? 'tue' : wd
    minutes = Number(get('hour')) * 60 + Number(get('minute'))
  } catch {
    day = DAY_KEYS[now.getUTCDay()]
    minutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  }
  return (windows as any[]).some((w) => {
    const days = (Array.isArray(w?.days) ? w.days : []).map((d: unknown) => String(d).toLowerCase())
    if (days.length > 0 && !days.includes(day)) return false
    const start = timeToMinutes(w?.start_time)
    const end = timeToMinutes(w?.end_time)
    if (Number.isNaN(start) || Number.isNaN(end)) return true
    if (start <= end) return minutes >= start && minutes <= end
    return minutes >= start || minutes <= end
  })
}

export class CouponService {
  constructor(private readonly payload: Payload) {}

  async getActiveCart(customerId: number | string, merchantId: number | string): Promise<{ subtotal: number; lines: CouponLineItem[] }> {
    const res = await (this.payload as any).find({
      collection: 'cart-items',
      where: {
        and: [
          { customer: { equals: customerId } },
          { merchant: { equals: merchantId } },
          { status: { equals: 'active' } },
        ],
      },
      depth: 2,
      limit: 200,
      pagination: false,
    })
    const docs = (((res as any)?.docs ?? []) as any[])
    const lines: CouponLineItem[] = docs.map((d) => {
      const product = (d.product && typeof d.product === 'object' ? d.product : null) as any
      const cats = product?.product_categories
      const categoryIds = (Array.isArray(cats) ? cats : cats ? [cats] : []).map((c: any) => relId(c)).filter(Boolean)
      const unitPrice = Number(d.priceAtAdd ?? d.price_at_add ?? 0) || 0
      const compare = d.compareAtPrice ?? d.compare_at_price
      return {
        productId: relId(d.product),
        merchantProductId: relId(d.merchantProduct ?? d.merchant_product) || null,
        categoryIds,
        qty: Number(d.quantity) || 0,
        unitPrice,
        lineTotal: Number(d.subtotal) || 0,
        isPromo: compare !== undefined && compare !== null && Number(compare) > unitPrice,
      }
    })
    const subtotal = roundMoney(lines.reduce((s, l) => s + (l.lineTotal || 0), 0))
    return { subtotal, lines }
  }

  async countOrders(customerId: number | string, excludeOrderId?: number | string): Promise<number> {
    const and: any[] = [{ customer: { equals: customerId } }, { status: { not_equals: 'cancelled' } }]
    if (excludeOrderId !== undefined && excludeOrderId !== null && String(excludeOrderId) !== '') {
      and.push({ id: { not_equals: Number(excludeOrderId) || excludeOrderId } })
    }
    const res = await (this.payload as any).count({
      collection: 'orders',
      where: { and },
    })
    return Number((res as any)?.totalDocs ?? 0) || 0
  }

  async countRedemptions(couponId: number | string, contact: { customerId?: number | string; email?: string; phone?: string }): Promise<number> {
    const counts: number[] = []
    if (contact.customerId !== undefined && String(contact.customerId) !== '') {
      const r = await (this.payload as any).count({
        collection: 'coupon-redemptions',
        where: {
          and: [{ coupon: { equals: couponId } }, { customer: { equals: contact.customerId } }, { status: { in: ['held', 'applied'] } }],
        },
      })
      counts.push(Number((r as any)?.totalDocs ?? 0) || 0)
    }
    if (contact.email) {
      const r = await (this.payload as any).count({
        collection: 'coupon-redemptions',
        where: {
          and: [{ coupon: { equals: couponId } }, { customer_email: { equals: contact.email.toLowerCase() } }, { status: { in: ['held', 'applied'] } }],
        },
      })
      counts.push(Number((r as any)?.totalDocs ?? 0) || 0)
    }
    if (contact.phone) {
      const r = await (this.payload as any).count({
        collection: 'coupon-redemptions',
        where: {
          and: [{ coupon: { equals: couponId } }, { customer_phone: { equals: contact.phone } }, { status: { in: ['held', 'applied'] } }],
        },
      })
      counts.push(Number((r as any)?.totalDocs ?? 0) || 0)
    }
    return counts.length ? Math.max(...counts) : 0
  }

  async countActiveHolds(couponId: number | string, now: Date): Promise<number> {
    const r = await (this.payload as any).count({
      collection: 'coupon-redemptions',
      where: {
        and: [{ coupon: { equals: couponId } }, { status: { equals: 'held' } }, { held_until: { greater_than: now.toISOString() } }],
      },
    })
    return Number((r as any)?.totalDocs ?? 0) || 0
  }

  private async couponsEnabled(): Promise<boolean> {
    try {
      const settings = await (this.payload as any).findGlobal({ slug: 'system-settings' })
      if (settings && typeof settings === 'object' && 'couponsEnabled' in settings) {
        return (settings as any).couponsEnabled !== false
      }
    } catch {
      // Global missing or unreachable: fail open (coupons usable)
    }
    return true
  }

  private async customerContact(customerId: number | string): Promise<{ email?: string; phone?: string }> {
    try {
      const customer = await (this.payload as any).findByID({ collection: 'customers', id: customerId, depth: 1 })
      const email = typeof customer?.email === 'string' && customer.email.trim()
        ? customer.email.trim()
        : undefined
      let phone: string | undefined
      const user = (customer as any)?.user
      if (user && typeof user === 'object') {
        if (typeof user.phone === 'string' && user.phone.trim()) phone = user.phone.trim()
      }
      return { email, phone }
    } catch {
      return {}
    }
  }

  async validate(input: CouponValidateInput): Promise<CouponValidation> {
    const now = input.now ?? new Date()
    const code = normalizeCouponCode(input.code)
    if (!code) {
      return { valid: false, reason: 'COUPON_NOT_FOUND', wooCode: 105, message: 'Please enter a coupon code.' }
    }
    if (!(await this.couponsEnabled())) {
      return { valid: false, reason: 'COUPON_DISABLED', wooCode: 100, message: 'Coupons are currently disabled. Please try again later.' }
    }

    const found = await (this.payload as any).find({
      collection: 'coupons',
      where: { code: { equals: code } },
      limit: 20,
      depth: 0,
      pagination: false,
    })
    const candidates = (((found as any)?.docs ?? []) as any[])
    if (candidates.length === 0) {
      return { valid: false, reason: 'COUPON_NOT_FOUND', wooCode: 105, message: `Coupon "${code}" does not exist.` }
    }

    let merchantVendorId = ''
    let merchantTimeZone = 'Asia/Manila'
    try {
      const merchant = await (this.payload as any).findByID({ collection: 'merchants', id: input.merchantId, depth: 0 })
      merchantVendorId = relId((merchant as any)?.vendor)
      if (typeof (merchant as any)?.timezone === 'string' && (merchant as any).timezone.trim()) {
        merchantTimeZone = (merchant as any).timezone.trim()
      }
    } catch {
      return { valid: false, reason: 'WRONG_STORE', wooCode: 109, message: 'This store could not be found.' }
    }

    const ordered = [...candidates].sort((a, b) => {
      const aVendor = relId(a.vendor)
      const bVendor = relId(b.vendor)
      const aScore = aVendor && aVendor === merchantVendorId ? 0 : aVendor ? 2 : 1
      const bScore = bVendor && bVendor === merchantVendorId ? 0 : bVendor ? 2 : 1
      return aScore - bScore
    })

    let lines = input.lineItems
    let foodSubtotal = input.foodSubtotal
    if (!lines || foodSubtotal === undefined) {
      const cart = await this.getActiveCart(input.customerId, input.merchantId)
      if (!lines) lines = cart.lines
      if (foodSubtotal === undefined) foodSubtotal = cart.subtotal
    }
    foodSubtotal = roundMoney(Number(foodSubtotal) || 0)
    const deliveryFee = roundMoney(Number(input.deliveryFee) || 0)

    const contact = await this.customerContact(input.customerId)
    const email = contact.email
    const phone = contact.phone

    let isFirstOrder = input.isFirstOrder
    if (isFirstOrder === undefined) {
      try {
        isFirstOrder = (await this.countOrders(input.customerId, input.excludeOrderId)) === 0
      } catch {
        isFirstOrder = false
      }
    }

    let fallback: CouponFailure | null = null
    for (const coupon of ordered) {
      const result = await this.checkCoupon(coupon, {
        merchantId: String(input.merchantId),
        merchantVendorId,
        merchantTimeZone,
        lines: lines ?? [],
        foodSubtotal,
        deliveryFee,
        paymentMethod: input.paymentMethod,
        email,
        phone,
        isFirstOrder: !!isFirstOrder,
        now,
        customerId: input.customerId,
        existingCouponCount: input.existingCouponCount ?? 0,
      })
      if (result.valid) return result
      if (!fallback) fallback = result
    }
    return fallback ?? { valid: false, reason: 'COUPON_NOT_FOUND', wooCode: 105, message: `Coupon "${code}" does not exist.` }
  }

  private async checkCoupon(
    coupon: any,
    ctx: {
      merchantId: string
      merchantVendorId: string
      merchantTimeZone: string
      lines: CouponLineItem[]
      foodSubtotal: number
      deliveryFee: number
      paymentMethod?: string
      email?: string
      phone?: string
      isFirstOrder: boolean
      now: Date
      customerId: number | string
      existingCouponCount: number
    },
  ): Promise<CouponValidation> {
    const couponId = coupon.id as number | string
    const code = String(coupon.code ?? '')

    // 2. Published + active window (Woo 105/107)
    if (coupon.status !== 'published') {
      const msg = coupon.status === 'scheduled'
        ? `Coupon "${code}" is not active yet.`
        : coupon.status === 'paused' || coupon.status === 'archived'
          ? `Coupon "${code}" is no longer active.`
          : `Coupon "${code}" is not available.`
      return { valid: false, reason: 'COUPON_NOT_ACTIVE', wooCode: 105, message: msg }
    }
    const startsAt = coupon.starts_at ? new Date(coupon.starts_at).getTime() : NaN
    const expiresAt = coupon.expires_at ? new Date(coupon.expires_at).getTime() : NaN
    const nowMs = ctx.now.getTime()
    if (!Number.isNaN(startsAt) && nowMs < startsAt) {
      return { valid: false, reason: 'COUPON_NOT_STARTED', wooCode: 107, message: `Coupon "${code}" is not active yet.` }
    }
    if (!Number.isNaN(expiresAt) && nowMs > expiresAt) {
      return { valid: false, reason: 'COUPON_EXPIRED', wooCode: 107, message: `Coupon "${code}" has expired.` }
    }

    // 3. Global usage limit incl. tentative holds (Woo 106)
    const usageLimit = Number(coupon.usage_limit) || 0
    if (usageLimit > 0) {
      const used = Number(coupon.usage_count) || 0
      let holds = 0
      try {
        holds = await this.countActiveHolds(couponId, ctx.now)
      } catch {
        holds = 0
      }
      if (used + holds >= usageLimit) {
        return { valid: false, reason: 'USAGE_LIMIT_REACHED', wooCode: 106, message: `Coupon "${code}" has reached its redemption limit.` }
      }
    }

    // 4. Per-customer limit (Woo 106)
    const perUser = Number(coupon.usage_limit_per_user) || 0
    if (perUser > 0) {
      let mine = 0
      try {
        mine = await this.countRedemptions(couponId, { customerId: ctx.customerId, email: ctx.email, phone: ctx.phone })
      } catch {
        mine = 0
      }
      if (mine >= perUser) {
        return { valid: false, reason: 'USER_LIMIT_REACHED', wooCode: 106, message: `You have already used coupon "${code}" the maximum number of times.` }
      }
    }

    // 5. Basket bounds vs food subtotal (Woo 108/112)
    const min = coupon.minimum_basket !== undefined && coupon.minimum_basket !== null ? Number(coupon.minimum_basket) : NaN
    const max = coupon.maximum_basket !== undefined && coupon.maximum_basket !== null ? Number(coupon.maximum_basket) : NaN
    if (Number.isFinite(min) && min > 0 && ctx.foodSubtotal < min) {
      return { valid: false, reason: 'MIN_BASKET', wooCode: 108, message: `Add ₱${min.toLocaleString()} more to use coupon "${code}" (minimum ₱${min.toLocaleString()}).` }
    }
    if (Number.isFinite(max) && max > 0 && ctx.foodSubtotal > max) {
      return { valid: false, reason: 'MAX_BASKET', wooCode: 112, message: `Coupon "${code}" only works for baskets up to ₱${max.toLocaleString()}.` }
    }

    // 6. Vendor / branch gate (platform extension, Woo 109 class)
    const couponVendorId = relId(coupon.vendor)
    if (couponVendorId && couponVendorId !== ctx.merchantVendorId) {
      return { valid: false, reason: 'WRONG_STORE', wooCode: 109, message: `Coupon "${code}" is not valid for this store.` }
    }
    if (coupon.merchant_scope === 'selected_branches') {
      const allowed = new Set(relIdList(coupon.merchants))
      if (!allowed.has(ctx.merchantId)) {
        return { valid: false, reason: 'WRONG_STORE', wooCode: 109, message: `Coupon "${code}" is not valid for this branch.` }
      }
    }

    // 7-8. Menu scoping + excludes (Woo 109/113/114)
    const appliesToFood = coupon.applies_to === 'food_subtotal' || coupon.applies_to === 'both' || !coupon.applies_to
    let foodDiscount = 0
    if (appliesToFood) {
      const math = computeFoodDiscount(coupon, ctx.lines, ctx.foodSubtotal)
      if (math.invalid) {
        return { valid: false, reason: 'EXCLUDED_ITEMS', wooCode: 113, message: `Coupon "${code}" cannot be used with items in your basket.` }
      }
      if (!math.matched) {
        return { valid: false, reason: 'NO_MATCHING_ITEMS', wooCode: 109, message: `Coupon "${code}" does not apply to items in your basket.` }
      }
      foodDiscount = math.discount
    } else if (ctx.lines.length === 0 && ctx.foodSubtotal <= 0) {
      return { valid: false, reason: 'NO_MATCHING_ITEMS', wooCode: 109, message: `Coupon "${code}" does not apply to your basket.` }
    }

    // 9. Sale guard is inside computeFoodDiscount for fixed_cart (invalid) — surface promo-only failure
    if (coupon.exclude_promo_items === true && (coupon.discount_type === 'percent' || coupon.discount_type === 'fixed_product')) {
      const promoOnly = ctx.lines.length > 0 && ctx.lines.every((l) => l.isPromo || l.lineTotal <= 0)
      if (promoOnly && foodDiscount <= 0 && appliesToFood) {
        return { valid: false, reason: 'PROMO_ITEMS_EXCLUDED', wooCode: 110, message: `Coupon "${code}" cannot be used with items already on promo.` }
      }
    }

    // 10. Contact allowlists (Woo 102)
    const emails = Array.isArray(coupon.email_restrictions) ? coupon.email_restrictions : []
    const phones = Array.isArray(coupon.phone_restrictions) ? coupon.phone_restrictions : []
    if (emails.length > 0 || phones.length > 0) {
      const emailOk = emails.length > 0 && ctx.email ? matchWildcard(ctx.email, emails) : false
      const phoneOk = phones.length > 0 && ctx.phone ? matchWildcard(ctx.phone, phones) : false
      const needsEmail = emails.length > 0
      const needsPhone = phones.length > 0
      const ok = needsEmail && needsPhone ? emailOk || phoneOk : needsEmail ? emailOk : phoneOk
      if (!ok) {
        return { valid: false, reason: 'CONTACT_NOT_ALLOWED', wooCode: 102, message: `Coupon "${code}" is not available for your account.` }
      }
    }

    // 11. Platform extensions: first order, payment method, time windows
    if (coupon.first_order_only === true && !ctx.isFirstOrder) {
      return { valid: false, reason: 'FIRST_ORDER_ONLY', wooCode: 109, message: `Coupon "${code}" is only for first-time customers.` }
    }
    const allowedMethods = Array.isArray(coupon.allowed_payment_methods) ? coupon.allowed_payment_methods.map((m: unknown) => String(m)) : []
    if (allowedMethods.length > 0 && ctx.paymentMethod && !allowedMethods.includes(ctx.paymentMethod)) {
      return { valid: false, reason: 'PAYMENT_NOT_ALLOWED', wooCode: 109, message: `Coupon "${code}" cannot be used with this payment method.` }
    }
    if (!isInTimeWindows(coupon.time_windows, ctx.now, ctx.merchantTimeZone)) {
      return { valid: false, reason: 'OUTSIDE_SCHEDULE', wooCode: 107, message: `Coupon "${code}" is not available right now. Please try again during promo hours.` }
    }

    // 12. One coupon per order (Woo 104 class, inverted default)
    const maxPerOrder = Number(coupon.max_coupons_per_order) || 1
    if (ctx.existingCouponCount >= maxPerOrder) {
      return { valid: false, reason: 'ALREADY_APPLIED', wooCode: 104, message: 'A coupon has already been applied to this order.' }
    }

    // Delivery leg
    let deliveryDiscount = 0
    let freeDeliveryApplied = false
    const appliesTo = (coupon.applies_to as string) || 'food_subtotal'
    if (ctx.deliveryFee > 0 && (appliesTo === 'delivery_fee' || appliesTo === 'both' || coupon.free_delivery === true)) {
      if (coupon.free_delivery === true) {
        const cap = coupon.delivery_discount_cap !== undefined && coupon.delivery_discount_cap !== null
          ? Number(coupon.delivery_discount_cap)
          : NaN
        deliveryDiscount = Number.isFinite(cap) && cap > 0 ? Math.min(ctx.deliveryFee, cap) : ctx.deliveryFee
        freeDeliveryApplied = deliveryDiscount >= ctx.deliveryFee
      } else if (appliesTo === 'delivery_fee' || appliesTo === 'both') {
        const type = coupon.discount_type as DiscountType
        const amount = Number(coupon.amount) || 0
        if (type === 'percent') {
          deliveryDiscount = roundMoney((toCents(ctx.deliveryFee) * Math.min(100, Math.max(0, amount))) / 10000)
          const cap = coupon.delivery_discount_cap !== undefined && coupon.delivery_discount_cap !== null
            ? Number(coupon.delivery_discount_cap)
            : NaN
          if (Number.isFinite(cap) && cap > 0) deliveryDiscount = Math.min(deliveryDiscount, cap)
        } else if (type === 'fixed_cart') {
          if (appliesTo === 'delivery_fee') {
            deliveryDiscount = Math.min(amount, ctx.deliveryFee)
          } else {
            const remainder = roundMoney(amount - foodDiscount)
            deliveryDiscount = remainder > 0 ? Math.min(remainder, ctx.deliveryFee) : 0
          }
        }
      }
      deliveryDiscount = roundMoney(Math.min(deliveryDiscount, ctx.deliveryFee))
    }

    foodDiscount = roundMoney(foodDiscount)
    const totalDiscount = roundMoney(Math.min(foodDiscount + deliveryDiscount, ctx.foodSubtotal + ctx.deliveryFee))
    if (totalDiscount <= 0) {
      return { valid: false, reason: 'NO_MATCHING_ITEMS', wooCode: 109, message: `Coupon "${code}" does not change your total.` }
    }

    const fundedBy = (coupon.funded_by as FundedBy) || 'platform'
    const vendorSharePct = Number(coupon.vendor_share_pct) || 0
    const { platformShare, vendorShare } = splitFunding(totalDiscount, fundedBy, vendorSharePct)

    return {
      valid: true,
      couponId,
      code,
      discountType: coupon.discount_type as DiscountType,
      foodDiscount,
      deliveryDiscount,
      totalDiscount,
      platformShare,
      vendorShare,
      fundedBy,
      vendorSharePct,
      freeDeliveryApplied,
      foodSubtotal: ctx.foodSubtotal,
      maxCouponsPerOrder: maxPerOrder,
      couponSnapshot: {
        id: couponId,
        code,
        type: coupon.discount_type,
        amount: Number(coupon.amount) || 0,
        applies_to: appliesTo,
        free_delivery: coupon.free_delivery === true,
      },
    }
  }

  /**
   * Server-side coupon application. Creates the order-discount row + held
   * redemption and rewrites the order totals atomically (best-effort sequence).
   * Only pending orders can take a coupon.
   */
  async applyToOrder(args: { orderId: number | string; code: string; customerId: number | string }): Promise<CouponValidation & { orderTotal?: number; discountId?: number | string }> {
    const order = await (this.payload as any).findByID({ collection: 'orders', id: args.orderId, depth: 0 })
    if (!order) {
      return { valid: false, reason: 'ORDER_NOT_FOUND', wooCode: 105, message: 'Order not found.' }
    }
    if (String(order.status) !== 'pending') {
      return { valid: false, reason: 'ORDER_NOT_EDITABLE', wooCode: 104, message: 'Coupons can only be applied to unpaid orders.' }
    }
    if (relId(order.customer) !== String(args.customerId)) {
      return { valid: false, reason: 'CONTACT_NOT_ALLOWED', wooCode: 102, message: 'This order does not belong to your account.' }
    }
    const merchantId = relId(order.merchant)

    let existing: any[] = []
    try {
      const found = await (this.payload as any).find({
        collection: 'order-discounts',
        where: { order: { equals: args.orderId } },
        limit: 10,
        depth: 0,
        pagination: false,
      })
      existing = (((found as any)?.docs ?? []) as any[])
    } catch {
      existing = []
    }

    const subtotal = Number(order.subtotal) || 0
    const deliveryFee = Number(order.delivery_fee) || 0
    const platformFee = Number(order.platform_fee) || 0
    const priorityFee = Number((order as any).priority_fee) || 0
    const currentDiscount = Number((order as any).discount_total) || 0

    const cart = await this.getActiveCart(args.customerId, merchantId)
    const validation = await this.validate({
      code: args.code,
      customerId: args.customerId,
      merchantId,
      deliveryFee,
      foodSubtotal: subtotal,
      lineItems: cart.lines.length > 0 ? cart.lines : undefined,
      excludeOrderId: args.orderId,
      existingCouponCount: existing.length,
    })
    if (!validation.valid) return validation

    const v = validation as CouponSuccess
    const newDiscountTotal = roundMoney(currentDiscount + v.totalDiscount)
    const newTotal = roundMoney(Math.max(0, subtotal + deliveryFee + platformFee + priorityFee - newDiscountTotal))

    const discountDoc = await (this.payload as any).create({
      collection: 'order-discounts',
      data: {
        order: args.orderId,
        code: v.code,
        amount_off: v.totalDiscount,
        type: v.discountType === 'percent' ? 'percentage' : 'fixed',
        coupon: v.couponId,
        coupon_snapshot: v.couponSnapshot,
        food_discount: v.foodDiscount,
        delivery_discount: v.deliveryDiscount,
        funded_by: v.fundedBy,
        vendor_share_pct: v.vendorSharePct,
        platform_share: v.platformShare,
        vendor_share: v.vendorShare,
        source: 'coupon',
      },
    })

    const now = new Date()
    await (this.payload as any).create({
      collection: 'coupon-redemptions',
      data: {
        coupon: v.couponId,
        order: args.orderId,
        customer: args.customerId,
        code_snapshot: v.code,
        coupon_snapshot: v.couponSnapshot,
        food_discount: v.foodDiscount,
        delivery_discount: v.deliveryDiscount,
        total_discount: v.totalDiscount,
        funded_by: v.fundedBy,
        vendor_share_pct: v.vendorSharePct,
        platform_share: v.platformShare,
        vendor_share: v.vendorShare,
        status: 'held',
        held_until: new Date(now.getTime() + COUPON_HOLD_MINUTES * 60 * 1000).toISOString(),
        hold_key: crypto.randomUUID(),
      },
    })

    await (this.payload as any).update({
      collection: 'orders',
      id: args.orderId,
      data: {
        discount_total: newDiscountTotal,
        coupon_code: v.code,
        free_delivery_applied: v.freeDeliveryApplied || (order as any).free_delivery_applied === true,
        total: newTotal,
      },
    })

    return { ...v, orderTotal: newTotal, discountId: (discountDoc as any)?.id }
  }

  /** Promote held redemptions on payment success, release on failure. Never throws. */
  async finalizeForOrder(orderId: number | string, paid: boolean): Promise<void> {
    try {
      const found = await (this.payload as any).find({
        collection: 'coupon-redemptions',
        where: { and: [{ order: { equals: orderId } }, { status: { equals: 'held' } }] },
        limit: 10,
        depth: 0,
        pagination: false,
      })
      const docs = (((found as any)?.docs ?? []) as any[])
      for (const doc of docs) {
        try {
          await (this.payload as any).update({
            collection: 'coupon-redemptions',
            id: doc.id,
            data: { status: paid ? 'applied' : 'cancelled' },
          })
          if (paid) {
            const couponId = relId(doc.coupon)
            if (couponId) {
              try {
                const coupon = await (this.payload as any).findByID({ collection: 'coupons', id: couponId, depth: 0 })
                await (this.payload as any).update({
                  collection: 'coupons',
                  id: couponId,
                  data: { usage_count: (Number((coupon as any)?.usage_count) || 0) + 1 },
                })
              } catch {
                // counter best-effort; holds still prevent oversell at validate time
              }
            }
          }
        } catch {
          // per-row best effort
        }
      }
    } catch (e) {
      console.error('[coupons] finalizeForOrder error:', e)
    }
  }

  /** Reverse applied redemptions on refund/cancel. Never throws. */
  async reverseForOrder(orderId: number | string, to: 'refunded' | 'cancelled'): Promise<void> {
    try {
      const found = await (this.payload as any).find({
        collection: 'coupon-redemptions',
        where: { and: [{ order: { equals: orderId } }, { status: { in: ['held', 'applied'] } }] },
        limit: 10,
        depth: 0,
        pagination: false,
      })
      const docs = (((found as any)?.docs ?? []) as any[])
      for (const doc of docs) {
        try {
          await (this.payload as any).update({
            collection: 'coupon-redemptions',
            id: doc.id,
            data: { status: to },
          })
          if (doc.status === 'applied') {
            const couponId = relId(doc.coupon)
            if (couponId) {
              try {
                const coupon = await (this.payload as any).findByID({ collection: 'coupons', id: couponId, depth: 0 })
                await (this.payload as any).update({
                  collection: 'coupons',
                  id: couponId,
                  data: { usage_count: Math.max(0, (Number((coupon as any)?.usage_count) || 0) - 1) },
                })
              } catch {
                // best effort
              }
            }
          }
        } catch {
          // per-row best effort
        }
      }
    } catch (e) {
      console.error('[coupons] reverseForOrder error:', e)
    }
  }
}
