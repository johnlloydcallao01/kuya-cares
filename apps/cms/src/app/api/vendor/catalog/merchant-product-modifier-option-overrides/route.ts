/**
 * @file apps/cms/src/app/api/vendor/catalog/merchant-product-modifier-option-overrides/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/merchant-product-modifier-option-overrides.
 *
 * Divergence from admin (cms/.../admin/catalog/merchant-product-modifier-option-overrides): this override
 * collection keys on merchant_product_id + base_modifier_option_id (MerchantProductModifierOptionOverrides.ts:25-63).
 * Merchant scope derives via merchant-product -> merchants -> vendor chain (vendors.user == auth user, and
 * merchant-products.merchant_id is the FK on merchant-products). The base_modifier_option_id points to
 * product-level modifier-options whose batch must also derive from owned products. merchantProductId and
 * baseModifierOptionId filters are ownership-guarded. Writes absent for merchants.
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
function sanitizeOptionBrief(value: unknown): { id: number; name: string } | number | null {
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
    const merchantProductParam = (searchParams.get('merchant_product_id') || searchParams.get('merchantProductId') || '').trim()
    const baseOptionParam = (searchParams.get('base_modifier_option_id') || searchParams.get('baseModifierOptionId') || searchParams.get('base_option_id') || '').trim()
    const modeCsv = parseCsv(searchParams.get('mode'))
    const defaultBehaviorCsv = parseCsv(searchParams.get('default_behavior') || searchParams.get('defaultBehavior'))
    const availabilityBehaviorCsv = parseCsv(searchParams.get('availability_behavior') || searchParams.get('availabilityBehavior'))
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
      return NextResponse.json({ docs: [], merchant_products: [], options: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 2. Owned merchant-products (merchant-products.merchant_id is the FK).
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
      return NextResponse.json({ docs: [], merchant_products, options: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 3. Owned products + owned modifier-groups + owned modifier-options (base option candidates).
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
    const ownedModifierGroupIds = new Set((modifierGroupRes.docs as unknown as Record<string, any>[]).map((g) => Number(g.id)).filter((v) => Number.isFinite(v)))

    if (ownedModifierGroupIds.size === 0) {
      return NextResponse.json({ docs: [], merchant_products, options: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

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

    // 4. Per-id ownership guards on merchantProductId and baseModifierOptionId filter params.
    if (merchantProductParam) {
      const mpid = Number(merchantProductParam)
      if (!Number.isFinite(mpid)) return NextResponse.json({ error: 'merchantProductId must be numeric' }, { status: 400 })
      if (!ownedMerchantProductIds.has(mpid)) {
        return NextResponse.json({ error: 'Forbidden: merchant product does not belong to vendor' }, { status: 403 })
      }
    }
    if (baseOptionParam) {
      const oid = Number(baseOptionParam)
      if (!Number.isFinite(oid)) return NextResponse.json({ error: 'baseModifierOptionId must be numeric' }, { status: 400 })
      if (!ownedOptionIds.has(oid)) {
        return NextResponse.json({ error: 'Forbidden: modifier option does not belong to vendor' }, { status: 403 })
      }
    }

    // 5. Option overrides scoped to owned merchant products.
    const where: Record<string, any> = { merchant_product_id: { in: Array.from(ownedMerchantProductIds) } }
    const and: any[] = []
    if (search) and.push({ name_override: { contains: search } })
    if (merchantProductParam) where.merchant_product_id = { equals: Number(merchantProductParam) }
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
        collection: 'merchant-product-modifier-option-overrides',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'merchant-product-modifier-option-overrides', where: finalWhere, limit: 0, depth: 0, overrideAccess: true }),
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
      merchant_products,
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
    const msg = err instanceof Error ? err.message : 'Failed to fetch merchant product modifier option overrides'
    console.error('[vendor/catalog/merchant-product-modifier-option-overrides] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}