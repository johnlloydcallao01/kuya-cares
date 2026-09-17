/**
 * @file apps/cms/src/app/api/vendor/customers/route.ts
 * @description BFF aggregation endpoint for web-merchant /customers (vendor-scoped, read-only).
 * Follows docs/BFF-pattern.md: backend owns userId -> vendors.user -> merchants.vendor
 * resolution, joins, filtering, pagination and sanitization with overrideAccess:true.
 *
 * GET /api/vendor/customers?userId=&page=&limit=&search=&outletId=&sort=
 *     -> { docs, pagination, stats, meta }
 *
 * Merchant differences vs admin BFF (admin/customers): scope is limited to customers
 * who placed orders at the vendor's own outlets (derived via orders, the only
 * merchant<->customer link — no junction collection exists). Read-only: no create/
 * edit/delete, no status toggles. PII is minimal: id/email/firstName/lastName plus
 * order aggregates only — no phone, birthDate, addresses, SRN, events, or wishlists.
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

type CustomerAggregate = {
  id: number
  email: string
  firstName: string
  lastName: string
  isActive: boolean | null
  ordersCount: number
  totalSpent: number
  lastOrderDate: string | null
  outletIds: Set<number>
  lastOutlet: { id: number; outletName: string } | null
  createdAt: string
}

const ALLOWED_SORT = new Set([
  '-lastOrderDate',
  'lastOrderDate',
  '-totalSpent',
  'totalSpent',
  '-ordersCount',
  'ordersCount',
  'name',
  '-name',
  '-createdAt',
  'createdAt',
])

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
    if (merchantIds.length === 0) {
      return NextResponse.json({
        vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
        merchants: [],
        docs: [],
        pagination: { page: 1, limit: 10, totalDocs: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        stats: { totalCustomers: 0, filteredTotal: 0, repeatCount: 0, totalRevenue: 0, avgSpent: 0 },
        meta: { generatedAt: new Date().toISOString(), sort: '-lastOrderDate', search: '' },
      })
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    let sort = (searchParams.get('sort') || '-lastOrderDate').trim()
    if (!ALLOWED_SORT.has(sort)) sort = '-lastOrderDate'

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

    // All orders at the vendor's outlets (depth 2 populates customer + customer.user + merchant).
    const ordersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: outletIds } } as any,
      limit: 5000,
      depth: 2,
      sort: '-placed_at',
      overrideAccess: true,
      pagination: false,
    } as any)
    const orderDocs = ((ordersRes as any).docs as Record<string, any>[]) ?? []

    const byCustomer = new Map<number, CustomerAggregate>()
    for (const o of orderDocs) {
      const custRaw = o.customer
      const cid = relId(custRaw)
      if (cid == null) continue
      const c = (typeof custRaw === 'object' ? custRaw : {}) as Record<string, any>
      const u = (typeof c.user === 'object' && c.user !== null ? c.user : {}) as Record<string, any>
      const mid = relId(o.merchant)
      const m = (typeof o.merchant === 'object' && o.merchant !== null ? o.merchant : {}) as Record<string, any>
      const placedAt = o.placed_at ? String(o.placed_at) : o.createdAt ? String(o.createdAt) : null

      let agg = byCustomer.get(cid)
      if (!agg) {
        agg = {
          id: cid,
          email: str(c.email, u ? str(u.email, '') : ''),
          firstName: u ? str(u.firstName, '') : '',
          lastName: u ? str(u.lastName, '') : '',
          isActive: typeof u.isActive === 'boolean' ? u.isActive : null,
          ordersCount: 0,
          totalSpent: 0,
          lastOrderDate: null,
          outletIds: new Set<number>(),
          lastOutlet: null,
          createdAt: c.createdAt ? String(c.createdAt) : o.createdAt ? String(o.createdAt) : '',
        }
        byCustomer.set(cid, agg)
      }
      agg.ordersCount += 1
      agg.totalSpent += num(o.total, 0)
      if (placedAt && (!agg.lastOrderDate || placedAt > agg.lastOrderDate)) {
        agg.lastOrderDate = placedAt
        agg.lastOutlet = mid != null ? { id: mid, outletName: str(m.outletName, `Outlet #${mid}`) } : null
      }
      if (mid != null) agg.outletIds.add(mid)
    }

    let arr = Array.from(byCustomer.values())
    const totalCustomers = arr.length

    if (search) {
      arr = arr.filter((a) =>
        `${a.firstName} ${a.lastName} ${a.email}`.toLowerCase().includes(search),
      )
    }

    const cmpName = (a: CustomerAggregate, b: CustomerAggregate) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`) || a.email.localeCompare(b.email)
    switch (sort) {
      case 'lastOrderDate':
        arr.sort((a, b) => (a.lastOrderDate || '').localeCompare(b.lastOrderDate || ''))
        break
      case '-totalSpent':
        arr.sort((a, b) => b.totalSpent - a.totalSpent)
        break
      case 'totalSpent':
        arr.sort((a, b) => a.totalSpent - b.totalSpent)
        break
      case '-ordersCount':
        arr.sort((a, b) => b.ordersCount - a.ordersCount)
        break
      case 'ordersCount':
        arr.sort((a, b) => a.ordersCount - b.ordersCount)
        break
      case 'name':
        arr.sort(cmpName)
        break
      case '-name':
        arr.sort((a, b) => cmpName(b, a))
        break
      case '-createdAt':
        arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        break
      case 'createdAt':
        arr.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
        break
      case '-lastOrderDate':
      default:
        arr.sort((a, b) => (b.lastOrderDate || '').localeCompare(a.lastOrderDate || ''))
        break
    }

    const filteredTotal = arr.length
    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit))
    const safePage = Math.min(page, totalPages)
    const paged = arr.slice((safePage - 1) * limit, safePage * limit)

    let repeatCount = 0
    let totalRevenue = 0
    for (const a of arr) {
      if (a.ordersCount > 1) repeatCount++
      totalRevenue += a.totalSpent
    }

    return NextResponse.json({
      vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
      merchants: merchants.map((m) => ({
        id: Number(m.id),
        outletName: str(m.outletName, `Outlet #${m.id}`),
        outletCode: str(m.outletCode, ''),
      })),
      docs: paged.map((a) => ({
        id: a.id,
        email: a.email,
        firstName: a.firstName,
        lastName: a.lastName,
        isActive: a.isActive,
        ordersCount: a.ordersCount,
        totalSpent: Math.round(a.totalSpent * 100) / 100,
        lastOrderDate: a.lastOrderDate,
        outletCount: a.outletIds.size,
        lastOutlet: a.lastOutlet,
        createdAt: a.createdAt,
      })),
      pagination: {
        page: safePage,
        limit,
        totalDocs: filteredTotal,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      },
      stats: {
        totalCustomers,
        filteredTotal,
        repeatCount,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        avgSpent: filteredTotal > 0 ? Math.round((totalRevenue / filteredTotal) * 100) / 100 : 0,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search: searchParams.get('search')?.trim() || '' },
    })
  } catch (err: any) {
    console.error('[vendor/customers] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load customers' }, { status: 500 })
  }
}
