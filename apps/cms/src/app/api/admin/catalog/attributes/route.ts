/**
 * @file apps/cms/src/app/api/admin/catalog/attributes/route.ts
 * @description BFF aggregation endpoint for attributes (admin) — mirrors vendors BFF.
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
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    name: str(raw.name, ''),
    slug: str(raw.slug, ''),
    type: str(raw.type, 'select'),
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
function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
}

const ATTRIBUTE_TYPES = new Set(['select', 'color', 'button', 'radio'])
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
    const cacheKey = `admin:catalog-attributes:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Attributes-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const typeCsv = parseCsv(searchParams.get('type'))
    const isActiveParam = searchParams.get('is_active')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({
        or: [
          { name: { contains: search } },
          { slug: { contains: search } },
        ],
      })
    }
    if (typeCsv.length) {
      const filtered = typeCsv.filter((v) => ATTRIBUTE_TYPES.has(v))
      if (filtered.length) where.type = { in: filtered }
    }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'prod-attributes',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'prod-attributes', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const statsDocs = (statsAll as any).docs as Record<string, any>[] ?? []

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const totalAll = statsDocs.length

    const typeBreakdown: Record<string, number> = { select: 0, color: 0, button: 0, radio: 0 }
    let activeCount = 0
    let inactiveCount = 0
    for (const doc of statsDocs) {
      const t = String(doc.type || 'select').toLowerCase()
      if (typeBreakdown[t] !== undefined) typeBreakdown[t]++
      else typeBreakdown[t] = 1
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
        typeBreakdown,
        activeCount,
        inactiveCount,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Attributes-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/catalog/attributes] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load attributes' }, { status: 500 })
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

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length < 2) return badRequest('name is required (min 2 chars)')
    if (name.length > 100) return badRequest('name must be at most 100 characters')

    const typeRaw = typeof body.type === 'string' ? body.type.trim().toLowerCase() : ''
    if (!typeRaw || !ATTRIBUTE_TYPES.has(typeRaw)) return badRequest(`type must be one of: ${Array.from(ATTRIBUTE_TYPES).join(', ')}`)

    let slug: string | undefined
    if (typeof body.slug === 'string' && body.slug.trim().length > 0) {
      slug = body.slug.trim().toLowerCase()
      if (slug.length > 100) return badRequest('slug must be at most 100 characters')
      if (!SLUG_RE.test(slug)) return badRequest('slug must be lowercase alphanumeric with hyphens (e.g. my-attribute)')
      // uniqueness check
      const existing = await payload.find({
        collection: 'prod-attributes',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) {
        return NextResponse.json({ error: `Duplicate slug: ${slug} already exists`, details: `slug ${slug} already exists` }, { status: 409 })
      }
    } else {
      // auto slug via hook — still validate uniqueness after slugify
      const auto = slugify(name)
      if (!auto) return badRequest('name must contain alphanumeric characters to generate slug')
      const existing = await payload.find({
        collection: 'prod-attributes',
        where: { slug: { equals: auto } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) {
        return NextResponse.json({ error: `Duplicate slug: ${auto} already exists`, details: `slug ${auto} already exists` }, { status: 409 })
      }
      slug = auto
    }

    let is_active: boolean = true
    if (typeof body.is_active === 'boolean') is_active = body.is_active
    else if (typeof body.is_active === 'string') {
      const v = body.is_active.trim().toLowerCase()
      if (v === 'true') is_active = true
      else if (v === 'false') is_active = false
      else return badRequest('is_active must be boolean')
    } else if (body.is_active !== undefined && body.is_active !== null) {
      return badRequest('is_active must be boolean')
    }

    const data: Record<string, any> = {
      name,
      slug,
      type: typeRaw,
      is_active,
    }

    let created: Record<string, any>
    try {
      created = (await payload.create({ collection: 'prod-attributes', data: data as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create attribute'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        return NextResponse.json({ error: `Duplicate slug: already exists`, details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new attribute shows immediately
    await deleteCachedByPrefix('admin:catalog-attributes:')
    return NextResponse.json({ success: true, message: 'Attribute created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/catalog/attributes] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
