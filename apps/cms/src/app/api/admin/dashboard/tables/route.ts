import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached } from '@encreasl/cache'

function getNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || fallback
  return fallback
}

function getStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>
    if ('outletName' in obj) return String(obj.outletName ?? fallback)
    if ('businessName' in obj) return String(obj.businessName ?? fallback)
    if ('email' in obj) return String(obj.email ?? fallback)
  }
  return fallback
}

function idOf(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    return String(obj.id ?? '')
  }
  return String(raw ?? '')
}

type TablesResponse = {
  topVendors: Array<Record<string, string | number>>
  recentOrders: Array<Record<string, string | number>>
}

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const cacheKey = `admin:dashboard:tables:${admin.id}`
      const cached = await getCached<TablesResponse>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-Dashboard-Cache': 'HIT' } })

      // Rollups run on depth: 0 docs (ids only). Only the 10 freshest orders
      // are hydrated with depth: 1 for display names — instead of 1000.
      const [vendorsRes, merchantsRes, ordersRes, recentRes] = await Promise.all([
        payload.find({ collection: 'vendors', limit: 1000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'merchants', limit: 1000, depth: 0, overrideAccess: true }),
        payload.find({
          collection: 'orders',
          limit: 1000,
          sort: '-createdAt',
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({
          collection: 'orders',
          limit: 10,
          sort: '-createdAt',
          depth: 1,
          overrideAccess: true,
        }),
      ])

      const vendorsDocs = vendorsRes.docs as unknown as Record<string, unknown>[]
      const merchantsDocs = merchantsRes.docs as unknown as Record<string, unknown>[]
      const ordersDocs = ordersRes.docs as unknown as Record<string, unknown>[]
      const recentDocs = recentRes.docs as unknown as Record<string, unknown>[]

      const merchantOrderMap = new Map<string, { orders: number; revenue: number }>()
      ordersDocs.forEach((o) => {
        const merchantId = idOf(o.merchant)
        if (!merchantId || merchantId === 'undefined') return
        const existing = merchantOrderMap.get(merchantId) || { orders: 0, revenue: 0 }
        existing.orders += 1
        existing.revenue += getNum(o.total)
        merchantOrderMap.set(merchantId, existing)
      })

      const vendorOrderMap = new Map<string, { orders: number; revenue: number }>()
      merchantsDocs.forEach((m) => {
        const vendorId = idOf(m.vendor)
        if (!vendorId || vendorId === 'undefined') return
        const merchantData = merchantOrderMap.get(String(m.id))
        if (merchantData) {
          const existing = vendorOrderMap.get(vendorId) || { orders: 0, revenue: 0 }
          existing.orders += merchantData.orders
          existing.revenue += merchantData.revenue
          vendorOrderMap.set(vendorId, existing)
        }
      })

      const topVendors = vendorsDocs
        .map((v) => {
          const id = String(v.id)
          const computed = vendorOrderMap.get(id) || { orders: 0, revenue: 0 }
          return {
            id,
            businessName: getStr(v.businessName),
            totalOrders: computed.orders,
            totalMerchants: getNum(v.totalMerchants),
            averageRating: getNum(v.averageRating),
          }
        })
        .sort((a, b) => b.totalOrders - a.totalOrders)
        .slice(0, 5)

      const recentOrders = recentDocs.map((o) => {
        const merchantRaw = o.merchant
        const merchantObj =
          merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as Record<string, unknown>) : null
        const customerRaw = o.customer
        const customerObj =
          customerRaw && typeof customerRaw === 'object' ? (customerRaw as Record<string, unknown>) : null
        const userRaw = customerObj?.user
        const userObj = userRaw && typeof userRaw === 'object' ? (userRaw as Record<string, unknown>) : null

        return {
          id: String(o.id),
          merchantName: getStr(merchantObj?.outletName, 'N/A'),
          customerEmail: getStr(userObj?.email, customerObj ? `Customer #${customerObj.id}` : 'N/A'),
          total: getNum(o.total),
          status: getStr(o.status, 'unknown'),
          createdAt: String(o.createdAt ?? ''),
        }
      })

      const response: TablesResponse = { topVendors, recentOrders }
      await setCached(cacheKey, response, 30)
      return NextResponse.json(response, { headers: { 'X-Dashboard-Cache': 'MISS' } })
    } catch (error) {
      console.error('Dashboard tables aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load dashboard tables' }, { status: 500 })
    }
  })
}
