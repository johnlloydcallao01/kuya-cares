/**
 * @file apps/cms/src/app/api/admin/catalog/variation-modifier-options/route.ts
 * @description BFF aggregation endpoint for variation-modifier-options (admin) — mirrors modifier-options BFF.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fallback = ''): string { return typeof v === 'string' ? v : fallback }
function num(v: unknown, fallback = 0): number { if (typeof v === 'number' && Number.isFinite(v)) return v; if (typeof v === 'string'){const n=Number(v); return Number.isFinite(n)?n:fallback} return fallback }
function sanitizeGroupBrief(value: unknown): { id: number; name: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') { const n=Number(value); return Number.isNaN(n)?null:n }
  if (typeof value === 'object') { const src=value as Record<string,unknown>; const id=Number(src.id); if(Number.isNaN(id)) return null; return { id, name: str(src.name,'') } }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    variation_modifier_group_id: sanitizeGroupBrief(raw.variation_modifier_group_id),
    variation_modifier_group: sanitizeGroupBrief(raw.variation_modifier_group_id),
    name: str(raw.name,''),
    price_adjustment: raw.price_adjustment!=null?num(raw.price_adjustment,0):0,
    is_default: typeof raw.is_default==='boolean'?raw.is_default:false,
    is_available: typeof raw.is_available==='boolean'?raw.is_available:true,
    sort_order: raw.sort_order!=null?Math.trunc(num(raw.sort_order,0)):0,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}
function parseCsv(value: string | null): string[] { if(!value) return []; return value.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean) }
function badRequest(message: string, details?: unknown) { return NextResponse.json({ error: message, details }, { status: 400 }) }

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
    const cacheKey = `admin:catalog-variation-modifier-options:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VariationModifierOptions-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const groupIdParam = searchParams.get('variation_modifier_group_id')?.trim() || searchParams.get('variationModifierGroupId')?.trim() || searchParams.get('groupId')?.trim() || searchParams.get('modifier_group_id')?.trim() || ''
    const isAvailableParam = searchParams.get('is_available')
    const isDefaultParam = searchParams.get('is_default')
    const isAvailableFilter = isAvailableParam === 'true' ? true : isAvailableParam === 'false' ? false : null
    const isDefaultFilter = isDefaultParam === 'true' ? true : isDefaultParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) and.push({ name: { contains: search } })
    if (groupIdParam) {
      const gid = Number(groupIdParam)
      if (!Number.isNaN(gid)) where.variation_modifier_group_id = { equals: gid }
      else where.variation_modifier_group_id = { equals: groupIdParam }
    }
    if (isAvailableFilter !== null) where.is_available = { equals: isAvailableFilter }
    if (isDefaultFilter !== null) where.is_default = { equals: isDefaultFilter }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({ collection: 'variation-modifier-options', where: Object.keys(finalWhere).length ? finalWhere : undefined, page, limit, sort, depth: 2, overrideAccess: true }),
      payload.find({ collection: 'variation-modifier-options', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const statsDocs = (statsAll as any).docs as Record<string, any>[] ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d)=>sanitizeDoc(d))
    const total = typeof paginated.totalDocs==='number'?paginated.totalDocs:docs.length
    const totalAll = statsDocs.length
    let availableCount=0, unavailableCount=0, defaultCount=0
    for(const d of statsDocs){ if(d.is_available) availableCount++; else unavailableCount++; if(d.is_default) defaultCount++ }

    const responseBody = {
      docs,
      pagination: { page: paginated.page, limit: paginated.limit, totalDocs: paginated.totalDocs, totalPages: paginated.totalPages, hasNextPage: paginated.hasNextPage, hasPrevPage: paginated.hasPrevPage },
      stats: { total, totalAll, filteredTotal: total, availableCount, unavailableCount, defaultCount },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-VariationModifierOptions-Cache': 'MISS' } })
  } catch (err:any) { console.error('[admin/catalog/variation-modifier-options] GET error:', err); return NextResponse.json({ error: err?.message||'Failed to load variation-modifier-options' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try { body = await request.json() } catch { return badRequest('Invalid JSON body') }

    const rawGroupId = body.variation_modifier_group_id ?? body.variationModifierGroupId ?? body.groupId ?? body.modifier_group_id
    if (rawGroupId == null || rawGroupId === '') return badRequest('variation_modifier_group_id is required')
    const groupIdNum = Number(rawGroupId)
    if (Number.isNaN(groupIdNum)) return badRequest('variation_modifier_group_id must be numeric')
    try {
      const grp = await payload.findByID({ collection: 'variation-modifier-groups', id: groupIdNum, depth: 0, overrideAccess: true }) as any
      if (!grp) return badRequest('variation_modifier_group_id does not exist')
    } catch { return badRequest('variation_modifier_group_id does not exist') }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length < 2) return badRequest('name is required (min 2 chars)')
    if (name.length > 255) return badRequest('name must be at most 255 characters')

    let price_adjustment = 0
    if (body.price_adjustment !== undefined && body.price_adjustment !== null && body.price_adjustment !== '') {
      const n = Number(body.price_adjustment)
      if (!Number.isFinite(n)) return badRequest('price_adjustment must be finite numeric')
      price_adjustment = n
    }

    let is_default = false
    if (body.is_default !== undefined) {
      if (typeof body.is_default === 'boolean') is_default = body.is_default
      else if (typeof body.is_default === 'string') {
        const v=body.is_default.trim().toLowerCase()
        if(v==='true') is_default=true
        else if(v==='false') is_default=false
        else return badRequest('is_default must be boolean')
      } else return badRequest('is_default must be boolean')
    }

    let is_available = true
    if (body.is_available !== undefined) {
      if (typeof body.is_available === 'boolean') is_available = body.is_available
      else if (typeof body.is_available === 'string') {
        const v=body.is_available.trim().toLowerCase()
        if(v==='true') is_available=true
        else if(v==='false') is_available=false
        else return badRequest('is_available must be boolean')
      } else return badRequest('is_available must be boolean')
    }

    let sort_order = 0
    if (body.sort_order !== undefined && body.sort_order !== null && body.sort_order !== '') {
      const n = Number(body.sort_order)
      if (!Number.isFinite(n)) return badRequest('sort_order must be numeric')
      sort_order = Math.trunc(n)
    }

    const data: Record<string, any> = { variation_modifier_group_id: groupIdNum, name, price_adjustment, is_default, is_available, sort_order }

    let created: Record<string, any>
    try {
      created = await payload.create({ collection: 'variation-modifier-options', data: data as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e:any) {
      const msg = e?.message || 'Failed to create variation-modifier-option'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique')||lower.includes('duplicate')||lower.includes('already exists')) return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data||e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new option shows immediately
    await deleteCachedByPrefix('admin:catalog-variation-modifier-options:')
    return NextResponse.json({ success: true, message: 'Variation modifier option created successfully', doc: sanitized }, { status: 201 })
  } catch (err:any) { console.error('[admin/catalog/variation-modifier-options] POST error:', err); return NextResponse.json({ error: err?.message||'Internal Server Error' }, { status: 500 }) }
}
