/**
 * @file apps/cms/src/app/api/admin/catalog/merchant-product-modifier-option-overrides/route.ts
 * @description BFF aggregation endpoint for merchant-product-modifier-option-overrides (admin) — mirrors vendors BFF.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fallback = ''): string { return typeof v === 'string' ? v : fallback }
function optionalString(v: unknown): string | null { return typeof v === 'string' ? v.trim() || null : null }
function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? n : fallback }
  return fallback
}
function extractId(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const o = value as any; if ('id' in o) return extractId(o.id); if ('value' in o) return extractId(o.value) }
  return null
}
function sanitizeMerchantProductBrief(value: unknown): { id: number; display_title: string | null } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return { id, display_title: optionalString(src.display_title) || optionalString((src as any).displayTitle) || null } }
  return null
}
function sanitizeOptionBrief(value: unknown): { id: number; name: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return { id, name: str(src.name,'') } }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    merchant_product_id: sanitizeMerchantProductBrief(raw.merchant_product_id),
    merchant_product: sanitizeMerchantProductBrief(raw.merchant_product_id),
    base_modifier_option_id: sanitizeOptionBrief(raw.base_modifier_option_id),
    base_modifier_option: sanitizeOptionBrief(raw.base_modifier_option_id),
    mode: str(raw.mode,'inherit'),
    name_override: optionalString(raw.name_override),
    price_adjustment_override: raw.price_adjustment_override != null && raw.price_adjustment_override !== '' ? num(raw.price_adjustment_override,0) : null,
    default_behavior: str(raw.default_behavior,'inherit'),
    availability_behavior: str(raw.availability_behavior,'inherit'),
    sort_order_override: raw.sort_order_override != null && raw.sort_order_override !== '' ? Math.trunc(num(raw.sort_order_override,0)) : null,
    is_active: typeof raw.is_active==='boolean'?raw.is_active:true,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}
function parseCsv(v: string | null): string[] { if(!v) return []; return v.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) }
function badRequest(message: string, details?: unknown) { return NextResponse.json({ error: message, details }, { status: 400 }) }

const MODES = new Set(['inherit','hide','override'])
const DEFAULT_BEHAVIORS = new Set(['inherit','default','not_default'])
const AVAILABILITY_BEHAVIORS = new Set(['inherit','available','unavailable'])

async function resolveMerchantProductProductId(payload: any, merchantProductId: number): Promise<number | null> {
  try {
    const mp = await payload.findByID({ collection: 'merchant-products', id: merchantProductId, depth: 0, overrideAccess: true })
    return extractId((mp as any)?.product_id)
  } catch { return null }
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
    const cacheKey = `admin:catalog-merchant-product-modifier-option-overrides:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-MerchantProductModifierOptionOverrides-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const merchantProductParam = searchParams.get('merchant_product_id')?.trim() || searchParams.get('merchantProductId')?.trim() || searchParams.get('merchant_product')?.trim() || ''
    const baseOptionParam = searchParams.get('base_modifier_option_id')?.trim() || searchParams.get('baseModifierOptionId')?.trim() || searchParams.get('base_option_id')?.trim() || ''
    const modeCsv = parseCsv(searchParams.get('mode'))
    const defaultBehaviorCsv = parseCsv(searchParams.get('default_behavior') || searchParams.get('defaultBehavior'))
    const availabilityCsv = parseCsv(searchParams.get('availability_behavior') || searchParams.get('availabilityBehavior'))
    const isActiveParam = searchParams.get('is_active') || searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) and.push({ name_override: { contains: search } })
    if (merchantProductParam) {
      const mpId = Number(merchantProductParam)
      if (!Number.isNaN(mpId)) where.merchant_product_id = { equals: mpId }
      else where.merchant_product_id = { equals: merchantProductParam }
    }
    if (baseOptionParam) {
      const oid = Number(baseOptionParam)
      if (!Number.isNaN(oid)) where.base_modifier_option_id = { equals: oid }
      else where.base_modifier_option_id = { equals: baseOptionParam }
    }
    if (modeCsv.length) {
      const filtered = modeCsv.filter((v) => MODES.has(v))
      if (filtered.length) where.mode = { in: filtered }
    }
    if (defaultBehaviorCsv.length) {
      const filtered = defaultBehaviorCsv.filter((v) => DEFAULT_BEHAVIORS.has(v))
      if (filtered.length) where.default_behavior = { in: filtered }
    }
    if (availabilityCsv.length) {
      const filtered = availabilityCsv.filter((v) => AVAILABILITY_BEHAVIORS.has(v))
      if (filtered.length) where.availability_behavior = { in: filtered }
    }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({ collection: 'merchant-product-modifier-option-overrides', where: Object.keys(finalWhere).length ? finalWhere : undefined, page, limit, sort, depth: 2, overrideAccess: true }),
      payload.find({ collection: 'merchant-product-modifier-option-overrides', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const statsDocs = (statsAll as any).docs as Record<string, any>[] ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))
    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const totalAll = statsDocs.length
    const modeBreakdown: Record<string, number> = { inherit: 0, hide: 0, override: 0 }
    const defaultBehaviorBreakdown: Record<string, number> = { inherit: 0, default: 0, not_default: 0 }
    const availabilityBreakdown: Record<string, number> = { inherit: 0, available: 0, unavailable: 0 }
    let activeCount=0, inactiveCount=0
    for (const doc of statsDocs) {
      const m=String(doc.mode||'inherit').toLowerCase()
      if(modeBreakdown[m]!==undefined) modeBreakdown[m]++
      else modeBreakdown[m]=1
      const db=String(doc.default_behavior||'inherit').toLowerCase()
      if(defaultBehaviorBreakdown[db]!==undefined) defaultBehaviorBreakdown[db]++
      const ab=String(doc.availability_behavior||'inherit').toLowerCase()
      if(availabilityBreakdown[ab]!==undefined) availabilityBreakdown[ab]++
      if(doc.is_active) activeCount++; else inactiveCount++
    }

    const responseBody = {
      docs,
      pagination: { page: paginated.page, limit: paginated.limit, totalDocs: paginated.totalDocs, totalPages: paginated.totalPages, hasNextPage: paginated.hasNextPage, hasPrevPage: paginated.hasPrevPage },
      stats: { total, totalAll, filteredTotal: total, modeBreakdown, defaultBehaviorBreakdown, availabilityBreakdown, activeCount, inactiveCount },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-MerchantProductModifierOptionOverrides-Cache': 'MISS' } })
  } catch (err:any) { console.error('[admin/catalog/merchant-product-modifier-option-overrides] GET error:', err); return NextResponse.json({ error: err?.message||'Failed to load merchant-product-modifier-option-overrides' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    let body: Record<string, any>
    try { body = await request.json() } catch { return badRequest('Invalid JSON body') }

    const rawMerchantProductId = body.merchant_product_id ?? body.merchantProductId ?? body.merchant_product
    if (rawMerchantProductId == null || rawMerchantProductId === '') return badRequest('merchant_product_id is required')
    const merchantProductIdNum = Number(rawMerchantProductId)
    if (Number.isNaN(merchantProductIdNum)) return badRequest('merchant_product_id must be numeric')
    try {
      const mp = await payload.findByID({ collection: 'merchant-products', id: merchantProductIdNum, depth: 0, overrideAccess: true }) as any
      if (!mp) return badRequest('merchant_product_id does not exist')
    } catch { return badRequest('merchant_product_id does not exist') }

    const rawOptionId = body.base_modifier_option_id ?? body.baseModifierOptionId ?? body.baseOptionId
    if (rawOptionId == null || rawOptionId === '') return badRequest('base_modifier_option_id is required')
    const optionIdNum = Number(rawOptionId)
    if (Number.isNaN(optionIdNum)) return badRequest('base_modifier_option_id must be numeric')
    let baseOptionDoc: any = null
    try {
      baseOptionDoc = await payload.findByID({ collection: 'modifier-options', id: optionIdNum, depth: 0, overrideAccess: true }) as any
      if (!baseOptionDoc) return badRequest('base_modifier_option_id does not exist')
    } catch { return badRequest('base_modifier_option_id does not exist') }

    const productId = await resolveMerchantProductProductId(payload, merchantProductIdNum)
    if (productId == null) return badRequest('Unable to resolve merchant product catalog item')
    const baseGroupId = extractId(baseOptionDoc?.modifier_group_id)
    if (!baseGroupId) return badRequest('The selected base modifier option is missing its parent modifier group')
    let baseGroup: any = null
    try { baseGroup = await payload.findByID({ collection: 'modifier-groups', id: baseGroupId, depth: 0, overrideAccess: true }) as any } catch {}
    const groupProductId = extractId(baseGroup?.product_id)
    if (!groupProductId || groupProductId !== productId) {
      return badRequest('The selected base modifier option does not belong to the selected merchant product catalog item')
    }

    const modeRaw = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : 'inherit'
    if (!MODES.has(modeRaw)) return badRequest(`mode must be one of: ${Array.from(MODES).join(', ')}`)

    const name_override = typeof body.name_override === 'string' ? body.name_override.trim() || null : body.name_override === null ? null : null
    const nameAlias = typeof body.nameOverride === 'string' ? body.nameOverride.trim() || null : null
    const finalName = name_override ?? nameAlias ?? null

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
        if (v==='true') is_active=true
        else if (v==='false') is_active=false
        else return badRequest('is_active must be boolean')
      } else return badRequest('is_active must be boolean')
    }

    const data: Record<string, any> = {
      merchant_product_id: merchantProductIdNum,
      base_modifier_option_id: optionIdNum,
      mode: modeRaw,
      name_override: finalName,
      price_adjustment_override,
      default_behavior,
      availability_behavior,
      sort_order_override,
      is_active,
    }

    let created: Record<string, any>
    try {
      created = await payload.create({ collection: 'merchant-product-modifier-option-overrides', data: data as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e:any) {
      const msg=e?.message||'Failed to create merchant-product-modifier-option-override'
      const lower=String(msg).toLowerCase()
      if(lower.includes('unique')||lower.includes('duplicate')||lower.includes('already exists')) return NextResponse.json({ error: 'Duplicate merchant_product_id + base_modifier_option_id combination', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data||e?.errors }, { status: 400 })
    }
    const sanitized=sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new override shows immediately
    await deleteCachedByPrefix('admin:catalog-merchant-product-modifier-option-overrides:')
    return NextResponse.json({ success: true, message: 'Merchant product modifier option override created successfully', doc: sanitized }, { status: 201 })
  } catch (err:any) { console.error('[admin/catalog/merchant-product-modifier-option-overrides] POST error:', err); return NextResponse.json({ error: err?.message||'Internal Server Error' }, { status: 500 }) }
}
