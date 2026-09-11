/**
 * @file apps/cms/src/app/api/admin/coupons/[id]/route.ts
 * @description BFF for single coupon - admin-only safe boundary.
 * GET    /api/admin/coupons/[id] -> { doc }
 * PATCH  /api/admin/coupons/[id] -> { success, doc } (identity fields code/vendor/discount_type locked)
 * DELETE /api/admin/coupons/[id] -> { success } (hard delete; prefer paused/archived status)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { validateCouponFields } from '@/collections/Coupons'

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
    vendor: raw.vendor ?? null,
    merchant_scope: str(raw.merchant_scope, 'all_vendor_branches'),
    merchants: Array.isArray(raw.merchants) ? raw.merchants : [],
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

// Identity + counter fields are never patched (history + uniqueness stay stable)
const PATCH_FIELDS = [
  'description', 'status', 'amount', 'max_discount_amount',
  'applies_to', 'free_delivery', 'delivery_discount_cap', 'merchant_scope', 'merchants',
  'menu_items', 'excluded_menu_items', 'menu_categories', 'excluded_menu_categories',
  'exclude_promo_items', 'minimum_basket', 'maximum_basket', 'limit_per_order_items',
  'individual_use', 'max_coupons_per_order', 'starts_at', 'expires_at',
  'usage_limit', 'usage_limit_per_user', 'email_restrictions', 'phone_restrictions',
  'first_order_only', 'allowed_payment_methods', 'time_windows', 'funded_by', 'vendor_share_pct',
] as const

type RouteParams = { params: Promise<{ id: string }> }

function parseId(id: string): number | string {
  const n = Number(id)
  return Number.isFinite(n) ? n : id
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let doc: Record<string, any>
    try {
      doc = (await payload.findByID({ collection: 'coupons', id: parseId(id) as number, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      return NextResponse.json({ error: 'Coupon not found', details: e?.message }, { status: 404 })
    }
    if (!doc) return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    return NextResponse.json({ doc: sanitizeCoupon(doc) })
  } catch (err: any) {
    console.error('[admin/coupons/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load coupon' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (body.code !== undefined || body.vendor !== undefined || body.discount_type !== undefined) {
      return NextResponse.json(
        { error: 'code, vendor, and discount_type are locked after creation. Archive this coupon and create a new one instead.' },
        { status: 400 },
      )
    }

    let current: Record<string, any>
    try {
      current = (await payload.findByID({ collection: 'coupons', id: parseId(id) as number, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
    } catch {
      return NextResponse.json({ error: 'Coupon not found' }, { status: 404 })
    }

    const patch: Record<string, any> = {}
    for (const key of PATCH_FIELDS) {
      if (body[key] !== undefined) patch[key] = body[key]
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
    }

    const merged = { ...(current as object), ...patch } as Record<string, any>
    const error = validateCouponFields(merged)
    if (error) return NextResponse.json({ error }, { status: 400 })

    try {
      const updated = (await payload.update({
        collection: 'coupons',
        id: parseId(id) as number,
        data: patch as any,
        depth: 1,
        overrideAccess: true,
      })) as unknown as Record<string, any>
      return NextResponse.json({ success: true, message: 'Coupon updated successfully', doc: sanitizeCoupon(updated) })
    } catch (e: any) {
      const msg = e?.message || 'Failed to update coupon'
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[admin/coupons/[id]] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Update failed' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    try {
      await payload.delete({ collection: 'coupons', id: parseId(id) as number, overrideAccess: true })
    } catch (e: any) {
      return NextResponse.json({ error: 'Coupon not found', details: e?.message }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: 'Coupon deleted. Past order history keeps its snapshots.' })
  } catch (err: any) {
    console.error('[admin/coupons/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Delete failed' }, { status: 500 })
  }
}
