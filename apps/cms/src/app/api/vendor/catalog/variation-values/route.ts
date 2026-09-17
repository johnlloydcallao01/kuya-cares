/**
 * @file apps/cms/src/app/api/vendor/catalog/variation-values/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/variation-values.
 *
 * Divergence from admin (cms/.../admin/catalog/variation-values): prod-variation-values
 * link a variation <-> attribute <-> term with NO vendor FK. Merchants only see values
 * attached to THEIR variations (variations -> owned products chain), with per-id
 * ownership guard on variationId filter. attributeId/termId filters are global shared
 * catalog references and stay open. Write endpoints absent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function optionalString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() || null : null
}
function idNum(v: unknown): number | null {
  if (typeof v === 'object' && v != null && 'id' in (v as Record<string, unknown>)) {
    const n = Number((v as Record<string, unknown>).id)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(v as string | number)
  return Number.isFinite(n) ? n : null
}
function sanitizeAttributeBrief(raw: Record<string, any>) {
  return { id: Number(raw.id), name: str(raw.name, ''), slug: str(raw.slug, ''), type: str(raw.type, 'select') }
}
function sanitizeTermBrief(raw: Record<string, any>) {
  const attrId = idNum(raw.attribute_id)
  return { id: Number(raw.id), name: str(raw.name, ''), slug: str(raw.slug, ''), value: optionalString(raw.value), attribute_id: attrId ?? Number(raw.attribute_id ?? 'NaN') }
}
function sanitizeProductBrief(value: unknown): { id: number; name: string; slug: string } | number | null {
  if (value == null) return null
  if (typeof value === 'number' || typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, any>
    const id = Number(obj.id)
    if (Number.isNaN(id)) return null
    return { id, name: str(obj.name), slug: str(obj.slug) }
  }
  return null
}
function sanitizeVariationBrief(raw: Record<string, any>) {
  return { id: Number(raw.id), sku: str(raw.sku), name: optionalString(raw.name), product: sanitizeProductBrief(raw.product_id) }
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const variationRaw = raw.variation_id
  const attributeRaw = raw.attribute_id
  const termRaw = raw.term_id
  let variation: Record<string, any> | null = null
  let attribute: Record<string, any> | null = null
  let term: Record<string, any> | null = null
  if (variationRaw && typeof variationRaw === 'object' && !Array.isArray(variationRaw)) variation = sanitizeVariationBrief(variationRaw as Record<string, any>)
  if (attributeRaw && typeof attributeRaw === 'object' && !Array.isArray(attributeRaw)) attribute = sanitizeAttributeBrief(attributeRaw as Record<string, any>)
  if (termRaw && typeof termRaw === 'object' && !Array.isArray(termRaw)) term = sanitizeTermBrief(termRaw as Record<string, any>)
  return {
    id: raw.id,
    variation_id: idNum(variationRaw),
    variation,
    attribute_id: idNum(attributeRaw),
    attribute,
    term_id: idNum(termRaw),
    term,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || String(authUser.id)
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
    const search = (searchParams.get('search') || '').trim()
    const sort = searchParams.get('sort') || '-createdAt'
    const variationIdRaw = searchParams.get('variationId') || searchParams.get('variation_id') || searchParams.get('variation')
    const attributeIdRaw = searchParams.get('attributeId') || searchParams.get('attribute_id')
    const termIdRaw = searchParams.get('termId') || searchParams.get('term_id')

    // 1. Resolve vendor.
    const vendorRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorRes.docs[0] as Record<string, any> | undefined
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }
    const vendorId = Number(vendor.id)

    // 2. Owned products -> owned variations.
    const merchantRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantIds = (merchantRes.docs as unknown as Record<string, any>[]).map((m) => Number(m.id)).filter((v) => Number.isFinite(v))

    const prodRes = await payload.find({
      collection: 'products',
      where: {
        or: [
          { createdByVendor: { equals: vendorId } },
          ...(merchantIds.length ? [{ createdByMerchant: { in: merchantIds } }] : []),
        ],
      },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    const ownedProductIds = new Set((prodRes.docs as unknown as Record<string, any>[]).map((p) => Number(p.id)).filter((v) => Number.isFinite(v)))

    if (ownedProductIds.size === 0) {
      return NextResponse.json({ docs: [], variations: [], attributes: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    const varRes = await payload.find({
      collection: 'prod-variations',
      where: { product_id: { in: Array.from(ownedProductIds) } },
      limit: 5000,
      depth: 0,
      overrideAccess: true,
    })
    const ownedVariations = varRes.docs as unknown as Record<string, any>[]
    const ownedVariationIds = new Set(ownedVariations.map((v) => Number(v.id)).filter((v) => Number.isFinite(v)))

    const variations = ownedVariations.map((v) => sanitizeVariationBrief(v)).sort((a: any, b: any) => String(a.sku).localeCompare(String(b.sku)))

    if (ownedVariationIds.size === 0) {
      return NextResponse.json({ docs: [], variations, attributes: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 3. variationId filter must be one of the vendor's variations.
    if (variationIdRaw) {
      const n = Number(variationIdRaw)
      if (!Number.isFinite(n)) return NextResponse.json({ error: 'variationId must be numeric' }, { status: 400 })
      if (!ownedVariationIds.has(n)) {
        return NextResponse.json({ error: 'Forbidden: variation does not belong to vendor' }, { status: 403 })
      }
    }

    // 4. Attribute options (global shared catalog).
    const attrOptsRes = await payload.find({
      collection: 'prod-attributes',
      where: {},
      limit: 1000,
      sort: 'name',
      depth: 0,
      overrideAccess: true,
    })
    const attributes = (attrOptsRes.docs as unknown as Record<string, any>[]).map(sanitizeAttributeBrief)

    const where: Record<string, any> = { variation_id: { in: Array.from(ownedVariationIds) } }
    if (variationIdRaw) where.variation_id = { equals: Number(variationIdRaw) }
    if (attributeIdRaw) {
      const n = Number(attributeIdRaw)
      if (!Number.isNaN(n) && Number.isFinite(n)) where.attribute_id = { equals: n }
    }
    if (termIdRaw) {
      const n = Number(termIdRaw)
      if (!Number.isNaN(n) && Number.isFinite(n)) where.term_id = { equals: n }
    }

    // Search via related term id resolution (admin parity).
    let searchNoMatch = false
    let searchClause: Record<string, any> | null = null
    if (search) {
      try {
        const termRes = await payload.find({
          collection: 'prod-attribute-terms',
          where: { or: [{ name: { contains: search } }, { slug: { contains: search } }, { value: { contains: search } }] },
          limit: 200,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        const termDocs = (termRes as any).docs as Record<string, any>[] ?? []
        const ids = termDocs.map((d) => Number(d.id)).filter((n) => Number.isFinite(n))
        if (ids.length === 0) {
          searchNoMatch = true
        } else if (where.term_id?.equals !== undefined) {
          if (!ids.includes(Number(where.term_id.equals))) searchNoMatch = true
          else searchClause = { term_id: { equals: Number(where.term_id.equals) } }
        } else {
          searchClause = { term_id: { in: ids } }
        }
      } catch {
        // fallback: ignore search filter if lookup fails
      }
    }

    if (searchNoMatch) {
      return NextResponse.json({ docs: [], variations, attributes, stats: { total: 0, filteredTotal: 0, perVariation: {}, perAttribute: {}, perTerm: {} }, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    const finalWhere = searchClause ? { ...where, ...searchClause } : where

    const [paginated, statsAll] = await Promise.all([
      payload.find({
        collection: 'prod-variation-values',
        where: finalWhere,
        page,
        limit,
        sort,
        depth: 2,
        overrideAccess: true,
      }),
      payload.find({ collection: 'prod-variation-values', where: finalWhere, limit: 0, depth: 0, overrideAccess: true }),
    ])

    const statsDocs = (statsAll.docs as unknown as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))

    const total = typeof paginated.totalDocs === 'number' ? paginated.totalDocs : docs.length
    const filteredTotal = statsDocs.length
    const perVariation: Record<string, number> = {}
    const perAttribute: Record<string, number> = {}
    const perTerm: Record<string, number> = {}
    for (const d of statsDocs) {
      const vid = idNum(d.variation_id)
      const aid = idNum(d.attribute_id)
      const tid = idNum(d.term_id)
      if (vid != null) perVariation[String(vid)] = (perVariation[String(vid)] || 0) + 1
      if (aid != null) perAttribute[String(aid)] = (perAttribute[String(aid)] || 0) + 1
      if (tid != null) perTerm[String(tid)] = (perTerm[String(tid)] || 0) + 1
    }

    return NextResponse.json({
      docs,
      variations,
      attributes,
      stats: { total, filteredTotal, perVariation, perAttribute, perTerm },
      pagination: {
        page: paginated.page,
        limit: paginated.limit,
        totalDocs: paginated.totalDocs,
        totalPages: paginated.totalPages,
        hasNextPage: paginated.hasNextPage,
        hasPrevPage: paginated.hasPrevPage,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch variation values'
    console.error('[vendor/catalog/variation-values] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}