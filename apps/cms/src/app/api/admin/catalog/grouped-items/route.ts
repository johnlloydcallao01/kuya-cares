/**
 * @file apps/cms/src/app/api/admin/catalog/grouped-items/route.ts
 * @description BFF aggregation endpoint for grouped-items (admin) — mirrors vendors/attributes BFF.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}
function num(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fb
  }
  return fb
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
    return { id, name: str(src.name, ''), slug: str(src.slug, ''), productType: str((src as any).productType, '') }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    parent_product_id: sanitizeProductBrief(raw.parent_product_id),
    parent_product: sanitizeProductBrief(raw.parent_product_id),
    child_product_id: sanitizeProductBrief(raw.child_product_id),
    child_product: sanitizeProductBrief(raw.child_product_id),
    default_quantity: raw.default_quantity != null ? num(raw.default_quantity, 1) : 1,
    sort_order: raw.sort_order != null ? Math.trunc(num(raw.sort_order, 0)) : 0,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
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
    const cacheKey = `admin:catalog-grouped-items:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-GroupedItems-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const parentFilter = searchParams.get('parent_product_id')?.trim() || searchParams.get('parent')?.trim() || ''
    const childFilter = searchParams.get('child_product_id')?.trim() || searchParams.get('child')?.trim() || ''

    const where: Record<string, any> = {}
    const and: any[] = []

    // direct parent/child filters (exact ID)
    if (parentFilter) {
      const pid = Number(parentFilter)
      if (!Number.isNaN(pid)) where.parent_product_id = { equals: pid }
      else where.parent_product_id = { equals: parentFilter }
    }
    if (childFilter) {
      const cid = Number(childFilter)
      if (!Number.isNaN(cid)) where.child_product_id = { equals: cid }
      else where.child_product_id = { equals: childFilter }
    }

    // search across parent/child product names via additional lookup
    if (search) {
      try {
        const prodRes = await payload.find({
          collection: 'products',
          where: { name: { contains: search } },
          limit: 100,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        const ids = (prodRes.docs as any[]).map((d) => d.id)
        if (ids.length > 0) {
          and.push({ or: [{ parent_product_id: { in: ids } }, { child_product_id: { in: ids } }] })
        } else {
          // also allow searching by sort_order/default_quantity if numeric? fallback to no results
          and.push({ or: [{ parent_product_id: { equals: -1 } }, { child_product_id: { equals: -1 } }] })
        }
      } catch {
        // fallback: no search expansion
      }
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const allowedSorts = new Set(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt', 'sort_order', '-sort_order', 'default_quantity', '-default_quantity'])
    const safeSort = allowedSorts.has(sort) ? sort : '-createdAt'

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'prod-grouped-items',
        where: Object.keys(finalWhere).length ? (finalWhere as any) : undefined,
        page,
        limit,
        sort: safeSort as any,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({ collection: 'prod-grouped-items', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))
    const statsDocs = ((statsAll as any).docs as Record<string, any>[]) ?? []
    const total = typeof (paginated as any).totalDocs === 'number' ? (paginated as any).totalDocs : docs.length
    const totalAll = statsDocs.length

    // per-parent breakdown (top 5 parents)
    const perParent: Record<string, number> = {}
    for (const d of statsDocs) {
      const pid = (d as any).parent_product_id
      const key = pid && typeof pid === 'object' ? String((pid as any).id) : String(pid ?? 'unknown')
      perParent[key] = (perParent[key] || 0) + 1
    }

    const responseBody = {
      docs,
      pagination: {
        page: (paginated as any).page,
        limit: (paginated as any).limit,
        totalDocs: (paginated as any).totalDocs,
        totalPages: (paginated as any).totalPages,
        hasNextPage: (paginated as any).hasNextPage,
        hasPrevPage: (paginated as any).hasPrevPage,
      },
      stats: {
        total,
        totalAll,
        filteredTotal: total,
        perParent,
        totalGrouped: total,
      },
      meta: { generatedAt: new Date().toISOString(), sort: safeSort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-GroupedItems-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/catalog/grouped-items] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load grouped items' }, { status: 500 })
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

    const parentRaw = body.parent_product_id ?? body.parentProductId ?? body.parent
    const childRaw = body.child_product_id ?? body.childProductId ?? body.child
    if (parentRaw == null || parentRaw === '') return badRequest('parent_product_id is required')
    if (childRaw == null || childRaw === '') return badRequest('child_product_id is required')

    const parentId = Number(parentRaw)
    const childId = Number(childRaw)
    if (Number.isNaN(parentId)) return badRequest('parent_product_id must be numeric')
    if (Number.isNaN(childId)) return badRequest('child_product_id must be numeric')
    if (parentId === childId) return badRequest('parent_product_id and child_product_id cannot be the same product')

    // validate parent exists and is grouped
    let parentProd: any
    try {
      parentProd = await payload.findByID({ collection: 'products', id: parentId, depth: 0, overrideAccess: true })
    } catch {
      return badRequest('parent_product_id does not exist')
    }
    if (!parentProd) return badRequest('parent_product_id does not exist')
    const parentType = String((parentProd as any).productType || '').toLowerCase()
    if (parentType !== 'grouped') return badRequest('parent_product_id must reference a product with productType=grouped')

    // validate child exists
    let childProd: any
    try {
      childProd = await payload.findByID({ collection: 'products', id: childId, depth: 0, overrideAccess: true })
    } catch {
      return badRequest('child_product_id does not exist')
    }
    if (!childProd) return badRequest('child_product_id does not exist')
    const childType = String((childProd as any).productType || '').toLowerCase()
    if (childType === 'grouped') return badRequest('child_product_id cannot be a grouped product (no nested grouping)')

    // duplicate check (parent, child) unique
    const dup = await payload.find({
      collection: 'prod-grouped-items',
      where: { and: [{ parent_product_id: { equals: parentId } }, { child_product_id: { equals: childId } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if ((dup as any).docs.length > 0) {
      return NextResponse.json({ error: 'Duplicate grouped item: this child is already in this parent group', code: 'HAS_DUPLICATE' }, { status: 409 })
    }

    let default_quantity: number | null = 1
    if (body.default_quantity !== undefined || body.defaultQuantity !== undefined) {
      const raw = body.default_quantity ?? body.defaultQuantity
      if (raw === null || raw === '') default_quantity = 1
      else {
        const n = Number(raw)
        if (!Number.isFinite(n)) return badRequest('default_quantity must be numeric')
        if (n < 0) return badRequest('default_quantity cannot be negative')
        default_quantity = Math.trunc(n)
      }
    }
    let sort_order: number = 0
    if (body.sort_order !== undefined || body.sortOrder !== undefined) {
      const raw = body.sort_order ?? body.sortOrder
      if (raw === null || raw === '') sort_order = 0
      else {
        const n = Number(raw)
        if (!Number.isFinite(n)) return badRequest('sort_order must be numeric')
        sort_order = Math.trunc(n)
      }
    }

    const data: Record<string, any> = {
      parent_product_id: parentId,
      child_product_id: childId,
      default_quantity,
      sort_order,
    }

    let created: Record<string, any>
    try {
      created = (await payload.create({ collection: 'prod-grouped-items', data: data as any, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create grouped item'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        return NextResponse.json({ error: 'Duplicate grouped item: already exists', details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new item shows immediately
    await deleteCachedByPrefix('admin:catalog-grouped-items:')
    return NextResponse.json({ success: true, message: 'Grouped item created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/catalog/grouped-items] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
