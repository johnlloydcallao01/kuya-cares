/**
 * @file apps/cms/src/app/api/vendor/catalog/tag-groups/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/tag-groups.
 *
 * Divergence from admin (cms/.../admin/catalog/tag-groups): tag-groups is a global platform taxonomy
 * (no vendor/merchant fields). Memberships live in tag-group-memberships (tag_group_id → tag-groups,
 * tag_id → prod-tags), and tags attach to products via prod-tags-junction (product_id → products).
 * This vendor BFF returns the group taxonomy with each group's tag count plus a merchant-scoped
 * "your products" count = distinct vendor-owned products carrying any member tag. Writes absent.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

function sanitizeDoc(raw: Record<string, any>, tagCount: number, myProducts: number): Record<string, any> {
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
    myProducts,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}

const ALLOWED_SORTS = new Set(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt', 'name', '-name', 'display_order', '-display_order', 'tag_count', '-tag_count'])

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
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 10))
    const search = (searchParams.get('search') || '').trim()
    const sort = (searchParams.get('sort') || '-createdAt').trim()
    const safeSort = ALLOWED_SORTS.has(sort) ? sort : '-createdAt'
    const isActiveParam = searchParams.get('is_active') || searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null
    const isFilterableParam = searchParams.get('is_filterable') || searchParams.get('isFilterable')
    const isFilterableFilter = isFilterableParam === 'true' ? true : isFilterableParam === 'false' ? false : null
    const isSearchableParam = searchParams.get('is_searchable') || searchParams.get('isSearchable')
    const isSearchableFilter = isSearchableParam === 'true' ? true : isSearchableParam === 'false' ? false : null

    // 1. Resolve vendor + merchants + owned products.
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
      pagination: false,
    } as any)
    const ownedProductDocs = (prodRes.docs as unknown as Record<string, any>[]) ?? []
    const ownedProductIds = new Set(ownedProductDocs.map((p) => Number(p.id)).filter((v) => Number.isFinite(v)))

    // 2. Load memberships (group → tags) and product-tag junctions.
    const [membershipRes, junctionRes] = await Promise.all([
      payload.find({ collection: 'tag-group-memberships', limit: 20000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'prod-tags-junction', limit: 20000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])
    const memberships = ((membershipRes as any).docs as Record<string, any>[]) ?? []
    const junctions = ((junctionRes as any).docs as Record<string, any>[]) ?? []

    // tagId -> Set<ownedProductId> for the vendor's products.
    const ownedProductsByTag = new Map<string, Set<number>>()
    for (const j of junctions) {
      const pidRaw = j.product_id
      const pid = typeof pidRaw === 'object' ? Number((pidRaw as any).id) : Number(pidRaw)
      if (!Number.isFinite(pid) || !ownedProductIds.has(pid)) continue
      const tidRaw = j.tag_id
      const tid = typeof tidRaw === 'object' ? String((tidRaw as any).id ?? tidRaw) : String(tidRaw)
      if (!tid || tid === 'undefined') continue
      let set = ownedProductsByTag.get(tid)
      if (!set) {
        set = new Set()
        ownedProductsByTag.set(tid, set)
      }
      set.add(pid)
    }

    // Group -> member tag ids + tag count.
    const tagIdsByGroup = new Map<string, Set<string>>()
    for (const m of memberships) {
      const gRaw = m.tag_group_id
      const gid = typeof gRaw === 'object' ? String((gRaw as any).id ?? gRaw) : String(gRaw)
      if (!gid || gid === 'undefined') continue
      const tRaw = m.tag_id
      const tid = typeof tRaw === 'object' ? String((tRaw as any).id ?? tRaw) : String(tRaw)
      if (!tid || tid === 'undefined') continue
      let set = tagIdsByGroup.get(gid)
      if (!set) {
        set = new Set()
        tagIdsByGroup.set(gid, set)
      }
      set.add(tid)
    }

    const myProductsByGroup = new Map<string, number>()
    const allMyGroupedProducts = new Set<number>()
    for (const [gid, tagIds] of tagIdsByGroup.entries()) {
      const union = new Set<number>()
      for (const tid of tagIds) {
        const prodSet = ownedProductsByTag.get(tid)
        if (!prodSet) continue
        for (const pid of prodSet) union.add(pid)
      }
      myProductsByGroup.set(gid, union.size)
      for (const pid of union) allMyGroupedProducts.add(pid)
    }

    // 3. Build group where.
    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }, { description: { contains: search } }] })
    }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }
    if (isFilterableFilter !== null) where.is_filterable = { equals: isFilterableFilter }
    if (isSearchableFilter !== null) where.is_searchable = { equals: isSearchableFilter }
    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allForStats] = await Promise.all([
      payload.find({
        collection: 'tag-groups',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort: safeSort as any,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({ collection: 'tag-groups', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) =>
      sanitizeDoc(d, tagIdsByGroup.get(String(d.id))?.size || 0, myProductsByGroup.get(String(d.id)) || 0),
    )
    const allDocs = ((allForStats as any).docs as Record<string, any>[]) ?? []
    const total = allDocs.length

    let activeCount = 0
    let filterableCount = 0
    let searchableCount = 0
    for (const d of allDocs) {
      if (d.is_active) activeCount++
      if (d.is_filterable) filterableCount++
      if (d.is_searchable) searchableCount++
    }

    return NextResponse.json({
      docs,
      stats: {
        total,
        filteredCount: typeof (paginated as any).totalDocs === 'number' ? (paginated as any).totalDocs : docs.length,
        activeCount,
        inactiveCount: total - activeCount,
        filterableCount,
        searchableCount,
        myGroupedProducts: allMyGroupedProducts.size,
      },
      pagination: {
        page: (paginated as any).page || page,
        limit: (paginated as any).limit || limit,
        totalDocs: (paginated as any).totalDocs ?? docs.length,
        totalPages: (paginated as any).totalPages ?? 1,
        hasNextPage: (paginated as any).hasNextPage ?? false,
        hasPrevPage: (paginated as any).hasPrevPage ?? false,
      },
    })
  } catch (err: any) {
    console.error('[vendor/catalog/tag-groups] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load tag groups' }, { status: 500 })
  }
}