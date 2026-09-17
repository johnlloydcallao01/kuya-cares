/**
 * @file apps/cms/src/app/api/vendor/catalog/merchant-product-modifier-group-overrides/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/merchant-product-modifier-group-overrides.
 *
 * Divergence from admin (cms/.../admin/catalog/merchant-product-modifier-group-overrides): this override
 * collection keys on merchant_product_id + base_modifier_group_id (MerchantProductModifierGroupOverrides.ts:25-57).
 * Merchant scope derives via merchant-product -> merchant -> vendor chain (vendors.user == auth user). The
 * base_modifier_group_id points to product-level modifier-groups whose product_id must also be owned by the
 * vendor. merchantProductId / baseModifierGroupId filters are ownership-guarded. Writes absent for merchants.
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
function sanitizeMerchantProductBrief(value: unknown): { id: number; display_title: string | null } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    const title = optionalString(src.display_title) || optionalString((src as any).displayTitle) || null
    return { id, display_title: title }
  }
  return null
}
function sanitizeGroupBrief(value: unknown): { id: number; name: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return { id, name: str(src.name, '') }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    merchant_product_id: sanitizeMerchantProductBrief(raw.merchant_product_id),
    merchant_product: sanitizeMerchantProductBrief(raw.merchant_product_id),
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
    const merchantProductParam = (searchParams.get('merchant_product_id') || searchParams.get('merchantProductId') || '').trim()
    const baseGroupParam = (searchParams.get('base_modifier_group_id') || searchParams.get('baseModifierGroupId') || searchParams.get('base_group_id') || '').trim()
    const modeCsv = parseCsv(searchParams.get('mode'))
    const requiredBehaviorCsv = parseCsv(searchParams.get('required_behavior') || searchParams.get('requiredBehavior'))
    const selectionCsv = parseCsv(searchParams.get('selection_type_override') || searchParams.get('selectionTypeOverride'))
    const isActiveParam = searchParams.get('is_active')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    // 1. Resolve vendor + owned merchants.
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
      return NextResponse.json({ docs: [], merchant_products: [], groups: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 2. Owned merchant-products.
    const merchantProductRes = await payload.find({
      collection: 'merchant-products',
      where: { merchant_id: { in: merchantIds } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    const ownedMerchantProductDocs = merchantProductRes.docs as unknown as Record<string, any>[]
    const ownedMerchantProductIds = new Set(ownedMerchantProductDocs.map((mp) => Number(mp.id)).filter((v) => Number.isFinite(v)))

    const merchant_products = ownedMerchantProductDocs
      .map((mp) => ({
        id: Number(mp.id),
        display_title: optionalString(mp.display_title) ?? `Merchant Product #${mp.id}`,
        product_id: mp.product_id != null ? Number((mp.product_id as Record<string, any>)?.id ?? mp.product_id) : null,
      }))
      .sort((a, b) => a.display_title.localeCompare(b.display_title))

    if (ownedMerchantProductIds.size === 0) {
      return NextResponse.json({ docs: [], merchant_products, groups: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 3. Owned products + owned product-level modifier-groups (base group candidates).
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

    const modifierGroupRes = await payload.find({
      collection: 'modifier-groups',
      where: { product_id: { in: Array.from(ownedProductIds) } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    const ownedModifierGroupDocs = modifierGroupRes.docs as unknown as Record<string, any>[]
    const ownedModifierGroupIds = new Set(ownedModifierGroupDocs.map((g) => Number(g.id)).filter((v) => Number.isFinite(v)))

    const groups = ownedModifierGroupDocs
      .map((g) => ({ id: Number(g.id), name: str(g.name, ''), product_id: g.product_id != null ? Number((g.product_id as Record<string, any>)?.id ?? g.product_id) : null }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // 4. Per-id ownership guards on merchantProductId and baseModifierGroupId filter params.
    if (merchantProductParam) {
      const mpid = Number(merchantProductParam)
      if (!Number.isFinite(mpid)) return NextResponse.json({ error: 'merchantProductId must be numeric' }, { status: 400 })
      if (!ownedMerchantProductIds.has(mpid)) {
        return NextResponse.json({ error: 'Forbidden: merchant product does not belong to vendor' }, { status: 403 })
      }
    }
    if (baseGroupParam) {
      const gid = Number(baseGroupParam)
      if (!Number.isFinite(gid)) return NextResponse.json({ error: 'baseModifierGroupId must be numeric' }, { status: 400 })
      if (!ownedModifierGroupIds.has(gid)) {
        return NextResponse.json({ error: 'Forbidden: modifier group does not belong to vendor' }, { status: 403 })
      }
    }

    // 5. Overrides scoped to owned merchant products.
    const where: Record<string, any> = { merchant_product_id: { in: Array.from(ownedMerchantProductIds) } }
    const and: any[] = []
    if (search) and.push({ name_override: { contains: search } })
    if (merchantProductParam) where.merchant_product_id = { equals: Number(merchantProductParam) }
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
        collection: 'merchant-product-modifier-group-overrides',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'merchant-product-modifier-group-overrides', where: finalWhere, limit: 0, depth: 0, overrideAccess: true }),
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
      merchant_products,
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
    const msg = err instanceof Error ? err.message : 'Failed to fetch merchant product modifier group overrides'
    console.error('[vendor/catalog/merchant-product-modifier-group-overrides] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}