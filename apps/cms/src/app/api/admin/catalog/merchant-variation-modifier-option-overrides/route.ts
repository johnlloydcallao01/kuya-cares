/**
 * @file apps/cms/src/app/api/admin/catalog/merchant-variation-modifier-option-overrides/route.ts
 * @description BFF aggregation endpoint for merchant-variation-modifier-option-overrides (admin) — mirrors vendors pattern.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

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
    variation_id: sanitizeVariationBrief(raw.variation_id),
    variation: sanitizeVariationBrief(raw.variation_id),
    target_option_source: str(raw.target_option_source, 'product_base'),
    base_modifier_option_id: sanitizeOptionBrief(raw.base_modifier_option_id),
    base_modifier_option: sanitizeOptionBrief(raw.base_modifier_option_id),
    variation_modifier_option_id: sanitizeOptionBrief(raw.variation_modifier_option_id),
    variation_modifier_option: sanitizeOptionBrief(raw.variation_modifier_option_id),
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
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

const MODES = new Set(['inherit', 'hide', 'override'])
const TARGET_SOURCES = new Set(['product_base', 'variation_added'])
const DEFAULT_BEHAVIORS = new Set(['inherit', 'default', 'not_default'])
const AVAILABILITY_BEHAVIORS = new Set(['inherit', 'available', 'unavailable'])

async function resolveMerchantProductProductId(payload: any, merchantProductId: number): Promise<number | null> {
  try {
    const mp = await payload.findByID({ collection: 'merchant-products', id: merchantProductId, depth: 0, overrideAccess: true })
    return extractId((mp as any)?.product_id)
  } catch {
    return null
  }
}

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
    const cacheKey = `admin:catalog-merchant-variation-modifier-option-overrides:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-MerchantVariationModifierOptionOverrides-Cache': 'HIT' } })
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const merchantProductParam = searchParams.get('merchant_product_id')?.trim() || searchParams.get('merchantProductId')?.trim() || searchParams.get('merchant_product')?.trim() || ''
    const variationParam = searchParams.get('variation_id')?.trim() || searchParams.get('variationId')?.trim() || ''
    const targetSourceCsv = parseCsv(searchParams.get('target_option_source') || searchParams.get('targetOptionSource'))
    const baseOptionParam = searchParams.get('base_modifier_option_id')?.trim() || searchParams.get('baseModifierOptionId')?.trim() || searchParams.get('base_option_id')?.trim() || ''
    const variationOptionParam = searchParams.get('variation_modifier_option_id')?.trim() || searchParams.get('variationModifierOptionId')?.trim() || ''
    const modeCsv = parseCsv(searchParams.get('mode'))
    const isActiveParam = searchParams.get('is_active') || searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({ name_override: { contains: search } })
    }
    if (merchantProductParam) {
      const mpId = Number(merchantProductParam)
      if (!Number.isNaN(mpId)) where.merchant_product_id = { equals: mpId }
      else where.merchant_product_id = { equals: merchantProductParam }
    }
    if (variationParam) {
      const vid = Number(variationParam)
      if (!Number.isNaN(vid)) where.variation_id = { equals: vid }
      else where.variation_id = { equals: variationParam }
    }
    if (targetSourceCsv.length) {
      const filtered = targetSourceCsv.filter((v) => TARGET_SOURCES.has(v))
      if (filtered.length) where.target_option_source = { in: filtered }
    }
    if (baseOptionParam) {
      const oid = Number(baseOptionParam)
      if (!Number.isNaN(oid)) where.base_modifier_option_id = { equals: oid }
      else where.base_modifier_option_id = { equals: baseOptionParam }
    }
    if (variationOptionParam) {
      const oid = Number(variationOptionParam)
      if (!Number.isNaN(oid)) where.variation_modifier_option_id = { equals: oid }
      else where.variation_modifier_option_id = { equals: variationOptionParam }
    }
    if (modeCsv.length) {
      const filtered = modeCsv.filter((v) => MODES.has(v))
      if (filtered.length) where.mode = { in: filtered }
    }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'merchant-variation-modifier-option-overrides',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'merchant-variation-modifier-option-overrides', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const statsDocs = (statsAll as any).docs as Record<string, any>[] ?? []

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const totalAll = statsDocs.length

    const modeBreakdown: Record<string, number> = { inherit: 0, hide: 0, override: 0 }
    const sourceBreakdown: Record<string, number> = { product_base: 0, variation_added: 0 }
    let activeCount = 0
    let inactiveCount = 0
    for (const doc of statsDocs) {
      const m = String(doc.mode || 'inherit').toLowerCase()
      if (modeBreakdown[m] !== undefined) modeBreakdown[m]++
      else modeBreakdown[m] = 1
      const s = String(doc.target_option_source || 'product_base').toLowerCase()
      if (sourceBreakdown[s] !== undefined) sourceBreakdown[s]++
      else sourceBreakdown[s] = 1
      if (doc.is_active) activeCount++
      else inactiveCount++
    }

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
        total,
        totalAll,
        filteredTotal: total,
        modeBreakdown,
        sourceBreakdown,
        targetOptionSourceBreakdown: sourceBreakdown,
        activeCount,
        inactiveCount,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-MerchantVariationModifierOptionOverrides-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/catalog/merchant-variation-modifier-option-overrides] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load merchant-variation-modifier-option-overrides' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const rawMerchantProductId = body.merchant_product_id ?? body.merchantProductId ?? body.merchant_product
    if (rawMerchantProductId == null || rawMerchantProductId === '') return badRequest('merchant_product_id is required')
    const merchantProductIdNum = Number(rawMerchantProductId)
    if (Number.isNaN(merchantProductIdNum)) return badRequest('merchant_product_id must be numeric')
    let merchantProductDoc: any = null
    try {
      merchantProductDoc = await payload.findByID({ collection: 'merchant-products', id: merchantProductIdNum, depth: 0, overrideAccess: true }) as any
      if (!merchantProductDoc) return badRequest('merchant_product_id does not exist')
    } catch {
      return badRequest('merchant_product_id does not exist')
    }

    const rawVariationId = body.variation_id ?? body.variationId ?? body.variation
    if (rawVariationId == null || rawVariationId === '') return badRequest('variation_id is required')
    const variationIdNum = Number(rawVariationId)
    if (Number.isNaN(variationIdNum)) return badRequest('variation_id must be numeric')
    let variationDoc: any = null
    try {
      variationDoc = await payload.findByID({ collection: 'prod-variations', id: variationIdNum, depth: 0, overrideAccess: true }) as any
      if (!variationDoc) return badRequest('variation_id does not exist')
    } catch {
      return badRequest('variation_id does not exist')
    }

    const productId = await resolveMerchantProductProductId(payload, merchantProductIdNum)
    if (productId == null) return badRequest('Unable to resolve merchant product catalog item')
    const variationProductId = extractId(variationDoc?.product_id)
    if (!variationProductId || variationProductId !== productId) {
      return badRequest('The selected variation does not belong to the selected merchant product catalog item')
    }

    const targetSourceRaw = typeof body.target_option_source === 'string' ? body.target_option_source.trim().toLowerCase() : typeof body.targetOptionSource === 'string' ? body.targetOptionSource.trim().toLowerCase() : 'product_base'
    if (!TARGET_SOURCES.has(targetSourceRaw)) return badRequest(`target_option_source must be one of: ${Array.from(TARGET_SOURCES).join(', ')}`)
    const target_option_source = targetSourceRaw

    let base_modifier_option_id: number | null = null
    let variation_modifier_option_id: number | null = null

    if (target_option_source === 'product_base') {
      const rawBase = body.base_modifier_option_id ?? body.baseModifierOptionId ?? body.baseOptionId
      if (rawBase == null || rawBase === '') return badRequest('A base product modifier option is required when the target source is Product Base')
      const oid = Number(rawBase)
      if (Number.isNaN(oid)) return badRequest('base_modifier_option_id must be numeric')
      let baseOption: any = null
      try {
        baseOption = await payload.findByID({ collection: 'modifier-options', id: oid, depth: 0, overrideAccess: true }) as any
        if (!baseOption) return badRequest('base_modifier_option_id does not exist')
      } catch {
        return badRequest('base_modifier_option_id does not exist')
      }
      const baseGroupId = extractId(baseOption?.modifier_group_id)
      if (!baseGroupId) return badRequest('The selected base modifier option is missing its parent modifier group')
      let baseGroup: any = null
      try { baseGroup = await payload.findByID({ collection: 'modifier-groups', id: baseGroupId, depth: 0, overrideAccess: true }) as any } catch {}
      const groupProductId = extractId(baseGroup?.product_id)
      if (!groupProductId || groupProductId !== productId) {
        return badRequest('The selected base modifier option does not belong to the selected merchant product catalog item')
      }
      base_modifier_option_id = oid
      variation_modifier_option_id = null
    } else {
      const rawVar = body.variation_modifier_option_id ?? body.variationModifierOptionId ?? body.variationOptionId
      if (rawVar == null || rawVar === '') return badRequest('A variation modifier option is required when the target source is Variation Added')
      const oid = Number(rawVar)
      if (Number.isNaN(oid)) return badRequest('variation_modifier_option_id must be numeric')
      let varOption: any = null
      try {
        varOption = await payload.findByID({ collection: 'variation-modifier-options', id: oid, depth: 0, overrideAccess: true }) as any
        if (!varOption) return badRequest('variation_modifier_option_id does not exist')
      } catch {
        return badRequest('variation_modifier_option_id does not exist')
      }
      const groupId = extractId(varOption?.variation_modifier_group_id)
      if (!groupId) return badRequest('The selected variation modifier option is missing its parent variation modifier group')
      let varGroup: any = null
      try { varGroup = await payload.findByID({ collection: 'variation-modifier-groups', id: groupId, depth: 0, overrideAccess: true }) as any } catch {}
      const gidVariationId = extractId(varGroup?.variation_id)
      if (!gidVariationId || gidVariationId !== variationIdNum) {
        return badRequest('The selected variation modifier option does not belong to the selected variation')
      }
      variation_modifier_option_id = oid
      base_modifier_option_id = null
    }

    const modeRaw = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : 'inherit'
    if (!MODES.has(modeRaw)) return badRequest(`mode must be one of: ${Array.from(MODES).join(', ')}`)

    let name_override: string | null = null
    if (body.name_override !== undefined && body.name_override !== null && body.name_override !== '') {
      if (typeof body.name_override !== 'string') return badRequest('name_override must be a string')
      name_override = body.name_override.trim() || null
    } else if (body.nameOverride !== undefined && typeof body.nameOverride === 'string' && body.nameOverride.trim()) {
      name_override = body.nameOverride.trim()
    }

    let price_adjustment_override: number | null = null
    if (body.price_adjustment_override !== undefined && body.price_adjustment_override !== null && body.price_adjustment_override !== '') {
      const n = Number(body.price_adjustment_override)
      if (!Number.isFinite(n)) return badRequest('price_adjustment_override must be numeric')
      price_adjustment_override = n
    }

    let default_behavior = 'inherit'
    if (body.default_behavior !== undefined && body.default_behavior !== null && body.default_behavior !== '') {
      if (typeof body.default_behavior !== 'string') return badRequest('default_behavior must be a string')
      const v = body.default_behavior.trim().toLowerCase()
      if (!DEFAULT_BEHAVIORS.has(v)) return badRequest(`default_behavior must be one of: ${Array.from(DEFAULT_BEHAVIORS).join(', ')}`)
      default_behavior = v
    }

    let availability_behavior = 'inherit'
    if (body.availability_behavior !== undefined && body.availability_behavior !== null && body.availability_behavior !== '') {
      if (typeof body.availability_behavior !== 'string') return badRequest('availability_behavior must be a string')
      const v = body.availability_behavior.trim().toLowerCase()
      if (!AVAILABILITY_BEHAVIORS.has(v)) return badRequest(`availability_behavior must be one of: ${Array.from(AVAILABILITY_BEHAVIORS).join(', ')}`)
      availability_behavior = v
    }

    let sort_order_override: number | null = null
    if (body.sort_order_override !== undefined && body.sort_order_override !== null && body.sort_order_override !== '') {
      const n = Number(body.sort_order_override)
      if (!Number.isFinite(n)) return badRequest('sort_order_override must be numeric')
      sort_order_override = Math.trunc(n)
    }

    let is_active = true
    if (body.is_active !== undefined) {
      if (typeof body.is_active === 'boolean') is_active = body.is_active
      else if (typeof body.is_active === 'string') {
        const v = body.is_active.trim().toLowerCase()
        if (v === 'true') is_active = true
        else if (v === 'false') is_active = false
        else return badRequest('is_active must be boolean')
      } else return badRequest('is_active must be boolean')
    }

    const data: Record<string, any> = {
      merchant_product_id: merchantProductIdNum,
      variation_id: variationIdNum,
      target_option_source,
      base_modifier_option_id,
      variation_modifier_option_id,
      mode: modeRaw,
      name_override,
      price_adjustment_override,
      default_behavior,
      availability_behavior,
      sort_order_override,
      is_active,
    }

    let created: Record<string, any>
    try {
      created = (await payload.create({ collection: 'merchant-variation-modifier-option-overrides', data: data as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create merchant-variation-modifier-option-override'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        const isBase = target_option_source === 'product_base'
        const field = isBase ? 'merchant_product_id + variation_id + base_modifier_option_id' : 'merchant_product_id + variation_id + variation_modifier_option_id'
        return NextResponse.json({ error: `Duplicate ${field} combination`, details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new override shows immediately
    await deleteCachedByPrefix('admin:catalog-merchant-variation-modifier-option-overrides:')
    return NextResponse.json({ success: true, message: 'Merchant variation modifier option override created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/catalog/merchant-variation-modifier-option-overrides] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
