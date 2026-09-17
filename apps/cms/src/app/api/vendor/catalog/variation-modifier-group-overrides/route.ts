/**
 * @file apps/cms/src/app/api/vendor/catalog/variation-modifier-group-overrides/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/variation-modifier-group-overrides.
 *
 * Divergence from admin (cms/.../admin/catalog/variation-modifier-group-overrides): this override
 * collection keys on variation_id + base_modifier_group_id (VariationModifierGroupOverrides.ts:40-70).
 * Merchant scope derives via variation -> product -> owner chain (createdByVendor / createdByMerchant
 * under the vendor's merchants). variationId / baseModifierGroupId filters are ownership-guarded.
 * The base_modifier_group_id points to product-level ModifierGroups (NOT variation-modifier-groups),
 * which must also belong to an owned product. Stat toggles and writes absent for merchants.
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
function extractId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const obj = value as any
    if ('id' in obj) return extractId(obj.id)
    if ('value' in obj) return extractId(obj.value)
  }
  return null
}
function sanitizeVariationBrief(value: unknown): { id: number; name: string | null; sku: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return { id, name: optionalString(src.name), sku: str((src as any).sku, '') }
  }
  return null
}
function sanitizeGroupBrief(value: unknown): { id: number; name: string; product_id: number | null } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return { id, name: str(src.name, ''), product_id: extractId((src as any).product_id) }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    variation_id: sanitizeVariationBrief(raw.variation_id),
    variation: sanitizeVariationBrief(raw.variation_id),
    base_modifier_group_id: sanitizeGroupBrief(raw.base_modifier_group_id),
    base_modifier_group: sanitizeGroupBrief(raw.base_modifier_group_id),
    mode: str(raw.mode, 'inherit'),
    name_override: optionalString(raw.name_override),
    selection_type_override: raw.selection_type_override ? str(raw.selection_type_override, '') : null,
    required_behavior: str(raw.required_behavior, 'inherit'),
    min_selections_override: raw.min_selections_override != null && raw.min_selections_override !== '' ? num(raw.min_selections_override, 0) : null,
    max_selections_override: raw.max_selections_override != null && raw.max_selections_override !== '' ? num(raw.max_selections_override, NaN) : null,
    sort_order_override: raw.sort_order_override != null && raw.sort_order_override !== '' ? Math.trunc(num(raw.sort_order_override, 0)) : null,
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}
function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

const MODES = new Set(['inherit', 'hide', 'override'])
const SELECTION_TYPES = new Set(['single', 'multiple'])
const REQUIRED_BEHAVIORS = new Set(['inherit', 'required', 'optional'])

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
    const variationIdParam = (searchParams.get('variationId') || searchParams.get('variation_id') || '').trim()
    const baseGroupParam = (searchParams.get('base_modifier_group_id') || searchParams.get('baseModifierGroupId') || searchParams.get('base_group_id') || '').trim()
    const modeCsv = parseCsv(searchParams.get('mode'))
    const requiredBehaviorCsv = parseCsv(searchParams.get('required_behavior') || searchParams.get('requiredBehavior'))
    const selectionCsv = parseCsv(searchParams.get('selection_type_override') || searchParams.get('selectionTypeOverride'))
    const isActiveParam = searchParams.get('is_active')
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

    if (ownedProductIds.size === 0) {
      return NextResponse.json({ docs: [], variations: [], groups: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 2. Owned variations + owned product-level modifier-groups (base group candidates).
    const [variationRes, modifierGroupRes] = await Promise.all([
      payload.find({
        collection: 'prod-variations',
        where: { product_id: { in: Array.from(ownedProductIds) } },
        limit: 5000,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'modifier-groups',
        where: { product_id: { in: Array.from(ownedProductIds) } },
        limit: 5000,
        depth: 0,
        overrideAccess: true,
      }),
    ])

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

    const ownedModifierGroupDocs = modifierGroupRes.docs as unknown as Record<string, any>[]
    const ownedModifierGroupIds = new Set(ownedModifierGroupDocs.map((g) => Number(g.id)).filter((v) => Number.isFinite(v)))

    const groups = ownedModifierGroupDocs
      .map((g) => ({ id: Number(g.id), name: str(g.name, ''), product_id: g.product_id != null ? Number((g.product_id as Record<string, any>)?.id ?? g.product_id) : null }))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (ownedVariationIds.size === 0) {
      return NextResponse.json({ docs: [], variations, groups, stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 3. Per-id ownership guards on variationId and baseModifierGroupId filter params.
    if (variationIdParam) {
      const vid = Number(variationIdParam)
      if (!Number.isFinite(vid)) return NextResponse.json({ error: 'variationId must be numeric' }, { status: 400 })
      if (!ownedVariationIds.has(vid)) {
        return NextResponse.json({ error: 'Forbidden: variation does not belong to vendor' }, { status: 403 })
      }
    }
    if (baseGroupParam) {
      const gid = Number(baseGroupParam)
      if (!Number.isFinite(gid)) return NextResponse.json({ error: 'baseModifierGroupId must be numeric' }, { status: 400 })
      if (!ownedModifierGroupIds.has(gid)) {
        return NextResponse.json({ error: 'Forbidden: modifier group does not belong to vendor' }, { status: 403 })
      }
    }

    // 4. Overrides scoped to owned variations (transitively guarantees base group is owned via collection hook).
    const where: Record<string, any> = { variation_id: { in: Array.from(ownedVariationIds) } }
    const and: any[] = []
    if (search) and.push({ name_override: { contains: search } })
    if (variationIdParam) where.variation_id = { equals: Number(variationIdParam) }
    if (baseGroupParam) where.base_modifier_group_id = { equals: Number(baseGroupParam) }
    if (modeCsv.length) {
      const filtered = modeCsv.filter((v) => MODES.has(v))
      if (filtered.length) where.mode = { in: filtered }
    }
    if (requiredBehaviorCsv.length) {
      const filtered = requiredBehaviorCsv.filter((v) => REQUIRED_BEHAVIORS.has(v))
      if (filtered.length) where.required_behavior = { in: filtered }
    }
    if (selectionCsv.length) {
      const filtered = selectionCsv.filter((v) => SELECTION_TYPES.has(v))
      if (filtered.length) where.selection_type_override = { in: filtered }
    }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }
    if (and.length) where.and = and

    const finalWhere = where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'variation-modifier-group-overrides',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'variation-modifier-group-overrides', where: finalWhere, limit: 0, depth: 0, overrideAccess: true }),
    ])

    const statsDocs = (statsAll.docs as unknown as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const filteredTotal = statsDocs.length

    const modeBreakdown: Record<string, number> = { inherit: 0, hide: 0, override: 0 }
    const requiredBehaviorBreakdown: Record<string, number> = { inherit: 0, required: 0, optional: 0 }
    let activeCount = 0
    let inactiveCount = 0
    for (const doc of statsDocs) {
      const m = String(doc.mode || 'inherit').toLowerCase()
      if (modeBreakdown[m] !== undefined) modeBreakdown[m]++
      else modeBreakdown[m] = 1
      const rb = String(doc.required_behavior || 'inherit').toLowerCase()
      if (requiredBehaviorBreakdown[rb] !== undefined) requiredBehaviorBreakdown[rb]++
      else requiredBehaviorBreakdown[rb] = 1
      if (doc.is_active) activeCount++
      else inactiveCount++
    }

    return NextResponse.json({
      docs,
      variations,
      groups,
      stats: { total, filteredTotal, modeBreakdown, requiredBehaviorBreakdown, activeCount, inactiveCount },
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
    const msg = err instanceof Error ? err.message : 'Failed to fetch variation modifier group overrides'
    console.error('[vendor/catalog/variation-modifier-group-overrides] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}