/**
 * POST /api/customer/loyalty/achievements { userId, achievementId }
 * Claims a completed achievement (one-shot points grant).
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
    const { userId, achievementId } = body as { userId?: unknown; achievementId?: unknown }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (achievementId == null || String(achievementId) === '') {
      return NextResponse.json({ error: 'achievementId is required' }, { status: 400 })
    }

    const customer = await resolveCustomer(payload, String(userId))
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    const service = new PointsService(payload)
    try {
      const { entry } = await service.claimAchievement(customer.id, achievementId as number | string)
      const balance = await service.getPointsBalance(customer.id)
      return NextResponse.json({
        data: {
          granted: Math.floor(Number(entry.points ?? 0)),
          newBalance: balance.points,
          entryId: entry.id,
        },
      })
    } catch (e: any) {
      const msg = String(e?.message || 'Claim failed')
      const status = msg === 'ACHIEVEMENT_INCOMPLETE' ? 422 : msg === 'ACHIEVEMENT_ALREADY_CLAIMED' ? 409 : 500
      return NextResponse.json({ error: msg, code: msg }, { status })
    }
  } catch (err: any) {
    console.error('[customer/loyalty/achievements] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
