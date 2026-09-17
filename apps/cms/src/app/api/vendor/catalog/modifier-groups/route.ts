/**
 * @file apps/cms/src/app/api/vendor/catalog/modifier-groups/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/modifier-groups.
 *
 * Divergence from admin (cms/.../admin/catalog/modifier-groups): ModifierGroups attach
 * to product_id (collection ModifierGroups.ts:23-28) with no vendor FK. Merchants only
 * see groups of their own products (createdByVendor / createdByMerchant under their
 * merchants), per-id ownership guard on productId filter. Write endpoints absent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

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
function sanitizeProductBrief(value: unknown): { id: number; name: string; slug: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, any>
    const id = Number(obj.id)
    if (Number.isNaN(id)) return null
    return { id, name: str(obj.name), slug: str(obj.slug) }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    product_id: sanitizeProductBrief(raw.product_id),
    product: sanitizeProductBrief(raw.product_id),
    name: str(raw.name, ''),
    selection_type: str(raw.selection_type, 'single'),
    is_required: typeof raw.is_required === 'boolean' ? raw.is_required : false,
    min_selections: raw.min_selections != null ? num(raw.min_selections, 0) : 0,
    max_selections: raw.max_selections != null && raw.max_selections !== '' ? num(raw.max_selections, NaN) : null,
    sort_order: raw.sort_order != null ? Math.trunc(num(raw.sort_order, 0)) : 0,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}
function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

const SELECTION_TYPES = new Set(['single', 'multiple'])

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
    const productIdParam = searchParams.get('productId')?.trim() || searchParams.get('product_id')?.trim() || ''
    const selectionCsv = parseCsv(searchParams.get('selection_type'))
    const isRequiredParam = searchParams.get('is_required')
    const isRequiredFilter = isRequiredParam === 'true' ? true : isRequiredParam === 'false' ? false : null

    // 1. Resolve vendor + owned products.
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

    const products = ownedProducts
      .map((p) => ({ id: Number(p.id), name: str(p.name, ''), slug: str(p.slug, '') }))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (ownedProductIds.size === 0) {
      return NextResponse.json({ docs: [], products, stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 2. productId filter must be one of the vendor's owned products.
    if (productIdParam) {
      const pid = Number(productIdParam)
      if (!Number.isFinite(pid)) return NextResponse.json({ error: 'productId must be numeric' }, { status: 400 })
      if (!ownedProductIds.has(pid)) {
        return NextResponse.json({ error: 'Forbidden: product does not belong to vendor' }, { status: 403 })
      }
    }

    // 3. Modifier groups scoped to owned products.
    const where: Record<string, any> = { product_id: { in: Array.from(ownedProductIds) } }
    const and: any[] = []
    if (search) and.push({ name: { contains: search } })
    if (productIdParam) where.product_id = { equals: Number(productIdParam) }
    if (selectionCsv.length) {
      const filtered = selectionCsv.filter((v) => SELECTION_TYPES.has(v))
      if (filtered.length) where.selection_type = { in: filtered }
    }
    if (isRequiredFilter !== null) where.is_required = { equals: isRequiredFilter }
    if (and.length) where.and = and

    const finalWhere = where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'modifier-groups',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'modifier-groups', where: finalWhere, limit: 0, depth: 0, overrideAccess: true }),
    ])

    const statsDocs = (statsAll.docs as unknown as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const filteredTotal = statsDocs.length

    const selectionBreakdown: Record<string, number> = { single: 0, multiple: 0 }
    let requiredCount = 0
    let optionalCount = 0
    for (const doc of statsDocs) {
      const st = String(doc.selection_type || 'single').toLowerCase()
      if (selectionBreakdown[st] !== undefined) selectionBreakdown[st]++
      else selectionBreakdown[st] = 1
      if (doc.is_required) requiredCount++
      else optionalCount++
    }

    return NextResponse.json({
      docs,
      products,
      stats: { total, filteredTotal, selectionBreakdown, requiredCount, optionalCount },
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
    const msg = err instanceof Error ? err.message : 'Failed to fetch modifier groups'
    console.error('[vendor/catalog/modifier-groups] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}