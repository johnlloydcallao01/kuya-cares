/**
 * @file apps/cms/src/app/api/admin/transactions/route.ts
 * @description BFF aggregation endpoint for web-admin transactions page (enterprise-grade).
 * Follows docs/BFF-pattern.md: backend owns context resolution, joins, filtering, pagination,
 * and sanitization with overrideAccess:true. Frontend is thin consumer.
 *
 * GET /api/admin/transactions?page=1&limit=20&search=&status=paid,pending&payment_method=card,gcash&currency=PHP&sort=-paid_at
 *     -> { docs, pagination, stats, meta }
 * Access: admin-only via authenticateAdmin (JWT Bearer/JWT or payload-token cookie)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'

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
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
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
    const cacheKey = `admin:transactions:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Transactions-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    let sort = searchParams.get('sort') || '-paid_at'
    if (!ALLOWED_SORT.has(sort)) sort = '-paid_at'

    const statusCsv = parseCsv(searchParams.get('status'))
    const paymentMethodCsv = parseCsv(searchParams.get('payment_method'))
    const currencyParam = searchParams.get('currency')?.trim() || ''

    const where: Record<string, any> = {}
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
      // open filter: allow any lowercased value, already normalized via parseCsv
      where.payment_method = { in: paymentMethodCsv }
    }
    if (currencyParam) {
      where.currency = { equals: currencyParam.toUpperCase() }
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    // parallel: paginated list + full stats (bounded)
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
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const statsDocs = ((statsAll as any).docs as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeTransactionDoc(d))

    // stats aggregation
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
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Transactions-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/transactions] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load transactions' }, { status: 500 })
  }
}
