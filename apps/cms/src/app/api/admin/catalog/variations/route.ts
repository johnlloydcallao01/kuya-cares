/**
 * @file apps/cms/src/app/api/admin/catalog/variations/route.ts
 * @description BFF aggregation endpoint for prod-variations (admin) — mirrors vendors/attributes BFF.
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
function sanitizeMediaRef(value: unknown): { id: number; url: string | null; filename: string | null } | null {
  if (!value || typeof value !== 'object') return null
  const src = value as Record<string, unknown>
  const id = Number(src.id)
  if (Number.isNaN(id)) return null
  const url =
    typeof src.cloudinaryURL === 'string' ? src.cloudinaryURL : typeof src.url === 'string' ? src.url : null
  return { id, url, filename: typeof src.filename === 'string' ? src.filename : null }
}
function sanitizeProductBrief(value: unknown): { id: number; name: string; slug: string; productType: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return {
      id,
      name: str(src.name, ''),
      slug: str(src.slug, ''),
      productType: str((src as any).productType, ''),
    }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    product_id: sanitizeProductBrief(raw.product_id),
    product: sanitizeProductBrief(raw.product_id),
    modifier_behavior_mode: str(raw.modifier_behavior_mode, 'inherit_product'),
    name: optionalString(raw.name),
    short_description: optionalString(raw.short_description),
    image: sanitizeMediaRef(raw.image),
    sku: str(raw.sku, ''),
    base_price: raw.base_price != null ? num(raw.base_price, 0) : null,
    compare_at_price: raw.compare_at_price != null ? num(raw.compare_at_price, 0) : null,
    stock_quantity: raw.stock_quantity != null ? Math.trunc(num(raw.stock_quantity, 0)) : 0,
    is_used_for_variations: typeof raw.is_used_for_variations === 'boolean' ? raw.is_used_for_variations : true,
    is_visible: typeof raw.is_visible === 'boolean' ? raw.is_visible : true,
    sort_order: raw.sort_order != null ? Math.trunc(num(raw.sort_order, 0)) : 0,
    modifier_configuration_hint: optionalString(raw.modifier_configuration_hint),
    effective_modifier_preview: raw.effective_modifier_preview ?? null,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}
function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

const MODE_VALUES = new Set(['inherit_product', 'variation_specific', 'hybrid'])

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
    const cacheKey = `admin:catalog-variations:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Variations-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const productIdParam = searchParams.get('productId')?.trim() || searchParams.get('product_id')?.trim() || ''
    const modeCsv = parseCsv(searchParams.get('modifier_behavior_mode') || searchParams.get('mode'))
    const isVisibleParam = searchParams.get('is_visible')
    const isVisibleFilter =
      isVisibleParam === 'true' ? true : isVisibleParam === 'false' ? false : null
    const isUsedParam = searchParams.get('is_used') ?? searchParams.get('is_used_for_variations')
    const isUsedFilter = isUsedParam === 'true' ? true : isUsedParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({
        or: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { short_description: { contains: search } },
        ],
      })
    }
    if (productIdParam) {
      const pid = Number(productIdParam)
      if (!Number.isNaN(pid)) where.product_id = { equals: pid }
      else where.product_id = { equals: productIdParam }
    }
    if (modeCsv.length) {
      const filtered = modeCsv.filter((v) => MODE_VALUES.has(v))
      if (filtered.length) where.modifier_behavior_mode = { in: filtered }
    }
    if (isVisibleFilter !== null) where.is_visible = { equals: isVisibleFilter }
    if (isUsedFilter !== null) where.is_used_for_variations = { equals: isUsedFilter }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'prod-variations',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'prod-variations',
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any),
    ])

    const statsDocs = (statsAll as any).docs as Record<string, any>[] ?? []

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const totalAll = statsDocs.length

    const modeBreakdown: Record<string, number> = {
      inherit_product: 0,
      variation_specific: 0,
      hybrid: 0,
    }
    let inStock = 0
    let outOfStock = 0
    let visibleCount = 0
    let hiddenCount = 0
    for (const doc of statsDocs) {
      const m = String(doc.modifier_behavior_mode || 'inherit_product').toLowerCase()
      if (modeBreakdown[m] !== undefined) modeBreakdown[m]++
      else modeBreakdown[m] = 1
      const sq = num(doc.stock_quantity, 0)
      if (sq > 0) inStock++
      else outOfStock++
      if (doc.is_visible) visibleCount++
      else hiddenCount++
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
        inStock,
        outOfStock,
        visibleCount,
        hiddenCount,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Variations-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/catalog/variations] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load variations' }, { status: 500 })
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

    // product_id required Number (validate product exists and type variable)
    const rawProductId = body.product_id ?? body.productId
    if (rawProductId == null || rawProductId === '') return badRequest('product_id is required')
    const productIdNum = Number(rawProductId)
    if (Number.isNaN(productIdNum)) return badRequest('product_id must be numeric')

    // validate product exists and type variable
    let productDoc: any = null
    try {
      productDoc = await payload.findByID({ collection: 'products', id: productIdNum, depth: 0, overrideAccess: true })
    } catch {
      return badRequest('product_id does not exist')
    }
    if (!productDoc) return badRequest('product_id does not exist')
    const pType = String(productDoc.productType || '').toLowerCase()
    if (pType !== 'variable') return badRequest('product_id must reference a variable product (productType=variable)')

    const modeRaw = typeof body.modifier_behavior_mode === 'string' ? body.modifier_behavior_mode.trim().toLowerCase() : ''
    if (!modeRaw || !MODE_VALUES.has(modeRaw))
      return badRequest(`modifier_behavior_mode is required and must be one of: ${Array.from(MODE_VALUES).join(', ')}`)

    const name = typeof body.name === 'string' ? body.name.trim() || null : null
    const short_description =
      body.short_description !== undefined
        ? typeof body.short_description === 'string'
          ? body.short_description.trim().slice(0, 500) || null
          : null
        : null
    if (typeof body.short_description === 'string' && body.short_description.length > 500)
      return badRequest('short_description must be at most 500 characters')

    // image Number|null
    let image: number | null = null
    if (body.image !== undefined && body.image !== null && body.image !== '') {
      const n = Number(body.image)
      if (Number.isNaN(n)) return badRequest('image must be numeric media id or null')
      image = n
    }

    // base_price / compare_at_price
    let base_price: number | null = null
    if (body.base_price !== undefined && body.base_price !== null && body.base_price !== '') {
      const n = Number(body.base_price)
      if (Number.isNaN(n) || n < 0) return badRequest('base_price must be a number >= 0')
      base_price = n
    }
    let compare_at_price: number | null = null
    if (body.compare_at_price !== undefined && body.compare_at_price !== null && body.compare_at_price !== '') {
      const n = Number(body.compare_at_price)
      if (Number.isNaN(n) || n < 0) return badRequest('compare_at_price must be a number >= 0')
      compare_at_price = n
    }

    let stock_quantity = 0
    if (body.stock_quantity !== undefined && body.stock_quantity !== null && body.stock_quantity !== '') {
      const n = Number(body.stock_quantity)
      if (!Number.isFinite(n) || !Number.isInteger(Math.trunc(n)) || n < 0)
        return badRequest('stock_quantity must be an integer >= 0')
      stock_quantity = Math.trunc(n)
    }

    let is_used_for_variations = true
    if (body.is_used_for_variations !== undefined) {
      if (typeof body.is_used_for_variations === 'boolean') is_used_for_variations = body.is_used_for_variations
      else if (typeof body.is_used_for_variations === 'string') {
        const v = body.is_used_for_variations.trim().toLowerCase()
        if (v === 'true') is_used_for_variations = true
        else if (v === 'false') is_used_for_variations = false
        else return badRequest('is_used_for_variations must be boolean')
      } else return badRequest('is_used_for_variations must be boolean')
    }

    let is_visible = true
    if (body.is_visible !== undefined) {
      if (typeof body.is_visible === 'boolean') is_visible = body.is_visible
      else if (typeof body.is_visible === 'string') {
        const v = body.is_visible.trim().toLowerCase()
        if (v === 'true') is_visible = true
        else if (v === 'false') is_visible = false
        else return badRequest('is_visible must be boolean')
      } else return badRequest('is_visible must be boolean')
    }

    let sort_order = 0
    if (body.sort_order !== undefined && body.sort_order !== null && body.sort_order !== '') {
      const n = Number(body.sort_order)
      if (!Number.isFinite(n)) return badRequest('sort_order must be numeric')
      sort_order = Math.trunc(n)
    }

    const data: Record<string, any> = {
      product_id: productIdNum,
      modifier_behavior_mode: modeRaw,
      name,
      short_description,
      image,
      base_price,
      compare_at_price,
      stock_quantity,
      is_used_for_variations,
      is_visible,
      sort_order,
    }

    let created: Record<string, any>
    try {
      created = (await payload.create({
        collection: 'prod-variations',
        data: data as any,
        depth: 2,
        overrideAccess: true,
      })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create variation'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        return NextResponse.json({ error: 'Duplicate value violates unique constraint', details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new variation shows immediately
    await deleteCachedByPrefix('admin:catalog-variations:')
    return NextResponse.json({ success: true, message: 'Variation created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/catalog/variations] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
