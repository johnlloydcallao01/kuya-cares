/**
 * @file apps/cms/src/app/api/vendor/catalog/attribute-terms/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/attribute-terms.
 *
 * Divergence from admin (cms/.../admin/catalog/attribute-terms): term slugs are NOT
 * unique and terms belong to the global shared attribute catalog. Merchants view the
 * terms of each shared attribute (read-only) plus per-attribute breakdown and an
 * attribute list to filter by. Write endpoints intentionally absent.
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
function numVal(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const attrRaw = raw.attribute_id
  let attribute: { id: number; name: string; slug: string; type: string } | null = null
  if (attrRaw && typeof attrRaw === 'object' && !Array.isArray(attrRaw)) {
    const id = Number(attrRaw.id)
    if (!Number.isNaN(id)) attribute = { id, name: str(attrRaw.name, ''), slug: str(attrRaw.slug, ''), type: str(attrRaw.type, 'select') }
  }
  const attrIdNum = attribute?.id ?? (typeof attrRaw === 'number' ? attrRaw : typeof attrRaw === 'string' ? Number(attrRaw) : null)
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

function sanitizeAttributeBrief(raw: Record<string, any>) {
  return { id: Number(raw.id), name: str(raw.name, ''), slug: str(raw.slug, ''), type: str(raw.type, 'select') }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
    const search = (searchParams.get('search') || '').trim()
    const sort = searchParams.get('sort') || '-createdAt'
    const attributeIdRaw = searchParams.get('attribute_id') || searchParams.get('attributeId')
    const isActiveParam = searchParams.get('is_active')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }, { value: { contains: search } }] })
    }
    if (attributeIdRaw) {
      const n = Number(attributeIdRaw)
      if (!Number.isFinite(n)) return NextResponse.json({ error: 'attribute_id must be numeric' }, { status: 400 })
      and.push({ attribute_id: { equals: n } })
    }
    if (isActiveFilter !== null) and.push({ is_active: { equals: isActiveFilter } })
    if (and.length) where.and = and

    // Stats across the full scoped set + per-attribute breakdown.
    const allRes = await payload.find({
      collection: 'prod-attribute-terms',
      where,
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    const allTerms = allRes.docs as unknown as Record<string, any>[]
    const totalAll = allTerms.length
    const totalActive = allTerms.filter((t) => t.is_active !== false).length

    const byAttrMap = new Map<number, number>()
    for (const t of allTerms) {
      const attrId = typeof t.attribute_id === 'object' && t.attribute_id != null
        ? Number((t.attribute_id as Record<string, any>).id)
        : Number(t.attribute_id)
      if (Number.isFinite(attrId)) byAttrMap.set(attrId, (byAttrMap.get(attrId) || 0) + 1)
    }
    const attrIds = Array.from(byAttrMap.keys())
    const attrNameMap = new Map<number, { name: string; type: string }>()
    let byAttribute: { attribute_id: number; name: string; type: string; count: number }[] = []
    if (attrIds.length > 0) {
      const attrRes = await payload.find({
        collection: 'prod-attributes',
        where: { id: { in: attrIds } },
        limit: 2000,
        depth: 0,
        overrideAccess: true,
      })
      for (const a of attrRes.docs as unknown as Record<string, any>[]) {
        attrNameMap.set(Number(a.id), { name: str(a.name, ''), type: str(a.type, 'select') })
      }
      byAttribute = attrIds
        .map((id) => ({ attribute_id: id, ...(attrNameMap.get(id) || { name: `Attribute #${id}`, type: 'select' }), count: byAttrMap.get(id) || 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    }

    const stats = { total: totalAll, active: totalActive, inactive: Math.max(0, totalAll - totalActive), filteredTotal: totalAll, byAttribute }

    // Attribute options for the filter (shared catalog).
    const attrOptsRes = await payload.find({
      collection: 'prod-attributes',
      where: {},
      limit: 1000,
      sort: 'name',
      depth: 0,
      overrideAccess: true,
    })
    const attributes = (attrOptsRes.docs as unknown as Record<string, any>[]).map(sanitizeAttributeBrief)

    const res = await payload.find({
      collection: 'prod-attribute-terms',
      where,
      page,
      limit,
      sort,
      depth: 1,
      overrideAccess: true,
    })
    const docs = (res.docs as unknown as Record<string, any>[]).map(sanitizeDoc)

    return NextResponse.json({
      docs,
      stats,
      attributes,
      pagination: { page: res.page, limit: res.limit, totalDocs: res.totalDocs, totalPages: res.totalPages, hasNextPage: res.hasNextPage, hasPrevPage: res.hasPrevPage },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch attribute terms'
    console.error('[vendor/catalog/attribute-terms] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}