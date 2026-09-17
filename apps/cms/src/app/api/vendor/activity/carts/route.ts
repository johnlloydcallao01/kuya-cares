/**
 * @file apps/cms/src/app/api/vendor/activity/carts/route.ts
 * @description BFF aggregation endpoint for web-merchant /activity/carts (vendor-scoped, read-only).
 * Follows docs/BFF-pattern.md: backend owns userId -> vendors.user -> merchants.vendor
 * resolution, joins, filtering, pagination and sanitization with overrideAccess:true.
 *
 * GET /api/vendor/activity/carts?userId=&page=&limit=&search=&outletId=&sort=
 *     -> { docs, pagination, stats, meta }
 *
 * Merchant differences vs admin BFF (admin/customer-activity/carts): scope is limited to
 * abandoned carts at the vendor's own outlets (cart-items.merchant IN vendor's merchants,
 * status == 'abandoned'). Read-only. PII is minimal: id/email/firstName/lastName only —
 * no phone, birthDate, addresses, or carts outside the vendor's outlets. Revenue figures
 * are recoverable sums of abandoned line subtotals, not verified sales.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'

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
  const c = raw as Record<string, any>
  // cart-items.customer -> customers; identity lives on customers.user -> users.
  const u = (typeof c.user === 'object' && c.user !== null ? c.user : {}) as Record<string, any>
  return {
    id,
    email: str(c.email, u ? str(u.email, '') : ''),
    firstName: u ? str(u.firstName, str(c.firstName, '')) : str(c.firstName, ''),
    lastName: u ? str(u.lastName, str(c.lastName, '')) : str(c.lastName, ''),
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

const ALLOWED_SORT = new Set(['-updatedAt', 'updatedAt', '-createdAt', 'createdAt', '-subtotal', 'subtotal', '-quantity', 'quantity'])

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
      meta: { generatedAt: new Date().toISOString(), sort: '-updatedAt', search: '' },
    })

    if (merchantIds.length === 0) {
      return NextResponse.json(emptyOut(1, 10, null))
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    let sort = (searchParams.get('sort') || '-updatedAt').trim()
    if (!ALLOWED_SORT.has(sort)) sort = '-updatedAt'

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

    // 1. Vendor's listings (for listing labels).
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
    const mpTitleById = new Map<number, string>()
    const productIdByMp = new Map<number, number>()
    for (const mp of mpDocs) {
      const mpid = Number(mp.id)
      if (!Number.isFinite(mpid)) continue
      mpTitleById.set(mpid, str(mp.display_title, `Listing #${mpid}`))
      const pid = relId((mp as any).product_id)
      if (pid != null) productIdByMp.set(mpid, pid)
    }

    // 2. Product names for cart line labels.
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

    // 3. Abandoned carts at the vendor's outlets (depth 2 populates customer + merchant + product).
    const cartsRes = await payload.find({
      collection: 'cart-items',
      where: { and: [{ merchant: { in: outletIds } }, { status: { equals: 'abandoned' } }] } as any,
      limit: 5000,
      depth: 2,
      overrideAccess: true,
      pagination: false,
    } as any)
    let cartDocs = (((cartsRes as any).docs as Record<string, any>[]) ?? [])

    let enriched = cartDocs.map((c) => {
      const mid = relId(c.merchant)
      const mpid = relId(c.merchantProduct ?? (c as any).merchant_product)
      const pid = relId(c.product)
      const merchantRaw = (typeof c.merchant === 'object' && c.merchant !== null ? c.merchant : merchantById.get(mid ?? -1)) as Record<string, any> | undefined
      const mpTitle = mpid != null ? (mpTitleById.get(mpid) ?? `Listing #${mpid}`) : null
      const listingPid = mpid != null ? productIdByMp.get(mpid) : undefined
      const pinfo = (pid != null ? productNameById.get(pid) : undefined) ?? (listingPid != null ? productNameById.get(listingPid) : undefined)
      const productName =
        typeof c.product === 'object' && c.product !== null
          ? str((c.product as any).name, pinfo?.name || `Product #${pid ?? '?'}`)
          : (pinfo?.name || (pid != null ? `Product #${pid}` : 'Unknown'));
      return {
        raw: c,
        customer: sanitizeCustomerBrief(c.customer),
        merchant: sanitizeMerchantBrief(merchantRaw ?? (mid != null ? { id: mid } : null)),
        outletId: mid,
        merchantProduct: mpid != null ? { id: mpid, display_title: mpTitle || `Listing #${mpid}` } : null,
        product: { id: pid, name: productName, slug: pinfo?.slug || '' },
        quantity: num(c.quantity, 0),
        subtotal: num(c.subtotal, 0),
        priceAtAdd: num(c.priceAtAdd ?? (c as any).price_at_add, 0),
      }
    }).filter((e) => e.customer != null)

    const totalCarts = enriched.length

    if (search) {
      enriched = enriched.filter((e) => {
        const c = e.customer!
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${e.merchant?.outletName || ''} ${e.merchantProduct?.display_title || ''} ${e.product?.name || ''}`.toLowerCase()
        return hay.includes(search)
      })
    }

    switch (sort) {
      case 'updatedAt':
        enriched.sort((a, b) => String(a.raw.updatedAt || '').localeCompare(String(b.raw.updatedAt || '')))
        break
      case '-createdAt':
        enriched.sort((a, b) => String(b.raw.createdAt || '').localeCompare(String(a.raw.createdAt || '')))
        break
      case 'createdAt':
        enriched.sort((a, b) => String(a.raw.createdAt || '').localeCompare(String(b.raw.createdAt || '')))
        break
      case '-subtotal':
        enriched.sort((a, b) => b.subtotal - a.subtotal)
        break
      case 'subtotal':
        enriched.sort((a, b) => a.subtotal - b.subtotal)
        break
      case '-quantity':
        enriched.sort((a, b) => b.quantity - a.quantity)
        break
      case 'quantity':
        enriched.sort((a, b) => a.quantity - b.quantity)
        break
      case '-updatedAt':
      default:
        enriched.sort((a, b) => String(b.raw.updatedAt || '').localeCompare(String(a.raw.updatedAt || '')))
        break
    }

    const filteredTotal = enriched.length
    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit))
    const safePage = Math.min(page, totalPages)
    const paged = enriched.slice((safePage - 1) * limit, safePage * limit)

    const uniqueCustomers = new Set<number>()
    const uniqueProducts = new Set<number>()
    let recoverableRevenue = 0
    const perOutlet = new Map<number, { id: number; outletName: string; count: number; revenue: number }>()
    for (const e of enriched) {
      if (e.customer) uniqueCustomers.add(e.customer.id)
      if (e.product?.id != null) uniqueProducts.add(e.product.id)
      recoverableRevenue += e.subtotal
      if (e.outletId != null) {
        const prev = perOutlet.get(e.outletId) || { id: e.outletId, outletName: e.merchant?.outletName || `Outlet #${e.outletId}`, count: 0, revenue: 0 }
        prev.count += 1
        prev.revenue = Math.round((prev.revenue + e.subtotal) * 100) / 100
        perOutlet.set(e.outletId, prev)
      }
    }

    return NextResponse.json({
      vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
      merchants: merchants.map((m) => ({ id: Number(m.id), outletName: str(m.outletName || (m as any).name, `Outlet #${m.id}`) })),
      docs: paged.map((e) => ({
        id: Number(e.raw.id),
        customer: e.customer,
        merchant: e.merchant,
        merchantProduct: e.merchantProduct,
        product: e.product,
        quantity: e.quantity,
        subtotal: Math.round(e.subtotal * 100) / 100,
        priceAtAdd: Math.round(e.priceAtAdd * 100) / 100,
        status: str(e.raw.status, 'abandoned'),
        createdAt: e.raw.createdAt ? String(e.raw.createdAt) : '',
        updatedAt: e.raw.updatedAt ? String(e.raw.updatedAt) : '',
      })),
      pagination: {
        page: safePage, limit, totalDocs: filteredTotal, totalPages,
        hasNextPage: safePage < totalPages, hasPrevPage: safePage > 1,
      },
      stats: {
        totalCarts,
        filteredTotal,
        uniqueCustomers: uniqueCustomers.size,
        uniqueProducts: uniqueProducts.size,
        recoverableRevenue: Math.round(recoverableRevenue * 100) / 100,
        perOutlet: Array.from(perOutlet.values()).sort((a, b) => b.revenue - a.revenue),
      },
      meta: { generatedAt: new Date().toISOString(), sort, search: searchParams.get('search')?.trim() || '' },
    })
  } catch (err: any) {
    console.error('[vendor/activity/carts] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load abandoned carts' }, { status: 500 })
  }
}
