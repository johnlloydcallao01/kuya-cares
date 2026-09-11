/**
 * @file apps/cms/src/app/api/admin/business-zones/route.ts
 * @description BFF aggregation for web-admin /business-zones — platform Business Zones + merchant zone overview.
 * Backend owns: zone CRUD, search/filter, pagination, merchant assignment stats, boundary validation with overrideAccess.
 * GET  /api/admin/business-zones?page=1&limit=10&search=&isActive=true&sort=-createdAt
 * POST /api/admin/business-zones — create zone (admin-only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

function optionalString(v: unknown): string | null { return typeof v === 'string' ? v.trim() || null : null }
function str(v: unknown, fb = ''): string { return typeof v === 'string' ? v : fb }
function badRequest(m: string, d?: unknown){ return NextResponse.json({ error: m, details: d }, { status: 400 }) }

function isValidGeoJSONBoundary(boundary: unknown): { valid: boolean; error?: string } {
  if (boundary == null) return { valid: true }
  if (typeof boundary !== 'object' || Array.isArray(boundary)) return { valid: false, error: 'boundary must be a GeoJSON object' }
  const obj = boundary as Record<string, unknown>
  const type = obj.type
  if (type !== 'Polygon' && type !== 'MultiPolygon') return { valid: false, error: 'boundary.type must be Polygon or MultiPolygon' }
  if (!Array.isArray(obj.coordinates)) return { valid: false, error: 'boundary.coordinates must be an array' }
  return { valid: true }
}

function sanitizeZoneDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    name: str(raw.name, ''),
    slug: str(raw.slug, ''),
    description: optionalString(raw.description),
    boundary: raw.boundary ?? null,
    boundary_geometry: raw.boundary_geometry ?? raw.boundary ?? null,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    disabledReason: optionalString(raw.disabledReason),
    displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 0,
    timezone: str(raw.timezone, 'Asia/Manila'),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
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
      .join('&') || 'page=1&limit=10&sort=-createdAt'
    const cacheKey = `admin:business-zones:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-BusinessZones-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }, { description: { contains: search } }] })
    }
    if (isActiveFilter !== null) where.isActive = { equals: isActiveFilter }
    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allZonesForStats, merchantsForStats] = await Promise.all([
      payload.find({
        collection: 'business-zones',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({ collection: 'business-zones', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'merchants', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const zoneDocs = paginated.docs as unknown as Record<string, any>[]
    const allZones = (allZonesForStats.docs as any[]) || []
    const allMerchants = (merchantsForStats.docs as any[]) || []

    // Merchant counts per zone
    const merchantCountByZone = new Map<string, number>()
    let unassignedMerchants = 0
    for (const m of allMerchants) {
      const bz = (m as any).businessZone ?? (m as any).business_zone ?? null
      const bzId = bz != null ? String(typeof bz === 'object' ? (bz as any).id ?? bz : bz) : null
      if (!bzId || bzId === 'null') {
        unassignedMerchants++
      } else {
        merchantCountByZone.set(bzId, (merchantCountByZone.get(bzId) || 0) + 1)
      }
    }

    const docs = zoneDocs.map((raw) => {
      const sanitized = sanitizeZoneDoc(raw as Record<string, any>)
      const idStr = String(sanitized.id)
      return {
        ...sanitized,
        merchantCount: merchantCountByZone.get(idStr) || 0,
      }
    })

    const totalZones = allZones.length
    const activeZones = allZones.filter((z: any) => z.isActive !== false).length
    const inactiveZones = totalZones - activeZones

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
        totalZones,
        activeZones,
        inactiveZones,
        totalMerchants: allMerchants.length,
        assignedMerchants: allMerchants.length - unassignedMerchants,
        unassignedMerchants,
        merchantCountByZone: Object.fromEntries(merchantCountByZone),
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }

    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-BusinessZones-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/business-zones] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load business zones' }, { status: 500 })
  }
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
    let slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (!slug) {
      slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    }
    if (!slug || slug.length < 2) return badRequest('slug is required')
    const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugPattern.test(slug)) return badRequest('slug must be URL-friendly (lowercase, numbers, hyphens)')

    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const boundary = body.boundary ?? null
    if (boundary !== null) {
      const v = isValidGeoJSONBoundary(boundary)
      if (!v.valid) return badRequest(v.error || 'Invalid boundary')
    }
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true
    const disabledReason = typeof body.disabledReason === 'string' ? body.disabledReason.trim() || null : null
    if (!isActive && !disabledReason) {
      // allow empty disabledReason but warn - not blocking
    }
    const displayOrder = body.displayOrder != null ? Number(body.displayOrder) : 0
    if (Number.isNaN(displayOrder)) return badRequest('displayOrder must be a number')
    const timezone = typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : 'Asia/Manila'
    try { Intl.DateTimeFormat(undefined, { timeZone: timezone }) } catch { return badRequest('timezone must be a valid IANA identifier (e.g. Asia/Manila)') }

    const data: Record<string, any> = {
      name,
      slug,
      description: description ?? undefined,
      boundary: boundary ?? undefined,
      isActive,
      disabledReason: disabledReason ?? undefined,
      displayOrder,
      timezone,
    }

    let created: Record<string, any>
    try {
      created = await payload.create({ collection: 'business-zones', data: data as any, depth: 0, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create business zone'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeZoneDoc(created)
    // Bust list + overview caches (all admins / query variants) so the new zone shows immediately
    await deleteCachedByPrefix('admin:business-zones:')
    await deleteCachedByPrefix('admin:business-zones-overview:')
    return NextResponse.json({ success: true, message: 'Business zone created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/business-zones] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
