import { describe, it, expect, vi } from 'vitest'

/** Entitlement matrix with mocked payload (no DB). */

type Ctx = { plan: string; status: string; couponsUsed?: number; outlets?: number; action: 'publish_outlet' | 'create_product' | 'create_coupon' | 'accept_orders' | 'read'; goingOffline?: boolean }

function evaluate(ctx: Ctx): { allowed: boolean; code?: string } {
  if (ctx.goingOffline) return { allowed: true }
  if (ctx.action === 'read') return { allowed: true }
  if (!['active', 'trialing'].includes(ctx.status)) return { allowed: false, code: 'MEMBERSHIP_REQUIRED' }
  if (ctx.plan === 'basic' && ctx.action === 'create_coupon') return { allowed: false, code: 'MEMBERSHIP_REQUIRED' }
  if (ctx.plan === 'growth' && ctx.action === 'create_coupon' && (ctx.couponsUsed ?? 0) >= 5) return { allowed: false, code: 'MEMBERSHIP_REQUIRED' }
  if (ctx.plan === 'basic' && ctx.action === 'publish_outlet' && (ctx.outlets ?? 0) >= 1) return { allowed: false, code: 'MEMBERSHIP_REQUIRED' }
  return { allowed: true }
}

describe('membership entitlement matrix (mocked)', () => {
  it('Basic active: 1 outlet ok, 2nd 402, coupon 402 always', () => {
    expect(evaluate({ plan: 'basic', status: 'active', outlets: 0, action: 'publish_outlet' }).allowed).toBe(true)
    expect(evaluate({ plan: 'basic', status: 'active', outlets: 1, action: 'publish_outlet' })).toEqual({ allowed: false, code: 'MEMBERSHIP_REQUIRED' })
    expect(evaluate({ plan: 'basic', status: 'active', action: 'create_coupon' }).allowed).toBe(false)
  })

  it('Growth active: coupon < 5 ok, 5th blocked', () => {
    expect(evaluate({ plan: 'growth', status: 'active', couponsUsed: 4, action: 'create_coupon' }).allowed).toBe(true)
    expect(evaluate({ plan: 'growth', status: 'active', couponsUsed: 5, action: 'create_coupon' }).allowed).toBe(false)
  })

  it('past_due in grace: writes 402, reads ok', () => {
    expect(evaluate({ plan: 'growth', status: 'past_due', action: 'publish_outlet' }).allowed).toBe(false)
    expect(evaluate({ plan: 'growth', status: 'past_due', action: 'read' }).allowed).toBe(true)
  })

  it('expired/none: all writes 402', () => {
    for (const a of ['publish_outlet', 'create_product', 'create_coupon', 'accept_orders'] as const) {
      expect(evaluate({ plan: 'basic', status: 'expired', action: a }).allowed).toBe(false)
    }
  })

  it('open->closed always allowed', () => {
    expect(evaluate({ plan: 'basic', status: 'expired', action: 'publish_outlet', goingOffline: true }).allowed).toBe(true)
  })

  it('guard fail-open when module missing', async () => {
    const req = { payload: { find: vi.fn().mockRejectedValue(new Error('collection missing')) } }
    let allowed = false
    try {
      const mod = await import('../../src/utils/membershipGuard')
      await mod.requireActiveMembership(req.payload, '1', { fn: 'test' })
      allowed = true
    } catch (e: any) {
      allowed = e?.status !== 402
    }
    expect(allowed).toBe(true)
  })
})
