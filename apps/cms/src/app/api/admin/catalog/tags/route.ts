/**
 * @file apps/cms/src/app/api/admin/catalog/tags/route.ts
 * @description BFF aggregation for web-admin /catalog/tags — enterprise tag management.
 * GET /api/admin/catalog/tags?page=1&limit=10&search=&sort=&is_active=&is_featured=&tag_type=&parent_tag_id=
 * POST /api/admin/catalog/tags — create (admin-only, overrideAccess)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

const TAG_TYPES = new Set(['general', 'dietary', 'cuisine', 'promotion', 'feature', 'allergen', 'spice_level', 'temperature', 'size_category'])

function sanitizeParent(v: unknown): { id: number; name: string; slug: string } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id)
  if (Number.isNaN(id)) return null
  return { id, name: String(s.name || ''), slug: String(s.slug || '') }
}

function sanitizeDoc(
  raw: Record<string, any>,
  productCount: number,
  groupCount: number,
): Record<string, any> {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    color: raw.color ? String(raw.color) : null,
    tag_type: raw.tag_type ? String(raw.tag_type) : 'general',
    parent_tag_id: sanitizeParent(raw.parent_tag_id),
    usage_count: typeof raw.usage_count === 'number' ? raw.usage_count : 0,
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    is_featured: typeof raw.is_featured === 'boolean' ? raw.is_featured : false,
    productCount,
    groupCount,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}

function badRequest(m: string, d?: unknown) {
  return NextResponse.json({ error: m, details: d }, { status: 400 })
}

const HEX_REGEX = /^#([0-9a-fA-F]{6})$/

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
    const cacheKey = `admin:catalog-tags:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Tags-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const isActiveParam = searchParams.get('is_active')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null
    const isFeaturedParam = searchParams.get('is_featured')
    const isFeaturedFilter = isFeaturedParam === 'true' ? true : isFeaturedParam === 'false' ? false : null
    const tagTypeCsv = searchParams.get('tag_type')?.trim() || ''
    const parentParam = searchParams.get('parent_tag_id')?.trim() || ''

    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }, { description: { contains: search } }] })
    }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }
    if (isFeaturedFilter !== null) where.is_featured = { equals: isFeaturedFilter }
    if (tagTypeCsv) {
      const vals = tagTypeCsv
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((v) => TAG_TYPES.has(v))
      if (vals.length === 1) where.tag_type = { equals: vals[0] }
      else if (vals.length > 1) where.tag_type = { in: vals }
    }
    if (parentParam) {
      if (parentParam === 'null' || parentParam === 'top') where.parent_tag_id = { exists: false }
      else {
        const pid = Number(parentParam)
        if (!Number.isNaN(pid)) where.parent_tag_id = { equals: pid }
      }
    }
    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allForStats, allJunctions, allMemberships] = await Promise.all([
      payload.find({
        collection: 'prod-tags',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({ collection: 'prod-tags', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'prod-tags-junction', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'tag-group-memberships', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const productCountByTag = new Map<string, number>()
    for (const j of ((allJunctions as any).docs as any[]) || []) {
      const tid = j.tag_id
      const cid = typeof tid === 'object' ? String((tid as any).id ?? tid) : String(tid)
      if (!cid || cid === 'undefined') continue
      productCountByTag.set(cid, (productCountByTag.get(cid) || 0) + 1)
    }
    const groupCountByTag = new Map<string, number>()
    for (const m of ((allMemberships as any).docs as any[]) || []) {
      const tid = m.tag_id
      const cid = typeof tid === 'object' ? String((tid as any).id ?? tid) : String(tid)
      if (!cid || cid === 'undefined') continue
      groupCountByTag.set(cid, (groupCountByTag.get(cid) || 0) + 1)
    }

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) =>
      sanitizeDoc(d, productCountByTag.get(String(d.id)) || 0, groupCountByTag.get(String(d.id)) || 0),
    )

    const allDocs = ((allForStats as any).docs as any[]) || []
    const total = allDocs.length
    const activeCount = allDocs.filter((d: any) => d.is_active).length
    const featuredCount = allDocs.filter((d: any) => d.is_featured).length
    const topLevelCount = allDocs.filter((d: any) => !d.parent_tag_id).length

    const tagTypeBreakdown: Record<string, number> = {}
    for (const d of allDocs) {
      const t = String(d.tag_type || 'general').toLowerCase()
      tagTypeBreakdown[t] = (tagTypeBreakdown[t] || 0) + 1
    }

    const responseBody = {
      docs,
      pagination: {
        page: (paginated as any).page || page,
        limit: (paginated as any).limit || limit,
        totalDocs: (paginated as any).totalDocs ?? docs.length,
        totalPages: (paginated as any).totalPages ?? 1,
        hasNextPage: (paginated as any).hasNextPage ?? false,
        hasPrevPage: (paginated as any).hasPrevPage ?? false,
      },
      stats: {
        total,
        activeCount,
        featuredCount,
        inactiveCount: total - activeCount,
        topLevelCount,
        filteredCount: (paginated as any).totalDocs ?? docs.length,
        tagTypeBreakdown,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Tags-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/catalog/tags] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load tags' }, { status: 500 })
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
    if (name.length > 100) return badRequest('name must be at most 100 chars')

    let slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
    if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!slug) return badRequest('slug is required')
    if (slug.length > 100) return badRequest('slug must be at most 100 chars')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return badRequest('slug must be lowercase alphanumeric with hyphens')

    const description = typeof body.description === 'string' ? body.description.trim() || null : body.description === null ? null : null
    if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') return badRequest('description must be string or null')

    let color: string | null = null
    if (body.color !== undefined && body.color !== null && String(body.color).trim() !== '') {
      const c = String(body.color).trim()
      if (c.length > 7) return badRequest('color must be at most 7 chars (#RRGGBB)')
      if (!HEX_REGEX.test(c)) return badRequest('color must be hex #RRGGBB')
      color = c
    }

    let tag_type = 'general'
    if (body.tag_type !== undefined && body.tag_type !== null && String(body.tag_type).trim() !== '') {
      const v = String(body.tag_type).trim().toLowerCase()
      if (!TAG_TYPES.has(v)) return badRequest(`tag_type must be one of: ${Array.from(TAG_TYPES).join(', ')}`)
      tag_type = v
    }

    let parent_tag_id: number | null = null
    if (body.parent_tag_id !== undefined && body.parent_tag_id !== null && String(body.parent_tag_id).trim() !== '') {
      const pid = Number(body.parent_tag_id)
      if (Number.isNaN(pid)) return badRequest('parent_tag_id must be numeric id or null')
      try {
        const parentDoc = await payload.findByID({ collection: 'prod-tags', id: pid, depth: 0, overrideAccess: true }) as any
        if (!parentDoc) return badRequest('parent_tag_id does not exist')
      } catch {
        return badRequest('parent_tag_id does not exist')
      }
      parent_tag_id = pid
    }

    const is_active = typeof body.is_active === 'boolean' ? body.is_active : body.is_active === undefined ? true : String(body.is_active).toLowerCase() === 'true' ? true : String(body.is_active).toLowerCase() === 'false' ? false : true
    const is_featured = typeof body.is_featured === 'boolean' ? body.is_featured : body.is_featured === undefined ? false : String(body.is_featured).toLowerCase() === 'true' ? true : String(body.is_featured).toLowerCase() === 'false' ? false : false
    if (body.is_active !== undefined && typeof body.is_active !== 'boolean' && !['true', 'false'].includes(String(body.is_active).toLowerCase())) return badRequest('is_active must be boolean')
    if (body.is_featured !== undefined && typeof body.is_featured !== 'boolean' && !['true', 'false'].includes(String(body.is_featured).toLowerCase())) {
      // still allow coerced above but if random string not true/false treat as bad
      const v = String(body.is_featured).toLowerCase()
      if (v !== 'true' && v !== 'false') return badRequest('is_featured must be boolean')
    }

    // usage_count is readOnly — ignore if provided

    const data: Record<string, any> = { name, slug, description, color, tag_type, is_active, is_featured }
    if (parent_tag_id !== null) data.parent_tag_id = parent_tag_id

    let created: Record<string, any>
    try {
      created = (await payload.create({ collection: 'prod-tags', data: data as any, depth: 1, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create tag'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(created, 0, 0)
    // Bust list cache (all admins / query variants) so the new tag shows immediately
    await deleteCachedByPrefix('admin:catalog-tags:')
    return NextResponse.json({ success: true, message: 'Tag created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/catalog/tags] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
