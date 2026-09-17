/**
 * @file apps/cms/src/app/api/vendor/products/route.ts
 * @description BFF aggregation endpoint for web-merchant products list.
 * GET /api/vendor/products?userId=123&merchantId=5&search=pizza&productType=simple&isActive=true&page=1&limit=50
 *
 * Mirrors the outlets BFF (docs/BFF-pattern.md): authenticate vendor JWT, resolve
 * vendor (vendors where user == userId), scope merchants to that vendor (with
 * outlet/vendor context + ownership guards like vendor/addresses), join
 * merchant-products -> products in memory (precedent: admin/merchant-products),
 * return sanitized rows + metrics. Frontend stays thin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

export const dynamic = 'force-dynamic'

function getStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  return fallback
}

function getNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string' && val.trim() !== '') {
    const n = Number(val)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

function relId(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'object' && v !== null && 'id' in (v as Record<string, unknown>)) {
    const n = Number((v as Record<string, unknown>).id)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(v as string | number)
  return Number.isFinite(n) ? n : null
}

function sanitizeMedia(mediaObj: unknown): Record<string, any> | null {
  if (!mediaObj || typeof mediaObj !== 'object') return null
  const obj = mediaObj as Record<string, any>
  const url = getStr(obj.cloudinaryURL || obj.url)
  if (!url) return null
  return { id: Number(obj.id), url, alt: getStr(obj.alt), filename: getStr(obj.filename) }
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
    const merchantParam = searchParams.get('merchantId') || searchParams.get('outletId')
    const vendorParam = searchParams.get('vendorId')
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    const productType = (searchParams.get('productType') || '').trim().toLowerCase()
    const isActiveParam = searchParams.get('isActive')
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit')) || 50))

    // 1. Resolve vendor for user (same as outlets BFF).
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

    // 2. Scope merchants: outlet context (ownership-guarded) | explicit vendor | all vendor merchants.
    let merchantIds: number[] | null = null
    if (merchantParam) {
      const n = Number(merchantParam)
      if (!Number.isFinite(n)) return NextResponse.json({ error: 'merchantId must be numeric' }, { status: 400 })
      let merchant: Record<string, any> | null = null
      try {
        merchant = (await payload.findByID({ collection: 'merchants', id: n, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
      } catch {
        return NextResponse.json({ error: 'Merchant outlet not found' }, { status: 404 })
      }
      if (!merchant) return NextResponse.json({ error: 'Merchant outlet not found' }, { status: 404 })
      if (String(relId(merchant.vendor)) !== String(vendor.id)) {
        return NextResponse.json({ error: 'Forbidden: outlet does not belong to vendor' }, { status: 403 })
      }
      merchantIds = [Number(merchant.id)]
    } else if (vendorParam) {
      const n = Number(vendorParam)
      if (!Number.isFinite(n) || String(n) !== String(vendor.id)) {
        return NextResponse.json({ error: 'Forbidden: vendor does not belong to user' }, { status: 403 })
      }
      merchantIds = null // all merchants below
    }

    if (merchantIds === null) {
      const mRes = await payload.find({
        collection: 'merchants',
        where: { vendor: { equals: vendor.id } },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      merchantIds = (mRes.docs as Record<string, any>[]).map((m) => Number(m.id)).filter((v) => Number.isFinite(v))
    }

    if (merchantIds.length === 0) {
      return NextResponse.json({
        vendor: { id: String(vendor.id), businessName: getStr(vendor.businessName) },
        metrics: { totalListings: 0, activeListings: 0, availableListings: 0, outOfStock: 0, totalProducts: 0 },
        products: [],
        pagination: { page, limit, totalDocs: 0, totalPages: 1 },
      })
    }

    // 3. merchant-products join (precedent: admin/merchant-products bulk loads).
    const mpRes = await payload.find({
      collection: 'merchant-products',
      where: { merchant_id: { in: merchantIds } },
      limit: 2000,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
      context: { skipEffectiveModifierPreview: true },
    } as never)
    const mpDocs = mpRes.docs as unknown as Record<string, any>[]

    // Merchant briefs for rows.
    const merchRes = await payload.find({
      collection: 'merchants',
      where: { id: { in: merchantIds } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchMap = new Map<number, Record<string, any>>()
    for (const m of merchRes.docs as unknown as Record<string, any>[]) merchMap.set(Number(m.id), m)

    // 4. Products map.
    const productIds = Array.from(new Set(mpDocs.map((d) => relId(d.product_id)).filter((v): v is number => v != null)))
    const prodMap = new Map<number, Record<string, any>>()
    if (productIds.length > 0) {
      const prodRes = await payload.find({
        collection: 'products',
        where: { id: { in: productIds } },
        limit: 2000,
        depth: 1,
        overrideAccess: true,
      })
      for (const p of prodRes.docs as unknown as Record<string, any>[]) prodMap.set(Number(p.id), p)
    }

    // 5. Join + filter in memory.
    let rows = mpDocs.map((mp) => {
      const merchantId = relId(mp.merchant_id)
      const productId = relId(mp.product_id)
      const m = merchantId != null ? merchMap.get(merchantId) : undefined
      const p = productId != null ? prodMap.get(productId) : undefined
      const media = p && typeof p.media === 'object' ? (p.media as Record<string, any>) : {}
      return {
        merchantProductId: Number(mp.id),
        merchant: merchantId != null ? { id: merchantId, outletName: getStr(m?.outletName, `Outlet #${merchantId}`), outletCode: getStr(m?.outletCode) } : null,
        product: productId != null
          ? {
              id: productId,
              name: getStr(p?.name, `Product #${productId}`),
              slug: getStr(p?.slug),
              sku: getStr(p?.sku),
              productType: getStr(p?.productType, 'simple'),
              basePrice: getNum(p?.basePrice, 0),
              primaryImage: sanitizeMedia(media?.primaryImage),
            }
          : null,
        priceOverride: mp.price_override ?? null,
        stockQuantity: typeof mp.stock_quantity === 'number' ? mp.stock_quantity : 0,
        isActive: mp.is_active !== false,
        isAvailable: mp.is_available !== false,
        createdAt: getStr(mp.createdAt),
      }
    })

    if (search) {
      rows = rows.filter((r) =>
        `${r.product?.name || ''} ${r.product?.slug || ''} ${r.product?.sku || ''} ${r.merchant?.outletName || ''}`.toLowerCase().includes(search),
      )
    }
    if (productType) {
      rows = rows.filter((r) => String(r.product?.productType || '').toLowerCase() === productType)
    }
    if (isActiveParam != null && isActiveParam !== '') {
      const want = isActiveParam === 'true' || isActiveParam === '1'
      rows = rows.filter((r) => r.isActive === want)
    }

    const totalProducts = new Set(rows.map((r) => r.product?.id).filter((v) => v != null)).size
    const metrics = {
      totalListings: rows.length,
      activeListings: rows.filter((r) => r.isActive).length,
      availableListings: rows.filter((r) => r.isActive && r.isAvailable).length,
      outOfStock: rows.filter((r) => Number(r.stockQuantity) <= 0).length,
      totalProducts,
    }

    const totalPages = Math.max(1, Math.ceil(rows.length / limit))
    const safePage = Math.min(page, totalPages)
    const paged = rows.slice((safePage - 1) * limit, safePage * limit)

    return NextResponse.json({
      vendor: { id: String(vendor.id), businessName: getStr(vendor.businessName) },
      metrics,
      products: paged,
      pagination: { page: safePage, limit, totalDocs: rows.length, totalPages },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch products'
    console.error('[vendor/products] GET error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
