/**
 * @file apps/cms/src/app/api/admin/merchant-categories/route.ts
 * @description BFF aggregation for web-admin /merchant-categories — enterprise category management.
 * GET /api/admin/merchant-categories?page=1&limit=10&search=&isActive=true&isFeatured=&sort=displayOrder
 * POST /api/admin/merchant-categories — create (admin-only, overrideAccess)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

function sanitizeMediaRef(v: unknown): { id: number; url: string | null } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id); if (Number.isNaN(id)) return null
  const url = typeof s.cloudinaryURL === 'string' ? s.cloudinaryURL : typeof s.url === 'string' ? s.url : null
  return { id, url }
}
function sanitizeDoc(raw: Record<string, any>, merchantCount: number): Record<string, any> {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 0,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    isFeatured: typeof raw.isActive === 'boolean' ? !!raw.isFeatured : !!raw.isFeatured,
    icon: sanitizeMediaRef(raw.icon),
    merchantCount,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}
function badRequest(m: string, d?: unknown) { return NextResponse.json({ error: m, details: d }, { status: 400 }) }

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const cacheQuery = Array.from(searchParams.entries())
      .filter(([key]) => key !== '_t')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'page=1&limit=10&sort=displayOrder'
    const cacheKey = `admin:merchant-categories:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Categories-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || 'displayOrder'
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null
    const isFeaturedParam = searchParams.get('isFeatured')
    const isFeaturedFilter = isFeaturedParam === 'true' ? true : isFeaturedParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }, { description: { contains: search } }] })
    }
    if (isActiveFilter !== null) where.isActive = { equals: isActiveFilter }
    if (isFeaturedFilter !== null) where.isFeatured = { equals: isFeaturedFilter }
    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allForStats, allMerchants] = await Promise.all([
      payload.find({ collection: 'merchant-categories', where: Object.keys(finalWhere).length ? finalWhere : undefined, page, limit, sort, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'merchant-categories', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'merchants', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const merchantCountByCategory = new Map<string, number>()
    for (const m of (allMerchants.docs as any[]) || []) {
      const cats: any[] = Array.isArray(m.merchant_categories) ? m.merchant_categories : []
      for (const c of cats) {
        const cid = typeof c === 'object' ? String(c.id ?? c) : String(c)
        merchantCountByCategory.set(cid, (merchantCountByCategory.get(cid) || 0) + 1)
      }
    }

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d, merchantCountByCategory.get(String(d.id)) || 0))

    const allDocs = (allForStats.docs as any[]) || []
    const total = allDocs.length
    const activeCount = allDocs.filter((d: any) => d.isActive).length
    const featuredCount = allDocs.filter((d: any) => d.isFeatured).length

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
        filteredCount: (paginated as any).totalDocs ?? docs.length,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }

    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-Categories-Cache': 'MISS' } })
    } catch (err: any) {
      console.error('[admin/merchant-categories] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Failed to load merchant categories' }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    let body: Record<string, any>
    try { body = await request.json() } catch { return badRequest('Invalid JSON body') }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length < 2) return badRequest('name is required (min 2 chars)')
    let slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
    if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!slug) return badRequest('slug is required')
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const displayOrder = body.displayOrder != null ? Number(body.displayOrder) : 0
    if (Number.isNaN(displayOrder)) return badRequest('displayOrder must be numeric')
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true
    const isFeatured = typeof body.isFeatured === 'boolean' ? body.isFeatured : false
    const icon = body.icon != null && body.icon !== '' ? Number(body.icon) : null
    if (icon !== null && Number.isNaN(icon)) return badRequest('icon must be media id or null')

    const data: Record<string, any> = { name, slug, description, displayOrder, isActive, isFeatured }
    if (icon !== null) data.icon = icon

    let created: Record<string, any>
    try {
      created = await payload.create({ collection: 'merchant-categories', data: data as any, depth: 1, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create merchant category'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(created, 0)
    // Bust list cache (all admins / query variants) so the new category shows immediately
    await deleteCachedByPrefix('admin:merchant-categories:')
    return NextResponse.json({ success: true, message: 'Merchant category created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/merchant-categories] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
