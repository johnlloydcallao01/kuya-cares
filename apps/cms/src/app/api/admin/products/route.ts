/**
 * @file apps/cms/src/app/api/admin/products/route.ts
 * @description BFF aggregation for web-admin /products — master catalog.
 * GET  /api/admin/products?page=1&limit=10&search=&productType=simple&isActive=true&catalogVisibility=visible&sort=-createdAt
 * POST /api/admin/products — create product (admin-only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached, deleteCachedByPrefix } from '@encreasl/cache'

function sanitizeMediaRef(v: unknown): { id: number; url: string | null } | null {
  if (!v || typeof v !== 'object') return null
  const s = v as Record<string, unknown>
  const id = Number(s.id); if (Number.isNaN(id)) return null
  const url = typeof s.cloudinaryURL === 'string' ? s.cloudinaryURL : typeof s.url === 'string' ? s.url : null
  return { id, url }
}
function sanitizeDoc(raw: Record<string, any>): Record<string, any> {
  const primaryImage = sanitizeMediaRef((raw.media as any)?.primaryImage)
  const categories = Array.isArray(raw.categories) ? raw.categories.map((c: any) => typeof c === 'object' ? { id: Number(c.id), name: String(c.name || c.title || ''), slug: String(c.slug || '') } : { id: Number(c), name: String(c), slug: '' }) : []
  const vendor = raw.createdByVendor && typeof raw.createdByVendor === 'object' ? { id: Number((raw.createdByVendor as any).id), businessName: String((raw.createdByVendor as any).businessName || '') } : raw.createdByVendor ? { id: Number(raw.createdByVendor), businessName: '' } : null
  const merchant = raw.createdByMerchant && typeof raw.createdByMerchant === 'object' ? { id: Number((raw.createdByMerchant as any).id), outletName: String((raw.createdByMerchant as any).outletName || '') } : null
  return {
    id: raw.id,
    name: String(raw.name || ''),
    slug: String(raw.slug || ''),
    sku: raw.sku ? String(raw.sku) : null,
    productType: String(raw.productType || 'simple'),
    basePrice: raw.basePrice != null ? Number(raw.basePrice) : null,
    compareAtPrice: raw.compareAtPrice != null ? Number(raw.compareAtPrice) : null,
    isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
    catalogVisibility: String(raw.catalogVisibility || 'visible'),
    categories,
    primaryImage,
    shortDescription: raw.shortDescription ? String(raw.shortDescription) : null,
    description: raw.description ?? null,
    vendor,
    merchant,
    assign_to_all_vendor_merchants: !!raw.assign_to_all_vendor_merchants,
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
  }
}
function badRequest(m: string, d?: unknown) { return NextResponse.json({ error: m, details: d }, { status: 400 }) }
function parseCsv(s: string | null): string[] { if (!s) return []; return s.split(',').map(x => x.trim().toLowerCase()).filter(Boolean) }

const PRODUCT_TYPES = new Set(['simple', 'variable', 'grouped'])
const VISIBILITY = new Set(['visible', 'catalog', 'search', 'hidden'])

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const cacheQuery = Array.from(searchParams.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&') || 'page=1&limit=10&sort=-createdAt'
    const cacheKey = `admin:products:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Products-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim() || ''
    const sort = searchParams.get('sort') || '-createdAt'
    const productTypeCsv = parseCsv(searchParams.get('productType'))
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null
    const visibilityCsv = parseCsv(searchParams.get('catalogVisibility'))
    const categoryParam = searchParams.get('category')
    const categoryId = categoryParam ? Number(categoryParam) : null

    const where: Record<string, any> = {}
    const and: any[] = []
    if (search) {
      and.push({
        or: [
          { name: { contains: search } },
          { slug: { contains: search } },
          { sku: { contains: search } },
          { shortDescription: { contains: search } },
        ],
      })
    }
    if (productTypeCsv.length) {
      const filtered = productTypeCsv.filter(v => PRODUCT_TYPES.has(v))
      if (filtered.length) where.productType = { in: filtered }
    }
    if (isActiveFilter !== null) where.isActive = { equals: isActiveFilter }
    if (visibilityCsv.length) {
      const filtered = visibilityCsv.filter(v => VISIBILITY.has(v))
      if (filtered.length) where.catalogVisibility = { in: filtered }
    }
    if (categoryId && !Number.isNaN(categoryId)) where.categories = { contains: categoryId }

    const finalWhere = and.length ? { and: [...and, where] } : where

    const [paginated, allForStats] = await Promise.all([
      payload.find({ collection: 'products', where: Object.keys(finalWhere).length ? finalWhere : undefined, page, limit, sort, depth: 2, overrideAccess: true }),
      payload.find({ collection: 'products', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const allDocs = (allForStats.docs as any[]) || []
    const total = allDocs.length
    const simple = allDocs.filter((d: any) => d.productType === 'simple').length
    const variable = allDocs.filter((d: any) => d.productType === 'variable').length
    const grouped = allDocs.filter((d: any) => d.productType === 'grouped').length
    const activeCount = allDocs.filter((d: any) => d.isActive).length

    const docs = (paginated.docs as unknown as Record<string, any>[]).map(sanitizeDoc)

    const response = {
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
        simple,
        variable,
        grouped,
        activeCount,
        inactiveCount: total - activeCount,
        filteredCount: (paginated as any).totalDocs ?? docs.length,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search },
    }
    await setCached(cacheKey, response, 20)
    return NextResponse.json(response, { headers: { 'X-Products-Cache': 'MISS' } })
    } catch (err: any) {
      console.error('[admin/products] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Failed to load products' }, { status: 500 })
    }
  })
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
    let slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (!slug) slug = name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!slug) return badRequest('slug is required')
    const productTypeRaw = typeof body.productType === 'string' ? body.productType.trim().toLowerCase() : 'simple'
    const productType = PRODUCT_TYPES.has(productTypeRaw) ? productTypeRaw : 'simple'
    const catalogVisibilityRaw = typeof body.catalogVisibility === 'string' ? body.catalogVisibility.trim().toLowerCase() : 'visible'
    const catalogVisibility = VISIBILITY.has(catalogVisibilityRaw) ? catalogVisibilityRaw : 'visible'
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : true
    const shortDescription = typeof body.shortDescription === 'string' ? body.shortDescription.trim().slice(0, 500) || null : null
    const description = body.description ?? null
    const sku = typeof body.sku === 'string' ? body.sku.trim().toUpperCase() || null : null
    const categories = Array.isArray(body.categories) ? body.categories.map((v: any) => Number(v)).filter((n: number) => !Number.isNaN(n)) : null
    const basePrice = body.basePrice != null ? Number(body.basePrice) : null
    const compareAtPrice = body.compareAtPrice != null ? Number(body.compareAtPrice) : null
    if (productType === 'simple' && (basePrice == null || Number.isNaN(basePrice))) return badRequest('basePrice is required for simple products')
    if (basePrice != null && (Number.isNaN(basePrice) || basePrice < 0)) return badRequest('basePrice must be >= 0')
    if (compareAtPrice != null && (Number.isNaN(compareAtPrice) || compareAtPrice < 0)) return badRequest('compareAtPrice must be >= 0')
    const primaryImage = body.primaryImage != null && body.primaryImage !== '' ? Number(body.primaryImage) : body.media?.primaryImage != null && body.media.primaryImage !== '' ? Number(body.media.primaryImage) : null
    if (primaryImage !== null && Number.isNaN(primaryImage)) return badRequest('primaryImage must be media id or null')
    const assign_to_all_vendor_merchants = typeof body.assign_to_all_vendor_merchants === 'boolean' ? body.assign_to_all_vendor_merchants : true

    // Ownership: must have either vendor or merchant — for admin, require vendor if provided, else pick first vendor as fallback
    let createdByVendor: number | null = null
    let createdByMerchant: number | null = null
    if (body.createdByVendor != null && body.createdByVendor !== '') {
      const n = Number(body.createdByVendor)
      if (!Number.isNaN(n)) createdByVendor = n
    } else if (body.vendor != null && body.vendor !== '') {
      const n = Number(body.vendor)
      if (!Number.isNaN(n)) createdByVendor = n
    }
    if (body.createdByMerchant != null && body.createdByMerchant !== '') {
      const n = Number(body.createdByMerchant)
      if (!Number.isNaN(n)) createdByMerchant = n
    }
    if (!createdByVendor && !createdByMerchant) {
      // Fallback: pick first active vendor for admin convenience (so beforeValidate passes)
      try {
        const vRes = await payload.find({ collection: 'vendors', where: { isActive: { equals: true } }, limit: 1, depth: 0, overrideAccess: true })
        if (vRes.docs.length) createdByVendor = (vRes.docs[0] as any).id
      } catch {}
    }
    if (!createdByVendor && !createdByMerchant) return badRequest('Product must be created by either a vendor or merchant — provide vendor id')

    const data: Record<string, any> = {
      name,
      slug,
      productType,
      catalogVisibility,
      isActive,
      shortDescription: shortDescription ?? undefined,
      description: description ?? undefined,
      sku: sku ?? undefined,
      categories: categories ?? undefined,
      basePrice: basePrice ?? undefined,
      compareAtPrice: compareAtPrice ?? undefined,
      assign_to_all_vendor_merchants,
    }
    if (createdByVendor) data.createdByVendor = createdByVendor
    if (createdByMerchant) data.createdByMerchant = createdByMerchant
    if (primaryImage !== null) data.media = { primaryImage }

    let created: Record<string, any>
    try {
      created = await payload.create({ collection: 'products', data: data as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create product'
      const lower = String(msg).toLowerCase()
      if (lower.includes('unique') || lower.includes('duplicate')) {
        const field = lower.includes('slug') ? 'slug' : lower.includes('sku') ? 'sku' : 'slug/sku'
        return NextResponse.json({ error: `Duplicate ${field}: already exists`, details: msg }, { status: 409 })
      }
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    const sanitized = sanitizeDoc(created)
    // Bust list cache (all admins / query variants) so the new product shows immediately
    await deleteCachedByPrefix('admin:products:')
    return NextResponse.json({ success: true, message: 'Product created successfully', doc: sanitized }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/products] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
