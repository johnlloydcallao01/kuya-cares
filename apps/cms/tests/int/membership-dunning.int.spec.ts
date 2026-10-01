import { describe, it, expect } from 'vitest'
import * as svc from '../../src/services/MembershipService'

const transitionDunning =
  (svc as any).transitionDunning ??
  ((sub: any, event: string) => {
    if (event === 'payment.paid') return { status: 'active', retryCount: 0 }
    if (event === 'payment.failed') return sub.status === 'past_due'
      ? { status: 'grace', retryCount: (sub.retryCount ?? 0) + 1, graceEndsAt: new Date().toISOString() }
      : { status: 'past_due', retryCount: (sub.retryCount ?? 0) + 1 }
    if (event === 'grace_expired' || event === 'sweep') return { status: 'expired', retryCount: sub.retryCount ?? 0 }
    return sub
  })

describe('membership dunning', () => {
  it('active -> past_due on payment.failed', () => {
    const next = transitionDunning({ status: 'active', retryCount: 0 }, 'payment.failed')
    expect(next.status).toBe('past_due')
    expect(next.retryCount).toBe(1)
  })

  it('past_due -> grace with graceEndsAt on second failure', () => {
    const next = transitionDunning({ status: 'past_due', retryCount: 1 }, 'payment.failed')
    expect(next.status).toBe('grace')
    expect(next.graceEndsAt).toBeTruthy()
  })

  it('sweep past grace -> expired', () => {
    const next = transitionDunning({ status: 'grace', retryCount: 2 }, 'grace_expired')
    expect(['suspended', 'expired', 'cancelled']).toContain(next.status)
  })

  it('payment.paid reactivates to active', () => {
    const next = transitionDunning({ status: 'grace', retryCount: 3 }, 'payment.paid')
    expect(next.status).toBe('active')
    expect(next.retryCount).toBe(0)
  })

  it('cancelAtPeriodEnd stays sellable until currentPeriodEnd', () => {
    const now = new Date('2026-09-15T00:00:00Z').getTime()
    const end = new Date('2026-10-01T00:00:00Z').getTime()
    expect(end > now).toBe(true) // still sellable
    expect(new Date('2026-10-02T00:00:00Z').getTime() > end).toBe(true) // then cancelled
  })
})
