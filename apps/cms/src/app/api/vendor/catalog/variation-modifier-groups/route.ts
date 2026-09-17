/**
 * @file apps/cms/src/app/api/vendor/catalog/variation-modifier-groups/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/variation-modifier-groups.
 *
 * Divergence from admin (cms/.../admin/catalog/variation-modifier-groups): variation-modifier-groups
 * attach to variation_id (collection VariationModifierGroups.ts:24-32) with no product/vendor FK.
 * Vendors only see groups whose variation belongs to their products (createdByVendor /
 * createdByMerchant under their merchants, then prod-variations under those products), with a
 * per-id ownership guard on the variationId filter. Stat toggles (is_required / is_active) and
 * write endpoints are absent for merchants — the UI renders static badges only.
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
function sanitizeVariationBrief(value: unknown): { id: number; name: string | null; sku: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, any>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return { id, name: optionalString(src.name), sku: str(src.sku, '') }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    variation_id: sanitizeVariationBrief(raw.variation_id),
    variation: sanitizeVariationBrief(raw.variation_id),
    name: str(raw.name, ''),
    selection_type: str(raw.selection_type, 'single'),
    is_required: typeof raw.is_required === 'boolean' ? raw.is_required : false,
    min_selections: raw.min_selections != null ? num(raw.min_selections, 0) : 0,
    max_selections: raw.max_selections != null && raw.max_selections !== '' ? num(raw.max_selections, NaN) : null,
    sort_order: raw.sort_order != null ? Math.trunc(num(raw.sort_order, 0)) : 0,
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
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
    const variationIdParam = searchParams.get('variationId')?.trim() || searchParams.get('variation_id')?.trim() || ''
    const selectionCsv = parseCsv(searchParams.get('selection_type'))
    const isRequiredParam = searchParams.get('is_required')
    const isActiveParam = searchParams.get('is_active')
    const isRequiredFilter = isRequiredParam === 'true' ? true : isRequiredParam === 'false' ? false : null
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

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

    // 2. Variations under the vendor's products drive both the scope and the filter dropdown.
    const variationRes = await payload.find({
      collection: 'prod-variations',
      where: { product_id: { in: Array.from(ownedProductIds) } },
      limit: 5000,
      depth: 1,
      overrideAccess: true,
    })
    const ownedVariationDocs = variationRes.docs as unknown as Record<string, any>[]
    const ownedVariationIds = new Set(ownedVariationDocs.map((v) => Number(v.id)).filter((v) => Number.isFinite(v)))

    const variations = ownedVariationDocs
      .map((v) => ({
        id: Number(v.id),
        name: optionalString(v.name) ?? `Variation #${v.id}`,
        sku: str(v.sku, ''),
        product_id: v.product_id != null ? Number((v.product_id as Record<string, any>)?.id ?? v.product_id) : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (ownedVariationIds.size === 0) {
      return NextResponse.json({ docs: [], variations, stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 3. variationId filter must be one of the vendor's owned variations.
    if (variationIdParam) {
      const vid = Number(variationIdParam)
      if (!Number.isFinite(vid)) return NextResponse.json({ error: 'variationId must be numeric' }, { status: 400 })
      if (!ownedVariationIds.has(vid)) {
        return NextResponse.json({ error: 'Forbidden: variation does not belong to vendor' }, { status: 403 })
      }
    }

    // 4. Variation modifier groups scoped to owned variations.
    const where: Record<string, any> = { variation_id: { in: Array.from(ownedVariationIds) } }
    const and: any[] = []
    if (search) and.push({ name: { contains: search } })
    if (variationIdParam) where.variation_id = { equals: Number(variationIdParam) }
    if (selectionCsv.length) {
      const filtered = selectionCsv.filter((v) => SELECTION_TYPES.has(v))
      if (filtered.length) where.selection_type = { in: filtered }
    }
    if (isRequiredFilter !== null) where.is_required = { equals: isRequiredFilter }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }
    if (and.length) where.and = and

    const finalWhere = where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'variation-modifier-groups',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'variation-modifier-groups', where: finalWhere, limit: 0, depth: 0, overrideAccess: true }),
    ])

    const statsDocs = (statsAll.docs as unknown as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const filteredTotal = statsDocs.length

    const selectionBreakdown: Record<string, number> = { single: 0, multiple: 0 }
    let requiredCount = 0
    let optionalCount = 0
    let activeCount = 0
    let inactiveCount = 0
    for (const doc of statsDocs) {
      const st = String(doc.selection_type || 'single').toLowerCase()
      if (selectionBreakdown[st] !== undefined) selectionBreakdown[st]++
      else selectionBreakdown[st] = 1
      if (doc.is_required) requiredCount++
      else optionalCount++
      if (doc.is_active) activeCount++
      else inactiveCount++
    }

    return NextResponse.json({
      docs,
      variations,
      stats: { total, filteredTotal, selectionBreakdown, requiredCount, optionalCount, activeCount, inactiveCount },
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
    const msg = err instanceof Error ? err.message : 'Failed to fetch variation modifier groups'
    console.error('[vendor/catalog/variation-modifier-groups] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}