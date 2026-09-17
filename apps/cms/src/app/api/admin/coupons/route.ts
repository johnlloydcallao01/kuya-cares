/**
 * @file apps/cms/src/app/api/admin/coupons/route.ts
 * @description BFF for coupon code management - admin-only safe boundary.
 * GET  /api/admin/coupons?page=&limit=&search=&status=&discount_type=&vendor=
 *      -> { docs, pagination, stats, meta }
 * POST /api/admin/coupons -> { doc } (code normalized + cross-field validated)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'
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

const STATUS_SET = new Set(['draft', 'scheduled', 'published', 'paused', 'archived'])
const TYPE_SET = new Set(['percent', 'fixed_cart', 'fixed_product'])
const ALLOWED_SORT = new Set(['-createdAt', 'createdAt', '-expires_at', 'expires_at', 'code', '-usage_count', 'usage_count'])

const CREATE_FIELDS = [
  'code', 'description', 'status', 'discount_type', 'amount', 'max_discount_amount',
  'applies_to', 'free_delivery', 'delivery_discount_cap', 'vendor', 'merchant_scope', 'merchants',
  'menu_items', 'excluded_menu_items', 'menu_categories', 'excluded_menu_categories',
  'exclude_promo_items', 'minimum_basket', 'maximum_basket', 'limit_per_order_items',
  'individual_use', 'max_coupons_per_order', 'starts_at', 'expires_at',
  'usage_limit', 'usage_limit_per_user', 'email_restrictions', 'phone_restrictions',
  'first_order_only', 'allowed_payment_methods', 'time_windows', 'funded_by', 'vendor_share_pct',
] as const

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const cacheQuery = Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'page=1&limit=20'
    const cacheKey = `admin:coupons:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Coupons-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    let sort = searchParams.get('sort') || '-createdAt'
    if (!ALLOWED_SORT.has(sort)) sort = '-createdAt'

    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({ code: { contains: search.toUpperCase() } })
    }
    const status = (searchParams.get('status') || '').trim().toLowerCase()
    if (status && STATUS_SET.has(status)) where.status = { equals: status }
    const dtype = (searchParams.get('discount_type') || '').trim().toLowerCase()
    if (dtype && TYPE_SET.has(dtype)) where.discount_type = { equals: dtype }
    const vendor = (searchParams.get('vendor') || '').trim()
    if (vendor) where.vendor = { equals: Number(vendor) || vendor }

    const finalWhere = and.length ? { and: [...and, where] } : where
    const hasFilters = and.length > 0 || Object.keys(where).length > 0

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'coupons',
        where: (hasFilters ? finalWhere : undefined) as any,
        page,
        limit,
        sort,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({ collection: 'coupons', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
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

    const responseBody = {
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
        totalAll: typeof (statsAll as any).totalDocs === 'number' ? (statsAll as any).totalDocs : statsDocs.length,
        filteredTotal: typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length,
        statusBreakdown,
        totalUsage,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Coupons-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/coupons] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load coupons' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const data: Record<string, any> = {}
    for (const key of CREATE_FIELDS) {
      if (body[key] !== undefined) data[key] = body[key]
    }
    if (typeof data.code === 'string') data.code = normalizeCouponCode(data.code)
    if (data.vendor === '' || data.vendor === null) data.vendor = null

    const error = validateCouponFields({ status: 'draft', discount_type: 'fixed_cart', amount: 0, ...data })
    if (error) return NextResponse.json({ error }, { status: 400 })

    try {
      const created = (await payload.create({
        collection: 'coupons',
        data: data as any,
        overrideAccess: true,
      })) as unknown as Record<string, any>
      // Bust list cache (all admins / query variants) so the new coupon shows immediately
      await deleteCachedByPrefix('admin:coupons:')
      return NextResponse.json({ doc: sanitizeCoupon(created) }, { status: 201 })
    } catch (e: any) {
      const msg = e?.message || 'Failed to create coupon'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        return NextResponse.json({ error: 'A coupon with this code already exists for this vendor', details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
  } catch (err: any) {
    console.error('[admin/coupons] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create coupon' }, { status: 500 })
  }
}
