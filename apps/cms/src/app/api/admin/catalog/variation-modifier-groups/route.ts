/**
 * @file apps/cms/src/app/api/admin/catalog/variation-modifier-groups/route.ts
 * @description BFF aggregation endpoint for variation-modifier-groups (admin) — mirrors modifier-groups BFF.
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
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

const SELECTION_TYPES = new Set(['single', 'multiple'])

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
    const cacheKey = `admin:catalog-variation-modifier-groups:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VariationModifierGroups-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const variationIdParam = searchParams.get('variationId')?.trim() || searchParams.get('variation_id')?.trim() || ''
    const selectionCsv = parseCsv(searchParams.get('selection_type'))
    const isRequiredParam = searchParams.get('is_required')
    const isActiveParam = searchParams.get('is_active')

    const isRequiredFilter = isRequiredParam === 'true' ? true : isRequiredParam === 'false' ? false : null
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({ name: { contains: search } })
    }
    if (variationIdParam) {
      const vid = Number(variationIdParam)
      if (!Number.isNaN(vid)) where.variation_id = { equals: vid }
      else where.variation_id = { equals: variationIdParam }
    }
    if (selectionCsv.length) {
      const filtered = selectionCsv.filter((v) => SELECTION_TYPES.has(v))
      if (filtered.length) where.selection_type = { in: filtered }
    }
    if (isRequiredFilter !== null) where.is_required = { equals: isRequiredFilter }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }

    const finalWhere = and.length ? { and: [...and, where] } : where

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
      payload.find({ collection: 'variation-modifier-groups', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const statsDocs = (statsAll as any).docs as Record<string, any>[] ?? []

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const totalAll = statsDocs.length

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
        selectionBreakdown,
        requiredCount,
        optionalCount,
        activeCount,
        inactiveCount,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-VariationModifierGroups-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/catalog/variation-modifier-groups] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load variation-modifier-groups' }, { status: 500 })
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

    // variation_id required numeric exists (prod-variations)
    const rawVariationId = body.variation_id ?? body.variationId
    if (rawVariationId == null || rawVariationId === '') return badRequest('variation_id is required')
    const variationIdNum = Number(rawVariationId)
    if (Number.isNaN(variationIdNum)) return badRequest('variation_id must be numeric')
    try {
      const variation = await payload.findByID({ collection: 'prod-variations', id: variationIdNum, depth: 0, overrideAccess: true }) as any
      if (!variation) return badRequest('variation_id does not exist')
    } catch {
      return badRequest('variation_id does not exist')
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length < 2) return badRequest('name is required (min 2 chars)')
    if (name.length > 255) return badRequest('name must be at most 255 characters')

    const selectionRaw = typeof body.selection_type === 'string' ? body.selection_type.trim().toLowerCase() : ''
    if (!selectionRaw || !SELECTION_TYPES.has(selectionRaw)) return badRequest(`selection_type must be one of: ${Array.from(SELECTION_TYPES).join(', ')}`)

    let is_required = false
    if (body.is_required !== undefined) {
      if (typeof body.is_required === 'boolean') is_required = body.is_required
      else if (typeof body.is_required === 'string') {
        const v = body.is_required.trim().toLowerCase()
        if (v === 'true') is_required = true
        else if (v === 'false') is_required = false
        else return badRequest('is_required must be boolean')
      } else return badRequest('is_required must be boolean')
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

    let min_selections = 0
    if (body.min_selections !== undefined && body.min_selections !== null && body.min_selections !== '') {
      const n = Number(body.min_selections)
      if (!Number.isFinite(n)) return badRequest('min_selections must be numeric')
      min_selections = Math.trunc(n)
    }
    let max_selections: number | null = null
    if (body.max_selections !== undefined && body.max_selections !== null && body.max_selections !== '') {
      const n = Number(body.max_selections)
      if (!Number.isFinite(n)) return badRequest('max_selections must be numeric or null')
      max_selections = Math.trunc(n)
    }

    // hook validations identical
    if (Number.isFinite(min_selections) && min_selections < 0) return badRequest('Minimum selections cannot be negative')
    if (max_selections !== null) {
      if (!Number.isFinite(max_selections) || max_selections < 1) return badRequest('Maximum selections must be at least 1 when provided')
      if (Number.isFinite(min_selections) && max_selections < min_selections) return badRequest('Maximum selections cannot be lower than minimum selections')
    }
    if (selectionRaw === 'single' && max_selections !== null && max_selections > 1) return badRequest('Single-selection groups cannot allow more than 1 selection')

    // normalize min to 0 when !is_required
    if (!is_required) min_selections = 0

    let sort_order = 0
    if (body.sort_order !== undefined && body.sort_order !== null && body.sort_order !== '') {
      const n = Number(body.sort_order)
      if (!Number.isFinite(n)) return badRequest('sort_order must be numeric')
      sort_order = Math.trunc(n)
    }

    const data: Record<string, any> = {
      variation_id: variationIdNum,
      name,
      selection_type: selectionRaw,
      is_required,
      min_selections,
      max_selections,
      sort_order,
      is_active,
    }

    let created: Record<string, any>
    try {
      created = (await payload.create({ collection: 'variation-modifier-groups', data: data as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create variation-modifier-group'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new group shows immediately
    await deleteCachedByPrefix('admin:catalog-variation-modifier-groups:')
    return NextResponse.json({ success: true, message: 'Variation modifier group created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/catalog/variation-modifier-groups] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
