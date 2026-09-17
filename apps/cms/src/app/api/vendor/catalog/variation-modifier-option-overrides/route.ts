/**
 * @file apps/cms/src/app/api/vendor/catalog/variation-modifier-option-overrides/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/variation-modifier-option-overrides.
 *
 * Divergence from admin (cms/.../admin/catalog/variation-modifier-option-overrides): this override
 * collection keys on variation_id + base_modifier_option_id (VariationModifierOptionOverrides.ts:40-52).
 * The base_modifier_option_id points to product-level modifier-options (NOT variation-modifier-options).
 * Merchant scope derives via variation -> product -> owner chain. variationId and baseModifierOptionId
 * filters are ownership-guarded. Stat toggles and writes absent for merchants.
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
function sanitizeOptionBrief(value: unknown): { id: number; name: string; product_id: number | null } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return { id, name: str(src.name, ''), product_id: extractId((src as any).modifier_group_id) }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    variation_id: sanitizeVariationBrief(raw.variation_id),
    variation: sanitizeVariationBrief(raw.variation_id),
    base_modifier_option_id: sanitizeOptionBrief(raw.base_modifier_option_id),
    base_modifier_option: sanitizeOptionBrief(raw.base_modifier_option_id),
    mode: str(raw.mode, 'inherit'),
    name_override: optionalString(raw.name_override),
    price_adjustment_override: raw.price_adjustment_override != null && raw.price_adjustment_override !== '' ? num(raw.price_adjustment_override, 0) : null,
    default_behavior: str(raw.default_behavior, 'inherit'),
    availability_behavior: str(raw.availability_behavior, 'inherit'),
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
const DEFAULT_BEHAVIORS = new Set(['inherit', 'default', 'not_default'])
const AVAILABILITY_BEHAVIORS = new Set(['inherit', 'available', 'unavailable'])

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
    const baseOptionParam = (searchParams.get('base_modifier_option_id') || searchParams.get('baseModifierOptionId') || searchParams.get('base_option_id') || '').trim()
    const modeCsv = parseCsv(searchParams.get('mode'))
    const defaultBehaviorCsv = parseCsv(searchParams.get('default_behavior') || searchParams.get('defaultBehavior'))
    const availabilityBehaviorCsv = parseCsv(searchParams.get('availability_behavior') || searchParams.get('availabilityBehavior'))
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
      return NextResponse.json({ docs: [], variations: [], options: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 2. Owned variations + owned product-level modifier-groups + owned modifier-options (base option candidates).
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

    if (ownedModifierGroupIds.size === 0) {
      return NextResponse.json({ docs: [], variations, options: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 3. Owned modifier-options (options whose modifier_group_id is owned).
    const optionRes = await payload.find({
      collection: 'modifier-options',
      where: { modifier_group_id: { in: Array.from(ownedModifierGroupIds) } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    const ownedOptionDocs = optionRes.docs as unknown as Record<string, any>[]
    const ownedOptionIds = new Set(ownedOptionDocs.map((o) => Number(o.id)).filter((v) => Number.isFinite(v)))

    const options = ownedOptionDocs
      .map((o) => ({ id: Number(o.id), name: str(o.name, ''), group_id: extractId(o.modifier_group_id) }))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (ownedVariationIds.size === 0) {
      return NextResponse.json({ docs: [], variations, options, stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 4. Per-id ownership guards on variationId and baseModifierOptionId filter params.
    if (variationIdParam) {
      const vid = Number(variationIdParam)
      if (!Number.isFinite(vid)) return NextResponse.json({ error: 'variationId must be numeric' }, { status: 400 })
      if (!ownedVariationIds.has(vid)) {
        return NextResponse.json({ error: 'Forbidden: variation does not belong to vendor' }, { status: 403 })
      }
    }
    if (baseOptionParam) {
      const oid = Number(baseOptionParam)
      if (!Number.isFinite(oid)) return NextResponse.json({ error: 'baseModifierOptionId must be numeric' }, { status: 400 })
      if (!ownedOptionIds.has(oid)) {
        return NextResponse.json({ error: 'Forbidden: modifier option does not belong to vendor' }, { status: 403 })
      }
    }

    // 5. Option overrides scoped to owned variations.
    const where: Record<string, any> = { variation_id: { in: Array.from(ownedVariationIds) } }
    const and: any[] = []
    if (search) and.push({ name_override: { contains: search } })
    if (variationIdParam) where.variation_id = { equals: Number(variationIdParam) }
    if (baseOptionParam) where.base_modifier_option_id = { equals: Number(baseOptionParam) }
    if (modeCsv.length) {
      const filtered = modeCsv.filter((v) => MODES.has(v))
      if (filtered.length) where.mode = { in: filtered }
    }
    if (defaultBehaviorCsv.length) {
      const filtered = defaultBehaviorCsv.filter((v) => DEFAULT_BEHAVIORS.has(v))
      if (filtered.length) where.default_behavior = { in: filtered }
    }
    if (availabilityBehaviorCsv.length) {
      const filtered = availabilityBehaviorCsv.filter((v) => AVAILABILITY_BEHAVIORS.has(v))
      if (filtered.length) where.availability_behavior = { in: filtered }
    }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }
    if (and.length) where.and = and

    const finalWhere = where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'variation-modifier-option-overrides',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'variation-modifier-option-overrides', where: finalWhere, limit: 0, depth: 0, overrideAccess: true }),
    ])

    const statsDocs = (statsAll.docs as unknown as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const filteredTotal = statsDocs.length

    const modeBreakdown: Record<string, number> = { inherit: 0, hide: 0, override: 0 }
    const defaultBehaviorBreakdown: Record<string, number> = { inherit: 0, default: 0, not_default: 0 }
    const availabilityBreakdown: Record<string, number> = { inherit: 0, available: 0, unavailable: 0 }
    let activeCount = 0
    let inactiveCount = 0
    for (const doc of statsDocs) {
      const m = String(doc.mode || 'inherit').toLowerCase()
      if (modeBreakdown[m] !== undefined) modeBreakdown[m]++
      else modeBreakdown[m] = 1
      const db = String(doc.default_behavior || 'inherit').toLowerCase()
      if (defaultBehaviorBreakdown[db] !== undefined) defaultBehaviorBreakdown[db]++
      else defaultBehaviorBreakdown[db] = 1
      const ab = String(doc.availability_behavior || 'inherit').toLowerCase()
      if (availabilityBreakdown[ab] !== undefined) availabilityBreakdown[ab]++
      else availabilityBreakdown[ab] = 1
      if (doc.is_active) activeCount++
      else inactiveCount++
    }

    return NextResponse.json({
      docs,
      variations,
      options,
      stats: { total, filteredTotal, modeBreakdown, defaultBehaviorBreakdown, availabilityBreakdown, activeCount, inactiveCount },
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
    const msg = err instanceof Error ? err.message : 'Failed to fetch variation modifier option overrides'
    console.error('[vendor/catalog/variation-modifier-option-overrides] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}