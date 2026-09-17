/**
 * @file apps/cms/src/app/api/vendor/customers/addresses/route.ts
 * @description BFF aggregation endpoint for web-merchant /customers/addresses (vendor-scoped, read-only).
 * Follows docs/BFF-pattern.md: backend owns userId -> vendors.user -> merchants.vendor
 * resolution, joins, filtering, pagination and sanitization with overrideAccess:true.
 *
 * GET /api/vendor/customers/addresses?userId=&page=&limit=&search=&outletId=&address_type=&is_default=&sort=
 *     -> { docs, pagination, stats, meta }
 *
 * Merchant differences vs admin BFF (admin/customers/addresses): scope is limited to
 * delivery addresses of customers who placed orders at the vendor's own outlets
 * (addresses.user -> users, bridged via orders: orders.customer -> customers.user).
 * Read-only: no create/edit/delete, no set-active. Least-privilege shape: delivery
 * fields only — no lat/lng, coordinates, google_place_id, or verification internals.
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
  const c = raw as Record<string, any>
  const u = (typeof c.user === 'object' && c.user !== null ? c.user : {}) as Record<string, any>
  return {
    id,
    email: str(c.email, u ? str(u.email, '') : ''),
    firstName: u ? str(u.firstName, '') : '',
    lastName: u ? str(u.lastName, '') : '',
  }
}

function shortAddressOf(raw: Record<string, any>): string {
  const parts = [raw.barangay, raw.locality, raw.administrative_area_level_1, raw.postal_code]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
  if (parts.length) return parts.join(', ')
  const fa = typeof raw.formatted_address === 'string' ? raw.formatted_address : ''
  return fa.slice(0, 80)
}

function sanitizeAddressDoc(
  raw: Record<string, any>,
  customer: { id: number; email: string; firstName: string; lastName: string } | null,
  customerActiveAddressId: number | null,
  ordersCount: number,
): Record<string, any> {
  const id = Number(raw.id)
  return {
    id,
    formatted_address: str(raw.formatted_address, ''),
    shortAddress: shortAddressOf(raw),
    street: str(raw.street, '') || null,
    floor_unit_room: str(raw.floor_unit_room, '') || null,
    delivery_instructions: str(raw.delivery_instructions, '') || null,
    label: str(raw.label, '') || null,
    barangay: str(raw.barangay, '') || null,
    locality: str(raw.locality, '') || null,
    administrative_area_level_1: str(raw.administrative_area_level_1, '') || null,
    postal_code: str(raw.postal_code, '') || null,
    country: str(raw.country, 'Philippines'),
    address_type: str(raw.address_type, 'home'),
    is_default: typeof raw.is_default === 'boolean' ? raw.is_default : false,
    customer,
    customerActiveAddressId,
    isActiveAddress: customerActiveAddressId != null && customerActiveAddressId === id,
    ordersCount,
    createdAt: raw.createdAt ? String(raw.createdAt) : '',
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : '',
  }
}

const ADDRESS_TYPES = new Set(['home', 'work', 'partner', 'billing', 'shipping', 'pickup', 'delivery'])
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
      merchants: merchants.map((m) => ({ id: Number(m.id), outletName: str(m.outletName, `Outlet #${m.id}`) })),
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

    const typeCsv = parseCsv(searchParams.get('address_type') || searchParams.get('addressType'))
    const typeFilter = typeCsv.filter((v) => ADDRESS_TYPES.has(v))
    const isDefaultParam = searchParams.get('is_default') || searchParams.get('isDefault')
    const isDefaultFilter = isDefaultParam === 'true' ? true : isDefaultParam === 'false' ? false : null

    // 1. Orders at the vendor's outlets (depth 2 populates customer + customer.user).
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

    // 2. Distinct customers -> user ids + per-customer order counts.
    const customerById = new Map<number, Record<string, any>>()
    const userIdByCustomer = new Map<number, number>()
    const ordersCountByCustomer = new Map<number, number>()
    for (const o of orderDocs) {
      const cid = relId(o.customer)
      if (cid == null) continue
      if (typeof o.customer === 'object' && o.customer !== null) customerById.set(cid, o.customer)
      const uid = typeof o.customer === 'object' && o.customer !== null ? relId((o.customer as any).user) : null
      if (uid != null) userIdByCustomer.set(cid, uid)
      ordersCountByCustomer.set(cid, (ordersCountByCustomer.get(cid) || 0) + 1)
    }

    if (userIdByCustomer.size === 0) {
      return NextResponse.json(emptyOut(page, limit, {
        totalAddresses: 0, filteredTotal: 0, defaultCount: 0, activeAddressCount: 0,
        typeBreakdown: {}, topLocalities: [],
      }))
    }

    const scopedUserIds = Array.from(new Set(userIdByCustomer.values()))

    // 3. Customer docs for activeAddress pointers (depth 0 is enough — activeAddress id only).
    const customersRes = await payload.find({
      collection: 'customers',
      where: { id: { in: Array.from(customerById.keys()) } } as any,
      limit: 5000,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    } as any)
    const activeAddressByCustomer = new Map<number, number>()
    for (const c of (((customersRes as any).docs as Record<string, any>[]) ?? [])) {
      const aid = relId(c.activeAddress)
      if (aid != null) activeAddressByCustomer.set(Number(c.id), aid)
    }

    // 4. Addresses owned by those users.
    const addressesRes = await payload.find({
      collection: 'addresses',
      where: { user: { in: scopedUserIds } } as any,
      limit: 5000,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    } as any)
    let addressDocs = (((addressesRes as any).docs as Record<string, any>[]) ?? [])

    // userId -> customerId reverse map for enrichment.
    const customerByUser = new Map<number, number>()
    for (const [cid, uid] of userIdByCustomer.entries()) customerByUser.set(uid, cid)

    let enriched = addressDocs.map((a) => {
      const uid = relId(a.user)
      const cid = uid != null ? customerByUser.get(uid) : undefined
      const custRaw = cid != null ? customerById.get(cid) : undefined
      const customer = custRaw ? sanitizeCustomerBrief(custRaw) : cid != null ? { id: cid, email: '', firstName: '', lastName: '' } : null
      const activeAid = cid != null ? (activeAddressByCustomer.get(cid) ?? null) : null
      return { raw: a, uid, cid, customer, activeAid, ordersCount: cid != null ? (ordersCountByCustomer.get(cid) || 0) : 0 }
    }).filter((e) => e.customer != null)

    const totalAddresses = enriched.length

    if (search) {
      enriched = enriched.filter((e) => {
        const c = e.customer!
        const hay = `${e.raw.formatted_address || ''} ${e.raw.locality || ''} ${e.raw.barangay || ''} ${e.raw.postal_code || ''} ${e.raw.street || ''} ${e.raw.label || ''} ${c.firstName} ${c.lastName} ${c.email}`.toLowerCase()
        return hay.includes(search)
      })
    }
    if (typeFilter.length) {
      enriched = enriched.filter((e) => typeFilter.includes(String(e.raw.address_type || 'home').toLowerCase()))
    }
    if (isDefaultFilter !== null) {
      enriched = enriched.filter((e) => (e.raw.is_default === true) === isDefaultFilter)
    }

    const dir = sort.startsWith('-') ? -1 : 1
    const key = sort.replace(/^-/, '')
    enriched.sort((a, b) => {
      const av = a.raw[key] ? String(a.raw[key]) : ''
      const bv = b.raw[key] ? String(b.raw[key]) : ''
      return av.localeCompare(bv) * dir
    })

    const filteredTotal = enriched.length
    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit))
    const safePage = Math.min(page, totalPages)
    const paged = enriched.slice((safePage - 1) * limit, safePage * limit)

    let defaultCount = 0
    let activeAddressCount = 0
    const typeBreakdown: Record<string, number> = {}
    const localityCount = new Map<string, number>()
    for (const e of enriched) {
      if (e.raw.is_default === true) defaultCount++
      if (e.activeAid != null && e.activeAid === Number(e.raw.id)) activeAddressCount++
      const t = String(e.raw.address_type || 'home').toLowerCase()
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1
      const loc = typeof e.raw.locality === 'string' && e.raw.locality.trim() ? e.raw.locality.trim() : null
      if (loc) localityCount.set(loc, (localityCount.get(loc) || 0) + 1)
    }
    const topLocalities = Array.from(localityCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    return NextResponse.json({
      vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
      merchants: merchants.map((m) => ({ id: Number(m.id), outletName: str(m.outletName, `Outlet #${m.id}`) })),
      docs: paged.map((e) => sanitizeAddressDoc(e.raw, e.customer, e.activeAid, e.ordersCount)),
      pagination: {
        page: safePage, limit, totalDocs: filteredTotal, totalPages,
        hasNextPage: safePage < totalPages, hasPrevPage: safePage > 1,
      },
      stats: { totalAddresses, filteredTotal, defaultCount, activeAddressCount, typeBreakdown, topLocalities },
      meta: { generatedAt: new Date().toISOString(), sort, search: searchParams.get('search')?.trim() || '' },
    })
  } catch (err: any) {
    console.error('[vendor/customers/addresses] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load customer addresses' }, { status: 500 })
  }
}
