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

function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
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

function merchantIdOf(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    return String(obj.id ?? '')
  }
  return String(raw ?? '')
}

type ChartsResponse = {
  revenueChart: Array<Record<string, string | number>>
  orderStatusChart: Array<Record<string, string | number>>
  topMerchants: Array<Record<string, string | number>>
}

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const cacheKey = `admin:dashboard:charts:${admin.id}`
      const cached = await getCached<ChartsResponse>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-Dashboard-Cache': 'HIT' } })

      const thirtyDaysAgoISO = daysAgoISO(30)

      // depth: 0 everywhere — charts need ids + amounts + statuses, not relations.
      // Revenue is DB-filtered to the 30d window it actually renders.
      const [transactionsRes, ordersRes, merchantsRes] = await Promise.all([
        payload.find({
          collection: 'transactions',
          where: {
            and: [{ status: { equals: 'paid' } }, { paid_at: { greater_than_equal: thirtyDaysAgoISO } }],
          },
          limit: 1000,
          sort: '-createdAt',
          depth: 0,
          overrideAccess: true,
        } as any),
        payload.find({
          collection: 'orders',
          limit: 1000,
          sort: '-createdAt',
          depth: 0,
          overrideAccess: true,
        }),
        payload.find({ collection: 'merchants', limit: 1000, depth: 0, overrideAccess: true }),
      ])

      const paidTransactions = transactionsRes.docs as unknown as Record<string, unknown>[]
      const ordersDocs = ordersRes.docs as unknown as Record<string, unknown>[]
      const merchantsDocs = merchantsRes.docs as unknown as Record<string, unknown>[]

      // Single-pass daily bucketing O(N) — same output shape as the monolith's O(30N) loop.
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

      const merchantOrderMap = new Map<string, { name: string; orders: number; revenue: number; rating: number }>()
      ordersDocs.forEach((o) => {
        const merchantId = merchantIdOf(o.merchant)
        if (!merchantId || merchantId === 'undefined') return
        const existing = merchantOrderMap.get(merchantId) || {
          name: `Merchant #${merchantId}`,
          orders: 0,
          revenue: 0,
          rating: 0,
        }
        existing.orders += 1
        existing.revenue += getNum(o.total)
        merchantOrderMap.set(merchantId, existing)
      })
      merchantsDocs.forEach((m) => {
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

      const response: ChartsResponse = { revenueChart, orderStatusChart, topMerchants }
      await setCached(cacheKey, response, 300)
      return NextResponse.json(response, { headers: { 'X-Dashboard-Cache': 'MISS' } })
    } catch (error) {
      console.error('Dashboard charts aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load dashboard charts' }, { status: 500 })
    }
  })
}
