/**
 * @file apps/cms/src/app/api/admin/product-categories/route.ts
 * @description BFF aggregation for web-admin /product-categories — mirrors merchant-categories + vendors BFF.
 * GET /api/admin/product-categories?page=1&limit=10&search=&isActive=&isFeatured=&categoryType=&ageRestriction=&parentCategory=&sort=displayOrder
 * POST /api/admin/product-categories — create (admin/service only, overrideAccess)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

function sanitizeMediaRef(v: unknown): { id: number; url: string | null } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id); if (Number.isNaN(id)) return null
  const url = typeof s.cloudinaryURL === 'string' ? s.cloudinaryURL : typeof s.url === 'string' ? s.url : null
  return { id, url }
}
function sanitizeParent(v: unknown): { id: number; name: string; slug: string; categoryPath: string | null } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id); if (Number.isNaN(id)) return null
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
      dietaryTags: Array.isArray(raw.attributes?.dietaryTags) ? raw.attributes.dietaryTags : raw.attributes?.dietaryTags ?? null,
      ageRestriction: raw.attributes?.ageRestriction ? String(raw.attributes.ageRestriction) : 'none',
      requiresPrescription: typeof raw.attributes?.requiresPrescription === 'boolean' ? raw.attributes.requiresPrescription : false,
    },
    seo: {
      metaTitle: raw.seo?.metaTitle ? String(raw.seo.metaTitle) : null,
      metaDescription: raw.seo?.metaDescription ? String(raw.seo.metaDescription) : null,
      keywords: Array.isArray(raw.seo?.keywords) ? raw.seo.keywords : raw.seo?.keywords ?? null,
      canonicalUrl: raw.seo?.canonicalUrl ? String(raw.seo.canonicalUrl) : null,
    },
    productCount,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}
function badRequest(m: string, d?: unknown) { return NextResponse.json({ error: m, details: d }, { status: 400 }) }

const CATEGORY_TYPES = new Set(['food', 'beverages', 'desserts', 'snacks', 'groceries', 'pharmacy', 'personal_care', 'household', 'other'])
const AGE_RESTRICTIONS = new Set(['none', '18_plus', '21_plus'])

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
    const cacheKey = `admin:product-categories:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-ProductCategories-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || 'displayOrder'
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null
    const isFeaturedParam = searchParams.get('isFeatured')
    const isFeaturedFilter = isFeaturedParam === 'true' ? true : isFeaturedParam === 'false' ? false : null
    const categoryTypeParam = searchParams.get('categoryType')?.trim() || ''
    const ageParam = searchParams.get('ageRestriction')?.trim() || ''
    const parentParam = searchParams.get('parentCategory')?.trim() || ''
    const levelParam = searchParams.get('categoryLevel')?.trim() || ''

    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({ or: [{ name: { contains: search } }, { slug: { contains: search } }, { description: { contains: search } }, { 'seo.metaTitle': { contains: search } }] })
    }
    if (isActiveFilter !== null) where.isActive = { equals: isActiveFilter }
    if (isFeaturedFilter !== null) where.isFeatured = { equals: isFeaturedFilter }
    if (categoryTypeParam && CATEGORY_TYPES.has(categoryTypeParam.toLowerCase())) where['attributes.categoryType'] = { equals: categoryTypeParam.toLowerCase() }
    if (ageParam && AGE_RESTRICTIONS.has(ageParam.toLowerCase())) where['attributes.ageRestriction'] = { equals: ageParam.toLowerCase() }
    if (parentParam) {
      if (parentParam === 'null' || parentParam === 'top') where.parentCategory = { exists: false }
      else {
        const pid = Number(parentParam)
        if (!Number.isNaN(pid)) where.parentCategory = { equals: pid }
      }
    }
    if (levelParam) {
      const lvl = Number(levelParam)
      if (!Number.isNaN(lvl) && lvl >= 1 && lvl <= 5) where.categoryLevel = { equals: lvl }
    }
    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allForStats, allProducts] = await Promise.all([
      payload.find({ collection: 'product-categories', where: Object.keys(finalWhere).length ? finalWhere : undefined, page, limit, sort, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'product-categories', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'products', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    // productCount per category via products_rels scan (products hasMany categories)
    const productCountByCategory = new Map<string, number>()
    for (const prod of ((allProducts as any).docs as any[]) || []) {
      // products.categories is hasMany relationship — Payload stores via products_rels, but find depth 0 returns array of IDs or objects?
      const cats: any[] = Array.isArray((prod as any).categories) ? (prod as any).categories : []
      for (const c of cats) {
        const cid = typeof c === 'object' ? String((c as any).id ?? c) : String(c)
        if (!cid || cid === 'undefined') continue
        productCountByCategory.set(cid, (productCountByCategory.get(cid) || 0) + 1)
      }
      // also check products_rels style if present
      const rels: any[] = Array.isArray((prod as any).product_categories) ? (prod as any).product_categories : []
      for (const c of rels) {
        const cid = typeof c === 'object' ? String((c as any).id ?? c) : String(c)
        productCountByCategory.set(cid, (productCountByCategory.get(cid) || 0) + 1)
      }
    }

    const docs = (paginated.docs as unknown as Record<string, any>[]).map((d) => sanitizeDoc(d, productCountByCategory.get(String(d.id)) || 0))

    const allDocs = ((allForStats as any).docs as any[]) || []
    const total = allDocs.length
    const activeCount = allDocs.filter((d: any) => d.isActive).length
    const featuredCount = allDocs.filter((d: any) => d.isFeatured).length
    const topLevelCount = allDocs.filter((d: any) => !d.parentCategory).length

    const levelBreakdown: Record<string, number> = {}
    const categoryTypeBreakdown: Record<string, number> = {}
    for (const d of allDocs) {
      const lvl = String(d.categoryLevel ?? 1)
      levelBreakdown[lvl] = (levelBreakdown[lvl] || 0) + 1
      const ct = String(d.attributes?.categoryType || 'other').toLowerCase()
      categoryTypeBreakdown[ct] = (categoryTypeBreakdown[ct] || 0) + 1
    }

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
        total,
        activeCount,
        featuredCount,
        inactiveCount: total - activeCount,
        topLevelCount,
        filteredCount: (paginated as any).totalDocs ?? docs.length,
        levelBreakdown,
        categoryTypeBreakdown,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-ProductCategories-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/product-categories] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load product categories' }, { status: 500 })
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
    let slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''
    if (!slug) slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!slug) return badRequest('slug is required')
    const description = typeof body.description === 'string' ? body.description.trim() || null : null
    const displayOrder = body.displayOrder != null ? Number(body.displayOrder) : 0
    if (Number.isNaN(displayOrder)) return badRequest('displayOrder must be numeric')
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true
    const isFeatured = typeof body.isFeatured === 'boolean' ? body.isFeatured : false

    // parentCategory
    let parentCategory: number | null = null
    if (body.parentCategory != null && body.parentCategory !== '') {
      const pid = Number(body.parentCategory)
      if (Number.isNaN(pid)) return badRequest('parentCategory must be numeric id or null')
      // validate exists
      try {
        const parentDoc = await payload.findByID({ collection: 'product-categories', id: pid, depth: 0, overrideAccess: true }) as any
        if (!parentDoc) return badRequest('parentCategory does not exist')
      } catch { return badRequest('parentCategory does not exist') }
      parentCategory = pid
    }

    // media group
    const media: Record<string, any> = {}
    const icon = body.media?.icon ?? body.icon
    if (icon != null && icon !== '') {
      const nid = Number(icon)
      if (Number.isNaN(nid)) return badRequest('media.icon must be media id or null')
      media.icon = nid
    }
    const bannerImage = body.media?.bannerImage ?? body.bannerImage
    if (bannerImage != null && bannerImage !== '') {
      const nid = Number(bannerImage)
      if (Number.isNaN(nid)) return badRequest('media.bannerImage must be media id or null')
      media.bannerImage = nid
    }
    const thumbnailImage = body.media?.thumbnailImage ?? body.thumbnailImage
    if (thumbnailImage != null && thumbnailImage !== '') {
      const nid = Number(thumbnailImage)
      if (Number.isNaN(nid)) return badRequest('media.thumbnailImage must be media id or null')
      media.thumbnailImage = nid
    }

    // attributes
    const attributes: Record<string, any> = {}
    const catTypeRaw = body.attributes?.categoryType ?? body.categoryType
    if (catTypeRaw != null && catTypeRaw !== '') {
      const ct = String(catTypeRaw).trim().toLowerCase()
      if (!CATEGORY_TYPES.has(ct)) return badRequest(`attributes.categoryType must be one of: ${Array.from(CATEGORY_TYPES).join(', ')}`)
      attributes.categoryType = ct
    }
    const dietaryRaw = body.attributes?.dietaryTags ?? body.dietaryTags
    if (dietaryRaw !== undefined) {
      if (dietaryRaw === null || dietaryRaw === '') attributes.dietaryTags = null
      else if (Array.isArray(dietaryRaw)) {
        const arr = dietaryRaw.map((s: any) => String(s).trim()).filter(Boolean)
        attributes.dietaryTags = arr.length ? arr : null
      } else if (typeof dietaryRaw === 'string') {
        // comma-separated
        const arr = dietaryRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
        attributes.dietaryTags = arr.length ? arr : null
      } else {
        return badRequest('attributes.dietaryTags must be array or comma-separated string')
      }
    }
    const ageRaw = body.attributes?.ageRestriction ?? body.ageRestriction
    if (ageRaw != null && ageRaw !== '') {
      const v = String(ageRaw).trim().toLowerCase()
      if (!AGE_RESTRICTIONS.has(v)) return badRequest(`attributes.ageRestriction must be one of: ${Array.from(AGE_RESTRICTIONS).join(', ')}`)
      attributes.ageRestriction = v
    }
    const reqPrescRaw = body.attributes?.requiresPrescription ?? body.requiresPrescription
    if (reqPrescRaw !== undefined) {
      if (typeof reqPrescRaw === 'boolean') attributes.requiresPrescription = reqPrescRaw
      else if (typeof reqPrescRaw === 'string') {
        const t = reqPrescRaw.trim().toLowerCase()
        if (t === 'true') attributes.requiresPrescription = true
        else if (t === 'false') attributes.requiresPrescription = false
        else return badRequest('attributes.requiresPrescription must be boolean')
      } else return badRequest('attributes.requiresPrescription must be boolean')
    }

    // seo
    const seo: Record<string, any> = {}
    const metaTitle = body.seo?.metaTitle ?? body.metaTitle
    if (metaTitle !== undefined) seo.metaTitle = typeof metaTitle === 'string' ? metaTitle.trim() || null : null
    const metaDesc = body.seo?.metaDescription ?? body.metaDescription
    if (metaDesc !== undefined) seo.metaDescription = typeof metaDesc === 'string' ? metaDesc.trim() || null : null
    const kwRaw = body.seo?.keywords ?? body.keywords
    if (kwRaw !== undefined) {
      if (kwRaw === null || kwRaw === '') seo.keywords = null
      else if (Array.isArray(kwRaw)) {
        const arr = kwRaw.map((s: any) => String(s).trim()).filter(Boolean)
        seo.keywords = arr.length ? arr : null
      } else if (typeof kwRaw === 'string') {
        const arr = kwRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
        seo.keywords = arr.length ? arr : null
      } else return badRequest('seo.keywords must be array or comma-separated string')
    }
    const canon = body.seo?.canonicalUrl ?? body.canonicalUrl
    if (canon !== undefined) {
      if (canon === null || String(canon).trim() === '') seo.canonicalUrl = null
      else {
        const v = String(canon).trim()
        try { new URL(v); seo.canonicalUrl = v } catch { return badRequest('seo.canonicalUrl must be valid URL') }
      }
    }

    const data: Record<string, any> = { name, slug, description, displayOrder, isActive, isFeatured }
    if (parentCategory !== null) data.parentCategory = parentCategory
    if (Object.keys(media).length) data.media = media
    if (Object.keys(attributes).length) data.attributes = attributes
    if (Object.keys(seo).length) data.seo = seo

    let created: Record<string, any>
    try {
      created = await payload.create({ collection: 'product-categories', data: data as any, depth: 1, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create product category'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) return NextResponse.json({ error: 'Duplicate slug: already exists', details: msg }, { status: 409 })
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(created, 0)
    // Bust list cache (all admins / query variants) so the new category shows immediately
    await deleteCachedByPrefix('admin:product-categories:')
    return NextResponse.json({ success: true, message: 'Product category created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/product-categories] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
