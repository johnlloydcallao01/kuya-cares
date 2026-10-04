/**
 * GET /api/customer/loyalty/catalog?userId=&category=
 * Earn rules + rewards catalog + achievements with live progress.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { PointsService } from '@/services/PointsService'
import { imageUrlOf, relId, resolveCustomer } from '../_shared'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const category = searchParams.get('category')
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

    const rules = await payload.find({
      collection: 'point-rules',
      where: { is_active: { equals: true } },
      sort: 'createdAt',
      pagination: false,
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })

    const rewardWhere: any = { is_active: { equals: true } }
    if (category && category !== 'all') rewardWhere.category = { equals: category }
    const rewards = await payload.find({
      collection: 'rewards',
      where: rewardWhere,
      sort: '-priority',
      pagination: false,
      limit: 100,
      depth: 1,
      overrideAccess: true,
    })

    const defs = await payload.find({
      collection: 'achievements',
      where: { is_active: { equals: true } },
      sort: 'createdAt',
      pagination: false,
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    const userIdNum = relId((customer as any).user)
    const progressRows = userIdNum
      ? await payload.find({
          collection: 'user-achievements',
          where: { user: { equals: Number(userIdNum) || userIdNum } },
          pagination: false,
          limit: 200,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] }
    const progressByDef = new Map<string, any>()
    for (const r of (((progressRows as any)?.docs || []) as any[])) {
      progressByDef.set(String(relId(r.achievement) ?? ''), r)
    }

    // Batched progress (§4: no sequential N+1): defs missing a progress row
    // each needed a metricValue round-trip (count or 2000-doc scan). All
    // misses resolve concurrently — reads only, order-independent.
    const missing = ((((defs as any)?.docs || []) as any[]).filter((def: any) => !progressByDef.get(String(def.id))))
    const measured = await Promise.all(
      missing.map(async (def: any) => {
        try {
          return { id: def.id, progress: Math.floor(await service.metricValue(def.metric, customer.id)) }
        } catch {
          return { id: def.id, progress: 0 }
        }
      }),
    )
    const measuredByDef = new Map<string, number>()
    for (const m of measured) measuredByDef.set(String(m.id), m.progress)

    const achievements: any[] = []
    for (const def of (((defs as any)?.docs || []) as any[])) {
      const row = progressByDef.get(String(def.id))
      const progress = row ? Number(row.progress ?? 0) : (measuredByDef.get(String(def.id)) ?? 0)
      const target = Number(def.target ?? 1)
      achievements.push({
        id: def.id,
        title: def.title,
        description: def.description,
        pointsReward: Math.floor(Number(def.points_reward ?? 0)),
        metric: def.metric,
        target,
        progress,
        progressPct: Math.min(100, Math.round((progress / Math.max(1, target)) * 100)),
        isCompleted: row ? !!row.completed : progress >= target,
        isClaimed: row ? !!row.claimed : false,
        icon: def.icon || 'target',
      })
    }

    return NextResponse.json({
      data: {
        pointsBalance: balance.points,
        earnRules: (((rules as any)?.docs || []) as any[]).map((r: any) => ({
          id: r.id,
          event: r.event,
          points: Math.floor(Number(r.points ?? 0)),
          ratePerPeso: Number(r.rate_per_peso ?? 0),
          minOrderTotal: Number(r.min_order_total ?? 0),
          capPoints: Math.floor(Number(r.cap_points ?? 0)),
        })),
        rewards: (((rewards as any)?.docs || []) as any[]).map((r: any) => {
          const inStock = r.stock === undefined || r.stock === null || Number(r.stock) > 0
          // Coupon-backed rewards inherit coupon validity (zero extra
          // queries — the coupon is already populated at depth:1). Without
          // this, rewards showed Available while redeem auto-claimed an
          // expired/unpublished coupon.
          const coupon = r.coupon && typeof r.coupon === 'object' ? r.coupon : null
          const couponValid =
            !coupon ||
            (coupon.status === 'published' &&
              (!coupon.starts_at || new Date(coupon.starts_at).getTime() <= Date.now()) &&
              (!coupon.expires_at || new Date(coupon.expires_at).getTime() > Date.now()))
          return {
            id: r.id,
            title: r.title,
            description: r.description,
            pointsCost: Math.floor(Number(r.points_cost ?? 0)),
            category: r.category,
            imageUrl: imageUrlOf(r.image),
            stock: r.stock ?? null,
            isAvailable: inStock && couponValid,
            terms: Array.isArray(r.terms) ? r.terms.map((t: any) => t?.term).filter(Boolean) : [],
            hasVoucher: !!relId(r.coupon),
            affordable: balance.points >= Math.floor(Number(r.points_cost ?? 0)),
          }
        }),
        achievements,
      },
    })
  } catch (err: any) {
    console.error('[customer/loyalty/catalog] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
