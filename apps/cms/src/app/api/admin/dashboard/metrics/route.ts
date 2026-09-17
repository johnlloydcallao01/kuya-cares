import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached } from '@encreasl/cache'

function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function getNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || fallback
  return fallback
}

function countOf(res: unknown): number {
  const r = res as { totalDocs?: unknown; docs?: unknown }
  if (typeof r.totalDocs === 'number') return r.totalDocs
  if (Array.isArray(r.docs)) return r.docs.length
  return 0
}

type MetricsResponse = {
  metrics: Record<string, number>
}

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const cacheKey = `admin:dashboard:metrics:${admin.id}`
      const cached = await getCached<MetricsResponse>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-Dashboard-Cache': 'HIT' } })

      const thirtyDaysAgoISO = daysAgoISO(30)
      const sixtyDaysAgoISO = daysAgoISO(60)

      // Lightweight counts (limit: 0 -> totalDocs only, no docs hydrated).
      // Revenue sums still need paid-transaction amounts, fetched depth: 0.
      const [
        vendorsCountRes,
        customersCountRes,
        activeMerchantsRes,
        ordersTotalRes,
        recentOrdersRes,
        previousOrdersRes,
        transactionsRes,
      ] = await Promise.all([
        payload.find({ collection: 'vendors', limit: 0, depth: 0, overrideAccess: true, pagination: false } as any),
        payload.find({ collection: 'customers', limit: 0, depth: 0, overrideAccess: true, pagination: false } as any),
        payload.find({
          collection: 'merchants',
          where: { isActive: { equals: true } },
          limit: 0,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any),
        payload.find({ collection: 'orders', limit: 0, depth: 0, overrideAccess: true, pagination: false } as any),
        payload.find({
          collection: 'orders',
          where: { createdAt: { greater_than_equal: thirtyDaysAgoISO } },
          limit: 0,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any),
        payload.find({
          collection: 'orders',
          where: {
            and: [
              { createdAt: { greater_than_equal: sixtyDaysAgoISO } },
              { createdAt: { less_than: thirtyDaysAgoISO } },
            ],
          },
          limit: 0,
          depth: 0,
          overrideAccess: true,
          pagination: false,
        } as any),
        payload.find({
          collection: 'transactions',
          where: { status: { equals: 'paid' } },
          limit: 1000,
          sort: '-createdAt',
          depth: 0,
          overrideAccess: true,
        }),
      ])

      const paidTransactions = transactionsRes.docs as unknown as Record<string, unknown>[]
      const totalRevenue = paidTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)

      // Same 30d/60d windowing semantics as the monolith overview route (JS-side,
      // date-only string compare) so numbers match while data < 1000 docs.
      const thirtyDaysAgo = thirtyDaysAgoISO.split('T')[0]
      const sixtyDaysAgo = sixtyDaysAgoISO.split('T')[0]
      const recentTransactions = paidTransactions.filter((t) => String(t.paid_at ?? '') >= thirtyDaysAgo)
      const previousTransactions = paidTransactions.filter((t) => {
        const paidAt = String(t.paid_at ?? '')
        return paidAt >= sixtyDaysAgo && paidAt < thirtyDaysAgo
      })
      const recentRevenue = recentTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)
      const previousRevenue = previousTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)

      const recentOrdersCount = countOf(recentOrdersRes)
      const previousOrdersCount = countOf(previousOrdersRes)

      const metrics = {
        totalRevenue,
        totalOrders: countOf(ordersTotalRes),
        activeMerchants: countOf(activeMerchantsRes),
        totalCustomers: countOf(customersCountRes),
        totalVendors: countOf(vendorsCountRes),
        revenueChange: previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
        ordersChange: previousOrdersCount > 0 ? ((recentOrdersCount - previousOrdersCount) / previousOrdersCount) * 100 : 0,
        merchantsChange: 0,
      }

      const response: MetricsResponse = { metrics }
      await setCached(cacheKey, response, 60)
      return NextResponse.json(response, { headers: { 'X-Dashboard-Cache': 'MISS' } })
    } catch (error) {
      console.error('Dashboard metrics aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load dashboard metrics' }, { status: 500 })
    }
  })
}
