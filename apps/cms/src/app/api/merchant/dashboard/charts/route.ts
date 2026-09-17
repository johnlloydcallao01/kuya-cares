import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
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

const EMPTY_BODY = {
  revenueChart: [],
  orderStatusChart: [],
  topProducts: [],
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const cacheKey = `merchant:dashboard:charts:${userId}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-MerchantDashboard-Cache': 'HIT' } })

    const payload = await getPayload({ config: configPromise })

    const vendorsRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorsRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }
    const vendorId = String(vendor.id)

    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantsDocs = merchantsRes.docs as unknown as Record<string, unknown>[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))

    if (merchantIds.size === 0) {
      await setCached(cacheKey, EMPTY_BODY, 20)
      return NextResponse.json(EMPTY_BODY, { headers: { 'X-MerchantDashboard-Cache': 'MISS' } })
    }

    const ordersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: Array.from(merchantIds) } },
      limit: 1000,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })
    const ordersDocs = ordersRes.docs as unknown as Record<string, unknown>[]

    const orderIds = new Set(ordersDocs.map((o) => String(o.id)))
    const [transactionsRes, orderItemsRes] = await Promise.all([
      payload.find({
        collection: 'transactions',
        where: {
          and: [{ order: { in: Array.from(orderIds) } }, { status: { equals: 'paid' } }],
        },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'order-items',
        where: { order: { in: Array.from(orderIds) } },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      }),
    ])
    const paidTransactions = transactionsRes.docs as unknown as Record<string, unknown>[]
    const orderItemsDocs = orderItemsRes.docs as unknown as Record<string, unknown>[]

    // Single-pass daily bucketing O(N) — same output shape as the monolith's O(30N) loop
    const buckets = new Map<string, { revenue: number; orders: number }>()
    for (const t of paidTransactions) {
      const day = String(t.paid_at ?? '').slice(0, 10)
      if (!day) continue
      const entry = buckets.get(day) ?? { revenue: 0, orders: 0 }
      entry.revenue += getNum(t.amount)
      entry.orders += 1
      buckets.set(day, entry)
    }
    const revenueChart = []
    for (let i = 29; i >= 0; i--) {
      const date = daysAgo(i)
      const entry = buckets.get(date) ?? { revenue: 0, orders: 0 }
      revenueChart.push({ date: formatDate(date), revenue: entry.revenue, orders: entry.orders })
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

    const productSalesMap = new Map<string, { name: string; totalSold: number; revenue: number }>()
    orderItemsDocs.forEach((item) => {
      const productName = getStr(item.product_name_snapshot, 'Unknown Product')
      const quantity = getNum(item.quantity)
      const totalPrice = getNum(item.total_price)
      const existing = productSalesMap.get(productName) || { name: productName, totalSold: 0, revenue: 0 }
      existing.totalSold += quantity
      existing.revenue += totalPrice
      productSalesMap.set(productName, existing)
    })
    const topProducts = Array.from(productSalesMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5)

    const responseBody = { revenueChart, orderStatusChart, topProducts }
    await setCached(cacheKey, responseBody, 300)
    return NextResponse.json(responseBody, { headers: { 'X-MerchantDashboard-Cache': 'MISS' } })
  } catch (error) {
    console.error('Merchant dashboard charts aggregation error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
