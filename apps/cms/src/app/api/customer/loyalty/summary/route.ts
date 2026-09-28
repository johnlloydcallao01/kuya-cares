/**
 * GET /api/customer/loyalty/summary?userId=
 * Points balance card: balance, lifetime, this-month, tier, recent.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { PointsService, TIERS } from '@/services/PointsService'
import { resolveCustomer } from '../_shared'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const customer = await resolveCustomer(payload, userId)
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    const service = new PointsService(payload)
    const balance = await service.getPointsBalance(customer.id)
    const tier = await service.tierFor(customer.id)

    // UTC month boundary (matches UTC createdAt; no ±12h drift).
    const now = new Date()
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const monthEarn = await payload.find({
      collection: 'wallet-transactions',
      where: {
        and: [
          { customer: { equals: customer.id } },
          { type: { equals: 'earn' } },
          { createdAt: { greater_than_equal: monthStart.toISOString() } },
          { status: { equals: 'posted' } },
        ],
      },
      pagination: false,
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    const thisMonthEarned = (((monthEarn as any)?.docs || []) as any[]).reduce(
      (s: number, e: any) => s + Math.floor(Number(e.points ?? 0)),
      0,
    )

    const recent = await payload.find({
      collection: 'wallet-transactions',
      where: {
        and: [
          { customer: { equals: customer.id } },
          { type: { in: ['earn', 'redeem', 'expiry'] } },
          { status: { equals: 'posted' } },
        ],
      },
      sort: '-createdAt',
      limit: 10,
      depth: 0,
      overrideAccess: true,
    })

    // Single source of truth: TIERS (no hardcoded ladder copy).
    const idx = TIERS.findIndex((t) => t.name === tier.name)
    const nextTier = idx >= 0 && idx < TIERS.length - 1 ? TIERS[idx + 1] : null

    return NextResponse.json({
      data: {
        customerId: customer.id,
        balance: balance.points,
        lifetimeEarned: balance.earned,
        lifetimeRedeemed: balance.redeemed,
        thisMonthEarned,
        tier: {
          name: tier.name,
          multiplier: tier.multiplier,
          deliveredOrders: tier.deliveredOrders,
          next: nextTier
            ? {
                name: nextTier.name,
                minOrders: nextTier.minOrders,
                multiplier: nextTier.multiplier,
                ordersToNext: Math.max(0, nextTier.minOrders - tier.deliveredOrders),
                progressPct: Math.min(100, Math.round((tier.deliveredOrders / Math.max(1, nextTier.minOrders)) * 100)),
              }
            : null,
        },
        recent: (((recent as any)?.docs || []) as any[]).map((d: any) => ({
          id: d.id,
          type: d.type,
          points: Math.floor(Number(d.points ?? 0)),
          pointsAfter: Math.floor(Number(d.points_balance_after ?? 0)),
          orderId: typeof d.order === 'object' ? d.order?.id : d.order,
          createdAt: d.createdAt,
        })),
      },
    })
  } catch (err: any) {
    console.error('[customer/loyalty/summary] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
