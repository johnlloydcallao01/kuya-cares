/**
 * @file apps/cms/src/app/api/vendor/customers/emergency-contacts/route.ts
 * @description BFF aggregation endpoint for web-merchant /customers/emergency-contacts (vendor-scoped, read-only).
 * Follows docs/BFF-pattern.md: backend owns userId -> vendors.user -> merchants.vendor
 * resolution, joins, filtering, pagination and sanitization with overrideAccess:true.
 *
 * GET /api/vendor/customers/emergency-contacts?userId=&page=&limit=&search=&outletId=&relationship=&isPrimary=&sort=
 *     -> { docs, pagination, stats, meta }
 *
 * Merchant differences vs admin BFF (admin/emergency-contacts): scope is limited to
 * emergency contacts of customers who placed orders at the vendor's own outlets
 * (emergency-contacts.user -> users, bridged via orders: orders.customer -> customers.user).
 * Read-only: no create/edit/delete, no primary toggling. Least-privilege shape for
 * delivery-emergency use: contact name/relationship/phone + primary flag + owning
 * customer brief + order count — no contact home addresses, no owner account internals.
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

function sanitizeContactDoc(
  raw: Record<string, any>,
  customer: { id: number; email: string; firstName: string; lastName: string } | null,
  ordersCount: number,
): Record<string, any> {
  return {
    id: Number(raw.id),
    firstName: str(raw.firstName, ''),
    lastName: str(raw.lastName, ''),
    relationship: str(raw.relationship, 'other').toLowerCase(),
    contactNumber: str(raw.contactNumber, ''),
    isPrimary: raw.isPrimary === true,
    customer,
    ordersCount,
    createdAt: raw.createdAt ? String(raw.createdAt) : '',
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : '',
  }
}

const RELATIONSHIPS = new Set(['parent', 'spouse', 'sibling', 'child', 'guardian', 'friend', 'relative', 'other'])
const ALLOWED_SORT = new Set(['-createdAt', 'createdAt', '-updatedAt', 'updatedAt', 'firstName', 'lastName', 'relationship'])

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

    const relCsv = parseCsv(searchParams.get('relationship'))
    const relFilter = relCsv.filter((v) => RELATIONSHIPS.has(v))
    const isPrimaryParam = searchParams.get('isPrimary') || searchParams.get('is_primary')
    const isPrimaryFilter = isPrimaryParam === 'true' ? true : isPrimaryParam === 'false' ? false : null

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
        totalContacts: 0, filteredTotal: 0, primaryCount: 0,
        relationshipBreakdown: {}, customersCovered: 0,
      }))
    }

    const scopedUserIds = Array.from(new Set(userIdByCustomer.values()))
    const customerByUser = new Map<number, number>()
    for (const [cid, uid] of userIdByCustomer.entries()) customerByUser.set(uid, cid)

    // 3. Emergency contacts owned by those users.
    const contactsRes = await payload.find({
      collection: 'emergency-contacts',
      where: { user: { in: scopedUserIds } } as any,
      limit: 5000,
      depth: 0,
      overrideAccess: true,
      pagination: false,
    } as any)
    let contactDocs = (((contactsRes as any).docs as Record<string, any>[]) ?? [])

    let enriched = contactDocs.map((c) => {
      const uid = relId(c.user)
      const cid = uid != null ? customerByUser.get(uid) : undefined
      const custRaw = cid != null ? customerById.get(cid) : undefined
      const customer = custRaw ? sanitizeCustomerBrief(custRaw) : cid != null ? { id: cid, email: '', firstName: '', lastName: '' } : null
      return { raw: c, uid, cid, customer, ordersCount: cid != null ? (ordersCountByCustomer.get(cid) || 0) : 0 }
    }).filter((e) => e.customer != null)

    const totalContacts = enriched.length

    if (search) {
      enriched = enriched.filter((e) => {
        const c = e.customer!
        const hay = `${e.raw.firstName || ''} ${e.raw.lastName || ''} ${e.raw.contactNumber || ''} ${e.raw.relationship || ''} ${c.firstName} ${c.lastName} ${c.email}`.toLowerCase()
        return hay.includes(search)
      })
    }
    if (relFilter.length) {
      enriched = enriched.filter((e) => relFilter.includes(String(e.raw.relationship || 'other').toLowerCase()))
    }
    if (isPrimaryFilter !== null) {
      enriched = enriched.filter((e) => (e.raw.isPrimary === true) === isPrimaryFilter)
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
      case 'firstName':
        enriched.sort((a, b) => String(a.raw.firstName || '').localeCompare(String(b.raw.firstName || '')))
        break
      case 'lastName':
        enriched.sort((a, b) => String(a.raw.lastName || '').localeCompare(String(b.raw.lastName || '')))
        break
      case 'relationship':
        enriched.sort((a, b) => String(a.raw.relationship || '').localeCompare(String(b.raw.relationship || '')))
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

    let primaryCount = 0
    const relationshipBreakdown: Record<string, number> = {}
    const coveredCustomers = new Set<number>()
    for (const e of enriched) {
      if (e.raw.isPrimary === true) primaryCount++
      const r = String(e.raw.relationship || 'other').toLowerCase()
      relationshipBreakdown[r] = (relationshipBreakdown[r] || 0) + 1
      if (e.cid != null) coveredCustomers.add(e.cid)
    }

    return NextResponse.json({
      vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
      merchants: merchants.map((m) => ({ id: Number(m.id), outletName: str(m.outletName, `Outlet #${m.id}`) })),
      docs: paged.map((e) => sanitizeContactDoc(e.raw, e.customer, e.ordersCount)),
      pagination: {
        page: safePage, limit, totalDocs: filteredTotal, totalPages,
        hasNextPage: safePage < totalPages, hasPrevPage: safePage > 1,
      },
      stats: {
        totalContacts,
        filteredTotal,
        primaryCount,
        relationshipBreakdown,
        customersCovered: coveredCustomers.size,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search: searchParams.get('search')?.trim() || '' },
    })
  } catch (err: any) {
    console.error('[vendor/customers/emergency-contacts] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load emergency contacts' }, { status: 500 })
  }
}
