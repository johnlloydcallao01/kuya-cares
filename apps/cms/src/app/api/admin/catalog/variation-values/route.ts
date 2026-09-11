/**
 * @file apps/cms/src/app/api/admin/catalog/variation-values/route.ts
 * @description BFF aggregation endpoint for prod-variation-values (admin) — mirrors vendors/attributes/attribute-terms BFF.
 * GET  /api/admin/catalog/variation-values?page=1&limit=20&search=&variationId=1&attributeId=1&termId=1&sort=-createdAt
 * POST /api/admin/catalog/variation-values -> create variation-value (join table 3 FKs)
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
function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status: 400 })
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

function sanitizeVariation(value: unknown): { id: number; sku: string; name: string | null; product: ReturnType<typeof sanitizeProductBrief> } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, any>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return {
      id,
      sku: str(src.sku, ''),
      name: optionalString(src.name),
      product: sanitizeProductBrief(src.product_id),
    }
  }
  return null
}

function sanitizeAttribute(value: unknown): { id: number; name: string; slug: string; type: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, any>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    return {
      id,
      name: str(src.name, ''),
      slug: str(src.slug, ''),
      type: str(src.type, 'select'),
    }
  }
  return null
}

function sanitizeTerm(value: unknown): { id: number; name: string; slug: string; value: string | null; attribute_id: number | null } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const src = value as Record<string, any>
    const id = Number(src.id)
    if (Number.isNaN(id)) return null
    const attrRaw = src.attribute_id
    const attrIdNum =
      attrRaw && typeof attrRaw === 'object' && 'id' in attrRaw
        ? Number((attrRaw as any).id)
        : typeof attrRaw === 'number'
          ? attrRaw
          : typeof attrRaw === 'string'
            ? Number(attrRaw)
            : null
    return {
      id,
      name: str(src.name, ''),
      slug: str(src.slug, ''),
      value: optionalString(src.value),
      attribute_id: attrIdNum !== null && !Number.isNaN(attrIdNum) ? attrIdNum : null,
    }
  }
  return null
}

function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const variationRaw = raw.variation_id
  const attributeRaw = raw.attribute_id
  const termRaw = raw.term_id

  const variation = sanitizeVariation(variationRaw)
  const attribute = sanitizeAttribute(attributeRaw)
  const term = sanitizeTerm(termRaw)

  const variationIdNum =
    variation && typeof variation === 'object' && 'id' in variation
      ? (variation as any).id
      : typeof variationRaw === 'number'
        ? variationRaw
        : typeof variationRaw === 'string'
          ? Number(variationRaw)
          : null

  const attributeIdNum =
    attribute && typeof attribute === 'object' && 'id' in attribute
      ? (attribute as any).id
      : typeof attributeRaw === 'number'
        ? attributeRaw
        : typeof attributeRaw === 'string'
          ? Number(attributeRaw)
          : null

  const termIdNum =
    term && typeof term === 'object' && 'id' in term
      ? (term as any).id
      : typeof termRaw === 'number'
        ? termRaw
        : typeof termRaw === 'string'
          ? Number(termRaw)
          : null

  return {
    id: raw.id,
    variation_id: variationIdNum,
    variation: typeof variation === 'object' && variation !== null && 'id' in variation ? variation : null,
    // alias for convenience
    variationBrief: typeof variation === 'object' && variation !== null && 'id' in variation ? variation : null,
    attribute_id: attributeIdNum,
    attribute: typeof attribute === 'object' && attribute !== null && 'id' in attribute ? attribute : null,
    term_id: termIdNum,
    term: typeof term === 'object' && term !== null && 'id' in term ? term : null,
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
      .join('&') || 'page=1&limit=20'
    const cacheKey = `admin:catalog-variation-values:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VariationValues-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'

    const variationIdRaw = searchParams.get('variationId') || searchParams.get('variation_id') || searchParams.get('variation')
    const attributeIdRaw = searchParams.get('attributeId') || searchParams.get('attribute_id')
    const termIdRaw = searchParams.get('termId') || searchParams.get('term_id')

    const where: Record<string, any> = {}

    if (variationIdRaw) {
      const n = Number(variationIdRaw)
      if (!Number.isNaN(n) && Number.isFinite(n)) where.variation_id = { equals: n }
    }
    if (attributeIdRaw) {
      const n = Number(attributeIdRaw)
      if (!Number.isNaN(n) && Number.isFinite(n)) where.attribute_id = { equals: n }
    }
    if (termIdRaw) {
      const n = Number(termIdRaw)
      if (!Number.isNaN(n) && Number.isFinite(n)) where.term_id = { equals: n }
    }

    // search: via related term name (and fallback attribute/variation names)
    // If search provided, resolve term ids that match term name/slug/value contains search
    let searchTermIds: number[] | null = null
    let searchNoMatch = false
    if (search) {
      try {
        const termRes = await payload.find({
          collection: 'prod-attribute-terms',
          where: {
            or: [
              { name: { contains: search } },
              { slug: { contains: search } },
              { value: { contains: search } },
            ],
          },
          limit: 200,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        const termDocs = (termRes as any).docs as Record<string, any>[] ?? []
        const ids = termDocs.map((d) => Number(d.id)).filter((n) => !Number.isNaN(n))
        if (ids.length === 0) {
          searchNoMatch = true
        } else {
          searchTermIds = ids
          // merge with existing termId filter? intersect if already filtered
          if (where.term_id?.equals !== undefined) {
            const already = Number(where.term_id.equals)
            if (!ids.includes(already)) searchNoMatch = true
            else searchTermIds = [already]
          } else {
            where.term_id = { in: ids }
          }
        }
      } catch {
        // fallback: ignore search filter if lookup fails
      }
    }

    if (searchNoMatch) {
      // early empty result
      const responseBody = {
        docs: [],
        pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        stats: { total: 0, totalAll: 0, filteredTotal: 0, perVariation: {}, perAttribute: {}, perTerm: {} },
        meta: { generatedAt: new Date().toISOString(), sort, search, variationId: variationIdRaw || null, attributeId: attributeIdRaw || null, termId: termIdRaw || null },
      }
      await setCached(cacheKey, responseBody, 20)
      return NextResponse.json(responseBody, { headers: { 'X-VariationValues-Cache': 'MISS' } })
    }

    const finalWhere = Object.keys(where).length ? where : undefined

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'prod-variation-values',
        where: finalWhere as any,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'prod-variation-values',
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

    // per- counts
    const perVariation: Record<string, number> = {}
    const perAttribute: Record<string, number> = {}
    const perTerm: Record<string, number> = {}
    for (const doc of statsDocs) {
      const vRaw = (doc as any).variation_id
      const vKey = vRaw && typeof vRaw === 'object' && 'id' in vRaw ? String((vRaw as any).id) : String(vRaw ?? 'unknown')
      const aRaw = (doc as any).attribute_id
      const aKey = aRaw && typeof aRaw === 'object' && 'id' in aRaw ? String((aRaw as any).id) : String(aRaw ?? 'unknown')
      const tRaw = (doc as any).term_id
      const tKey = tRaw && typeof tRaw === 'object' && 'id' in tRaw ? String((tRaw as any).id) : String(tRaw ?? 'unknown')
      perVariation[vKey] = (perVariation[vKey] || 0) + 1
      perAttribute[aKey] = (perAttribute[aKey] || 0) + 1
      perTerm[tKey] = (perTerm[tKey] || 0) + 1
    }

    // filtered stats if where applied
    let filteredTotal = total
    let perVariationFiltered = perVariation
    let perAttributeFiltered = perAttribute
    let perTermFiltered = perTerm
    if (finalWhere) {
      try {
        const filteredAll = await payload.find({
          collection: 'prod-variation-values',
          where: finalWhere as any,
          limit: 2000,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        const fdocs = (filteredAll as any).docs as Record<string, any>[] ?? []
        filteredTotal = fdocs.length
        if (typeof paginated.totalDocs === 'number' && paginated.totalDocs > 2000) filteredTotal = paginated.totalDocs
        // capped recompute filtered breakdown
        const pv: Record<string, number> = {}
        const pa: Record<string, number> = {}
        const pt: Record<string, number> = {}
        for (const doc of fdocs) {
          const vRaw = (doc as any).variation_id
          const vKey = vRaw && typeof vRaw === 'object' && 'id' in vRaw ? String((vRaw as any).id) : String(vRaw ?? 'unknown')
          const aRaw = (doc as any).attribute_id
          const aKey = aRaw && typeof aRaw === 'object' && 'id' in aRaw ? String((aRaw as any).id) : String(aRaw ?? 'unknown')
          const tRaw = (doc as any).term_id
          const tKey = tRaw && typeof tRaw === 'object' && 'id' in tRaw ? String((tRaw as any).id) : String(tRaw ?? 'unknown')
          pv[vKey] = (pv[vKey] || 0) + 1
          pa[aKey] = (pa[aKey] || 0) + 1
          pt[tKey] = (pt[tKey] || 0) + 1
        }
        perVariationFiltered = pv
        perAttributeFiltered = pa
        perTermFiltered = pt
      } catch {}
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
        perVariation: perVariationFiltered,
        perAttribute: perAttributeFiltered,
        perTerm: perTermFiltered,
        // global for compatibility
        globalPerVariation: perVariation,
        globalPerAttribute: perAttribute,
        globalPerTerm: perTerm,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search, variationId: variationIdRaw || null, attributeId: attributeIdRaw || null, termId: termIdRaw || null },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-VariationValues-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/catalog/variation-values] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load variation values' }, { status: 500 })
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

    // whitelist: variation_id required Number
    const varRaw = body.variation_id ?? body.variationId ?? body.variation
    const variation_id = Number(varRaw)
    if (varRaw === undefined || varRaw === null || varRaw === '' || Number.isNaN(variation_id) || !Number.isFinite(variation_id)) {
      return badRequest('variation_id is required (numeric prod-variations id)')
    }
    // attribute_id required Number
    const attrRaw = body.attribute_id ?? body.attributeId ?? body.attribute
    const attribute_id = Number(attrRaw)
    if (attrRaw === undefined || attrRaw === null || attrRaw === '' || Number.isNaN(attribute_id) || !Number.isFinite(attribute_id)) {
      return badRequest('attribute_id is required (numeric prod-attributes id)')
    }
    // term_id required Number
    const termRaw = body.term_id ?? body.termId ?? body.term
    const term_id = Number(termRaw)
    if (termRaw === undefined || termRaw === null || termRaw === '' || Number.isNaN(term_id) || !Number.isFinite(term_id)) {
      return badRequest('term_id is required (numeric prod-attribute-terms id)')
    }

    // validate variation exists
    try {
      const v = await payload.findByID({ collection: 'prod-variations', id: variation_id as number, depth: 0, overrideAccess: true })
      if (!v) return badRequest(`variation_id ${variation_id} does not exist`)
    } catch {
      return badRequest(`variation_id ${variation_id} does not exist`)
    }

    // validate attribute exists
    try {
      const a = await payload.findByID({ collection: 'prod-attributes', id: attribute_id as number, depth: 0, overrideAccess: true })
      if (!a) return badRequest(`attribute_id ${attribute_id} does not exist`)
    } catch {
      return badRequest(`attribute_id ${attribute_id} does not exist`)
    }

    // validate term exists and belongs to attribute via find
    let termDoc: Record<string, any> | null = null
    try {
      const termRes = await payload.find({
        collection: 'prod-attribute-terms',
        where: { id: { equals: term_id } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      termDoc = (termRes.docs?.[0] as unknown as Record<string, any>) ?? null
    } catch {}
    if (!termDoc) return badRequest(`term_id ${term_id} does not exist`)
    const termAttrId = typeof termDoc.attribute_id === 'object' ? (termDoc.attribute_id as any).id : termDoc.attribute_id
    const termAttrNum = Number(termAttrId)
    if (Number(termAttrNum) !== Number(attribute_id)) {
      return badRequest('Term does not belong to the selected attribute', { termAttributeId: termAttrNum, selectedAttributeId: attribute_id })
    }

    // duplicate check: same variation_id + attribute_id already exists -> 409
    try {
      const dup = await payload.find({
        collection: 'prod-variation-values',
        where: {
          and: [{ variation_id: { equals: variation_id } }, { attribute_id: { equals: attribute_id } }],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (dup.docs.length > 0) {
        return NextResponse.json(
          { error: `Duplicate attribute for variation: attribute #${attribute_id} already assigned to variation #${variation_id}`, code: 'DUPLICATE_ATTRIBUTE_FOR_VARIATION', details: `variation ${variation_id} already has attribute ${attribute_id}` },
          { status: 409 },
        )
      }
    } catch {}

    const data: Record<string, any> = {
      variation_id,
      attribute_id,
      term_id,
    }

    let created: Record<string, any>
    try {
      created = (await payload.create({ collection: 'prod-variation-values', data: data as any, depth: 2, overrideAccess: true })) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create variation value'
      const lower = String(msg).toLowerCase()
      if (lower.includes('term does not belong') || lower.includes('selected term does not belong')) {
        return NextResponse.json({ error: 'Term does not belong to the selected attribute', details: msg }, { status: 400 })
      }
      if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists')) {
        return NextResponse.json({ error: 'Duplicate attribute for variation', code: 'DUPLICATE_ATTRIBUTE_FOR_VARIATION', details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }

    const sanitized = sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new value shows immediately
    await deleteCachedByPrefix('admin:catalog-variation-values:')
    return NextResponse.json({ success: true, message: 'Variation value created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/catalog/variation-values] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
