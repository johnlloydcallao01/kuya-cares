/**
 * @file apps/cms/src/app/api/vendor/order-items/route.ts
 * @description Read-only BFF aggregation for web-merchant /order-items.
 *
 * Divergence from admin (cms/.../admin/order-items): order-items link to orders via `order` FK,
 * and orders carry a direct `merchant` FK. Scope = `order-items.order ∈` orders belonging to the
 * vendor's merchants. Pricing/snapshot fields are immutable audit records. This BFF returns line
 * items scoped to the vendor's merchant outlets with the same shape as the admin endpoint. Writes
 * are absent for merchants.
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
function sanitizeOrderBrief(value: unknown): Record<string, any> | null {
  if (value == null) return null
  if (typeof value !== 'object') {
    const id = Number(value)
    if (Number.isNaN(id)) return null
    return { id, orderNumber: `#${String(id).padStart(5, '0')}`, status: 'pending', placed_at: null, total: 0, merchant: null }
  }
  const o = value as Record<string, any>
  const id = Number(o.id)
  if (Number.isNaN(id)) return null
  return {
    id,
    orderNumber: `#${String(id).padStart(5, '0')}`,
    status: str(o.status, 'pending'),
    placed_at: o.placed_at ? String(o.placed_at) : o.createdAt ? String(o.createdAt) : null,
    total: num(o.total, 0),
    merchant: sanitizeMerchantBrief(o.merchant),
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
    is_active: typeof mp.is_active === 'boolean' ? mp.is_active : null,
    is_available: typeof mp.is_available === 'boolean' ? mp.is_available : null,
    merchant: sanitizeMerchantBrief(merchantRaw),
    product: sanitizeProductBrief(productRaw),
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
  return value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

const ALLOWED_SORT = new Set([
  '-createdAt', 'createdAt', '-updatedAt', 'updatedAt',
  '-price_at_purchase', 'price_at_purchase', '-quantity', 'quantity',
  '-total_price', 'total_price', 'product_name_snapshot', '-product_name_snapshot',
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
    const sort = searchParams.get('sort') || '-createdAt'
    const safeSort = ALLOWED_SORT.has(sort) ? sort : '-createdAt'
    const orderCsv = parseCsv(searchParams.get('order'))
    const productCsv = parseCsv(searchParams.get('product'))
    const merchantProductCsv = parseCsv(searchParams.get('merchant_product'))

    // 1. Resolve vendor + merchants.
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

    // 2. Scope: order-items.order ∈ orders where merchant ∈ merchantIds.
    const scopedOrdersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: merchantIds } } as any,
      limit: 5000,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    } as any)
    const scopedOrderIds = (scopedOrdersRes.docs as unknown as Record<string, any>[]).map((o) => Number(o.id)).filter((v) => Number.isFinite(v))

    if (scopedOrderIds.length === 0) {
      return NextResponse.json({ docs: [], pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false }, stats: { totalAll: 0, filteredTotal: 0 } })
    }

    // 3. Build where.
    const where: Record<string, any> = { order: { in: scopedOrderIds } }
    const and: any[] = []

    if (search) {
      const isNumeric = /^\d+$/.test(search)
      if (isNumeric) {
        const numericId = Number(search)
        and.push({ or: [{ id: { equals: numericId } }, { product_name_snapshot: { contains: search } }] })
      } else {
        and.push({ or: [{ product_name_snapshot: { contains: search } }] })
      }
    }

    if (orderCsv.length) {
      const filtered = orderCsv.map((v) => Number(v)).filter((n) => Number.isFinite(n))
      if (filtered.length) where.order = { in: filtered.filter((n) => scopedOrderIds.includes(n)) }
    }
    if (productCsv.length) {
      const filtered = productCsv.map((v) => Number(v)).filter((n) => Number.isFinite(n))
      if (filtered.length) where.product = { in: filtered }
    }
    if (merchantProductCsv.length) {
      const filtered = merchantProductCsv.map((v) => Number(v)).filter((n) => Number.isFinite(n))
      if (filtered.length) where.merchant_product = { in: filtered }
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allScopedItems] = await Promise.all([
      payload.find({
        collection: 'order-items',
        where: finalWhere as any,
        page,
        limit,
        sort: safeSort as any,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'order-items',
        where: { order: { in: scopedOrderIds } } as any,
        limit: 0,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeOrderItemDoc(d))
    const totalAll = typeof (allScopedItems as any).totalDocs === 'number'
      ? (allScopedItems as any).totalDocs
      : ((allScopedItems as any).docs as any[])?.length ?? 0
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
      stats: { totalAll, filteredTotal },
      meta: { generatedAt: new Date().toISOString(), sort: safeSort, search },
    })
  } catch (err: any) {
    console.error('[vendor/order-items] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load order items' }, { status: 500 })
  }
}