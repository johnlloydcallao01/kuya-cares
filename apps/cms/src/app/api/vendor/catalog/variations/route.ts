/**
 * @file apps/cms/src/app/api/vendor/catalog/variations/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/variations.
 *
 * Divergence from admin (cms/.../admin/catalog/variations): prod-variations have
 * product_id as the only scoping key (no vendor FK). Merchants only see variations
 * whose product belongs to them (createdByVendor == vendor.id OR createdByMerchant
 * under one of the vendor's merchants), with per-id ownership guards and a product
 * filter dropdown limited to the vendor's own products. Write endpoints absent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
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
function sanitizeProductBrief(value: unknown): { id: number; name: string; slug: string; productType: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, any>
    const id = Number(obj.id)
    if (Number.isNaN(id)) return null
    return { id, name: str(obj.name), slug: str(obj.slug), productType: str(obj.productType, 'simple') }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    product_id: sanitizeProductBrief(raw.product_id),
    product: sanitizeProductBrief(raw.product_id),
    modifier_behavior_mode: str(raw.modifier_behavior_mode, 'inherit_product'),
    name: optionalString(raw.name),
    short_description: optionalString(raw.short_description),
    image: sanitizeMediaRef(raw.image),
    sku: str(raw.sku, ''),
    base_price: raw.base_price != null ? num(raw.base_price, 0) : null,
    compare_at_price: raw.compare_at_price != null ? num(raw.compare_at_price, 0) : null,
    stock_quantity: raw.stock_quantity != null ? Math.trunc(num(raw.stock_quantity, 0)) : 0,
    is_used_for_variations: typeof raw.is_used_for_variations === 'boolean' ? raw.is_used_for_variations : true,
    is_visible: typeof raw.is_visible === 'boolean' ? raw.is_visible : true,
    sort_order: raw.sort_order != null ? Math.trunc(num(raw.sort_order, 0)) : 0,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}
function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

const MODE_VALUES = new Set(['inherit_product', 'variation_specific', 'hybrid'])

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
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
    const search = (searchParams.get('search') || '').trim()
    const sort = searchParams.get('sort') || '-createdAt'
    const productIdParam = (searchParams.get('productId') || searchParams.get('product_id') || '').trim()
    const modeCsv = parseCsv(searchParams.get('modifier_behavior_mode') || searchParams.get('mode'))
    const isVisibleParam = searchParams.get('is_visible')
    const isVisibleFilter = isVisibleParam === 'true' ? true : isVisibleParam === 'false' ? false : null
    const isUsedParam = searchParams.get('is_used') ?? searchParams.get('is_used_for_variations')
    const isUsedFilter = isUsedParam === 'true' ? true : isUsedParam === 'false' ? false : null

    // 1. Resolve vendor for user.
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

    // 2. Vendor's products: created by the vendor directly OR by their merchants.
    const merchantRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantIds = (merchantRes.docs as unknown as Record<string, any>[]).map((m) => Number(m.id)).filter((v) => Number.isFinite(v))

    const prodRes = await payload.find({
      collection: 'products',
      where: {
        or: [
          { createdByVendor: { equals: vendorId } },
          ...(merchantIds.length ? [{ createdByMerchant: { in: merchantIds } }] : []),
        ],
      },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    const ownedProducts = prodRes.docs as unknown as Record<string, any>[]
    const ownedProductIds = new Set(ownedProducts.map((p) => Number(p.id)).filter((v) => Number.isFinite(v)))

    const productOptions = ownedProducts
      .map((p) => ({ id: Number(p.id), name: str(p.name, ''), slug: str(p.slug, ''), productType: str(p.productType, 'simple') }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // 3. Product filter must be one of the vendor's owned products.
    let productScope = ownedProductIds
    if (productIdParam) {
      const pid = Number(productIdParam)
      if (!Number.isFinite(pid)) return NextResponse.json({ error: 'productId must be numeric' }, { status: 400 })
      if (!ownedProductIds.has(pid)) {
        return NextResponse.json({ error: 'Forbidden: product does not belong to vendor' }, { status: 403 })
      }
      productScope = new Set([pid])
    }
    if (productScope.size === 0) {
      return NextResponse.json({ docs: [], products: productOptions, stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false } })
    }

    // 4. Variations where product_id in owned scope.
    const where: Record<string, any> = { product_id: { in: Array.from(productScope) } }
    const and: any[] = []
    if (search) {
      and.push({ or: [{ name: { contains: search } }, { sku: { contains: search } }] })
    }
    if (modeCsv.length) {
      const filtered = modeCsv.filter((v) => MODE_VALUES.has(v))
      if (filtered.length) and.push({ modifier_behavior_mode: { in: filtered } })
    }
    if (isVisibleFilter !== null) and.push({ is_visible: { equals: isVisibleFilter } })
    if (isUsedFilter !== null) and.push({ is_used_for_variations: { equals: isUsedFilter } })
    if (and.length) where.and = and

    const finalWhere = where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'prod-variations',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'prod-variations', where: finalWhere, limit: 0, depth: 0, overrideAccess: true }),
    ])

    const statsDocs = (statsAll.docs as unknown as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const filteredTotal = statsDocs.length

    const modeBreakdown: Record<string, number> = { inherit_product: 0, variation_specific: 0, hybrid: 0 }
    let inStock = 0
    let outOfStock = 0
    let visibleCount = 0
    let hiddenCount = 0
    for (const doc of statsDocs) {
      const m = String(doc.modifier_behavior_mode || 'inherit_product').toLowerCase()
      if (modeBreakdown[m] !== undefined) modeBreakdown[m]++
      else modeBreakdown[m] = 1
      if (num(doc.stock_quantity, 0) > 0) inStock++
      else outOfStock++
      if (doc.is_visible) visibleCount++
      else hiddenCount++
    }

    return NextResponse.json({
      docs,
      products: productOptions,
      stats: { total, filteredTotal, modeBreakdown, inStock, outOfStock, visibleCount, hiddenCount },
      pagination: {
        page: paginated.page,
        limit: paginated.limit,
        totalDocs: paginated.totalDocs,
        totalPages: paginated.totalPages,
        hasNextPage: paginated.hasNextPage,
        hasPrevPage: paginated.hasPrevPage,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch variations'
    console.error('[vendor/catalog/variations] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}