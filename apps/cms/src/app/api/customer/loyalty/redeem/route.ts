/**
 * POST /api/customer/loyalty/redeem { userId, rewardId, idempotencyKey? }
 * Burns points for a catalog reward (auto-claims linked voucher).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { PointsService } from '@/services/PointsService'
import { resolveCustomer } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const { userId, rewardId, idempotencyKey } = body as {
      userId?: unknown
      rewardId?: unknown
      idempotencyKey?: unknown
    }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (rewardId == null || String(rewardId) === '') {
      return NextResponse.json({ error: 'rewardId is required' }, { status: 400 })
    }

    const customer = await resolveCustomer(payload, String(userId))
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    const service = new PointsService(payload)
    try {
      const { entry, claimId } = await service.redeemReward(
        customer.id,
        rewardId as number | string,
        typeof idempotencyKey === 'string' ? idempotencyKey : null,
      )
      const balance = await service.getPointsBalance(customer.id)
      return NextResponse.json(
        {
          data: {
            redemptionId: entry.id,
            newBalance: balance.points,
            claimId,
            cost: Math.abs(Math.floor(Number(entry.points ?? 0))),
          },
        },
        { status: 201 },
      )
    } catch (e: any) {
      const msg = String(e?.message || 'Redeem failed')
      const status = msg === 'INSUFFICIENT_POINTS' ? 422 : msg.includes('UNAVAILABLE') || msg.includes('STOCK') ? 409 : 500
      return NextResponse.json({ error: msg, code: msg }, { status })
    }
  } catch (err: any) {
    console.error('[customer/loyalty/redeem] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
