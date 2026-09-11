/**
 * @file apps/cms/src/app/api/admin/order-items/route.ts
 * @description BFF aggregation endpoint for web-admin order-items page (enterprise-grade).
 * Follows docs/BFF-pattern.md: backend owns context resolution, joins, filtering, pagination,
 * and sanitization with overrideAccess:true. Frontend is thin consumer.
 *
 * GET /api/admin/order-items?page=1&limit=10&search=&order=1,2&product=1,2&merchant_product=1,2&sort=-createdAt
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
      vendor = { id: vid, businessName: str(v.businessName, ''), logo: sanitizeMediaRef(v.logo) }
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

function sanitizeOrderBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, status: null, placed_at: null, merchant: null }
  }
  const o = value as Record<string, any>
  const id = Number(o.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    status: optionalString(o.status) ?? str(o.status, 'pending'),
    placed_at: o.placed_at ? String(o.placed_at) : null,
    merchant: o.merchant ? sanitizeMerchantBrief(o.merchant) : null,
  }
}

function sanitizeProductBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, name: `Product #${id}`, slug: '', sku: null, productType: null, basePrice: null, primaryImage: null }
  }
  const p = value as Record<string, any>
  const id = Number(p.id)
  if (Number.isNaN(id)) return null
  const mediaGroup = p.media as Record<string, any> | undefined
  const primaryImage = mediaGroup?.primaryImage ? sanitizeMediaRef(mediaGroup.primaryImage) : null
  return {
    id,
    name: str(p.name, `Product #${id}`),
    slug: str(p.slug, ''),
    sku: optionalString(p.sku),
    productType: optionalString(p.productType),
    basePrice: p.basePrice != null ? num(p.basePrice, 0) : null,
    primaryImage,
  }
}

function sanitizeMerchantProductBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, display_title: `MerchantProduct #${id}`, price_override: null, stock_quantity: null, is_active: null, is_available: null, merchant: null, product: null }
  }
  const mp = value as Record<string, any>
  const id = Number(mp.id)
  if (Number.isNaN(id)) return null
  const merchantRaw = mp.merchant_id ?? mp.merchant
  const productRaw = mp.product_id ?? mp.product
  return {
    id,
    display_title: optionalString(mp.display_title) ?? `MerchantProduct #${id}`,
    price_override: mp.price_override != null ? num(mp.price_override, 0) : null,
    stock_quantity: mp.stock_quantity != null ? num(mp.stock_quantity, 0) : null,
    is_active: typeof mp.is_active === 'boolean' ? mp.is_active : typeof mp.isActive === 'boolean' ? mp.isActive : null,
    is_available: typeof mp.is_available === 'boolean' ? mp.is_available : null,
    merchant: merchantRaw ? sanitizeMerchantBrief(merchantRaw) : null,
    product: productRaw ? sanitizeProductBrief(productRaw) : null,
  }
}

function sanitizeOrderItemDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    order: sanitizeOrderBrief(raw.order),
    product: sanitizeProductBrief(raw.product),
    merchant_product: sanitizeMerchantProductBrief(raw.merchant_product),
    product_name_snapshot: str(raw.product_name_snapshot, ''),
    price_at_purchase: num(raw.price_at_purchase, 0),
    quantity: num(raw.quantity, 0),
    options_snapshot: raw.options_snapshot ?? null,
    total_price: num(raw.total_price, 0),
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
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

const ALLOWED_SORT = new Set([
  '-createdAt',
  'createdAt',
  '-updatedAt',
  'updatedAt',
  '-price_at_purchase',
  'price_at_purchase',
  '-quantity',
  'quantity',
  '-total_price',
  'total_price',
  'product_name_snapshot',
  '-product_name_snapshot',
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
    const cacheKey = `admin:order-items:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-OrderItems-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    let sort = searchParams.get('sort') || '-createdAt'
    if (!ALLOWED_SORT.has(sort)) sort = '-createdAt'

    const orderCsv = parseCsv(searchParams.get('order'))
    const productCsv = parseCsv(searchParams.get('product'))
    const merchantProductCsv = parseCsv(searchParams.get('merchant_product'))

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      const isNumeric = /^\d+$/.test(search)
      if (isNumeric) {
        const numericId = Number(search)
        and.push({
          or: [{ id: { equals: numericId } }, { product_name_snapshot: { contains: search } }],
        })
      } else {
        and.push({
          or: [{ product_name_snapshot: { contains: search } }],
        })
      }
    }

    if (orderCsv.length) {
      const filtered = orderCsv.map((v) => Number(v)).filter((n) => Number.isFinite(n) && !Number.isNaN(n))
      if (filtered.length) where.order = { in: filtered }
    }
    if (productCsv.length) {
      const filtered = productCsv.map((v) => Number(v)).filter((n) => Number.isFinite(n) && !Number.isNaN(n))
      if (filtered.length) where.product = { in: filtered }
    }
    if (merchantProductCsv.length) {
      const filtered = merchantProductCsv.map((v) => Number(v)).filter((n) => Number.isFinite(n) && !Number.isNaN(n))
      if (filtered.length) where.merchant_product = { in: filtered }
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'order-items',
        where: Object.keys(finalWhere).length ? (finalWhere as any) : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'order-items',
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const statsDocs = ((statsAll as any).docs as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeOrderItemDoc(d))

    // stats aggregation from statsAll (bounded 2000 for breakdown)
    const totalAll = typeof (statsAll as any).totalDocs === 'number' ? (statsAll as any).totalDocs : statsDocs.length
    const filteredTotal = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length

    let totalRevenue = 0
    let totalQuantity = 0
    const uniqueOrders = new Set<string>()
    const uniqueProducts = new Set<string>()
    let withModifiersCount = 0

    for (const o of statsDocs) {
      totalRevenue += num(o.total_price, 0)
      totalQuantity += num(o.quantity, 0)

      const orderId = o.order != null && typeof o.order === 'object' ? String((o.order as any).id ?? o.order) : o.order != null ? String(o.order) : ''
      if (orderId) uniqueOrders.add(orderId)
      const productId = o.product != null && typeof o.product === 'object' ? String((o.product as any).id ?? o.product) : o.product != null ? String(o.product) : ''
      if (productId) uniqueProducts.add(productId)

      const opts = o.options_snapshot
      if (Array.isArray(opts) && opts.length > 0) withModifiersCount++
      else if (opts && typeof opts === 'object' && !Array.isArray(opts) && Object.keys(opts as object).length > 0) withModifiersCount++
    }

    const avgUnitPrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0
    const avgQuantity = statsDocs.length > 0 ? totalQuantity / statsDocs.length : 0

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
        totalRevenue,
        totalQuantity,
        avgUnitPrice,
        avgQuantity,
        uniqueOrders: uniqueOrders.size,
        uniqueProducts: uniqueProducts.size,
        withModifiersCount,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-OrderItems-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/order-items] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load order items' }, { status: 500 })
  }
}
