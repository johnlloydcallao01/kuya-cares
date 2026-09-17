/**
 * @file apps/cms/src/app/api/vendor/activity/wishlists/route.ts
 * @description BFF aggregation endpoint for web-merchant /activity/wishlists (vendor-scoped, read-only).
 * Follows docs/BFF-pattern.md: backend owns userId -> vendors.user -> merchants.vendor
 * resolution, joins, filtering, pagination and sanitization with overrideAccess:true.
 *
 * GET /api/vendor/activity/wishlists?userId=&page=&limit=&search=&outletId=&itemType=&sort=
 *     -> { docs, pagination, stats, meta }
 *
 * Merchant differences vs admin BFF (admin/customer-activity/wishlists): scope is limited
 * to rows where the vendor's own outlet was saved (itemType=merchant AND merchant in
 * vendor's merchants) or the vendor's own listing was saved (itemType=merchantProduct
 * AND merchantProduct in vendor's merchant-products). Read-only. PII is minimal:
 * id/email/firstName/lastName only — no phone, birthDate, addresses, or wishlists
 * outside the vendor's outlets.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

function str(v: unknown, fb = ''): string {
  return typeof v === 'string' ? v : fb
}
function relId(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  if (typeof v === 'object') {
    const id = (v as Record<string, any>).id
    return relId(id)
  }
  return null
}

function sanitizeCustomerBrief(raw: unknown): { id: number; email: string; firstName: string; lastName: string } | null {
  const id = relId(raw)
  if (id == null) return null
  if (typeof raw !== 'object' || raw === null) return { id, email: '', firstName: '', lastName: '' }
  const u = raw as Record<string, any>
  return {
    id,
    email: str(u.email, ''),
    firstName: str(u.firstName, ''),
    lastName: str(u.lastName, ''),
  }
}

function sanitizeMerchantBrief(raw: unknown): { id: number; outletName: string; outletCode: string } | null {
  const id = relId(raw)
  if (id == null) return null
  if (typeof raw !== 'object' || raw === null) return { id, outletName: `Outlet #${id}`, outletCode: '' }
  const m = raw as Record<string, any>
  return {
    id,
    outletName: str(m.outletName || m.name, `Outlet #${id}`),
    outletCode: str(m.outletCode, ''),
  }
}

const ITEM_TYPES = new Set(['merchant', 'merchantproduct'])
const ALLOWED_SORT = new Set(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt'])

function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

async function resolveVendorContext(payload: any, userId: string) {
  const vendorRes = await payload.find({
    collection: 'vendors',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const vendor = vendorRes.docs[0] as Record<string, any> | undefined
  if (!vendor) return { vendor: null, vendorId: null as number | null, merchantIds: [] as number[], merchants: [] as Record<string, any>[] }
  const vendorId = Number(vendor.id)
  const merchantsRes = await payload.find({
    collection: 'merchants',
    where: { vendor: { equals: vendorId } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const merchantDocs = merchantsRes.docs as Record<string, any>[]
  const merchantIds = merchantDocs.map((m) => Number(m.id)).filter((v) => Number.isFinite(v))
  return { vendor, vendorId, merchantIds, merchants: merchantDocs }
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const authUser = await authenticateVendor(payload, request)
    if (!authUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || String(authUser.id)

    const { vendor, vendorId, merchantIds, merchants } = await resolveVendorContext(payload, userId)
    if (!vendor || vendorId == null) {
      return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    }

    const emptyOut = (page: number, limit: number, stats: Record<string, any> | null = null) => ({
      vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
      merchants: merchants.map((m) => ({ id: Number(m.id), outletName: str(m.outletName || m.name, `Outlet #${m.id}`) })),
      docs: [],
      pagination: { page, limit, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
      stats,
      meta: { generatedAt: new Date().toISOString(), sort: '-createdAt', search: '' },
    })

    if (merchantIds.length === 0) {
      return NextResponse.json(emptyOut(1, 10, null))
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    let sort = (searchParams.get('sort') || '-createdAt').trim()
    if (!ALLOWED_SORT.has(sort)) sort = '-createdAt'

    // Optional outlet filter — must belong to the vendor's own outlets.
    const outletParam = (searchParams.get('outletId') || searchParams.get('merchantId') || '').trim()
    let outletIds = merchantIds
    if (outletParam) {
      const oid = Number(outletParam)
      if (!Number.isFinite(oid) || !merchantIds.includes(oid)) {
        return NextResponse.json({ error: 'Forbidden: outlet does not belong to vendor' }, { status: 403 })
      }
      outletIds = [oid]
    }

    const typeCsv = parseCsv(searchParams.get('itemType') || searchParams.get('item_type'))
    const typeFilter = typeCsv.filter((v) => ITEM_TYPES.has(v))

    // 1. Vendor's listings (for merchantProduct-scoped saves).
    const mpRes = await payload.find({
      collection: 'merchant-products',
      where: { merchant_id: { in: outletIds } } as any,
      limit: 2000,
      depth: 0,
      overrideAccess: true,
      pagination: false,
      context: { skipEffectiveModifierPreview: true },
    } as never)
    const mpDocs = ((mpRes as any).docs as Record<string, any>[]) ?? []
    const scopedMpIds = new Set(mpDocs.map((mp) => Number(mp.id)).filter((v) => Number.isFinite(v)))
    const productIdByMp = new Map<number, number>()
    for (const mp of mpDocs) {
      const pid = relId((mp as any).product_id)
      if (pid != null) productIdByMp.set(Number(mp.id), pid)
    }

    // 2. Product names for listing labels.
    const productIds = Array.from(new Set(productIdByMp.values()))
    const productNameById = new Map<number, { name: string; slug: string }>()
    if (productIds.length > 0) {
      const prodRes = await payload.find({
        collection: 'products',
        where: { id: { in: productIds } } as any,
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any)
      for (const p of (((prodRes as any).docs as Record<string, any>[]) ?? [])) {
        productNameById.set(Number(p.id), { name: str(p.name, `Product #${p.id}`), slug: str(p.slug, '') })
      }
    }

    const merchantById = new Map<number, Record<string, any>>()
    for (const m of merchants) merchantById.set(Number(m.id), m)

    // 3. Wishlists scoped to the vendor's outlets/listings (depth 2 populates user + merchant + merchantProduct).
    const wishlistRes = await payload.find({
      collection: 'wishlists',
      where: {
        or: [
          { and: [{ itemType: { equals: 'merchant' } }, { merchant: { in: outletIds } }] },
          { and: [{ itemType: { equals: 'merchantProduct' } }, { merchantProduct: { in: Array.from(scopedMpIds) } }] },
        ],
      } as any,
      limit: 5000,
      depth: 2,
      overrideAccess: true,
      pagination: false,
    } as any)
    let wishlistDocs = (((wishlistRes as any).docs as Record<string, any>[]) ?? [])

    let enriched = wishlistDocs.map((w) => {
      const itemType = String(w.itemType || 'merchant').toLowerCase()
      const mid = relId(w.merchant)
      const mpid = relId(w.merchantProduct)
      const merchantRaw = (typeof w.merchant === 'object' && w.merchant !== null ? w.merchant : merchantById.get(mid ?? -1)) as Record<string, any> | undefined
      const mpRaw = typeof w.merchantProduct === 'object' && w.merchantProduct !== null ? (w.merchantProduct as Record<string, any>) : undefined
      // Listing's outlet wins for merchantProduct saves (the listing belongs to exactly one outlet).
      const listingMid = mpRaw ? relId((mpRaw as any).merchant_id) : null
      const outlet = sanitizeMerchantBrief(merchantRaw ?? (listingMid != null ? merchantById.get(listingMid) : null) ?? (mid != null ? { id: mid } : null))
      const pid = mpid != null ? productIdByMp.get(mpid) : undefined
      const pinfo = pid != null ? productNameById.get(pid) : undefined
      const mpTitle = mpRaw ? str((mpRaw as any).display_title, '') : ''
      return {
        raw: w,
        itemType,
        customer: sanitizeCustomerBrief(w.user),
        merchant: outlet,
        outletId: outlet?.id ?? null,
        merchantProduct: mpid != null ? { id: mpid, display_title: mpTitle || pinfo?.name || `Listing #${mpid}` } : null,
        product: pid != null ? { id: pid, name: pinfo?.name || `Product #${pid}`, slug: pinfo?.slug || '' } : null,
      }
    }).filter((e) => e.customer != null)

    const totalWishlists = enriched.length

    if (search) {
      enriched = enriched.filter((e) => {
        const c = e.customer!
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${e.merchant?.outletName || ''} ${e.merchantProduct?.display_title || ''} ${e.product?.name || ''}`.toLowerCase()
        return hay.includes(search)
      })
    }
    if (typeFilter.length) {
      enriched = enriched.filter((e) => typeFilter.includes(e.itemType))
    }

    switch (sort) {
      case 'createdAt':
        enriched.sort((a, b) => String(a.raw.createdAt || '').localeCompare(String(b.raw.createdAt || '')))
        break
      case '-updatedAt':
        enriched.sort((a, b) => String(b.raw.updatedAt || '').localeCompare(String(a.raw.updatedAt || '')))
        break
      case 'updatedAt':
        enriched.sort((a, b) => String(a.raw.updatedAt || '').localeCompare(String(b.raw.updatedAt || '')))
        break
      case '-createdAt':
      default:
        enriched.sort((a, b) => String(b.raw.createdAt || '').localeCompare(String(a.raw.createdAt || '')))
        break
    }

    const filteredTotal = enriched.length
    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit))
    const safePage = Math.min(page, totalPages)
    const paged = enriched.slice((safePage - 1) * limit, safePage * limit)

    const uniqueCustomers = new Set<number>()
    const uniqueProducts = new Set<number>()
    const itemTypeSplit: Record<string, number> = { merchant: 0, merchantproduct: 0 }
    const perOutlet = new Map<number, { id: number; outletName: string; count: number }>()
    for (const e of enriched) {
      if (e.customer) uniqueCustomers.add(e.customer.id)
      if (e.product) uniqueProducts.add(e.product.id)
      const t = e.itemType === 'merchantproduct' ? 'merchantproduct' : 'merchant'
      itemTypeSplit[t] = (itemTypeSplit[t] || 0) + 1
      if (e.outletId != null) {
        const prev = perOutlet.get(e.outletId) || { id: e.outletId, outletName: e.merchant?.outletName || `Outlet #${e.outletId}`, count: 0 }
        prev.count += 1
        perOutlet.set(e.outletId, prev)
      }
    }

    return NextResponse.json({
      vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
      merchants: merchants.map((m) => ({ id: Number(m.id), outletName: str(m.outletName || (m as any).name, `Outlet #${m.id}`) })),
      docs: paged.map((e) => ({
        id: Number(e.raw.id),
        customer: e.customer,
        itemType: e.itemType,
        merchant: e.merchant,
        merchantProduct: e.merchantProduct,
        product: e.product,
        createdAt: e.raw.createdAt ? String(e.raw.createdAt) : '',
        updatedAt: e.raw.updatedAt ? String(e.raw.updatedAt) : '',
      })),
      pagination: {
        page: safePage, limit, totalDocs: filteredTotal, totalPages,
        hasNextPage: safePage < totalPages, hasPrevPage: safePage > 1,
      },
      stats: {
        totalWishlists,
        filteredTotal,
        uniqueCustomers: uniqueCustomers.size,
        uniqueProducts: uniqueProducts.size,
        itemTypeSplit,
        perOutlet: Array.from(perOutlet.values()).sort((a, b) => b.count - a.count),
      },
      meta: { generatedAt: new Date().toISOString(), sort, search: searchParams.get('search')?.trim() || '' },
    })
  } catch (err: any) {
    console.error('[vendor/activity/wishlists] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load wishlists' }, { status: 500 })
  }
}
