/**
 * @file apps/cms/src/app/api/admin/catalog/tag-groups/route.ts
 * @description BFF aggregation for web-admin /catalog/tag-groups — enterprise tag-group management.
 * GET /api/admin/catalog/tag-groups?page=1&limit=10&search=&sort=&is_active=&is_filterable=&is_searchable=
 * POST /api/admin/catalog/tag-groups — create (admin-only, overrideAccess)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

const HEX_REGEX = /^#([0-9a-fA-F]{6})$/
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function sanitizeDoc(raw: Record<string, any>, tagCount: number): Record<string, any> {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    color: raw.color ? String(raw.color) : null,
    icon: raw.icon ? String(raw.icon) : null,
    is_filterable: typeof raw.is_filterable === 'boolean' ? raw.is_filterable : true,
    is_searchable: typeof raw.is_searchable === 'boolean' ? raw.is_searchable : true,
    display_order: typeof raw.display_order === 'number' ? raw.display_order : 0,
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    tagCount,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}

function badRequest(m: string, d?: unknown) {
  return NextResponse.json({ error: m, details: d }, { status: 400 })
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
    const cacheKey = `admin:catalog-tag-groups:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-TagGroups-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const isActiveParam = searchParams.get('is_active')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null
    const isFilterableParam = searchParams.get('is_filterable')
    const isFilterableFilter = isFilterableParam === 'true' ? true : isFilterableParam === 'false' ? false : null
    const isSearchableParam = searchParams.get('is_searchable')
    const isSearchableFilter = isSearchableParam === 'true' ? true : isSearchableParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }, { description: { contains: search } }] })
    }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }
    if (isFilterableFilter !== null) where.is_filterable = { equals: isFilterableFilter }
    if (isSearchableFilter !== null) where.is_searchable = { equals: isSearchableFilter }
    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allForStats, allMemberships] = await Promise.all([
      payload.find({
        collection: 'tag-groups',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({ collection: 'tag-groups', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'tag-group-memberships', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const tagCountByGroup = new Map<string, number>()
    for (const m of ((allMemberships as any).docs as any[]) || []) {
      const gid = m.tag_group_id
      const cid = typeof gid === 'object' ? String((gid as any).id ?? gid) : String(gid)
      if (!cid || cid === 'undefined') continue
      tagCountByGroup.set(cid, (tagCountByGroup.get(cid) || 0) + 1)
    }

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) =>
      sanitizeDoc(d, tagCountByGroup.get(String(d.id)) || 0),
    )

    const allDocs = ((allForStats as any).docs as any[]) || []
    const total = allDocs.length
    const activeCount = allDocs.filter((d: any) => d.is_active).length
    const inactiveCount = total - activeCount
    const filterableCount = allDocs.filter((d: any) => d.is_filterable).length
    const searchableCount = allDocs.filter((d: any) => d.is_searchable).length

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
        inactiveCount,
        filterableCount,
        searchableCount,
        filteredCount: (paginated as any).totalDocs ?? docs.length,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-TagGroups-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/catalog/tag-groups] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load tag groups' }, { status: 500 })
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
    if (!SLUG_REGEX.test(slug)) return badRequest('slug must be lowercase alphanumeric with hyphens')

    const description = typeof body.description === 'string' ? body.description.trim() || null : body.description === null ? null : null
    if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') return badRequest('description must be string or null')

    let color: string | null = null
    if (body.color !== undefined && body.color !== null && String(body.color).trim() !== '') {
      const c = String(body.color).trim()
      if (c.length > 7) return badRequest('color must be at most 7 chars (#RRGGBB)')
      if (!HEX_REGEX.test(c)) return badRequest('color must be hex #RRGGBB')
      color = c
    }

    let icon: string | null = null
    if (body.icon !== undefined && body.icon !== null && String(body.icon).trim() !== '') {
      const v = String(body.icon).trim()
      if (v.length > 50) return badRequest('icon must be at most 50 chars')
      icon = v
    }

    const parseBool = (v: unknown, def: boolean, field: string): boolean | null => {
      if (v === undefined) return def
      if (typeof v === 'boolean') return v
      const s = String(v).toLowerCase()
      if (s === 'true') return true
      if (s === 'false') return false
      return null
    }

    const is_filterable = parseBool(body.is_filterable, true, 'is_filterable')
    if (is_filterable === null) return badRequest('is_filterable must be boolean')
    const is_searchable = parseBool(body.is_searchable, true, 'is_searchable')
    if (is_searchable === null) return badRequest('is_searchable must be boolean')
    const is_active = parseBool(body.is_active, true, 'is_active')
    if (is_active === null) return badRequest('is_active must be boolean')

    let display_order = 0
    if (body.display_order !== undefined && body.display_order !== null && String(body.display_order).trim() !== '') {
      const n = Number(body.display_order)
      if (Number.isNaN(n)) return badRequest('display_order must be numeric')
      display_order = n
    }

    const data: Record<string, any> = { name, slug, description, color, icon, is_filterable, is_searchable, display_order, is_active }

    let created: Record<string, any>
    try {
      created = (await payload.create({ collection: 'tag-groups', data: data as any, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create tag group'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(created, 0)
    // Bust list cache (all admins / query variants) so the new group shows immediately
    await deleteCachedByPrefix('admin:catalog-tag-groups:')
    return NextResponse.json({ success: true, message: 'Tag group created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/catalog/tag-groups] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
