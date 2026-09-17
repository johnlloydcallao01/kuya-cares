/**
 * @file apps/cms/src/app/api/vendor/catalog/tags/route.ts
 * @description Read-only BFF aggregation for web-merchant /catalog/tags.
 *
 * Divergence from admin (cms/.../admin/catalog/tags): prod-tags is a global taxonomy but product
 * tagging is a many-to-many via prod-tags-junction (product_id → products, tag_id → prod-tags,
 * added_by_type vendor|merchant|system + added_by_vendor_id/added_by_merchant_id). This vendor BFF
 * returns the tag taxonomy with per-tag product counts scoped to the vendor's OWNED products only.
 * It also reports how many of the vendor's products are tagged and how many tag assignments are
 * attributed to the vendor/their merchants. Writes absent for merchants.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

const TAG_TYPES = new Set(['general', 'dietary', 'cuisine', 'promotion', 'feature', 'allergen', 'spice_level', 'temperature', 'size_category'])

function sanitizeParent(v: unknown): { id: number; name: string; slug: string } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id)
  if (Number.isNaN(id)) return null
  return { id, name: String(s.name || ''), slug: String(s.slug || '') }
}

function sanitizeDoc(raw: Record<string, any>, productCount: number, groupCount: number): Record<string, any> {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    color: raw.color ? String(raw.color) : null,
    tag_type: raw.tag_type ? String(raw.tag_type) : 'general',
    parent_tag_id: sanitizeParent(raw.parent_tag_id),
    usage_count: typeof raw.usage_count === 'number' ? raw.usage_count : 0,
    is_active: typeof raw.is_active === 'boolean' ? raw.is_active : true,
    is_featured: typeof raw.is_featured === 'boolean' ? raw.is_featured : false,
    productCount,
    groupCount,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}

const ALLOWED_SORTS = new Set(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt', 'name', '-name', 'usage_count', '-usage_count', 'slug', '-slug'])

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
    const isFeaturedParam = searchParams.get('is_featured') || searchParams.get('isFeatured')
    const isFeaturedFilter = isFeaturedParam === 'true' ? true : isFeaturedParam === 'false' ? false : null
    const tagTypeCsv = (searchParams.get('tag_type') || searchParams.get('tagType') || '').trim()
    const parentParam = (searchParams.get('parent_tag_id') || searchParams.get('parent') || '').trim()

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

    // 2. Product counts + my assignments from junctions (product_id ∈ owned products).
    const junctionRes = await payload.find({
      collection: 'prod-tags-junction',
      limit: 20000,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    } as any)
    const junctions = ((junctionRes as any).docs as Record<string, any>[]) ?? []

    const productCountByTag = new Map<string, number>()
    const myAssignedTagIds = new Set<string>()
    let myAssignments = 0
    const ownedProductIdsWithTags = new Set<number>()

    for (const j of junctions) {
      const pidRaw = j.product_id
      const pid = typeof pidRaw === 'object' ? Number((pidRaw as any).id) : Number(pidRaw)
      if (!Number.isFinite(pid) || !ownedProductIds.has(pid)) continue
      const tidRaw = j.tag_id
      const tid = typeof tidRaw === 'object' ? String((tidRaw as any).id ?? tidRaw) : String(tidRaw)
      if (!tid || tid === 'undefined') continue
      productCountByTag.set(tid, (productCountByTag.get(tid) || 0) + 1)
      ownedProductIdsWithTags.add(pid)

      // Assignment attributed to this vendor / their merchants.
      const byType = String(j.added_by_type || 'system').toLowerCase()
      const attributed =
        (byType === 'vendor' && Number((j.added_by_vendor_id as any)?.id ?? j.added_by_vendor_id) === vendorId) ||
        (byType === 'merchant' && merchantIds.includes(Number((j.added_by_merchant_id as any)?.id ?? j.added_by_merchant_id)))
      if (attributed) {
        myAssignments++
        myAssignedTagIds.add(tid)
      }
    }

    const groupCountByTag = new Map<string, number>()
    const membershipRes = await payload.find({
      collection: 'tag-group-memberships',
      limit: 20000,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    } as any)
    for (const m of ((membershipRes as any).docs as Record<string, any>[]) ?? []) {
      const tid = m.tag_id
      const cid = typeof tid === 'object' ? String((tid as any).id ?? tid) : String(tid)
      if (!cid || cid === 'undefined') continue
      groupCountByTag.set(cid, (groupCountByTag.get(cid) || 0) + 1)
    }

    // 3. Build tag where.
    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }, { description: { contains: search } }] })
    }
    if (isActiveFilter !== null) where.is_active = { equals: isActiveFilter }
    if (isFeaturedFilter !== null) where.is_featured = { equals: isFeaturedFilter }
    if (tagTypeCsv) {
      const vals = tagTypeCsv
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter((v) => TAG_TYPES.has(v))
      if (vals.length === 1) where.tag_type = { equals: vals[0] }
      else if (vals.length > 1) where.tag_type = { in: vals }
    }
    if (parentParam) {
      if (parentParam === 'null' || parentParam === 'top') where.parent_tag_id = { exists: false }
      else {
        const pid = Number(parentParam)
        if (!Number.isNaN(pid)) where.parent_tag_id = { equals: pid }
      }
    }
    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allForStats] = await Promise.all([
      payload.find({
        collection: 'prod-tags',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort: safeSort as any,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({ collection: 'prod-tags', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) =>
      sanitizeDoc(d, productCountByTag.get(String(d.id)) || 0, groupCountByTag.get(String(d.id)) || 0),
    )
    const allDocs = ((allForStats as any).docs as Record<string, any>[]) ?? []
    const total = allDocs.length

    let activeCount = 0
    let featuredCount = 0
    let topLevelCount = 0
    const tagTypeBreakdown: Record<string, number> = {}
    for (const d of allDocs) {
      if (d.is_active) activeCount++
      if (d.is_featured) featuredCount++
      if (!d.parent_tag_id) topLevelCount++
      const t = String(d.tag_type || 'general').toLowerCase()
      tagTypeBreakdown[t] = (tagTypeBreakdown[t] || 0) + 1
    }

    return NextResponse.json({
      docs,
      stats: {
        total,
        filteredCount: typeof (paginated as any).totalDocs === 'number' ? (paginated as any).totalDocs : docs.length,
        activeCount,
        inactiveCount: total - activeCount,
        featuredCount,
        topLevelCount,
        tagTypeBreakdown,
        myProductsTagged: ownedProductIdsWithTags.size,
        myAssignments,
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
    console.error('[vendor/catalog/tags] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load tags' }, { status: 500 })
  }
}