/**
 * @file apps/cms/src/app/api/vendor/catalog/product-categories/route.ts
 * @description Read-only BFF aggregation for web-merchant /product-categories.
 *
 * Product categories is a global service/admin taxonomy. This vendor BFF returns the full category
 * hierarchy with per-category product counts scoped to the vendor's owned products only. All writes
 * are absent for merchants — they create categories via the admin console or CMS batch import.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

function sanitizeMediaRef(v: unknown): { id: number; url: string | null } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id)
  if (Number.isNaN(id)) return null
  const url = typeof s.cloudinaryURL === 'string' ? s.cloudinaryURL : typeof s.url === 'string' ? s.url : null
  return { id, url }
}
function sanitizeParent(v: unknown): { id: number; name: string; slug: string; categoryPath: string | null } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id)
  if (Number.isNaN(id)) return null
  return { id, name: String(s.name || ''), slug: String(s.slug || ''), categoryPath: (s.categoryPath as string) || null }
}
function sanitizeDoc(raw: Record<string, any>, productCount: number): Record<string, any> {
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    description: raw.description ? String(raw.description) : null,
    parentCategory: sanitizeParent(raw.parentCategory),
    categoryLevel: typeof raw.categoryLevel === 'number' ? raw.categoryLevel : null,
    categoryPath: raw.categoryPath ? String(raw.categoryPath) : null,
    displayOrder: typeof raw.displayOrder === 'number' ? raw.displayOrder : 0,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    isFeatured: typeof raw.isFeatured === 'boolean' ? raw.isFeatured : false,
    media: {
      icon: sanitizeMediaRef(raw.media?.icon),
      bannerImage: sanitizeMediaRef(raw.media?.bannerImage),
      thumbnailImage: sanitizeMediaRef(raw.media?.thumbnailImage),
    },
    attributes: {
      categoryType: raw.attributes?.categoryType ? String(raw.attributes.categoryType) : null,
      dietaryTags: Array.isArray(raw.attributes?.dietaryTags) ? raw.attributes.dietaryTags : null,
      ageRestriction: raw.attributes?.ageRestriction ? String(raw.attributes.ageRestriction) : 'none',
      requiresPrescription: typeof raw.attributes?.requiresPrescription === 'boolean' ? raw.attributes.requiresPrescription : false,
    },
    seo: {
      metaTitle: raw.seo?.metaTitle ? String(raw.seo.metaTitle) : null,
      metaDescription: raw.seo?.metaDescription ? String(raw.seo.metaDescription) : null,
      keywords: Array.isArray(raw.seo?.keywords) ? raw.seo.keywords : null,
      canonicalUrl: raw.seo?.canonicalUrl ? String(raw.seo.canonicalUrl) : null,
    },
    productCount,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}

const CATEGORY_TYPES = new Set(['food', 'beverages', 'desserts', 'snacks', 'groceries', 'pharmacy', 'personal_care', 'household', 'other'])
const AGE_RESTRICTIONS = new Set(['none', '18_plus', '21_plus'])
const ALLOWED_SORTS = new Set(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt', 'name', '-name', 'categoryLevel', '-categoryLevel', 'displayOrder', '-displayOrder'])

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
    const sort = (searchParams.get('sort') || 'name').trim()
    const safeSort = ALLOWED_SORTS.has(sort) ? sort : 'name'

    const isActiveParam = searchParams.get('isActive') || searchParams.get('is_active')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null
    const isFeaturedParam = searchParams.get('isFeatured') || searchParams.get('is_featured')
    const isFeaturedFilter = isFeaturedParam === 'true' ? true : isFeaturedParam === 'false' ? false : null
    const categoryTypeParam = (searchParams.get('categoryType') || '').trim().toLowerCase()
    const levelParam = (searchParams.get('categoryLevel') || searchParams.get('level') || '').trim()
    const parentParam = (searchParams.get('parentCategory') || searchParams.get('parent') || '').trim()

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

    // productCount per category from owned products (hasMany categories).
    const productCountByCategory = new Map<string, number>()
    for (const prod of ownedProductDocs) {
      const cats: any[] = Array.isArray(prod.categories) ? prod.categories : []
      for (const c of cats) {
        const cid = typeof c === 'object' ? String((c as any).id ?? c) : String(c)
        if (!cid || cid === 'undefined') continue
        productCountByCategory.set(cid, (productCountByCategory.get(cid) || 0) + 1)
      }
      const rels: any[] = Array.isArray(prod.product_categories) ? prod.product_categories : []
      for (const c of rels) {
        const cid = typeof c === 'object' ? String((c as any).id ?? c) : String(c)
        if (!cid || cid === 'undefined') continue
        productCountByCategory.set(cid, (productCountByCategory.get(cid) || 0) + 1)
      }
    }

    // 2. Build where (global category filters).
    const where: Record<string, any> = {}
    const and: any[] = []

    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }, { description: { contains: search } }] })
    }
    if (isActiveFilter !== null) where.isActive = { equals: isActiveFilter }
    if (isFeaturedFilter !== null) where.isFeatured = { equals: isFeaturedFilter }
    if (categoryTypeParam && CATEGORY_TYPES.has(categoryTypeParam)) where['attributes.categoryType'] = { equals: categoryTypeParam }
    if (levelParam) {
      const lvl = Number(levelParam)
      if (!Number.isNaN(lvl) && lvl >= 1 && lvl <= 5) where.categoryLevel = { equals: lvl }
    }
    if (parentParam) {
      if (parentParam === 'null' || parentParam === 'top') where.parentCategory = { exists: false }
      else {
        const pid = Number(parentParam)
        if (!Number.isNaN(pid)) where.parentCategory = { equals: pid }
      }
    }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allForStats] = await Promise.all([
      payload.find({
        collection: 'product-categories',
        where: Object.keys(finalWhere).length ? finalWhere : undefined,
        page,
        limit,
        sort: safeSort as any,
        depth: 1,
        overrideAccess: true,
      }),
      payload.find({ collection: 'product-categories', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const allDocs = (allForStats.docs as unknown as Record<string, any>[]) ?? []
    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d, productCountByCategory.get(String(d.id)) || 0))
    const total = typeof (paginated as any).totalDocs === 'number' ? (paginated as any).totalDocs : docs.length

    // Stats over ALL categories (for global KPIs).
    let activeCount = 0
    let featuredCount = 0
    let topLevelCount = 0
    const levelBreakdown: Record<string, number> = {}
    const categoryTypeBreakdown: Record<string, number> = {}
    for (const d of allDocs) {
      if (d.isActive) activeCount++
      if (d.isFeatured) featuredCount++
      if (!d.parentCategory) topLevelCount++
      const lvl = String(d.categoryLevel ?? 1)
      levelBreakdown[lvl] = (levelBreakdown[lvl] || 0) + 1
      const ct = String(d.attributes?.categoryType || 'other').toLowerCase()
      categoryTypeBreakdown[ct] = (categoryTypeBreakdown[ct] || 0) + 1
    }

    // Total product count across all owned products.
    const totalProducts = ownedProductDocs.length

    return NextResponse.json({
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
        inactiveCount: allDocs.length - activeCount,
        topLevelCount,
        filteredCount: total,
        levelBreakdown,
        categoryTypeBreakdown,
        totalProducts,
      },
    })
  } catch (err: any) {
    console.error('[vendor/catalog/product-categories] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load product categories' }, { status: 500 })
  }
}