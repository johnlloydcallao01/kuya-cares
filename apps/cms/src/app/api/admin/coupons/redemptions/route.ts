/**
 * @file apps/cms/src/app/api/admin/coupons/redemptions/route.ts
 * @description BFF for coupon redemption history (WooCommerce coupons-report parity).
 * GET /api/admin/coupons/redemptions?couponId=&orderId=&customerId=&status=&page=&limit=
 *     -> { docs, pagination, stats, meta }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'

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

function sanitizeRedemption(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    coupon: raw.coupon ?? null,
    order: raw.order ?? null,
    customer: raw.customer ?? null,
    code_snapshot: str(raw.code_snapshot, ''),
    food_discount: num(raw.food_discount, 0),
    delivery_discount: num(raw.delivery_discount, 0),
    total_discount: num(raw.total_discount, 0),
    funded_by: str(raw.funded_by, 'platform'),
    vendor_share_pct: num(raw.vendor_share_pct, 0),
    platform_share: num(raw.platform_share, 0),
    vendor_share: num(raw.vendor_share, 0),
    status: str(raw.status, 'held'),
    held_until: raw.held_until ? String(raw.held_until) : null,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const STATUS_SET = new Set(['held', 'applied', 'refunded', 'cancelled'])

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
    const cacheKey = `admin:coupon-redemptions:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-CouponRedemptions-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))

    const where: Record<string, any> = {}
    const couponId = (searchParams.get('couponId') || '').trim()
    if (couponId) where.coupon = { equals: Number(couponId) || couponId }
    const orderId = (searchParams.get('orderId') || '').trim()
    if (orderId) where.order = { equals: Number(orderId) || orderId }
    const customerId = (searchParams.get('customerId') || '').trim()
    if (customerId) where.customer = { equals: Number(customerId) || customerId }
    const status = (searchParams.get('status') || '').trim().toLowerCase()
    if (status && STATUS_SET.has(status)) where.status = { equals: status }

    const paginated = await payload.find({
      collection: 'coupon-redemptions',
      where: (Object.keys(where).length ? where : undefined) as any,
      page,
      limit,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })

    const docs = (paginated.docs as unknown as Record<string, any>[]).map(sanitizeRedemption)
    const totalDiscounted = docs.reduce((s, d) => s + num(d.total_discount, 0), 0)

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
      stats: { filteredTotal: typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length, pageDiscounted: totalDiscounted },
      meta: { generatedAt: new Date().toISOString() },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-CouponRedemptions-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/coupons/redemptions] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load redemptions' }, { status: 500 })
  }
}
