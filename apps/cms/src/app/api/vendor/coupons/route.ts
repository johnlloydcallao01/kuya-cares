/**
 * @file apps/cms/src/app/api/vendor/coupons/route.ts
 * @description BFF aggregation endpoint for web-merchant /coupons (vendor-scoped).
 * Follows docs/BFF-pattern.md: backend owns userId -> vendors.user -> merchants.vendor
 * resolution, joins, filtering, pagination and sanitization with overrideAccess:true.
 * Frontend (web-merchant proxy + page) is a thin consumer.
 *
 * GET  /api/vendor/coupons?userId=&page=&limit=&search=&status=&discount_type=&sort=
 *      -> { docs, pagination, stats, meta }
 * POST /api/vendor/coupons -> { doc } (vendor forced to own brand, merchants subset-checked)
 *
 * Merchant differences vs admin BFF: vendor is always the caller's own brand
 * (platform-wide coupons are not listed/created here), funding is forced to
 * platform (settlement-safe), merchants[] must belong to the vendor's outlets.
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
  if (raw == null) return null
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

const STATUS_SET = new Set(['draft', 'scheduled', 'published', 'paused', 'archived'])
const TYPE_SET = new Set(['percent', 'fixed_cart', 'fixed_product'])
const ALLOWED_SORT = new Set(['-createdAt', 'createdAt', '-expires_at', 'expires_at', 'code', '-usage_count', 'usage_count'])

const CREATE_FIELDS = [
  'code', 'description', 'status', 'discount_type', 'amount', 'max_discount_amount',
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
  if (!vendor) return { vendor: null, merchantIds: [] as number[] }
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

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || String(authUser.id)

    const { vendor, vendorId, merchantIds } = await resolveVendorContext(payload, userId)
    if (!vendor || vendorId == null) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    let sort = searchParams.get('sort') || '-createdAt'
    if (!ALLOWED_SORT.has(sort)) sort = '-createdAt'

    const where: Record<string, any> = { vendor: { equals: vendorId } }
    const and: any[] = []
    if (search) {
      and.push({ code: { contains: search.toUpperCase() } })
    }
    const status = (searchParams.get('status') || '').trim().toLowerCase()
    if (status && STATUS_SET.has(status)) where.status = { equals: status }
    const dtype = (searchParams.get('discount_type') || '').trim().toLowerCase()
    if (dtype && TYPE_SET.has(dtype)) where.discount_type = { equals: dtype }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'coupons',
        where: finalWhere as any,
        page,
        limit,
        sort,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'coupons',
        where: { vendor: { equals: vendorId } } as any,
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const statsDocs = ((statsAll as any).docs as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map(sanitizeCoupon)
    const statusBreakdown: Record<string, number> = {}
    for (const s of STATUS_SET) statusBreakdown[s] = 0
    let totalUsage = 0
    for (const c of statsDocs) {
      const st = String(c.status || 'draft')
      statusBreakdown[st] = (statusBreakdown[st] || 0) + 1
      totalUsage += num(c.usage_count, 0)
    }

    const merchantBriefs = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 500,
      depth: 0,
      sort: 'outletName',
      overrideAccess: true,
    }).catch(() => ({ docs: [] as any[] }))

    return NextResponse.json({
      vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
      merchants: ((merchantBriefs as any).docs as Record<string, any>[]).map((m) => ({
        id: Number(m.id),
        outletName: str(m.outletName, `Outlet #${m.id}`),
        outletCode: str(m.outletCode, ''),
      })),
      merchantIds,
      docs,
      pagination: {
        page: paginated.page,
        limit: paginated.limit,
        totalDocs: paginated.totalDocs,
        totalPages: paginated.totalPages,
        hasNextPage: paginated.hasNextPage,
        hasPrevPage: paginated.hasPrevPage,
      },
      stats: {
        totalAll: statsDocs.length,
        filteredTotal: typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length,
        statusBreakdown,
        totalUsage,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    })
  } catch (err: any) {
    console.error('[vendor/coupons] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load coupons' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
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

    const userId = body.userId ? String(body.userId) : String(authUser.id)
    const { vendor, vendorId, merchantIds } = await resolveVendorContext(payload, userId)
    if (!vendor || vendorId == null) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    const data: Record<string, any> = {}
    for (const key of CREATE_FIELDS) {
      if (body[key] !== undefined) data[key] = body[key]
    }
    if (typeof data.code === 'string') data.code = normalizeCouponCode(data.code)
    // Forced scoping: merchant coupons always belong to the caller's brand,
    // and are always platform-funded (settlement-safe).
    data.vendor = vendorId
    data.funded_by = 'platform'
    data.vendor_share_pct = 0

    // Branch allowlist must be a subset of the vendor's own outlets.
    if (data.merchant_scope === 'selected_branches') {
      const picked = (Array.isArray(data.merchants) ? data.merchants : []).map((v: unknown) => Number(v)).filter((n: number) => Number.isFinite(n))
      if (picked.length === 0) {
        return NextResponse.json({ error: 'Select at least one of your branches' }, { status: 400 })
      }
      const foreign = picked.filter((id: number) => !merchantIds.includes(id))
      if (foreign.length > 0) {
        return NextResponse.json({ error: 'Forbidden: branch does not belong to vendor', details: foreign }, { status: 403 })
      }
      data.merchants = picked
    } else {
      data.merchant_scope = 'all_vendor_branches'
      data.merchants = []
    }

    const error = validateCouponFields({ status: 'draft', discount_type: 'fixed_cart', amount: 0, ...data })
    if (error) return NextResponse.json({ error }, { status: 400 })

    try {
      const created = (await payload.create({
        collection: 'coupons',
        data: data as any,
        overrideAccess: true,
      })) as unknown as Record<string, any>
      return NextResponse.json({ doc: sanitizeCoupon(created) }, { status: 201 })
    } catch (e: any) {
      const msg = e?.message || 'Failed to create coupon'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        return NextResponse.json({ error: 'A coupon with this code already exists for your brand', details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[vendor/coupons] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create coupon' }, { status: 500 })
  }
}
