/**
 * @file apps/cms/src/app/api/vendor/activity/searches/route.ts
 * @description BFF aggregation endpoint for web-merchant /activity/searches (vendor-scoped, read-only).
 * Follows docs/BFF-pattern.md: backend owns userId -> vendors.user -> merchants.vendor
 * resolution, joins, filtering, pagination and sanitization with overrideAccess:true.
 *
 * GET /api/vendor/activity/searches?userId=&page=&limit=&search=&outletId=&scope=&sort=
 *     -> { docs, pagination, stats, meta }
 *
 * Merchant differences vs admin BFF (admin/customer-activity/searches): recent-searches
 * has NO merchant/outlet/product FK (only user + query text), so vendor relevance is
 * derived two ways: (1) the searcher must be a proven customer — someone who ordered
 * at the vendor's outlets (orders bridge, as in vendor/customers); (2) the query text
 * must touch the vendor's catalog (outlet names, product names, listing titles).
 * Rows are aggregated per normalized query (demand signal), not row-per-save.
 * Read-only. PII is minimal: id/email/firstName/lastName only.
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
  const u = raw as Record<string, any>
  return {
    id,
    email: str(u.email, ''),
    firstName: str(u.firstName, ''),
    lastName: str(u.lastName, ''),
  }
}

function tokensOf(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3)
}

const SCOPES = new Set(['restaurants', 'merchant_menu', 'global'])
const ALLOWED_SORT = new Set(['-frequency', 'frequency', '-updatedAt', 'updatedAt', '-createdAt', 'createdAt'])

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
      meta: { generatedAt: new Date().toISOString(), sort: '-frequency', search: '' },
    })

    if (merchantIds.length === 0) {
      return NextResponse.json(emptyOut(1, 10, null))
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10))
    const search = (searchParams.get('search') || '').trim().toLowerCase()
    let sort = (searchParams.get('sort') || '-frequency').trim()
    if (!ALLOWED_SORT.has(sort)) sort = '-frequency'

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

    const scopeCsv = parseCsv(searchParams.get('scope'))
    const scopeFilter = scopeCsv.filter((v) => SCOPES.has(v))

    const merchantById = new Map<number, Record<string, any>>()
    for (const m of merchants) merchantById.set(Number(m.id), m)

    // 1. Catalog vocabulary: outlet names + listing titles + product names.
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

    const outletsById = new Map<number, { id: number; outletName: string }>()
    for (const oid of outletIds) {
      const m = merchantById.get(oid)
      outletsById.set(oid, { id: oid, outletName: m ? str(m.outletName || (m as any).name, `Outlet #${oid}`) : `Outlet #${oid}` })
    }

    const productIdByMp = new Map<number, number>()
    for (const mp of mpDocs) {
      const pid = relId((mp as any).product_id)
      if (pid != null) productIdByMp.set(Number(mp.id), pid)
    }
    const productIds = Array.from(new Set(productIdByMp.values()))
    const productEntries: { id: number; name: string; tokens: string[]; outletIds: number[] }[] = []
    if (productIds.length > 0) {
      const prodRes = await payload.find({
        collection: 'products',
        where: { id: { in: productIds } } as any,
        limit: 2000,
        depth: 0,
        overrideAccess: true,
        pagination: false,
      } as any)
      const outletIdsByProduct = new Map<number, Set<number>>()
      for (const [mpid, pid] of productIdByMp.entries()) {
        const mp = mpDocs.find((d) => Number(d.id) === mpid)
        const mid = mp ? relId((mp as any).merchant_id) : null
        if (mid == null || !outletIds.includes(mid)) continue
        let set = outletIdsByProduct.get(pid)
        if (!set) {
          set = new Set()
          outletIdsByProduct.set(pid, set)
        }
        set.add(mid)
      }
      for (const p of (((prodRes as any).docs as Record<string, any>[]) ?? [])) {
        const pid = Number(p.id)
        const name = str(p.name, '')
        if (!name) continue
        productEntries.push({
          id: pid,
          name,
          tokens: tokensOf(name),
          outletIds: Array.from(outletIdsByProduct.get(pid) || []),
        })
      }
    }
    const listingEntries = mpDocs
      .map((mp) => {
        const title = str((mp as any).display_title, '')
        const mid = relId((mp as any).merchant_id)
        if (!title || mid == null || !outletIds.includes(mid)) return null
        return { id: Number(mp.id), name: title, tokens: tokensOf(title), outletIds: [mid] as number[] }
      })
      .filter((e): e is { id: number; name: string; tokens: string[]; outletIds: number[] } => e !== null)

    // 2. Proven customers: distinct users who ordered at the vendor's outlets.
    const ordersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: outletIds } } as any,
      limit: 5000,
      depth: 2,
      overrideAccess: true,
      pagination: false,
    } as any)
    const provenUserIds = new Set<number>()
    for (const o of (((ordersRes as any).docs as Record<string, any>[]) ?? [])) {
      const c = o.customer
      const uid = typeof c === 'object' && c !== null ? relId((c as any).user) : null
      if (uid != null) provenUserIds.add(uid)
    }

    if (provenUserIds.size === 0) {
      return NextResponse.json(emptyOut(page, limit, {
        totalQueries: 0, filteredTotal: 0, totalSearches: 0, uniqueCustomers: 0, topQueries: [],
      }))
    }

    // 3. Searches by proven customers only (privacy boundary).
    const searchesRes = await payload.find({
      collection: 'recent-searches',
      where: { user: { in: Array.from(provenUserIds) } } as any,
      limit: 5000,
      depth: 1,
      overrideAccess: true,
      pagination: false,
    } as any)
    const searchDocs = (((searchesRes as any).docs as Record<string, any>[]) ?? [])

    // 4. Keep rows touching the vendor's catalog + aggregate per normalized query.
    type Agg = {
      query: string
      normalizedQuery: string
      frequency: number
      userIds: Set<number>
      lastSearchedAt: string
      firstSearchedAt: string
      scope: string
      source: string
      outletIds: Set<number>
      products: Map<number, string>
      customers: Map<number, { id: number; email: string; firstName: string; lastName: string }>
    }
    const byQuery = new Map<string, Agg>()

    const matchOutlets = (nq: string): number[] => {
      const hits: number[] = []
      for (const [oid, o] of outletsById.entries()) {
        const on = o.outletName.toLowerCase()
        if (!on) continue
        if (nq.includes(on) || tokensOf(on).some((t) => nq.includes(t))) hits.push(oid)
      }
      return hits
    }
    const matchEntries = (nq: string, entries: { id: number; name: string; tokens: string[]; outletIds: number[] }[]) => {
      const ids: number[] = []
      const oids = new Set<number>()
      let display = ''
      for (const e of entries) {
        const hit = e.tokens.some((t) => nq.includes(t)) || (e.name && nq.length >= 3 && e.name.toLowerCase().includes(nq))
        if (hit) {
          ids.push(e.id)
          if (!display) display = e.name
          for (const oid of e.outletIds) oids.add(oid)
        }
      }
      return { ids, outletIds: Array.from(oids), display }
    }

    for (const s of searchDocs) {
      const nq = str(s.normalizedQuery, s.query ? String(s.query).toLowerCase().trim() : '').trim()
      if (!nq) continue
      if (scopeFilter.length && !scopeFilter.includes(String(s.scope || 'restaurants').toLowerCase())) continue

      const outletHits = matchOutlets(nq)
      const prodMatch = matchEntries(nq, productEntries)
      const listMatch = matchEntries(nq, listingEntries)
      const allOutletIds = new Set<number>([...outletHits, ...prodMatch.outletIds, ...listMatch.outletIds])
      if (allOutletIds.size === 0) continue

      const uid = relId(s.user)
      let agg = byQuery.get(nq)
      if (!agg) {
        agg = {
          query: str(s.query, nq),
          normalizedQuery: nq,
          frequency: 0,
          userIds: new Set<number>(),
          lastSearchedAt: '',
          firstSearchedAt: '',
          scope: str(s.scope, 'restaurants'),
          source: str(s.source, 'unknown'),
          outletIds: new Set<number>(),
          products: new Map<number, string>(),
          customers: new Map(),
        }
        byQuery.set(nq, agg)
      }
      agg.frequency += num(s.frequency, 1)
      if (uid != null) {
        agg.userIds.add(uid)
        if (!agg.customers.has(uid) && agg.customers.size < 3) {
          const brief = sanitizeCustomerBrief(s.user)
          if (brief) agg.customers.set(uid, brief)
        }
      }
      const upd = s.updatedAt ? String(s.updatedAt) : s.createdAt ? String(s.createdAt) : ''
      const crt = s.createdAt ? String(s.createdAt) : upd
      if (upd && (!agg.lastSearchedAt || upd > agg.lastSearchedAt)) {
        agg.lastSearchedAt = upd
        agg.scope = str(s.scope, agg.scope)
        agg.source = str(s.source, agg.source)
      }
      if (crt && (!agg.firstSearchedAt || crt < agg.firstSearchedAt)) agg.firstSearchedAt = crt
      for (const oid of allOutletIds) agg.outletIds.add(oid)
      for (const pid of prodMatch.ids) {
        if (!agg.products.has(pid)) {
          const e = productEntries.find((x) => x.id === pid)
          agg.products.set(pid, e?.name || `Product #${pid}`)
        }
      }
    }

    let arr = Array.from(byQuery.values())
    const totalQueries = arr.length

    if (search) {
      arr = arr.filter((a) => a.normalizedQuery.includes(search) || a.query.toLowerCase().includes(search))
    }

    switch (sort) {
      case 'frequency':
        arr.sort((a, b) => a.frequency - b.frequency || b.lastSearchedAt.localeCompare(a.lastSearchedAt))
        break
      case '-updatedAt':
        arr.sort((a, b) => b.lastSearchedAt.localeCompare(a.lastSearchedAt))
        break
      case 'updatedAt':
        arr.sort((a, b) => a.lastSearchedAt.localeCompare(b.lastSearchedAt))
        break
      case '-createdAt':
        arr.sort((a, b) => b.firstSearchedAt.localeCompare(a.firstSearchedAt))
        break
      case 'createdAt':
        arr.sort((a, b) => a.firstSearchedAt.localeCompare(b.firstSearchedAt))
        break
      case '-frequency':
      default:
        arr.sort((a, b) => b.frequency - a.frequency || b.lastSearchedAt.localeCompare(a.lastSearchedAt))
        break
    }

    const filteredTotal = arr.length
    const totalPages = Math.max(1, Math.ceil(filteredTotal / limit))
    const safePage = Math.min(page, totalPages)
    const paged = arr.slice((safePage - 1) * limit, safePage * limit)

    let totalSearches = 0
    const allCustomers = new Set<number>()
    for (const a of arr) {
      totalSearches += a.frequency
      for (const uid of a.userIds) allCustomers.add(uid)
    }
    const topQueries = [...arr]
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)
      .map((a) => ({ query: a.query, frequency: a.frequency }))

    return NextResponse.json({
      vendor: { id: String(vendorId), businessName: str((vendor as any).businessName, '') },
      merchants: merchants.map((m) => ({ id: Number(m.id), outletName: str(m.outletName || (m as any).name, `Outlet #${m.id}`) })),
      docs: paged.map((a) => ({
        query: a.query,
        normalizedQuery: a.normalizedQuery,
        frequency: a.frequency,
        uniqueUsers: a.userIds.size,
        lastSearchedAt: a.lastSearchedAt,
        firstSearchedAt: a.firstSearchedAt,
        scope: a.scope,
        source: a.source,
        outlets: Array.from(a.outletIds).map((oid) => {
          const o = outletsById.get(oid)
          return { id: oid, outletName: o?.outletName || `Outlet #${oid}` }
        }),
        products: Array.from(a.products.entries()).map(([id, name]) => ({ id, name })),
        customers: Array.from(a.customers.values()),
      })),
      pagination: {
        page: safePage, limit, totalDocs: filteredTotal, totalPages,
        hasNextPage: safePage < totalPages, hasPrevPage: safePage > 1,
      },
      stats: {
        totalQueries,
        filteredTotal,
        totalSearches,
        uniqueCustomers: allCustomers.size,
        topQueries,
      },
      meta: { generatedAt: new Date().toISOString(), sort, search: searchParams.get('search')?.trim() || '' },
    })
  } catch (err: any) {
    console.error('[vendor/activity/searches] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to load recent searches' }, { status: 500 })
  }
}
