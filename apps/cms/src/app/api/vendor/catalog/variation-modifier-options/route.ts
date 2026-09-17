/**
 * @file apps/cms/src/app/api/vendor/catalog/variation-modifier-options/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/variation-modifier-options.
 *
 * Divergence from admin (cms/.../admin/catalog/variation-modifier-options): variation-modifier-options
 * attach to variation_modifier_group_id (collection VariationModifierOptions.ts:30-33). Merchant scope
 * derives via group -> variation -> product -> owner chain (createdByVendor / createdByMerchant under
 * the vendor's merchants). groupId filter is ownership-guarded (403 for foreign groups). Writes absent.
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
function idNum(v: unknown): number | null {
  if (typeof v === 'object' && v != null && 'id' in (v as Record<string, unknown>)) {
    const n = Number((v as Record<string, unknown>).id)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(v as string | number)
  return Number.isFinite(n) ? n : null
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
function sanitizeGroupBrief(raw: Record<string, any>) {
  return {
    id: Number(raw.id),
    name: str(raw.name),
    variation_id: sanitizeVariationBrief(raw.variation_id),
    selection_type: str(raw.selection_type, 'single'),
    is_required: typeof raw.is_required === 'boolean' ? raw.is_required : false,
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
  }
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const gRaw = raw.variation_modifier_group_id
  let group: ReturnType<typeof sanitizeGroupBrief> | null = null
  if (gRaw && typeof gRaw === 'object' && !Array.isArray(gRaw)) group = sanitizeGroupBrief(gRaw as Record<string, any>)
  return {
    id: raw.id,
    variation_modifier_group_id: idNum(gRaw),
    group,
    name: str(raw.name, ''),
    price_adjustment: raw.price_adjustment != null ? num(raw.price_adjustment, 0) : 0,
    is_default: typeof raw.is_default === 'boolean' ? raw.is_default : false,
    is_available: typeof raw.is_available === 'boolean' ? raw.is_available : true,
    sort_order: raw.sort_order != null ? Math.trunc(num(raw.sort_order, 0)) : 0,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

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
    const groupIdRaw = searchParams.get('groupId') || searchParams.get('variation_modifier_group_id') || searchParams.get('variationModifierGroupId') || ''
    const isAvailableParam = searchParams.get('is_available')
    const isDefaultParam = searchParams.get('is_default')
    const isAvailableFilter = isAvailableParam === 'true' ? true : isAvailableParam === 'false' ? false : null
    const isDefaultFilter = isDefaultParam === 'true' ? true : isDefaultParam === 'false' ? false : null

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
    const ownedProductIds = new Set((prodRes.docs as unknown as Record<string, any>[]).map((p) => Number(p.id)).filter((v) => Number.isFinite(v)))

    if (ownedProductIds.size === 0) {
      return NextResponse.json({ docs: [], groups: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 2. Owned variations under the vendor's products.
    const variationRes = await payload.find({
      collection: 'prod-variations',
      where: { product_id: { in: Array.from(ownedProductIds) } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    const ownedVariationIds = new Set((variationRes.docs as unknown as Record<string, any>[]).map((v) => Number(v.id)).filter((v) => Number.isFinite(v)))

    if (ownedVariationIds.size === 0) {
      return NextResponse.json({ docs: [], groups: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 3. Owned variation-modifier-groups -> group options for the filter dropdown.
    const groupRes = await payload.find({
      collection: 'variation-modifier-groups',
      where: { variation_id: { in: Array.from(ownedVariationIds) } },
      limit: 5000,
      depth: 1,
      overrideAccess: true,
    })
    const ownedGroupDocs = groupRes.docs as unknown as Record<string, any>[]
    const ownedGroupIds = new Set(ownedGroupDocs.map((g) => Number(g.id)).filter((v) => Number.isFinite(v)))

    const groups = ownedGroupDocs
      .map((g) => ({ id: Number(g.id), name: str(g.name, ''), variation_id: sanitizeVariationBrief(g.variation_id) }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name))

    if (ownedGroupIds.size === 0) {
      return NextResponse.json({ docs: [], groups, stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 4. groupId filter must be one of the vendor's owned groups.
    if (groupIdRaw) {
      const gid = Number(groupIdRaw)
      if (!Number.isFinite(gid)) return NextResponse.json({ error: 'groupId must be numeric' }, { status: 400 })
      if (!ownedGroupIds.has(gid)) {
        return NextResponse.json({ error: 'Forbidden: variation modifier group does not belong to vendor' }, { status: 403 })
      }
    }

    // 5. Options scoped to owned groups.
    const where: Record<string, any> = { variation_modifier_group_id: { in: Array.from(ownedGroupIds) } }
    const and: any[] = []
    if (search) and.push({ name: { contains: search } })
    if (groupIdRaw) where.variation_modifier_group_id = { equals: Number(groupIdRaw) }
    if (isAvailableFilter !== null) where.is_available = { equals: isAvailableFilter }
    if (isDefaultFilter !== null) where.is_default = { equals: isDefaultFilter }
    if (and.length) where.and = and

    const finalWhere = where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'variation-modifier-options',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'variation-modifier-options', where: finalWhere, limit: 0, depth: 0, overrideAccess: true }),
    ])

    const statsDocs = (statsAll.docs as unknown as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const filteredTotal = statsDocs.length
    let available = 0
    let unavailable = 0
    let defaults = 0
    for (const d of statsDocs) {
      if (d.is_available !== false) available++
      else unavailable++
      if (d.is_default) defaults++
    }

    return NextResponse.json({
      docs,
      groups,
      stats: { total, filteredTotal, available, unavailable, defaults },
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
    const msg = err instanceof Error ? err.message : 'Failed to fetch variation modifier options'
    console.error('[vendor/catalog/variation-modifier-options] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}