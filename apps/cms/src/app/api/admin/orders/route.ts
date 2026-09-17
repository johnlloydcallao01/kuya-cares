/**
 * @file apps/cms/src/app/api/admin/orders/route.ts
 * @description BFF aggregation endpoint for web-admin orders page (enterprise-grade).
 * Follows docs/BFF-pattern.md: backend owns context resolution, joins, filtering, pagination,
 * and sanitization with overrideAccess:true. Frontend is thin consumer.
 *
 * GET /api/admin/orders?page=1&limit=10&search=&status=pending,delivered&fulfillment_type=delivery&delivery_status=completed&sort=-placed_at
 *     -> { docs, pagination, stats, meta }
 * Access: admin-only via authenticateAdmin (JWT Bearer/JWT or payload-token cookie)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

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
  const url =
    typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : typeof src.url === 'string' ? src.url : null
  return { id, url, filename: typeof src.filename === 'string' ? src.filename : null }
}

function sanitizeMerchantBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, outletName: `Outlet #${id}`, outletCode: '', isActive: null, vendor: null }
  }
  const m = value as Record<string, any>
  const id = Number(m.id)
  if (Number.isNaN(id)) return null
  const rawVendor = m.vendor
  let vendor: Record<string, any> | null = null
  if (rawVendor && typeof rawVendor === 'object') {
    const v = rawVendor as Record<string, any>
    const vid = Number(v.id)
    if (!Number.isNaN(vid)) {
      vendor = {
        id: vid,
        businessName: str(v.businessName, ''),
        logo: sanitizeMediaRef(v.logo),
      }
    }
  } else if (rawVendor != null) {
    const vid = Number(rawVendor)
    if (!Number.isNaN(vid)) vendor = { id: vid, businessName: '', logo: null }
  }
  return {
    id,
    outletName: str(m.outletName, `Outlet #${id}`),
    outletCode: str(m.outletCode, ''),
    isActive: typeof m.isActive === 'boolean' ? m.isActive : null,
    vendor,
  }
}

function sanitizeCustomerBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, email: '', user: null }
  }
  const c = value as Record<string, any>
  const id = Number(c.id)
  if (Number.isNaN(id)) return null
  const rawUser = c.user
  let user: Record<string, any> | null = null
  if (rawUser && typeof rawUser === 'object') {
    const u = rawUser as Record<string, any>
    const uid = Number(u.id)
    if (!Number.isNaN(uid)) {
      user = {
        id: uid,
        email: str(u.email, str(c.email, '')),
        firstName: str(u.firstName, ''),
        lastName: str(u.lastName, ''),
        phone: optionalString(u.phone),
      }
    }
  } else if (rawUser != null) {
    const uid = Number(rawUser)
    if (!Number.isNaN(uid)) user = { id: uid, email: str(c.email, ''), firstName: '', lastName: '', phone: null }
  }
  return {
    id,
    email: str(c.email, user ? str((user as any).email, '') : ''),
    user,
  }
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

const STATUS_SET = new Set([
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'on_delivery',
  'delivered',
  'cancelled',
])
const FULFILLMENT_SET = new Set(['delivery', 'pickup'])
const DELIVERY_STATUS_SET = new Set([
  'none',
  'pending',
  'assigning_driver',
  'driver_assigned',
  'picked_up',
  'completed',
  'canceled',
  'expired',
])
const ALLOWED_SORT = new Set([
  '-placed_at',
  'placed_at',
  '-total',
  'total',
  '-createdAt',
  'createdAt',
  'status',
  '-status',
  'fulfillment_type',
  '-fulfillment_type',
  'delivery_status',
  '-delivery_status',
])

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
    const cacheKey = `admin:orders:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Orders-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    let sort = searchParams.get('sort') || '-placed_at'
    if (!ALLOWED_SORT.has(sort)) sort = '-placed_at'

    const statusCsv = parseCsv(searchParams.get('status'))
    const fulfillmentCsv = parseCsv(searchParams.get('fulfillment_type'))
    const deliveryStatusCsv = parseCsv(searchParams.get('delivery_status'))

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      const isNumeric = /^\d+$/.test(search)
      if (isNumeric) {
        const numericId = Number(search)
        and.push({
          or: [
            { id: { equals: numericId } },
            { lalamove_order_id: { contains: search } },
            { notes: { contains: search } },
          ],
        })
      } else {
        and.push({
          or: [
            { lalamove_order_id: { contains: search } },
            { notes: { contains: search } },
            { coupon_code: { contains: search } },
          ],
        })
      }
    }

    if (statusCsv.length) {
      const filtered = statusCsv.filter((v) => STATUS_SET.has(v))
      if (filtered.length) where.status = { in: filtered }
    }
    const hasDiscount = (searchParams.get('has_discount') || '').trim().toLowerCase()
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
    const hasFilters = and.length > 0 || Object.keys(where).length > 0
    const queryWhere = hasFilters ? finalWhere : undefined

    const [paginated, statsAll, paidTxns] = await Promise.all([
      payload.find({
        collection: 'orders',
        where: queryWhere as any,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'orders',
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
      // Revenue is verified-transaction based (same principle as analytics):
      // only paid transactions count, never raw order totals.
      payload.find({
        collection: 'transactions',
        where: { status: { equals: 'paid' } },
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const statsDocs = ((statsAll as any).docs as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeOrderDoc(d))

    // stats aggregation
    const totalAll = typeof (statsAll as any).totalDocs === 'number' ? (statsAll as any).totalDocs : statsDocs.length
    // if pagination false with limit 2000, totalDocs may still be full count; use docs length for breakdown but totalAll as totalDocs
    const statusBreakdown: Record<string, number> = {}
    for (const s of STATUS_SET) statusBreakdown[s] = 0
    const fulfillmentBreakdown: Record<string, number> = {}
    for (const f of FULFILLMENT_SET) fulfillmentBreakdown[f] = 0
    const deliveryStatusBreakdown: Record<string, number> = {}
    for (const d of DELIVERY_STATUS_SET) deliveryStatusBreakdown[d] = 0

    let totalRevenue = 0
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
    // Revenue counts verified (paid) transactions only — same as dashboard analytics.
    const paidDocs = ((paidTxns as any).docs as Record<string, any>[]) ?? []
    for (const t of paidDocs) totalRevenue += num(t.amount, 0)
    const avgOrderValue = totalAll > 0 ? totalRevenue / totalAll : 0
    const filteredTotal = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length

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
        totalAll,
        filteredTotal,
        statusBreakdown,
        fulfillmentBreakdown,
        deliveryStatusBreakdown,
        totalRevenue,
        avgOrderValue,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Orders-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/orders] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load orders' }, { status: 500 })
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
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const customer = body.customer ?? body.customer_id ?? null
    const merchant = body.merchant ?? body.merchant_id ?? null
    if (customer == null || customer === '') return NextResponse.json({ error: 'customer is required' }, { status: 400 })
    if (merchant == null || merchant === '') return NextResponse.json({ error: 'merchant is required' }, { status: 400 })

    const status = str(body.status, 'pending').toLowerCase()
    if (!STATUS_SET.has(status)) return NextResponse.json({ error: `Invalid status: ${body.status}` }, { status: 400 })

    const fulfillmentType = str(body.fulfillment_type || body.fulfillmentType, '')
    if (!FULFILLMENT_SET.has(fulfillmentType))
      return NextResponse.json({ error: 'fulfillment_type is required (delivery|pickup)' }, { status: 400 })

    const deliveryStatus = str(body.delivery_status, 'none').toLowerCase()
    if (!DELIVERY_STATUS_SET.has(deliveryStatus))
      return NextResponse.json({ error: `Invalid delivery_status: ${body.delivery_status}` }, { status: 400 })

    const data: Record<string, any> = {
      customer: typeof customer === 'object' ? customer : Number(customer),
      merchant: typeof merchant === 'object' ? merchant : Number(merchant),
      status,
      fulfillment_type: fulfillmentType,
      subtotal: num(body.subtotal, 0),
      delivery_fee: num(body.delivery_fee, 0),
      platform_fee: num(body.platform_fee, 0),
      priority_fee: num(body.priority_fee, 0),
      discount_total: num(body.discount_total, 0),
      total: num(body.total, 0),
      coupon_code: optionalString(body.coupon_code),
      free_delivery_applied: !!body.free_delivery_applied,
      notes: optionalString(body.notes),
      placed_at: optionalString(body.placed_at) || new Date().toISOString(),
      lalamove_order_id: optionalString(body.lalamove_order_id),
      delivery_service_type: optionalString(body.delivery_service_type) || 'MOTORCYCLE',
      delivery_status: deliveryStatus,
      delivery_tracking_link: optionalString(body.delivery_tracking_link),
    }
    if (Number.isNaN(data.customer) || Number.isNaN(data.merchant))
      return NextResponse.json({ error: 'customer and merchant must be valid IDs' }, { status: 400 })

    const created = await payload.create({
      collection: 'orders',
      data: data as any,
      depth: 2,
      overrideAccess: true,
    })
    // Bust list cache (all admins / query variants) so the new order shows immediately.
    // Order items embed order data, so bust that aggregate too.
    await deleteCachedByPrefix('admin:orders:')
    await deleteCachedByPrefix('admin:order-items:')
    return NextResponse.json(
      { success: true, message: 'Order created successfully', doc: sanitizeOrderDoc(created as Record<string, any>) },
      { status: 201 },
    )
  } catch (err: any) {
    console.error('[admin/orders] POST error:', err)
    const message = err?.message || 'Failed to create order'
    // Collection beforeValidate invariant (total mismatch) surfaces here
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
