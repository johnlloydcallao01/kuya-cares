/**
 * GET /api/customer/loyalty/membership?userId=
 * Tier card: current tier, multiplier, progress to next, full ladder.
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
    const tier = await service.tierFor(customer.id)
    const idx = TIERS.findIndex((t) => t.name === tier.name)
    const next = idx < TIERS.length - 1 ? TIERS[idx + 1] : null

    return NextResponse.json({
      data: {
        currentTier: tier.name,
        multiplier: tier.multiplier,
        deliveredOrders: tier.deliveredOrders,
        nextTier: next
          ? {
              name: next.name,
              multiplier: next.multiplier,
              ordersRequired: next.minOrders,
              ordersToNext: Math.max(0, next.minOrders - tier.deliveredOrders),
              progressPct: Math.min(100, Math.round((tier.deliveredOrders / Math.max(1, next.minOrders)) * 100)),
            }
          : null,
        tiers: TIERS.map((t) => ({
          name: t.name,
          ordersRequired: t.minOrders,
          multiplier: t.multiplier,
          benefits: [
            `${t.multiplier}x points on every delivered order`,
            ...(t.minOrders > 0 ? [`Unlocks at ${t.minOrders} delivered orders`] : ['Everyone starts here']),
          ],
        })),
      },
    })
  } catch (err: any) {
    console.error('[customer/loyalty/membership] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
