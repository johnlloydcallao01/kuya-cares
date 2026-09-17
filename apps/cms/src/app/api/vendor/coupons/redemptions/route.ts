/**
 * @file apps/cms/src/app/api/vendor/coupons/redemptions/route.ts
 * @description BFF aggregation endpoint for web-merchant /coupons/usage (vendor-scoped).
 * Follows docs/BFF-pattern.md: backend owns userId -> vendors.user -> coupon scoping,
 * filtering, pagination and sanitization with overrideAccess:true.
 *
 * GET /api/vendor/coupons/redemptions?userId=&couponId=&orderId=&customerId=&status=&page=&limit=
 *     -> { docs, pagination, stats, meta }
 *
 * Merchant differences vs admin BFF (admin/coupons/redemptions): coupon-redemptions has
 * no vendor FK, so scope is derived via coupons where vendor == caller's vendor id.
 * A requested couponId outside the vendor's set is rejected (403) to prevent
 * cross-brand peeking. Read-only; holds/applies/reversals happen via checkout services.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

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

function sanitizeCouponBrief(raw: unknown): Record<string, any> | null {
  const id = relId(raw)
  if (id == null) return null
  if (typeof raw === 'object') {
    const c = raw as Record<string, any>
    return { id, code: str(c.code, '') }
  }
  return { id, code: '' }
}
function sanitizeOrderBrief(raw: unknown): Record<string, any> | null {
  const id = relId(raw)
  if (id == null) return null
  if (typeof raw === 'object') {
    const o = raw as Record<string, any>
    return { id, total: num(o.total, 0) }
  }
  return { id, total: 0 }
}
function sanitizeCustomerBrief(raw: unknown): Record<string, any> | null {
  const id = relId(raw)
  if (id == null) return null
  if (typeof raw === 'object') {
    const c = raw as Record<string, any>
    const u = typeof c.user === 'object' && c.user !== null ? (c.user as Record<string, any>) : null
    return {
      id,
      email: str(c.email, u ? str(u.email, '') : ''),
      firstName: u ? str(u.firstName, '') : '',
      lastName: u ? str(u.lastName, '') : '',
    }
  }
  return { id, email: '', firstName: '', lastName: '' }
}

function sanitizeRedemption(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    coupon: sanitizeCouponBrief(raw.coupon),
    order: sanitizeOrderBrief(raw.order),
    customer: sanitizeCustomerBrief(raw.customer),
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

async function resolveVendorContext(payload: any, userId: string) {
  const vendorRes = await payload.find({
    collection: 'vendors',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const vendor = vendorRes.docs[0] as Record<string, any> | undefined
  if (!vendor) return { vendor: null, vendorId: null as number | null }
  return { vendor, vendorId: Number(vendor.id) }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || String(authUser.id)

    const { vendor, vendorId } = await resolveVendorContext(payload, userId)
    if (!vendor || vendorId == null) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    // Vendor's coupon ids — the only ownership path (redemptions have no vendor FK).
    const couponsRes = await payload.find({
      collection: 'coupons',
      where: { vendor: { equals: vendorId } } as any,
      limit: 2000,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    } as any)
    const couponIds = ((couponsRes as any).docs as Record<string, any>[])
      .map((c) => Number(c.id))
      .filter((n) => Number.isFinite(n))

    const emptyPagination = (page: number, limit: number) => ({ page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false })
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))

    if (couponIds.length === 0) {
      return NextResponse.json({
        vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
        docs: [],
        pagination: emptyPagination(page, limit),
        stats: { totalAll: 0, filteredTotal: 0, statusBreakdown: { held: 0, applied: 0, refunded: 0, cancelled: 0 }, pageDiscounted: 0, totalDiscounted: 0 },
        meta: { generatedAt: new Date().toISOString() },
      })
    }

    const couponIdParam = (searchParams.get('couponId') || '').trim()
    if (couponIdParam) {
      const cid = Number(couponIdParam)
      if (!Number.isFinite(cid) || !couponIds.includes(cid)) {
        return NextResponse.json({ error: 'Forbidden: coupon does not belong to vendor' }, { status: 403 })
      }
    }
    const orderIdParam = (searchParams.get('orderId') || '').trim()
    const customerIdParam = (searchParams.get('customerId') || '').trim()
    const statusParam = (searchParams.get('status') || '').trim().toLowerCase()
    const statusFilter = statusParam && STATUS_SET.has(statusParam) ? statusParam : null

    const where: Record<string, any> = { coupon: { in: couponIds } }
    const and: any[] = []
    if (couponIdParam) where.coupon = { equals: Number(couponIdParam) }
    if (orderIdParam) {
      const oid = Number(orderIdParam)
      and.push({ order: { equals: Number.isFinite(oid) ? oid : orderIdParam } })
    }
    if (customerIdParam) {
      const cid = Number(customerIdParam)
      and.push({ customer: { equals: Number.isFinite(cid) ? cid : customerIdParam } })
    }
    if (statusFilter) and.push({ status: { equals: statusFilter } })
    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'coupon-redemptions',
        where: finalWhere as any,
        page,
        limit,
        sort: '-createdAt',
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'coupon-redemptions',
        where: { coupon: { in: couponIds } } as any,
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const docs = (paginated.docs as unknown as Record<string, any>[]).map(sanitizeRedemption)
    const statsDocs = ((statsAll as any).docs as Record<string, any>[]) ?? []

    const statusBreakdown: Record<string, number> = { held: 0, applied: 0, refunded: 0, cancelled: 0 }
    let totalDiscounted = 0
    for (const d of statsDocs) {
      const st = String(d.status || 'held').toLowerCase()
      if (statusBreakdown[st] !== undefined) statusBreakdown[st]++
      else statusBreakdown[st] = (statusBreakdown[st] || 0) + 1
      totalDiscounted += num(d.total_discount, 0)
    }
    const pageDiscounted = docs.reduce((s, d) => s + num((d as any).total_discount, 0), 0)

    return NextResponse.json({
      vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
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
        pageDiscounted,
        totalDiscounted,
      },
      meta: { generatedAt: new Date().toISOString() },
    })
  } catch (err: any) {
    console.error('[vendor/coupons/redemptions] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load coupon usage' }, { status: 500 })
  }
}
