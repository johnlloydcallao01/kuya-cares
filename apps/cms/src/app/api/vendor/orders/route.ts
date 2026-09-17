/**
 * @file apps/cms/src/app/api/vendor/orders/route.ts
 * @description Read-only BFF aggregation for web-merchant /orders (All Orders).
 *
 * Divergence from admin (cms/.../admin/orders): orders carry a direct `merchant` FK (merchants),
 * so scope = `order.merchant ∈ merchants where vendor = this vendor`. All filtering, joins,
 * pagination and sanitization happen server-side (docs/BFF-pattern.md). Revenue follows the same
 * rule as analytics/admin: only verified `transactions` with status paid whose order belongs to the
 * vendor's merchants. Merchants can read their orders; status changes happen via outlet workflows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}
function sanitizeMediaRef(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  if (Number.isNaN(id)) return null
  const url = typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : typeof src.url === 'string' ? src.url : null
  return { id, url, filename: typeof src.filename === 'string' ? src.filename : null }
}
function sanitizeMerchantBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, outletName: `Outlet #${id}`, outletCode: '', isActive: null }
  }
  const m = value as Record<string, any>
  const id = Number(m.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    outletName: str(m.outletName, `Outlet #${id}`),
    outletCode: str(m.outletCode, ''),
    isActive: typeof m.isActive === 'boolean' ? m.isActive : null,
  }
}
function sanitizeCustomerBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, email: '', firstName: '', lastName: '' }
  }
  const c = value as Record<string, any>
  const id = Number(c.id)
  if (Number.isNaN(id)) return null
  const rawUser = c.user
  let user: Record<string, any> | null = null
  if (rawUser && typeof rawUser === 'object') {
    const u = rawUser as Record<string, any>
    const uid = Number(u.id)
    if (!Number.isNaN(uid)) user = { id: uid, firstName: str(u.firstName), lastName: str(u.lastName) }
  } else if (rawUser != null) {
    const uid = Number(rawUser)
    if (!Number.isNaN(uid)) user = { id: uid, firstName: '', lastName: '' }
  }
  return { id, email: str(c.email), firstName: str(user?.firstName), lastName: str(user?.lastName) }
}

function sanitizeOrderDoc(raw: Record<string, any>): Record<string, any> {
  const id = raw.id
  const orderNumber = `#${String(id).padStart(5, '0')}`
  return {
    id,
    orderNumber,
    status: str(raw.status, 'pending'),
    fulfillment_type: str(raw.fulfillment_type, 'delivery'),
    total: num(raw.total, 0),
    subtotal: num(raw.subtotal, 0),
    delivery_fee: num(raw.delivery_fee, 0),
    platform_fee: num(raw.platform_fee, 0),
    priority_fee: num(raw.priority_fee, 0),
    discount_total: num(raw.discount_total, 0),
    coupon_code: optionalString(raw.coupon_code),
    free_delivery_applied: !!raw.free_delivery_applied,
    placed_at: raw.placed_at ? String(raw.placed_at) : null,
    notes: optionalString(raw.notes),
    lalamove: {
      orderId: optionalString(raw.lalamove_order_id),
      serviceType: optionalString(raw.delivery_service_type) || 'MOTORCYCLE',
      status: str(raw.delivery_status, 'none'),
      trackingLink: optionalString(raw.delivery_tracking_link),
    },
    merchant: sanitizeMerchantBrief(raw.merchant),
    customer: sanitizeCustomerBrief(raw.customer),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

const STATUS_SET = new Set(['pending', 'accepted', 'preparing', 'ready_for_pickup', 'on_delivery', 'delivered', 'cancelled'])
const FULFILLMENT_SET = new Set(['delivery', 'pickup'])
const DELIVERY_STATUS_SET = new Set(['none', 'pending', 'assigning_driver', 'driver_assigned', 'picked_up', 'completed', 'canceled', 'expired'])
const ALLOWED_SORT = new Set([
  '-placed_at', 'placed_at', '-total', 'total', '-createdAt', 'createdAt',
  'status', '-status', 'fulfillment_type', '-fulfillment_type', 'delivery_status', '-delivery_status',
])

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || String(authUser.id)
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 10))
    const search = (searchParams.get('search') || '').trim()
    const sort = searchParams.get('sort') || '-placed_at'
    const safeSort = ALLOWED_SORT.has(sort) ? sort : '-placed_at'
    const statusCsv = parseCsv(searchParams.get('status'))
    const fulfillmentCsv = parseCsv(searchParams.get('fulfillment_type'))
    const deliveryStatusCsv = parseCsv(searchParams.get('delivery_status'))
    const hasDiscount = (searchParams.get('has_discount') || '').trim().toLowerCase()

    // 1. Resolve vendor + owned merchants.
    const vendorRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorRes.docs[0] as Record<string, any> | undefined
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }
    const vendorId = Number(vendor.id)

    const merchantRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantIds = (merchantRes.docs as unknown as Record<string, any>[]).map((m) => Number(m.id)).filter((v) => Number.isFinite(v))

    if (merchantIds.length === 0) {
      return NextResponse.json({ docs: [], pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false }, stats: null })
    }

    // 2. Build where: scope to vendor merchants + filters.
    const where: Record<string, any> = { merchant: { in: merchantIds } }
    const and: any[] = []

    if (search) {
      const isNumeric = /^\d+$/.test(search)
      if (isNumeric) {
        const numericId = Number(search)
        and.push({ or: [{ id: { equals: numericId } }, { lalamove_order_id: { contains: search } }, { notes: { contains: search } }] })
      } else {
        and.push({ or: [{ lalamove_order_id: { contains: search } }, { notes: { contains: search } }, { coupon_code: { contains: search } }] })
      }
    }
    if (statusCsv.length) {
      const filtered = statusCsv.filter((v) => STATUS_SET.has(v))
      if (filtered.length) where.status = { in: filtered }
    }
    if (hasDiscount === 'true') where.discount_total = { greater_than: 0 }
    else if (hasDiscount === 'false') where.discount_total = { equals: 0 }
    if (fulfillmentCsv.length) {
      const filtered = fulfillmentCsv.filter((v) => FULFILLMENT_SET.has(v))
      if (filtered.length) where.fulfillment_type = { in: filtered }
    }
    if (deliveryStatusCsv.length) {
      const filtered = deliveryStatusCsv.filter((v) => DELIVERY_STATUS_SET.has(v))
      if (filtered.length) where.delivery_status = { in: filtered }
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    // 3. Fetch paginated orders + all scoped orders (for breakdowns) + all scoped order ids.
    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'orders',
        where: finalWhere as any,
        page,
        limit,
        sort: safeSort as any,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'orders',
        where: { merchant: { in: merchantIds } } as any,
        limit: 5000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeOrderDoc(d))
    const statsDocs = ((statsAll as any).docs as Record<string, any>[]) ?? []
    const totalAll = typeof (statsAll as any).totalDocs === 'number' ? (statsAll as any).totalDocs : statsDocs.length

    const statusBreakdown: Record<string, number> = {}
    for (const s of STATUS_SET) statusBreakdown[s] = 0
    const fulfillmentBreakdown: Record<string, number> = {}
    for (const f of FULFILLMENT_SET) fulfillmentBreakdown[f] = 0
    const deliveryStatusBreakdown: Record<string, number> = {}
    for (const d of DELIVERY_STATUS_SET) deliveryStatusBreakdown[d] = 0

    for (const o of statsDocs) {
      const st = String(o.status || 'pending')
      if (statusBreakdown[st] !== undefined) statusBreakdown[st]++
      else statusBreakdown[st] = (statusBreakdown[st] || 0) + 1
      const ft = String(o.fulfillment_type || 'delivery')
      if (fulfillmentBreakdown[ft] !== undefined) fulfillmentBreakdown[ft]++
      else fulfillmentBreakdown[ft] = (fulfillmentBreakdown[ft] || 0) + 1
      const ds = String(o.delivery_status || 'none')
      if (deliveryStatusBreakdown[ds] !== undefined) deliveryStatusBreakdown[ds]++
      else deliveryStatusBreakdown[ds] = (deliveryStatusBreakdown[ds] || 0) + 1
    }

    // 4. Revenue: verified (paid) transactions whose order belongs to the vendor's merchants.
    const scopedOrderIds = statsDocs.map((o) => Number(o.id)).filter((v) => Number.isFinite(v))
    let totalRevenue = 0
    if (scopedOrderIds.length > 0) {
      const txnRes = await payload.find({
        collection: 'transactions',
        where: { status: { equals: 'paid' }, order: { in: scopedOrderIds } } as any,
        limit: 5000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any)
      for (const t of ((txnRes as any).docs as Record<string, any>[]) ?? []) totalRevenue += num(t.amount, 0)
    }
    const avgOrderValue = totalAll > 0 ? totalRevenue / totalAll : 0
    const filteredTotal = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length

    return NextResponse.json({
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
        totalAll,
        filteredTotal,
        statusBreakdown,
        fulfillmentBreakdown,
        deliveryStatusBreakdown,
        totalRevenue,
        avgOrderValue,
      },
      meta: { generatedAt: new Date().toISOString(), sort: safeSort, search },
    })
  } catch (err: any) {
    console.error('[vendor/orders] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load orders' }, { status: 500 })
  }
}