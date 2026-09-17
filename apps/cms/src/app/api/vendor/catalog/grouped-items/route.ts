/**
 * @file apps/cms/src/app/api/vendor/catalog/grouped-items/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/grouped-items.
 *
 * Divergence from admin (cms/.../admin/catalog/grouped-items): the prod-grouped-items collection is an
 * open read/write junction (parent_product_id + child_product_id → products, default_quantity, sort_order)
 * with no merchant FK. Merchant scope is derived by restricting to rows where the parent OR child is one
 * of the vendor's owned products. parent_product_id / child_product_id filters are each ownership-guarded.
 * Writes absent for merchants.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}
function num(v: unknown, fb = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fb
  }
  return fb
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
    return { id, name: str(src.name, ''), slug: str(src.slug, ''), productType: str((src as any).productType, '') }
  }
  return null
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  return {
    id: raw.id,
    parent_product_id: sanitizeProductBrief(raw.parent_product_id),
    parent_product: sanitizeProductBrief(raw.parent_product_id),
    child_product_id: sanitizeProductBrief(raw.child_product_id),
    child_product: sanitizeProductBrief(raw.child_product_id),
    default_quantity: raw.default_quantity != null ? num(raw.default_quantity, 1) : 1,
    sort_order: raw.sort_order != null ? Math.trunc(num(raw.sort_order, 0)) : 0,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  }
}

const ALLOWED_SORTS = new Set(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt', 'sort_order', '-sort_order', 'default_quantity', '-default_quantity'])

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
    const parentFilter = (searchParams.get('parent_product_id') || searchParams.get('parent') || '').trim()
    const childFilter = (searchParams.get('child_product_id') || searchParams.get('child') || '').trim()
    const safeSort = ALLOWED_SORTS.has(sort) ? sort : '-createdAt'

    // 1. Resolve vendor + owned merchants + owned products.
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
    const ownedProducts = (prodRes.docs as unknown as Record<string, any>[])
      .map((p) => ({ id: Number(p.id), name: str(p.name, ''), slug: str(p.slug, ''), productType: str(p.productType, '') }))
      .sort((a, b) => a.name.localeCompare(b.name))

    if (ownedProductIds.size === 0) {
      return NextResponse.json({ docs: [], products: [], stats: null, pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } })
    }

    // 2. Ownership guards on id filter params.
    if (parentFilter) {
      const pid = Number(parentFilter)
      if (!Number.isNaN(pid) && !ownedProductIds.has(pid)) {
        return NextResponse.json({ error: 'Forbidden: parent product does not belong to vendor' }, { status: 403 })
      }
    }
    if (childFilter) {
      const cid = Number(childFilter)
      if (!Number.isNaN(cid) && !ownedProductIds.has(cid)) {
        return NextResponse.json({ error: 'Forbidden: child product does not belong to vendor' }, { status: 403 })
      }
    }

    // 3. Build where: scoped to rows where parent OR child is an owned product.
    const ownedArr = Array.from(ownedProductIds)
    const where: Record<string, any> = {}
    const and: any[] = [
      { or: [
        { parent_product_id: { in: ownedArr } },
        { child_product_id: { in: ownedArr } },
      ] },
    ]

    if (parentFilter) {
      const pid = Number(parentFilter)
      if (!Number.isNaN(pid)) where.parent_product_id = { equals: pid }
    }
    if (childFilter) {
      const cid = Number(childFilter)
      if (!Number.isNaN(cid)) where.child_product_id = { equals: cid }
    }

    // Search: find product names matching, then restrict to those product ids.
    if (search) {
      try {
        const searchProdRes = await payload.find({
          collection: 'products',
          where: { name: { contains: search } },
          limit: 200,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any)
        const matchIds = (searchProdRes.docs as unknown as Record<string, any>[]).map((d) => Number(d.id)).filter((id) => Number.isFinite(id))
        // Also scope to owned products.
        const scopedMatchIds = matchIds.filter((id) => ownedProductIds.has(id))
        if (scopedMatchIds.length > 0) {
          and.push({ or: [{ parent_product_id: { in: scopedMatchIds } }, { child_product_id: { in: scopedMatchIds } }] })
        } else {
          and.push({ parent_product_id: { equals: -1 } })
        }
      } catch {
        and.push({ parent_product_id: { equals: -1 } })
      }
    }

    const hasWhere = Object.keys(where).length > 0
    const finalWhere = and.length ? { and: [...and, ...(hasWhere ? [where] : [])] } : where

    // 4. Fetch paginated rows + global-scoped stats + filtered stats.
    const scopedOnlyWhere = { or: [{ parent_product_id: { in: ownedArr } }, { child_product_id: { in: ownedArr } }] }

    const [paginated, statsAll, globalScopedAll] = await Promise.all([
      payload.find({
        collection: 'prod-grouped-items',
        where: Object.keys(finalWhere).length ? (finalWhere as any) : undefined,
        page,
        limit,
        sort: safeSort as any,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({ collection: 'prod-grouped-items', where: finalWhere as any, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'prod-grouped-items', where: scopedOnlyWhere as any, limit: 0, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d))
    const statsDocs = ((statsAll as any).docs as Record<string, any>[]) ?? []
    const globalDocs = ((globalScopedAll as any).docs as Record<string, any>[]) ?? []

    const total = typeof (paginated as any).totalDocs === 'number' ? (paginated as any).totalDocs : docs.length
    const filteredTotal = statsDocs.length
    const totalAll = globalDocs.length

    // perParent breakdown from filtered stats.
    const perParent: Record<string, number> = {}
    const childSet = new Set<number | string>()
    for (const d of statsDocs) {
      const pid = (d as any).parent_product_id
      const key = pid && typeof pid === 'object' ? String((pid as any).id) : String(pid ?? 'unknown')
      perParent[key] = (perParent[key] || 0) + 1
      const cid = (d as any).child_product_id
      childSet.add(cid && typeof cid === 'object' ? String((cid as any).id) : String(cid ?? ''))
    }

    return NextResponse.json({
      docs,
      products: ownedProducts,
      stats: { total, totalAll, filteredTotal, perParent, totalGrouped: filteredTotal, uniqueParents: Object.keys(perParent).length, uniqueChildren: childSet.size },
      pagination: {
        page: (paginated as any).page,
        limit: (paginated as any).limit,
        totalDocs: (paginated as any).totalDocs,
        totalPages: (paginated as any).totalPages,
        hasNextPage: (paginated as any).hasNextPage,
        hasPrevPage: (paginated as any).hasPrevPage,
      },
    })
  } catch (err: any) {
    console.error('[vendor/catalog/grouped-items] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load grouped items' }, { status: 500 })
  }
}