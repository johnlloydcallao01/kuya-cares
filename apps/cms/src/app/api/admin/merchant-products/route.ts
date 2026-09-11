/**
 * @file apps/cms/src/app/api/admin/merchant-products/route.ts
 * @description BFF for /products page — vendor-encapsulated merchant products (FoodPanda style).
 * GET  /api/admin/merchant-products?page=1&limit=10&search=&vendor=&productType=&isActive=
 * POST /api/admin/merchant-products — create merchant product (assign product to merchant)
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
function sanitizeVendorBrief(v: unknown) {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, any>
  const id = Number(o.id); if (Number.isNaN(id)) return null
  return { id, businessName: String(o.businessName || ''), verificationStatus: String(o.verificationStatus || 'pending'), businessType: String(o.businessType || 'other') }
}
function badRequest(m: string, d?: unknown) { return NextResponse.json({ error: m, details: d }, { status: 400 }) }

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
      .join('&') || 'page=1&limit=10'
    const cacheKey = `admin:merchant-products:${admin.id}:${cacheQuery}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-MerchantProducts-Cache': 'HIT' } })

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = searchParams.get('search')?.trim().toLowerCase() || ''
    const vendorFilter = searchParams.get('vendor') ? Number(searchParams.get('vendor')) : null
    const merchantFilter = searchParams.get('merchant') ? Number(searchParams.get('merchant')) : null
    const productTypeFilter = searchParams.get('productType')?.trim().toLowerCase() || ''
    const isActiveParam = searchParams.get('isActive')
    const isActiveFilter = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : null

    const isUnfiltered = !search && !vendorFilter && !merchantFilter && !productTypeFilter && isActiveFilter === null
    let totalVendorsCount: number | null = null
    let totalMerchantsCount: number | null = null
    let totalMerchantProductsCount: number | null = null
    let activeMerchantsCount: number | null = null
    let vendorsRes: any
    let merchantsRes: any
    let merchantProductsRes: any
    let productsRes: any
    const vendorProductCounts = new Map<string, number>()

    if (isUnfiltered) {
      // The landing page only displays vendor summaries. Page vendors in SQL first,
      // then load relations for those vendors instead of the entire catalog.
      vendorsRes = await payload.find({
        collection: 'vendors', page, limit, sort: 'businessName', depth: 1,
        overrideAccess: true,
      } as any)
      const vendorIds = (vendorsRes.docs || []).map((vendor: any) => vendor.id)
      const [counts, scopedMerchants] = await Promise.all([
        Promise.all([
          payload.find({ collection: 'vendors', limit: 1, depth: 0, overrideAccess: true } as any),
          payload.find({ collection: 'merchants', limit: 1, depth: 0, overrideAccess: true } as any),
          payload.find({ collection: 'merchant-products', limit: 1, depth: 0, overrideAccess: true } as any),
          payload.find({ collection: 'merchants', where: { isActive: { equals: true } }, limit: 1, depth: 0, overrideAccess: true } as any),
        ]),
        vendorIds.length
          ? payload.find({ collection: 'merchants', where: { vendor: { in: vendorIds } }, limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any)
          : Promise.resolve({ docs: [] }),
      ])
      totalVendorsCount = counts[0].totalDocs || 0
      totalMerchantsCount = counts[1].totalDocs || 0
      totalMerchantProductsCount = counts[2].totalDocs || 0
      activeMerchantsCount = counts[3].totalDocs || 0
      merchantsRes = scopedMerchants
      await Promise.all((vendorsRes.docs || []).map(async (vendor: any) => {
        const merchantIds = (merchantsRes.docs || [])
          .filter((merchant: any) => {
            const rawVendor = merchant.vendor
            const merchantVendorId = rawVendor && typeof rawVendor === 'object' ? rawVendor.id : rawVendor
            return String(merchantVendorId) === String(vendor.id)
          })
          .map((merchant: any) => merchant.id)
        if (!merchantIds.length) {
          vendorProductCounts.set(String(vendor.id), 0)
          return
        }
        const result = await payload.find({
          collection: 'merchant-products',
          where: { merchant_id: { in: merchantIds } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        } as any)
        vendorProductCounts.set(String(vendor.id), result.totalDocs || 0)
      }))
      merchantProductsRes = { docs: [] }
      productsRes = { docs: [] }
    } else {
      // Filtered searches currently use the legacy in-memory matcher so their
      // existing vendor/product matching behavior remains unchanged.
      ;[vendorsRes, merchantsRes, merchantProductsRes, productsRes] = await Promise.all([
        payload.find({ collection: 'vendors', limit: 2000, depth: 1, overrideAccess: true, pagination: false } as any),
        payload.find({ collection: 'merchants', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
        payload.find({ collection: 'merchant-products', limit: 5000, depth: 0, overrideAccess: true, pagination: false, context: { skipEffectiveModifierPreview: true } } as any),
        payload.find({ collection: 'products', limit: 2000, depth: 1, overrideAccess: true, pagination: false } as any),
      ])
    }

    const vendorsDocs = (vendorsRes.docs as any[]) || []
    const merchantsDocs = (merchantsRes.docs as any[]) || []
    const merchantProductsDocs = (merchantProductsRes.docs as any[]) || []
    const productsDocs = (productsRes.docs as any[]) || []

    const vendorMap = new Map<string, any>()
    vendorsDocs.forEach((v: any) => vendorMap.set(String(v.id), v))
    const merchantMap = new Map<string, any>()
    merchantsDocs.forEach((m: any) => merchantMap.set(String(m.id), m))
    const productMap = new Map<string, any>()
    productsDocs.forEach((p: any) => productMap.set(String(p.id), p))

    // Build merchant -> vendor lookup
    const merchantToVendor = new Map<string, string>()
    const merchantsByVendor = new Map<string, any[]>()
    merchantsDocs.forEach((m: any) => {
      const vRaw = m.vendor
      const vId = vRaw && typeof vRaw === 'object' ? String((vRaw as any).id ?? '') : String(vRaw ?? '')
      if (vId) {
        merchantToVendor.set(String(m.id), vId)
        const vendorMerchants = merchantsByVendor.get(vId) || []
        vendorMerchants.push(m)
        merchantsByVendor.set(vId, vendorMerchants)
      }
    })
    const productsByMerchant = new Map<string, any[]>()
    merchantProductsDocs.forEach((mp: any) => {
      const raw = mp.merchant_id ?? mp.merchant
      const merchantId = raw && typeof raw === 'object' ? String(raw.id ?? '') : String(raw ?? '')
      if (!merchantId) return
      const merchantProducts = productsByMerchant.get(merchantId) || []
      merchantProducts.push(mp)
      productsByMerchant.set(merchantId, merchantProducts)
    })

    // Filter vendors by search and vendorFilter/merchantFilter
    let filteredVendorIds: Set<string> | null = null
    if (search || vendorFilter || merchantFilter || productTypeFilter || isActiveFilter !== null) {
      // For vendor-grouped view, filter vendors based on search (vendor name) or merchant-products matching search/productType
      const vendorMatched = new Set<string>()
      // Direct vendor search
      if (search) {
        for (const v of vendorsDocs) {
          const hay = `${v.businessName || ''} ${v.legalName || ''}`.toLowerCase()
          if (hay.includes(search)) vendorMatched.add(String(v.id))
        }
      }
      // Merchant-product search: product name/sku (+ merchant filter)
      if (search || productTypeFilter || isActiveFilter !== null || merchantFilter) {
        for (const mp of merchantProductsDocs) {
          const merchantId = ( ()=>{ const raw=(mp as any).merchant_id ?? (mp as any).merchant; return raw && typeof raw==="object" ? String((raw as any).id ?? "") : String(raw ?? "") })()
          if (merchantFilter && Number(merchantId) !== merchantFilter) continue
          const vendorId = merchantToVendor.get(merchantId)
          if (!vendorId) continue
          // Check product match
          const productId = ( ()=>{ const raw=(mp as any).product_id ?? (mp as any).product; return raw && typeof raw==="object" ? String((raw as any).id ?? "") : String(raw ?? "") })()
          const product = productId ? productMap.get(productId) : null
          if (search) {
            const productHay = product ? `${product.name || ''} ${product.slug || ''} ${product.sku || ''}`.toLowerCase() : ''
            const vendorHay = vendorMap.get(vendorId) ? `${vendorMap.get(vendorId).businessName || ''}`.toLowerCase() : ''
            if (!productHay.includes(search) && !vendorHay.includes(search) && !vendorMatched.has(vendorId)) {
              // Check merchant outlet name also
              const merchant = merchantMap.get(merchantId)
              const merchantHay = merchant ? `${merchant.outletName || ''} ${merchant.outletCode || ''}`.toLowerCase() : ''
              if (!merchantHay.includes(search)) continue
            }
          }
          if (productTypeFilter && product) {
            if (String(product.productType || '').toLowerCase() !== productTypeFilter) continue
          }
          if (isActiveFilter !== null && typeof mp.is_active === 'boolean' && mp.is_active !== isActiveFilter) continue
          if (isActiveFilter !== null && typeof mp.isActive === 'boolean' && mp.isActive !== isActiveFilter) continue
          vendorMatched.add(vendorId)
        }
      }
      if (vendorFilter && !Number.isNaN(vendorFilter)) {
        filteredVendorIds = new Set([String(vendorFilter)])
      } else if (merchantFilter && !Number.isNaN(merchantFilter)) {
        const vid = merchantToVendor.get(String(merchantFilter))
        filteredVendorIds = vid ? new Set([vid]) : new Set()
      } else if (search || productTypeFilter || isActiveFilter !== null) {
        filteredVendorIds = vendorMatched
      }
    }

    // Apply vendor filter to vendorsDocs
    let vendorsForPage = filteredVendorIds ? vendorsDocs.filter((v: any) => filteredVendorIds!.has(String(v.id))) : vendorsDocs
    // Sort vendors by businessName
    vendorsForPage.sort((a: any, b: any) => String(a.businessName || '').localeCompare(String(b.businessName || '')))

    const totalVendors = isUnfiltered ? (totalVendorsCount || 0) : vendorsForPage.length
    const totalPages = Math.max(1, Math.ceil(totalVendors / limit))
    const start = (page - 1) * limit
    const pagedVendors = isUnfiltered ? vendorsForPage : vendorsForPage.slice(start, start + limit)

    // Correct grouping: rebuild resultVendors properly
    const finalVendors = pagedVendors.map((vendor: any) => {
      const vendorId = String(vendor.id)
      const vendorMerchants = (merchantsByVendor.get(vendorId) || []).filter((m: any) => !merchantFilter || Number(m.id) === merchantFilter)
      if (isUnfiltered) {
        const totalProducts = vendorProductCounts.get(vendorId) || 0
        return {
          vendor: {
            id: Number(vendor.id),
            businessName: String(vendor.businessName || ''),
            legalName: String(vendor.legalName || ''),
            businessType: String(vendor.businessType || 'other'),
            verificationStatus: String(vendor.verificationStatus || 'pending'),
            isActive: !!vendor.isActive,
            logo: sanitizeMediaRef(vendor.logo),
          },
          merchants: [],
          totalMerchants: vendorMerchants.length,
          totalProducts,
          totalProductsFiltered: totalProducts,
        }
      }
      const merchantsWithProducts = vendorMerchants.map((merchant: any) => {
        const merchantId = String(merchant.id)
        let mps = productsByMerchant.get(merchantId) || []
        if (search) {
          const lower = search.toLowerCase()
          mps = mps.filter((mp: any) => {
            const productId = ( ()=>{ const raw=(mp as any).product_id ?? (mp as any).product; return raw && typeof raw==="object" ? String((raw as any).id ?? "") : String(raw ?? "") })()
            const product = productId ? productMap.get(productId) : null
            const hay = product ? `${product.name || ''} ${product.slug || ''} ${product.sku || ''}`.toLowerCase() : ''
            return hay.includes(lower)
          })
        }
        if (productTypeFilter) {
          mps = mps.filter((mp: any) => {
            const productId = ( ()=>{ const raw=(mp as any).product_id ?? (mp as any).product; return raw && typeof raw==="object" ? String((raw as any).id ?? "") : String(raw ?? "") })()
            const product = productId ? productMap.get(productId) : null
            return product && String(product.productType || '').toLowerCase() === productTypeFilter
          })
        }
        if (isActiveFilter !== null) {
          mps = mps.filter((mp: any) => {
            const val = typeof mp.is_active === 'boolean' ? mp.is_active : typeof mp.isActive === 'boolean' ? mp.isActive : true
            return val === isActiveFilter
          })
        }
        const products = mps.map((mp: any) => {
          const productId = ( ()=>{ const raw=(mp as any).product_id ?? (mp as any).product; return raw && typeof raw==="object" ? String((raw as any).id ?? "") : String(raw ?? "") })()
          const product = productId ? productMap.get(productId) : null
          const prodMedia = product ? sanitizeMediaRef((product.media as any)?.primaryImage) : null
          return {
            merchantProductId: Number(mp.id),
            merchantId: Number(merchantId),
            product: product ? {
              id: Number(product.id),
              name: String(product.name || ''),
              slug: String(product.slug || ''),
              sku: product.sku ? String(product.sku) : null,
              productType: String(product.productType || 'simple'),
              basePrice: product.basePrice != null ? Number(product.basePrice) : null,
              primaryImage: prodMedia,
            } : null,
            price_override: mp.price_override != null ? Number(mp.price_override) : null,
            stock_quantity: mp.stock_quantity != null ? Number(mp.stock_quantity) : null,
            is_active: typeof mp.is_active === 'boolean' ? mp.is_active : typeof mp.isActive === 'boolean' ? mp.isActive : true,
            is_available: typeof mp.is_available === 'boolean' ? mp.is_available : true,
            createdAt: String(mp.createdAt || ''),
          }
        })
        return {
          merchant: {
            id: Number(merchant.id),
            outletName: String(merchant.outletName || ''),
            outletCode: String(merchant.outletCode || ''),
            isActive: !!merchant.isActive,
            isAcceptingOrders: !!merchant.isAcceptingOrders,
            operationalStatus: String(merchant.operationalStatus || 'open'),
          },
          products,
        }
      })

      // Filter out merchants with no products after search filter (to keep vendor visible only if has matching products)
      const filteredMerchants = merchantsWithProducts.filter(m => m.products.length > 0)
      // If search filters products, and vendor has no matching products, vendor will have empty merchantsWithProducts, we keep vendor but with empty (so it will show 0 products)
      const totalProductsForVendor = merchantsWithProducts.reduce((sum, m) => sum + m.products.length, 0)
      const totalProductsFiltered = filteredMerchants.reduce((sum, m) => sum + m.products.length, 0)

      return {
        vendor: {
          id: Number(vendor.id),
          businessName: String(vendor.businessName || ''),
          legalName: String(vendor.legalName || ''),
          businessType: String(vendor.businessType || 'other'),
          verificationStatus: String(vendor.verificationStatus || 'pending'),
          isActive: !!vendor.isActive,
          logo: sanitizeMediaRef(vendor.logo),
        },
        merchants: search || productTypeFilter || isActiveFilter !== null ? filteredMerchants : merchantsWithProducts,
        totalMerchants: vendorMerchants.length,
        totalProducts: totalProductsForVendor,
        totalProductsFiltered,
      }
    })

    // Stats
    const totalVendorsAll = totalVendorsCount ?? vendorsDocs.length
    const totalMerchantsAll = totalMerchantsCount ?? merchantsDocs.length
    const totalMerchantProductsAll = totalMerchantProductsCount ?? merchantProductsDocs.length
    const activeMerchantsAll = activeMerchantsCount ?? merchantsDocs.filter((m: any) => m.isActive).length

    const responseBody = {
      vendors: finalVendors,
      pagination: {
        page,
        limit,
        totalDocs: totalVendors,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      stats: {
        totalVendors: totalVendorsAll,
        totalMerchants: totalMerchantsAll,
        totalMerchantProducts: totalMerchantProductsAll,
        activeMerchants: activeMerchantsAll,
        filteredVendors: totalVendors,
        totalProducts: totalMerchantProductsAll,
      },
      meta: { generatedAt: new Date().toISOString(), search, vendorFilter: vendorFilter ? String(vendorFilter) : null },
    }

    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-MerchantProducts-Cache': 'MISS' } })
  } catch (err: any) {
    console.error('[admin/merchant-products] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load merchant products' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    let body: Record<string, any>
    try { body = await request.json() } catch { return badRequest('Invalid JSON body') }

    const merchantId = body.merchant_id != null ? Number(body.merchant_id) : body.merchant != null ? Number(body.merchant) : body.merchantId != null ? Number(body.merchantId) : NaN
    const productId = body.product_id != null ? Number(body.product_id) : body.product != null ? Number(body.product) : body.productId != null ? Number(body.productId) : NaN
    if (!merchantId || Number.isNaN(merchantId)) return badRequest('merchant_id is required')
    if (!productId || Number.isNaN(productId)) return badRequest('product_id is required')

    // Verify merchant and product exist
    try {
      await payload.findByID({ collection: 'merchants', id: merchantId, depth: 0, overrideAccess: true })
    } catch { return badRequest('merchant not found') }
    try {
      await payload.findByID({ collection: 'products', id: productId, depth: 0, overrideAccess: true })
    } catch { return badRequest('product not found') }

    // Check duplicate
    const existing = await payload.find({
      collection: 'merchant-products',
      where: { and: [{ merchant_id: { equals: merchantId } }, { product_id: { equals: productId } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length) return NextResponse.json({ error: 'Merchant product already exists for this merchant and product', code: 'DUPLICATE' }, { status: 409 })

    const price_override = body.price_override != null && body.price_override !== '' ? Number(body.price_override) : body.priceOverride != null ? Number(body.priceOverride) : null
    if (price_override !== null && (Number.isNaN(price_override) || price_override < 0)) return badRequest('price_override must be >= 0')
    const stock_quantity = body.stock_quantity != null && body.stock_quantity !== '' ? Number(body.stock_quantity) : null
    if (stock_quantity !== null && (Number.isNaN(stock_quantity) || stock_quantity < 0)) return badRequest('stock_quantity must be >= 0')
    const is_active = typeof body.is_active === 'boolean' ? body.is_active : typeof body.isActive === 'boolean' ? body.isActive : true
    const is_available = typeof body.is_available === 'boolean' ? body.is_available : typeof body.isAvailable === 'boolean' ? body.isAvailable : true
    const isActive = typeof body.is_active === 'boolean' ? body.is_active : true // alias

    const data: Record<string, any> = {
      merchant_id: merchantId,
      product_id: productId,
      price_override: price_override ?? undefined,
      stock_quantity: stock_quantity ?? undefined,
      is_active: is_active,
      is_available: is_available,
      isActive: isActive,
    }

    let created: Record<string, any>
    try {
      created = await payload.create({ collection: 'merchant-products', data: data as any, depth: 2, overrideAccess: true }) as unknown as Record<string, any>
    } catch (e: any) {
      const msg = e?.message || 'Failed to create merchant product'
      return NextResponse.json({ error: msg, details: e?.data || e?.errors }, { status: 400 })
    }
    // Bust list cache (all admins / query variants) so the new merchant product shows immediately
    await deleteCachedByPrefix('admin:merchant-products:')
    return NextResponse.json({ success: true, message: 'Merchant product created successfully', doc: created }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/merchant-products] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
