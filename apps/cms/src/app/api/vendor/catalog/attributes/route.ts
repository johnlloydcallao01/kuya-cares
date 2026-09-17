/**
 * @file apps/cms/src/app/api/vendor/catalog/attributes/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/attributes.
 *
 * Divergence from admin (apps/cms/.../admin/catalog/attributes): prod-attributes are
 * GLOBAL platform definitions (no vendor FK, slug unique). Merchants/vendors must not
 * rename/disable/delete shared attributes. This endpoint exposes a read-only catalog:
 * active + inactive list with term counts, stats, filters, pagination.
 * All reads overrideAccess:true; authenticateVendor at the gate.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function sanitizeDoc(raw: Record<string, any>, termsCount: number): Record<string, any> {
  return {
    id: raw.id,
    name: str(raw.name, ''),
    slug: str(raw.slug, ''),
    type: str(raw.type, 'select'),
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    termsCount,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}
function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

const ATTRIBUTE_TYPES = new Set(['select', 'color', 'button', 'radio'])

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
    const typeCsv = parseCsv(searchParams.get('type'))
    const isActiveParam = searchParams.get('is_active')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }] })
    }
    if (typeCsv.length) {
      const filtered = typeCsv.filter((v) => ATTRIBUTE_TYPES.has(v))
      if (filtered.length) and.push({ type: { in: filtered } })
    }
    if (isActiveFilter !== null) and.push({ is_active: { equals: isActiveFilter } })
    if (and.length) where.and = and

    // Stats across the full scoped set (same query minus pagination).
    const statsRes = await payload.find({
      collection: 'prod-attributes',
      where,
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
    const totals = statsRes.docs as unknown as Record<string, any>[]
    const totalAll = totals.length
    const totalActive = totals.filter((d) => d.is_active !== false).length

    // No vendor writes — this endpoint is read-only by design.
    const stats = {
      total: totalAll,
      active: totalActive,
      inactive: Math.max(0, totalAll - totalActive),
      filteredTotal: totalAll,
    }

    const res = await payload.find({
      collection: 'prod-attributes',
      where,
      page,
      limit,
      sort,
      depth: 0,
      overrideAccess: true,
    })
    const docsRaw = res.docs as unknown as Record<string, any>[]

    // Term counts for visible page (prod-attribute-terms.attribute_id in ids).
    const ids = docsRaw.map((d) => Number(d.id)).filter((v) => Number.isFinite(v))
    const termsMap = new Map<number, number>()
    if (ids.length > 0) {
      const termsRes = await payload.find({
        collection: 'prod-attribute-terms',
        where: { attribute_id: { in: ids } },
        limit: 2000,
        depth: 0,
        overrideAccess: true,
      })
      for (const t of termsRes.docs as unknown as Record<string, any>[]) {
        const attrId = typeof t.attribute_id === 'object' && t.attribute_id != null
          ? Number((t.attribute_id as Record<string, any>).id)
          : Number(t.attribute_id)
        if (Number.isFinite(attrId)) termsMap.set(attrId, (termsMap.get(attrId) || 0) + 1)
      }
    }

    const docs = docsRaw.map((d) => sanitizeDoc(d, termsMap.get(Number(d.id)) || 0))

    return NextResponse.json({
      docs,
      stats,
      pagination: {
        page: res.page,
        limit: res.limit,
        totalDocs: res.totalDocs,
        totalPages: res.totalPages,
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch attributes'
    console.error('[vendor/catalog/attributes] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}