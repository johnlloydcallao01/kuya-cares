/**
 * @file apps/cms/src/app/api/vendor/transactions/route.ts
 * @description BFF aggregation endpoint for web-merchant payments/transactions page.
 * Follows docs/BFF-pattern.md: backend owns context resolution, joins, filtering, pagination,
 * and sanitization with overrideAccess:true. Frontend is thin consumer.
 *
 * GET /api/vendor/transactions?userId=1&page=1&limit=10&search=&status=paid,pending&payment_method=card,gcash&currency=PHP&sort=-paid_at
 *     -> { docs, pagination, stats, meta }
 * Access: vendor-only via authenticateVendor (JWT Bearer/JWT or payload-token cookie).
 * Scope: transactions whose order belongs to one of the vendor's merchants
 * (transactions.order -> orders.merchant -> merchants.vendor -> vendors.user).
 * Read-only: no POST/PATCH/DELETE (transactions are immutable financial records).
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
  const url =
    typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : typeof src.url === 'string' ? src.url : null
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

function sanitizeOrderBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, status: '', total: 0, subtotal: 0, placed_at: null, fulfillment_type: '', merchant: null, customer: null }
  }
  const o = value as Record<string, any>
  const id = Number(o.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    status: str(o.status, 'pending'),
    total: num(o.total, 0),
    subtotal: num(o.subtotal, 0),
    delivery_fee: num(o.delivery_fee, 0),
    platform_fee: num(o.platform_fee, 0),
    fulfillment_type: str(o.fulfillment_type, ''),
    placed_at: o.placed_at ? String(o.placed_at) : null,
    lalamove_order_id: optionalString(o.lalamove_order_id),
    delivery_status: str(o.delivery_status, 'none'),
    merchant: sanitizeMerchantBrief(o.merchant),
    customer: sanitizeCustomerBrief(o.customer),
    createdAt: String(o.createdAt ?? ''),
    updatedAt: String(o.updatedAt ?? ''),
  }
}

function sanitizeTransactionDoc(raw: Record<string, any>): Record<string, any> {
  const status = str(raw.status, 'pending').toLowerCase()
  return {
    id: raw.id,
    payment_intent_id: optionalString(raw.payment_intent_id),
    payment_method: optionalString(raw.payment_method),
    amount: num(raw.amount, 0),
    currency: str(raw.currency, 'PHP') || 'PHP',
    status,
    paid_at: raw.paid_at ? String(raw.paid_at) : null,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
    order: sanitizeOrderBrief(raw.order),
    isPaid: status === 'paid',
  }
}

function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

const STATUS_SET = new Set(['pending', 'paid', 'failed', 'refunded'])
const ALLOWED_SORT = new Set([
  '-paid_at',
  'paid_at',
  '-createdAt',
  'createdAt',
  '-updatedAt',
  'updatedAt',
  '-amount',
  'amount',
  'status',
  '-status',
  'payment_method',
  '-payment_method',
])

function zeroedStats() {
  return {
    totalAll: 0,
    filteredTotal: 0,
    statusBreakdown: { pending: 0, paid: 0, failed: 0, refunded: 0 },
    paymentMethodBreakdown: {},
    totalRevenue: 0,
    totalRefunded: 0,
    totalFailed: 0,
    totalPendingAmount: 0,
    netRevenue: 0,
    avgTransactionAmount: 0,
    paidCount: 0,
    pendingCount: 0,
    failedCount: 0,
    refundedCount: 0,
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const vendorUser = await authenticateVendor(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')?.trim() || String((vendorUser as any).id ?? '')

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    let sort = searchParams.get('sort') || '-paid_at'
    if (!ALLOWED_SORT.has(sort)) sort = '-paid_at'

    const statusCsv = parseCsv(searchParams.get('status'))
    const paymentMethodCsv = parseCsv(searchParams.get('payment_method'))
    const currencyParam = searchParams.get('currency')?.trim() || ''

    // 1. Resolve vendor record for this user.
    const vendorRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: Number(userId) || userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendorDoc = (vendorRes.docs as unknown as Record<string, any>[])[0]
    if (!vendorDoc) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    const vendorId = Number(vendorDoc.id)

    // 2. Resolve merchant outlets owned by this vendor.
    const merchantRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    const merchantIds = (merchantRes.docs as unknown as Record<string, any>[]).map((m) => Number(m.id)).filter((n) => Number.isFinite(n))
    if (!merchantIds.length) {
      return NextResponse.json({
        docs: [],
        pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        stats: zeroedStats(),
        meta: { generatedAt: new Date().toISOString(), sort, search },
      })
    }

    // 3. Resolve order ids for those merchants (bounded scan, depth 0).
    const orderRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: merchantIds } },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    } as any)
    const scopedOrderIds = (((orderRes as any).docs as Record<string, any>[]) ?? [])
      .map((o) => Number(o.id))
      .filter((n) => Number.isFinite(n))
    if (!scopedOrderIds.length) {
      return NextResponse.json({
        docs: [],
        pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        stats: zeroedStats(),
        meta: { generatedAt: new Date().toISOString(), sort, search },
      })
    }

    // 4. Build transaction filters (always scoped to vendor orders).
    const where: Record<string, any> = { order: { in: scopedOrderIds } }
    const and: any[] = []

    if (search) {
      const isNumeric = /^\d+$/.test(search)
      if (isNumeric) {
        const numericId = Number(search)
        const numericAmount = Number(search)
        const amountClause = Number.isFinite(numericAmount) ? { amount: { equals: numericAmount } } : null
        const orClauses: any[] = [
          { id: { equals: numericId } },
          { payment_intent_id: { contains: search } },
          { order: { equals: numericId } },
        ]
        if (amountClause) orClauses.push(amountClause)
        and.push({ or: orClauses })
      } else {
        and.push({
          or: [{ payment_intent_id: { contains: search } }],
        })
      }
    }

    if (statusCsv.length) {
      const filtered = statusCsv.filter((v) => STATUS_SET.has(v))
      if (filtered.length) where.status = { in: filtered }
    }
    if (paymentMethodCsv.length) {
      where.payment_method = { in: paymentMethodCsv }
    }
    if (currencyParam) {
      where.currency = { equals: currencyParam.toUpperCase() }
    }
    // Optional single-order drill-down (guarded to vendor scope).
    const orderParam = searchParams.get('order')?.trim() || searchParams.get('orderId')?.trim() || ''
    if (orderParam) {
      const oid = Number(orderParam)
      if (Number.isFinite(oid)) {
        if (!scopedOrderIds.includes(oid)) {
          return NextResponse.json({ error: 'Forbidden: order does not belong to vendor' }, { status: 403 })
        }
        where.order = { equals: oid }
      }
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    // parallel: paginated scoped list + full scoped stats (bounded)
    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'transactions',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2, // need order + order.merchant/customer populated for sanitization
        overrideAccess: true,
      }),
      payload.find({
        collection: 'transactions',
        where: { order: { in: scopedOrderIds } },
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const statsDocs = ((statsAll as any).docs as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeTransactionDoc(d))

    const totalAll = typeof (statsAll as any).totalDocs === 'number' ? (statsAll as any).totalDocs : statsDocs.length
    const filteredTotal = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length

    const statusBreakdown: Record<string, number> = { pending: 0, paid: 0, failed: 0, refunded: 0 }
    const paymentMethodBreakdown: Record<string, number> = {}
    let totalRevenue = 0
    let totalRefunded = 0
    let totalFailed = 0
    let totalPendingAmount = 0
    let paidCount = 0
    let pendingCount = 0
    let failedCount = 0
    let refundedCount = 0

    for (const t of statsDocs) {
      const st = String(t.status || 'pending').toLowerCase()
      if (statusBreakdown[st] !== undefined) statusBreakdown[st]++
      else statusBreakdown[st] = (statusBreakdown[st] || 0) + 1

      const pmRaw = typeof t.payment_method === 'string' ? t.payment_method.trim().toLowerCase() : ''
      const pm = pmRaw || 'unknown'
      paymentMethodBreakdown[pm] = (paymentMethodBreakdown[pm] || 0) + 1

      const amt = num(t.amount, 0)
      if (st === 'paid') {
        totalRevenue += amt
        paidCount++
      } else if (st === 'refunded') {
        totalRefunded += amt
        refundedCount++
      } else if (st === 'failed') {
        totalFailed += amt
        failedCount++
      } else if (st === 'pending') {
        totalPendingAmount += amt
        pendingCount++
      }
    }

    const netRevenue = totalRevenue - totalRefunded
    const avgTransactionAmount = paidCount > 0 ? totalRevenue / paidCount : 0

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
        paymentMethodBreakdown,
        totalRevenue,
        totalRefunded,
        totalFailed,
        totalPendingAmount,
        netRevenue,
        avgTransactionAmount,
        paidCount,
        pendingCount,
        failedCount,
        refundedCount,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    })
  } catch (err: any) {
    console.error('[vendor/transactions] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load transactions' }, { status: 500 })
  }
}
