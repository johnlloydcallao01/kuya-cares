/**
 * @file apps/cms/src/app/api/admin/catalog/attribute-terms/route.ts
 * @description BFF aggregation endpoint for attribute-terms (admin) — mirrors vendors/attributes BFF.
 * GET  /api/admin/catalog/attribute-terms?page=1&limit=20&search=&attribute_id=1&is_active=true&sort=-createdAt
 * POST /api/admin/catalog/attribute-terms -> create term
 * Access: admin-only via authenticateAdmin (JWT Bearer/JWT or payload-token cookie)
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
function numVal(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
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
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const attrRaw = raw.attribute_id
  let attribute: { id: number; name: string; slug: string; type: string } | null = null
  if (attrRaw && typeof attrRaw === 'object' && !Array.isArray(attrRaw)) {
    const a = attrRaw as Record<string, any>
    const id = Number(a.id)
    if (!Number.isNaN(id)) {
      attribute = {
        id,
        name: str(a.name, ''),
        slug: str(a.slug, ''),
        type: str(a.type, 'select'),
      }
    }
  }
  const attrIdNum =
    attribute?.id ??
    (typeof attrRaw === 'number' ? attrRaw : typeof attrRaw === 'string' ? Number(attrRaw) : null)
  return {
    id: raw.id,
    attribute_id: attrIdNum,
    attribute,
    name: str(raw.name, ''),
    slug: str(raw.slug, ''),
    value: optionalString(raw.value),
    sort_order: numVal(raw.sort_order, 0),
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
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

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const HEX_RE = /^#[0-9A-Fa-f]{6}$/

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
    const cacheKey = `admin:catalog-attribute-terms:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-AttributeTerms-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const attributeIdRaw = searchParams.get('attribute_id') || searchParams.get('attributeId')
    const isActiveParam = searchParams.get('is_active')
    const isActiveFilter =
      isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({
        or: [
          { name: { contains: search } },
          { slug: { contains: search } },
          { value: { contains: search } },
        ],
      })
    }

    if (attributeIdRaw) {
      const n = Number(attributeIdRaw)
      if (!Number.isNaN(n) && Number.isFinite(n)) {
        where.attribute_id = { equals: n }
      }
    }

    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'prod-attribute-terms',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'prod-attribute-terms',
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

    // per-attribute breakdown + active/inactive
    const perAttribute: Record<string, number> = {}
    let activeCount = 0
    let inactiveCount = 0
    for (const doc of statsDocs) {
      const rawAttr = (doc as any).attribute_id
      const key =
        rawAttr && typeof rawAttr === 'object' && 'id' in rawAttr
          ? String((rawAttr as any).id)
          : String(rawAttr ?? 'unknown')
      perAttribute[key] = (perAttribute[key] || 0) + 1
      if (doc.is_active) activeCount++
      else inactiveCount++
    }

    // filtered breakdown for current where scope (optional: paginated docs not enough, do a second find for filtered)
    let filteredTotal = total
    let activeFiltered = docs.filter((d) => d.is_active).length
    let inactiveFiltered = docs.filter((d) => !d.is_active).length
    // if paginated total != docs.length due to pagination we still have total; for KPIs use total docs filtered
    // Do an extra lightweight count for active/inactive filtered if needed — reuse paginated.totalDocs but we can approximate
    // Better: if filtered where not empty, fetch again without pagination for exact filtered stats (bounded 2000)
    if (Object.keys(finalWhere).length) {
      try {
        const filteredAll = await payload.find({
          collection: 'prod-attribute-terms',
          where: finalWhere as any,
          limit: 2000,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        const fdocs = (filteredAll as any).docs as Record<string, any>[] ?? []
        activeFiltered = fdocs.filter((d: any) => d.is_active).length
        inactiveFiltered = fdocs.filter((d: any) => !d.is_active).length
        filteredTotal = fdocs.length
        // capped case: if totalDocs > 2000 we fall back to paginated total
        if (typeof paginated.totalDocs === 'number' && paginated.totalDocs > 2000) {
          filteredTotal = paginated.totalDocs
        }
      } catch {}
    } else {
      activeFiltered = activeCount
      inactiveFiltered = inactiveCount
      filteredTotal = totalAll
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
        total: totalAll,
        totalAll,
        filteredTotal,
        perAttribute,
        activeCount: activeFiltered,
        inactiveCount: inactiveFiltered,
        // global counts for reference
        globalActive: activeCount,
        globalInactive: inactiveCount,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search, attributeId: attributeIdRaw || null },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-AttributeTerms-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/catalog/attribute-terms] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load attribute terms' }, { status: 500 })
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

    // attribute_id required
    const attrRaw = body.attribute_id ?? body.attributeId ?? body.attribute
    const attribute_id = Number(attrRaw)
    if (attrRaw === undefined || attrRaw === null || attrRaw === '' || Number.isNaN(attribute_id) || !Number.isFinite(attribute_id)) {
      return badRequest('attribute_id is required (numeric prod-attributes id)')
    }

    // validate attribute exists
    let attrDoc: Record<string, any> | null = null
    try {
      attrDoc = (await payload.findByID({ collection: 'prod-attributes', id: attribute_id as number, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
    } catch {
      return badRequest(`attribute_id ${attribute_id} does not exist`)
    }
    if (!attrDoc) return badRequest(`attribute_id ${attribute_id} not found`)
    const attrType = String((attrDoc as any).type || 'select').toLowerCase()

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length < 2) return badRequest('name is required (min 2 chars)')
    if (name.length > 100) return badRequest('name must be at most 100 characters')

    let slug: string | undefined
    if (typeof body.slug === 'string' && body.slug.trim().length > 0) {
      slug = body.slug.trim().toLowerCase()
      if (slug.length > 100) return badRequest('slug must be at most 100 characters')
      if (!SLUG_RE.test(slug)) return badRequest('slug must be lowercase alphanumeric with hyphens (e.g. red-color)')
    } else {
      const auto = slugify(name)
      if (!auto) return badRequest('name must contain alphanumeric characters to generate slug')
      slug = auto
    }

    // duplicate check: same attribute_id + slug exists -> 409
    try {
      const existing = await payload.find({
        collection: 'prod-attribute-terms',
        where: {
          and: [{ attribute_id: { equals: attribute_id } }, { slug: { equals: slug } }],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existing.docs.length > 0) {
        return NextResponse.json({ error: `Duplicate slug per attribute: ${slug} already exists for attribute #${attribute_id}`, details: `slug ${slug} already exists for attribute ${attribute_id}` }, { status: 409 })
      }
    } catch {}

    let value: string | null = null
    if (body.value !== undefined && body.value !== null && String(body.value).trim() !== '') {
      const v = String(body.value).trim()
      if (v.length > 100) return badRequest('value must be at most 100 characters')
      // optional hex validation for color type — not strict but helpful
      if (attrType === 'color') {
        if (v && !HEX_RE.test(v) && v.startsWith('#')) {
          return badRequest('value for color attribute must be a valid hex color like #RRGGBB (e.g. #FF5733)')
        }
        if (v && HEX_RE.test(v) === false && !v.startsWith('#') && /^[0-9A-Fa-f]{6}$/.test(v)) {
          // normalize missing hash? allow but auto prefix
          // still accept — non-strict, so don't error
        }
      }
      value = v
    }

    let sort_order = 0
    if (body.sort_order !== undefined || body.sortOrder !== undefined) {
      const raw = body.sort_order ?? body.sortOrder
      const n = numVal(raw, NaN)
      if (Number.isNaN(n)) return badRequest('sort_order must be numeric')
      sort_order = Math.trunc(n)
    }

    let is_active: boolean = true
    if (body.is_active !== undefined) {
      if (typeof body.is_active === 'boolean') is_active = body.is_active
      else if (typeof body.is_active === 'string') {
        const v = body.is_active.trim().toLowerCase()
        if (v === 'true') is_active = true
        else if (v === 'false') is_active = false
        else return badRequest('is_active must be boolean')
      } else if (body.is_active !== null) return badRequest('is_active must be boolean')
    } else if (body.isActive !== undefined) {
      if (typeof body.isActive === 'boolean') is_active = body.isActive
      else if (typeof body.isActive === 'string') {
        const v = body.isActive.trim().toLowerCase()
        if (v === 'true') is_active = true
        else if (v === 'false') is_active = false
      }
    }

    const data: Record<string, any> = {
      attribute_id,
      name,
      slug,
      value,
      sort_order,
      is_active,
    }

    let created: Record<string, any>
    try {
      created = (await payload.create({ collection: 'prod-attribute-terms', data: data as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create attribute term'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        return NextResponse.json({ error: 'Duplicate term slug for this attribute', details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new term shows immediately
    await deleteCachedByPrefix('admin:catalog-attribute-terms:')
    return NextResponse.json({ success: true, message: 'Attribute term created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/catalog/attribute-terms] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
