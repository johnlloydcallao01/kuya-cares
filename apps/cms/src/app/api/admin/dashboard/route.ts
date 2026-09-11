import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached } from '@encreasl/cache'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

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

type DashboardResponse = {
  metrics: Record<string, number>
  revenueChart: Array<Record<string, string | number>>
  orderStatusChart: Array<Record<string, string | number>>
  topMerchants: Array<Record<string, string | number>>
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

    const cacheKey = `admin:dashboard:overview:${admin.id}`
    const cached = await getCached<DashboardResponse>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Dashboard-Cache': 'HIT' } })

    const [vendorsRes, merchantsRes, ordersRes, driversRes, customersRes, transactionsRes] = await Promise.all([
      payload.find({ collection: 'vendors', limit: 1000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'merchants', limit: 1000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'orders', limit: 1000, sort: '-createdAt', depth: 1, overrideAccess: true }),
      payload.find({ collection: 'drivers', limit: 1000, depth: 1, overrideAccess: true }),
      payload.find({ collection: 'customers', limit: 1000, overrideAccess: true }),
      payload.find({ collection: 'transactions', limit: 1000, where: { status: { equals: 'paid' } }, depth: 1, overrideAccess: true }),
    ])

    const vendorsDocs = vendorsRes.docs
    const merchantsDocs = merchantsRes.docs
    const ordersDocs = ordersRes.docs as unknown as Record<string, unknown>[]
    const driversDocs = driversRes.docs
    const customersDocs = customersRes.docs
    const paidTransactions = transactionsRes.docs as unknown as Record<string, unknown>[]

    const activeMerchants = merchantsDocs.filter((m: any) => m.isActive === true).length
    const totalRevenue = paidTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)

    const thirtyDaysAgo = daysAgo(30)
    const sixtyDaysAgo = daysAgo(60)
    const recentOrders = ordersDocs.filter((o) => String(o.createdAt ?? '') >= thirtyDaysAgo)
    const previousOrders = ordersDocs.filter((o) => {
      const c = String(o.createdAt ?? '')
      return c >= sixtyDaysAgo && c < thirtyDaysAgo
    })
    const recentTransactions = paidTransactions.filter((t) => {
      const paidAt = String(t.paid_at ?? '')
      return paidAt >= thirtyDaysAgo
    })
    const previousTransactions = paidTransactions.filter((t) => {
      const paidAt = String(t.paid_at ?? '')
      return paidAt >= sixtyDaysAgo && paidAt < thirtyDaysAgo
    })
    const recentRevenue = recentTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)
    const previousRevenue = previousTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)

    const metrics = {
      totalRevenue,
      totalOrders: ordersDocs.length,
      activeMerchants,
      totalCustomers: customersDocs.length,
      totalVendors: vendorsDocs.length,
      revenueChange: previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
      ordersChange: previousOrders.length > 0 ? ((recentOrders.length - previousOrders.length) / previousOrders.length) * 100 : 0,
      merchantsChange: 0,
    }

    const revenueChart = []
    for (let i = 29; i >= 0; i--) {
      const date = daysAgo(i)
      const dayTransactions = paidTransactions.filter((t) => String(t.paid_at ?? '').startsWith(date))
      revenueChart.push({
        date: formatDate(date),
        revenue: dayTransactions.reduce((sum, t) => sum + getNum(t.amount), 0),
        orders: dayTransactions.length,
      })
    }

    const statusMap = new Map<string, number>()
    ordersDocs.forEach((o) => {
      const status = getStr(o.status, 'unknown')
      statusMap.set(status, (statusMap.get(status) || 0) + 1)
    })
    const orderStatusChart = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }))

    const merchantOrderMap = new Map<string, { name: string; orders: number; revenue: number; rating: number }>()
    ordersDocs.forEach((o) => {
      const merchantRaw = o.merchant
      const merchantObj = (merchantRaw && typeof merchantRaw === 'object') ? merchantRaw as Record<string, unknown> : null
      const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
      const merchantName = getStr(merchantObj?.outletName, `Merchant #${merchantId}`)
      if (!merchantId || merchantId === 'undefined') return
      const existing = merchantOrderMap.get(merchantId) || { name: merchantName, orders: 0, revenue: 0, rating: 0 }
      existing.orders += 1
      existing.revenue += getNum(o.total)
      merchantOrderMap.set(merchantId, existing)
    })
    merchantsDocs.forEach((m: any) => {
      const id = String(m.id)
      const existing = merchantOrderMap.get(id)
      if (existing) {
        existing.rating = getNum(m.ratingAverage)
        existing.name = getStr(m.outletName, existing.name)
      }
    })
    const topMerchants = Array.from(merchantOrderMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5)

    const vendorOrderMap = new Map<string, { orders: number; revenue: number }>()
    merchantsDocs.forEach((m: any) => {
      const vendorRaw = m.vendor
      const vendorObj = (vendorRaw && typeof vendorRaw === 'object') ? vendorRaw as Record<string, unknown> : null
      const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
      if (!vendorId || vendorId === 'undefined') return
      const merchantId = String(m.id)
      const merchantData = merchantOrderMap.get(merchantId)
      if (merchantData) {
        const existing = vendorOrderMap.get(vendorId) || { orders: 0, revenue: 0 }
        existing.orders += merchantData.orders
        existing.revenue += merchantData.revenue
        vendorOrderMap.set(vendorId, existing)
      }
    })
    const topVendors = vendorsDocs
      .map((v: any) => {
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

    const recentOrdersList = ordersDocs.slice(0, 10).map((o) => {
      const merchantRaw = o.merchant
      const merchantObj = (merchantRaw && typeof merchantRaw === 'object') ? merchantRaw as Record<string, unknown> : null
      const customerRaw = o.customer
      const customerObj = (customerRaw && typeof customerRaw === 'object') ? customerRaw as Record<string, unknown> : null
      const userRaw = customerObj?.user
      const userObj = (userRaw && typeof userRaw === 'object') ? userRaw as Record<string, unknown> : null

      return {
        id: String(o.id),
        merchantName: getStr(merchantObj?.outletName, 'N/A'),
        customerEmail: getStr(userObj?.email, customerObj ? `Customer #${customerObj.id}` : 'N/A'),
        total: getNum(o.total),
        status: getStr(o.status, 'unknown'),
        createdAt: String(o.createdAt ?? ''),
      }
    })

    const response: DashboardResponse = {
      metrics,
      revenueChart,
      orderStatusChart,
      topMerchants,
      topVendors,
      recentOrders: recentOrdersList,
    }
    await setCached(cacheKey, response, 20)
    return NextResponse.json(response, { headers: { 'X-Dashboard-Cache': 'MISS' } })
    } catch (error) {
      console.error('Dashboard aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
    }
  })
}
