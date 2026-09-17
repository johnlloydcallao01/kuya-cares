/**
 * @file apps/cms/src/app/api/vendor/coupons/[id]/route.ts
 * @description Vendor-scoped single-coupon BFF for web-merchant /coupons/[id].
 * Every operation verifies coupon.vendor == caller's vendor id (403 otherwise).
 * Mirrors admin locking: code / vendor / discount_type are immutable after creation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'
import { normalizeCouponCode, validateCouponFields } from '@/collections/Coupons'

function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}
function num(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fb
  }
  return fb
}
function relId(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (typeof v === 'object') {
    const id = (v as Record<string, any>).id
    return relId(id)
  }
  return null
}

function sanitizeVendorBrief(raw: unknown): Record<string, any> | null {
  const id = relId(raw)
  if (id == null) return null
  if (typeof raw === 'object') {
    const v = raw as Record<string, any>
    return { id, businessName: str(v.businessName, '') }
  }
  return { id, businessName: '' }
}

function sanitizeMerchantBrief(raw: unknown): Record<string, any> | null {
  const id = relId(raw)
  if (id == null) return null
  if (typeof raw === 'object') {
    const m = raw as Record<string, any>
    return { id, outletName: str(m.outletName, `Outlet #${id}`), outletCode: str(m.outletCode, '') }
  }
  return { id, outletName: `Outlet #${id}`, outletCode: '' }
}

function sanitizeCoupon(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    code: str(raw.code, ''),
    description: raw.description ? String(raw.description) : null,
    status: str(raw.status, 'draft'),
    discount_type: str(raw.discount_type, 'fixed_cart'),
    amount: num(raw.amount, 0),
    max_discount_amount: raw.max_discount_amount ?? null,
    applies_to: str(raw.applies_to, 'food_subtotal'),
    free_delivery: !!raw.free_delivery,
    delivery_discount_cap: raw.delivery_discount_cap ?? null,
    vendor: sanitizeVendorBrief(raw.vendor),
    merchant_scope: str(raw.merchant_scope, 'all_vendor_branches'),
    merchants: Array.isArray(raw.merchants) ? raw.merchants.map(sanitizeMerchantBrief).filter(Boolean) : [],
    menu_items: Array.isArray(raw.menu_items) ? raw.menu_items : [],
    excluded_menu_items: Array.isArray(raw.excluded_menu_items) ? raw.excluded_menu_items : [],
    menu_categories: Array.isArray(raw.menu_categories) ? raw.menu_categories : [],
    excluded_menu_categories: Array.isArray(raw.excluded_menu_categories) ? raw.excluded_menu_categories : [],
    exclude_promo_items: !!raw.exclude_promo_items,
    minimum_basket: raw.minimum_basket ?? null,
    maximum_basket: raw.maximum_basket ?? null,
    limit_per_order_items: raw.limit_per_order_items ?? null,
    individual_use: raw.individual_use !== false,
    max_coupons_per_order: num(raw.max_coupons_per_order, 1),
    starts_at: raw.starts_at ? String(raw.starts_at) : null,
    expires_at: raw.expires_at ? String(raw.expires_at) : null,
    usage_limit: num(raw.usage_limit, 0),
    usage_limit_per_user: num(raw.usage_limit_per_user, 0),
    usage_count: num(raw.usage_count, 0),
    email_restrictions: Array.isArray(raw.email_restrictions) ? raw.email_restrictions : [],
    phone_restrictions: Array.isArray(raw.phone_restrictions) ? raw.phone_restrictions : [],
    first_order_only: !!raw.first_order_only,
    allowed_payment_methods: Array.isArray(raw.allowed_payment_methods) ? raw.allowed_payment_methods : [],
    time_windows: Array.isArray(raw.time_windows) ? raw.time_windows : [],
    funded_by: str(raw.funded_by, 'platform'),
    vendor_share_pct: num(raw.vendor_share_pct, 0),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

// Mutable via merchant portal. Identity (code/vendor/discount_type), usage_count
// and funding stay locked — same rule as the admin BFF.
const PATCH_FIELDS = [
  'description', 'status', 'amount', 'max_discount_amount',
  'applies_to', 'free_delivery', 'delivery_discount_cap', 'merchant_scope', 'merchants',
  'menu_items', 'excluded_menu_items', 'menu_categories', 'excluded_menu_categories',
  'exclude_promo_items', 'minimum_basket', 'maximum_basket', 'limit_per_order_items',
  'individual_use', 'max_coupons_per_order', 'starts_at', 'expires_at',
  'usage_limit', 'usage_limit_per_user', 'email_restrictions', 'phone_restrictions',
  'first_order_only', 'allowed_payment_methods', 'time_windows',
] as const

async function resolveVendorContext(payload: any, userId: string) {
  const vendorRes = await payload.find({
    collection: 'vendors',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const vendor = vendorRes.docs[0] as Record<string, any> | undefined
  if (!vendor) return { vendor: null, vendorId: null as number | null, merchantIds: [] as number[] }
  const vendorId = Number(vendor.id)
  const merchantsRes = await payload.find({
    collection: 'merchants',
    where: { vendor: { equals: vendorId } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const merchantIds = (merchantsRes.docs as Record<string, any>[]).map((m) => Number(m.id)).filter((v) => Number.isFinite(v))
  return { vendor, vendorId, merchantIds }
}

async function loadOwnedCoupon(payload: any, id: string, vendorId: number) {
  let doc: Record<string, any>
  try {
    doc = (await payload.findByID({ collection: 'coupons', id: Number(id) || id, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
  } catch {
    return { error: NextResponse.json({ error: 'Coupon not found' }, { status: 404 }) }
  }
  if (!doc) return { error: NextResponse.json({ error: 'Coupon not found' }, { status: 404 }) }
  if (relId(doc.vendor) !== vendorId) {
    return { error: NextResponse.json({ error: 'Forbidden: coupon does not belong to vendor' }, { status: 403 }) }
  }
  return { doc }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || String(authUser.id)
    const { vendorId } = await resolveVendorContext(payload, userId)
    if (vendorId == null) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    const { id } = await params
    const { doc, error } = await loadOwnedCoupon(payload, id, vendorId)
    if (error) return error
    return NextResponse.json({ doc: sanitizeCoupon(doc!) })
  } catch (err: any) {
    console.error('[vendor/coupons/:id] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load coupon' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (body.code !== undefined || body.vendor !== undefined || body.discount_type !== undefined) {
      return NextResponse.json({ error: 'code, vendor and discount_type are locked after creation. Archive this coupon and create a new one.' }, { status: 400 })
    }

    const userId = body.userId ? String(body.userId) : String(authUser.id)
    const { vendorId, merchantIds } = await resolveVendorContext(payload, userId)
    if (vendorId == null) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    const { id } = await params
    const { doc: existing, error } = await loadOwnedCoupon(payload, id, vendorId)
    if (error) return error

    const patch: Record<string, any> = {}
    for (const key of PATCH_FIELDS) {
      if (body[key] !== undefined) patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    // Branch allowlist stays inside the vendor's own outlets.
    if (patch.merchant_scope === 'selected_branches' || (patch.merchants !== undefined && String(existing!.merchant_scope) === 'selected_branches' && patch.merchant_scope === undefined)) {
      const picked = (Array.isArray(patch.merchants) ? patch.merchants : (existing as any).merchants ?? []).map((v: unknown) => relId(v)).filter((n: number | null): n is number => n != null)
      if (picked.length === 0) {
        return NextResponse.json({ error: 'Select at least one of your branches' }, { status: 400 })
      }
      const foreign = picked.filter((mid: number) => !merchantIds.includes(mid))
      if (foreign.length > 0) {
        return NextResponse.json({ error: 'Forbidden: branch does not belong to vendor', details: foreign }, { status: 403 })
      }
      patch.merchants = picked
      patch.merchant_scope = 'selected_branches'
    } else if (patch.merchant_scope === 'all_vendor_branches') {
      patch.merchants = []
    }

    const merged = { ...(existing as Record<string, any>), ...patch }
    const validationError = validateCouponFields(merged)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    try {
      const updated = (await payload.update({
        collection: 'coupons',
        id: Number(id) || id,
        data: patch as any,
        depth: 1,
        overrideAccess: true,
      })) as unknown as Record<string, any>
      return NextResponse.json({ success: true, message: 'Coupon updated', doc: sanitizeCoupon(updated) })
    } catch (e: any) {
      const msg = e?.message || 'Failed to update coupon'
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[vendor/coupons/:id] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to update coupon' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || String(authUser.id)
    const { vendorId } = await resolveVendorContext(payload, userId)
    if (vendorId == null) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    const { id } = await params
    const { error } = await loadOwnedCoupon(payload, id, vendorId)
    if (error) return error
    await payload.delete({ collection: 'coupons', id: Number(id) || id, overrideAccess: true })
    return NextResponse.json({ success: true, message: 'Coupon deleted. Past order history keeps its snapshots.' })
  } catch (err: any) {
    console.error('[vendor/coupons/:id] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to delete coupon' }, { status: 500 })
  }
}
