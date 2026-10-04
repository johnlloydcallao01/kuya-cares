import type { Payload } from 'payload'
import crypto from 'crypto'
import { createNotificationFanout } from '../utils/notificationFanout'

function relId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in (value as any)) {
    return String((value as any).id)
  }
  return null
}

export type PointsEntryType = 'earn' | 'redeem' | 'expiry'

export interface Tier {
  name: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  minOrders: number
  multiplier: number
}

export const TIERS: Tier[] = [
  { name: 'Bronze', minOrders: 0, multiplier: 1 },
  { name: 'Silver', minOrders: 10, multiplier: 1.25 },
  { name: 'Gold', minOrders: 25, multiplier: 1.5 },
  { name: 'Platinum', minOrders: 50, multiplier: 2 },
]

/**
 * Loyalty points engine (Shopee-style earn-and-burn).
 * Points are an integer currency on the wallet ledger (earn/redeem types).
 * All public methods are idempotent; webhook paths never throw.
 */
export class PointsService {
  constructor(private payload: Payload) {}

  async enabled(): Promise<boolean> {
    try {
      const settings = (await (this.payload as any).findGlobal({ slug: 'system-settings' })) as any
      if (settings && typeof settings === 'object' && 'pointsEnabled' in settings) {
        return settings.pointsEnabled !== false
      }
    } catch {
      /* fail open */
    }
    return true
  }

  async expiryDays(): Promise<number> {
    try {
      const settings = (await (this.payload as any).findGlobal({ slug: 'system-settings' })) as any
      const n = Number(settings?.pointsExpiryDays ?? 365)
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 365
    } catch {
      return 365
    }
  }

  async getOrCreateWallet(customerId: number | string): Promise<any> {
    const existing = await (this.payload as any).find({
      collection: 'wallets',
      where: { customer: { equals: Number(customerId) || customerId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing?.docs?.[0]) return existing.docs[0]
    return (this.payload as any).create({
      collection: 'wallets',
      data: { customer: Number(customerId) || customerId, balance: 0, currency: 'PHP', status: 'active' },
      overrideAccess: true,
    })
  }

  async getPointsBalance(customerId: number | string): Promise<{ points: number; earned: number; redeemed: number; walletId: number | string }> {
    const wallet = await this.getOrCreateWallet(customerId)
    return {
      points: Math.floor(Number(wallet.points_balance ?? 0)),
      earned: Math.floor(Number(wallet.points_earned ?? 0)),
      redeemed: Math.floor(Number(wallet.points_redeemed ?? 0)),
      walletId: wallet.id,
    }
  }

  async activeRule(event: string): Promise<any | null> {
    const res = await (this.payload as any).find({
      collection: 'point-rules',
      where: { and: [{ event: { equals: event } }, { is_active: { equals: true } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return res?.docs?.[0] ?? null
  }

  async deliveredOrdersCount(customerId: number | string): Promise<number> {
    const res = await (this.payload as any).count({
      collection: 'orders',
      where: { and: [{ customer: { equals: customerId } }, { status: { equals: 'delivered' } }] },
    })
    return Number((res as any)?.totalDocs ?? 0) || 0
  }

  async tierFor(customerId: number | string): Promise<Tier & { deliveredOrders: number }> {
    const deliveredOrders = await this.deliveredOrdersCount(customerId)
    let tier = TIERS[0]
    for (const t of TIERS) {
      if (deliveredOrders >= t.minOrders) tier = t
    }
    return { ...tier, deliveredOrders }
  }

  async metricValue(
    metric: string,
    customerId: number | string,
  ): Promise<number> {
    if (metric === 'reviews_count') {
      const res = await (this.payload as any).count({
        collection: 'reviews',
        where: { customer: { equals: customerId } },
      })
      return Number((res as any)?.totalDocs ?? 0) || 0
    }
    if (metric === 'total_spent') {
      const res = await (this.payload as any).find({
        collection: 'orders',
        where: { and: [{ customer: { equals: customerId } }, { status: { equals: 'delivered' } }] },
        pagination: false,
        limit: 2000,
        depth: 0,
        overrideAccess: true,
      })
      return Math.floor((((res as any)?.docs || []) as any[]).reduce((s: number, o: any) => s + Number(o.total ?? 0), 0))
    }
    return this.deliveredOrdersCount(customerId)
  }

  /** Core idempotent points post. Never debits below zero. */
  async postPoints(args: {
    customerId: number | string
    type: PointsEntryType
    points: number
    orderId?: number | string | null
    reviewId?: number | string | null
    rewardId?: number | string | null
    achievementId?: number | string | null
    expiresAt?: string | null
    idempotencyKey?: string | null
    meta?: Record<string, unknown> | null
  }): Promise<any> {
    const points = Math.floor(Number(args.points))
    if (!Number.isFinite(points) || points === 0) {
      throw new Error('Points amount must be a non-zero integer')
    }
    const idempotencyKey = args.idempotencyKey || crypto.randomUUID()

    const dup = await (this.payload as any).find({
      collection: 'wallet-transactions',
      where: { idempotency_key: { equals: idempotencyKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (dup?.docs?.[0]) return dup.docs[0]

    const wallet = await this.getOrCreateWallet(args.customerId)
    if (wallet.status !== 'active') {
      throw new Error(`WALLET_NOT_ACTIVE (status=${wallet.status})`)
    }
    const current = Math.floor(Number(wallet.points_balance ?? 0))
    const next = current + points
    if (next < 0) throw new Error('INSUFFICIENT_POINTS')

    const entry = await (this.payload as any).create({
      collection: 'wallet-transactions',
      data: {
        wallet: wallet.id,
        customer: Number(args.customerId) || args.customerId,
        type: args.type,
        amount: 0,
        balance_after: Number(wallet.balance ?? 0),
        points,
        points_balance_after: next,
        order: args.orderId ? Number(args.orderId) || args.orderId : undefined,
        gateway: 'loyalty',
        idempotency_key: idempotencyKey,
        status: 'posted',
        expires_at: args.expiresAt || undefined,
        meta: {
          ...(args.meta || {}),
          ...(args.reviewId ? { reviewId: String(args.reviewId) } : {}),
          ...(args.rewardId ? { rewardId: String(args.rewardId) } : {}),
          ...(args.achievementId ? { achievementId: String(args.achievementId) } : {}),
        },
      },
      overrideAccess: true,
    })

    const patch: Record<string, unknown> = { points_balance: next }
    if (points > 0) patch.points_earned = Math.floor(Number(wallet.points_earned ?? 0)) + points
    else if (args.type === 'redeem') {
      patch.points_redeemed = Math.floor(Number(wallet.points_redeemed ?? 0)) + Math.abs(points)
    }
    await (this.payload as any).update({
      collection: 'wallets',
      id: wallet.id,
      data: patch,
      overrideAccess: true,
    })

    try {
      const customer = await (this.payload as any).findByID({
        collection: 'customers',
        id: Number(args.customerId) || args.customerId,
        depth: 0,
        overrideAccess: true,
      })
      const userId = relId((customer as any)?.user)
      if (userId) {
        await createNotificationFanout({
          payload: this.payload,
          userId,
          typeKey: `points.${args.type}`,
          domain: args.orderId ? 'order' : 'account',
          priority: 'info',
          title: points > 0 ? `+${points} points earned` : `${points} points redeemed`,
          body:
            points > 0
              ? `You earned ${points} loyalty points. New balance: ${next} pts.`
              : `You spent ${Math.abs(points)} loyalty points. New balance: ${next} pts.`,
          sourceEntityType: 'wallet-transaction',
          sourceEntityId: entry.id,
          metadata: { customerId: String(args.customerId), type: args.type, points, pointsAfter: next },
        })
      }
    } catch (e) {
      console.error('[points] fanout error:', e)
    }

    return entry
  }

  /** Earn on the delivered transition. Best-effort, idempotent. */
  async earnForOrder(orderId: number | string): Promise<void> {
    try {
      if (!(await this.enabled())) return
      const order = (await (this.payload as any).findByID({
        collection: 'orders',
        id: Number(orderId) || orderId,
        depth: 0,
        overrideAccess: true,
      })) as any
      if (!order || order.status !== 'delivered') return
      const customerId = relId(order.customer)
      if (!customerId) return

      const rule = await this.activeRule('order_delivered')
      const days = await this.expiryDays()
      const expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null

      if (rule) {
        const total = Number(order.total ?? 0)
        if (total < Number(rule.min_order_total ?? 0)) return
        const rate = Number(rule.rate_per_peso ?? 0)
        let base = Number(rule.points ?? 0) > 0 ? Math.floor(Number(rule.points)) : Math.floor(total * rate)
        const cap = Number(rule.cap_points ?? 0)
        if (cap > 0) base = Math.min(base, Math.floor(cap))
        if (base > 0) {
          const tier = await this.tierFor(customerId)
          const earn = Math.floor(base * tier.multiplier)
          if (earn > 0) {
            await this.postPoints({
              customerId,
              type: 'earn',
              points: earn,
              orderId,
              expiresAt,
              idempotencyKey: `loyalty-earn:order:${orderId}`,
              meta: { rule: 'order_delivered', tier: tier.name, multiplier: tier.multiplier },
            })
          }
        }
      }

      // First-order bonus (own idempotency namespace).
      const deliveredCount = await this.deliveredOrdersCount(customerId)
      if (deliveredCount === 1) {
        const firstRule = await this.activeRule('first_order')
        if (firstRule && Number(firstRule.points ?? 0) > 0) {
          await this.postPoints({
            customerId,
            type: 'earn',
            points: Math.floor(Number(firstRule.points)),
            orderId,
            expiresAt,
            idempotencyKey: `loyalty-earn:first-order:${customerId}`,
            meta: { rule: 'first_order' },
          })
        }
      }

      await this.refreshAchievements(customerId)
    } catch (e) {
      console.error('[points] earnForOrder error:', e)
    }
  }

  /** Review bonus. Best-effort, idempotent per review. */
  async earnForReview(reviewId: number | string): Promise<void> {
    try {
      if (!(await this.enabled())) return
      const review = (await (this.payload as any).findByID({
        collection: 'reviews',
        id: Number(reviewId) || reviewId,
        depth: 0,
        overrideAccess: true,
      })) as any
      if (!review) return
      const customerId = relId(review.customer)
      if (!customerId) return
      const rule = await this.activeRule('review')
      const fixed = Math.floor(Number(rule?.points ?? 0))
      if (!rule || fixed <= 0) return
      const days = await this.expiryDays()
      await this.postPoints({
        customerId,
        type: 'earn',
        points: fixed,
        orderId: relId(review.order),
        reviewId,
        expiresAt: days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null,
        idempotencyKey: `loyalty-earn:review:${reviewId}`,
        meta: { rule: 'review' },
      })
      await this.refreshAchievements(customerId)
    } catch (e) {
      console.error('[points] earnForReview error:', e)
    }
  }

  /** Burn points for a catalog reward (optionally auto-claims a voucher). */
  async redeemReward(
    customerId: number | string,
    rewardId: number | string,
    idempotencyKey?: string | null,
  ): Promise<{ entry: any; claimId?: number | string | null }> {
    if (!(await this.enabled())) throw new Error('POINTS_DISABLED')
    const reward = (await (this.payload as any).findByID({
      collection: 'rewards',
      id: Number(rewardId) || rewardId,
      depth: 1,
      overrideAccess: true,
    })) as any
    if (!reward || reward.is_active === false) throw new Error('REWARD_UNAVAILABLE')
    const cost = Math.floor(Number(reward.points_cost ?? 0))
    if (!Number.isFinite(cost) || cost <= 0) throw new Error('REWARD_UNAVAILABLE')
    if (reward.stock !== undefined && reward.stock !== null && Number(reward.stock) <= 0) {
      throw new Error('REWARD_OUT_OF_STOCK')
    }
    // Linked-coupon validity (mirrors catalog isAvailable): never burn
    // points for a reward whose auto-claimed coupon is unpublished or
    // outside its window. The coupon is already populated (depth:1 above).
    const coupon = (reward as any).coupon
    if (coupon && typeof coupon === 'object') {
      const now = Date.now()
      const started = !coupon.starts_at || new Date(coupon.starts_at).getTime() <= now
      const unexpired = !coupon.expires_at || new Date(coupon.expires_at).getTime() > now
      if (coupon.status !== 'published' || !started || !unexpired) {
        throw new Error('REWARD_UNAVAILABLE')
      }
    }

    const entry = await this.postPoints({
      customerId,
      type: 'redeem',
      points: -cost,
      rewardId,
      idempotencyKey: idempotencyKey || undefined,
      meta: { rewardTitle: reward.title },
    })

    if (reward.stock !== undefined && reward.stock !== null) {
      await (this.payload as any)
        .update({
          collection: 'rewards',
          id: reward.id,
          data: { stock: Math.max(0, Number(reward.stock) - 1) },
          overrideAccess: true,
        })
        .catch(() => {})
    }

    let claimId: number | string | null = null
    const couponId = relId(reward.coupon)
    if (couponId) {
      try {
        const existing = await (this.payload as any).find({
          collection: 'coupon-claims',
          where: {
            and: [{ coupon: { equals: couponId } }, { customer: { equals: customerId } }, { status: { not_equals: 'cancelled' } }],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existing?.docs?.[0]) {
          claimId = existing.docs[0].id
        } else {
          const created = await (this.payload as any).create({
            collection: 'coupon-claims',
            data: { coupon: Number(couponId) || couponId, customer: Number(customerId) || customerId, status: 'claimed' },
            overrideAccess: true,
          })
          claimId = (created as any).id
        }
      } catch (e) {
        console.error('[points] reward voucher claim error:', e)
      }
    }

    return { entry, claimId }
  }

  /** Refresh progress rows; auto-complete only (points granted on claim). */
  async refreshAchievements(customerId: number | string): Promise<void> {
    try {
      const customer = await (this.payload as any).findByID({
        collection: 'customers',
        id: Number(customerId) || customerId,
        depth: 0,
        overrideAccess: true,
      })
      const userId = relId((customer as any)?.user)
      if (!userId) return
      const defs = await (this.payload as any).find({
        collection: 'achievements',
        where: { is_active: { equals: true } },
        pagination: false,
        limit: 100,
        depth: 0,
        overrideAccess: true,
      })
      for (const def of (((defs as any)?.docs || []) as any[])) {
        const progress = Math.floor(await this.metricValue(def.metric, customerId))
        const { docs } = await (this.payload as any).find({
          collection: 'user-achievements',
          where: { and: [{ user: { equals: userId } }, { achievement: { equals: def.id } }] },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const row = docs[0]
        const completed = progress >= Number(def.target ?? 0)
        if (!row) {
          await (this.payload as any).create({
            collection: 'user-achievements',
            data: {
              user: Number(userId) || userId,
              achievement: def.id,
              progress,
              target: Number(def.target ?? 1),
              completed,
              claimed: false,
              completed_at: completed ? new Date().toISOString() : undefined,
            },
            overrideAccess: true,
          })
        } else if (Number(row.progress) !== progress || (!!row.completed !== completed)) {
          await (this.payload as any).update({
            collection: 'user-achievements',
            id: row.id,
            data: {
              progress,
              completed,
              completed_at: completed ? row.completed_at || new Date().toISOString() : undefined,
            },
            overrideAccess: true,
          })
        }
      }
    } catch (e) {
      console.error('[points] refreshAchievements error:', e)
    }
  }

  /** Claim a completed achievement (one-shot points grant). */
  async claimAchievement(customerId: number | string, achievementId: number | string): Promise<{ entry: any }> {
    const customer = await (this.payload as any).findByID({
      collection: 'customers',
      id: Number(customerId) || customerId,
      depth: 0,
      overrideAccess: true,
    })
    const userId = relId((customer as any)?.user)
    if (!userId) throw new Error('NO_CUSTOMER')
    const def = (await (this.payload as any).findByID({
      collection: 'achievements',
      id: Number(achievementId) || achievementId,
      depth: 0,
      overrideAccess: true,
    })) as any
    if (!def || def.is_active === false) throw new Error('ACHIEVEMENT_UNAVAILABLE')

    await this.refreshAchievements(customerId)
    const { docs } = await (this.payload as any).find({
      collection: 'user-achievements',
      where: { and: [{ user: { equals: userId } }, { achievement: { equals: def.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const row = docs[0]
    if (!row || !row.completed) throw new Error('ACHIEVEMENT_INCOMPLETE')
    if (row.claimed) throw new Error('ACHIEVEMENT_ALREADY_CLAIMED')

    const days = await this.expiryDays()
    const entry = await this.postPoints({
      customerId,
      type: 'earn',
      points: Math.floor(Number(def.points_reward ?? 0)),
      achievementId: def.id,
      expiresAt: days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null,
      idempotencyKey: `loyalty-earn:achievement:${row.id}`,
      meta: { rule: 'achievement', title: def.title },
    })
    await (this.payload as any).update({
      collection: 'user-achievements',
      id: row.id,
      data: { claimed: true },
      overrideAccess: true,
    })
    return { entry }
  }

  /**
   * FIFO expiry sweep: oldest earn lots first, burned points consume oldest
   * lots first. Bounded per run; idempotent via loyalty-expire:{lotId} keys.
   */
  async sweepExpiring(maxLots = 200): Promise<{ lotsSwept: number; pointsExpired: number }> {
    let lotsSwept = 0
    let pointsExpired = 0
    const nowIso = new Date().toISOString()
    const wallets = await (this.payload as any).find({
      collection: 'wallets',
      where: { points_balance: { greater_than: 0 } },
      pagination: false,
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    for (const wallet of (((wallets as any)?.docs || []) as any[])) {
      const lots = await (this.payload as any).find({
        collection: 'wallet-transactions',
        where: {
          and: [
            { wallet: { equals: wallet.id } },
            { type: { equals: 'earn' } },
            { points: { greater_than: 0 } },
            { expires_at: { less_than: nowIso } },
            { status: { equals: 'posted' } },
          ],
        },
        sort: 'createdAt',
        pagination: false,
        limit: maxLots,
        depth: 0,
        overrideAccess: true,
      })
      const docs = (((lots as any)?.docs || []) as any[])
      if (docs.length === 0) continue
      const burned = await (this.payload as any).find({
        collection: 'wallet-transactions',
        where: {
          and: [
            { wallet: { equals: wallet.id } },
            { type: { in: ['redeem'] } },
            { points: { less_than: 0 } },
            { status: { equals: 'posted' } },
          ],
        },
        pagination: false,
        limit: 5000,
        depth: 0,
        overrideAccess: true,
      })
      let burnedLeft = Math.abs(
        (((burned as any)?.docs || []) as any[]).reduce((s: number, e: any) => s + Number(e.points ?? 0), 0),
      )
      for (const lot of docs) {
        const lotPoints = Math.floor(Number(lot.points ?? 0))
        const consumed = Math.min(lotPoints, burnedLeft)
        burnedLeft -= consumed
        const unspent = lotPoints - consumed
        if (unspent <= 0) continue
        const customerId = relId(lot.customer)
        if (!customerId) continue
        try {
          await this.postPoints({
            customerId,
            type: 'expiry',
            points: -unspent,
            idempotencyKey: `loyalty-expire:${lot.id}`,
            meta: { sweepOf: String(lot.id), reason: 'expiry' },
          })
          lotsSwept += 1
          pointsExpired += unspent
        } catch {
          continue
        }
      }
    }
    return { lotsSwept, pointsExpired }
  }
}
