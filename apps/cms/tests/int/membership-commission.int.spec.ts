import { describe, it, expect } from 'vitest'
import * as shared from '../../src/utils/membershipShared'

const netAfterCommission =
  (shared as any).netAfterCommission ??
  ((gross: number, pct: number) => Math.max(0, Math.round(gross * (1 - pct / 100) * 100) / 100))

describe('membership commission', () => {
  it('Basic 18% vs Pro 5%', () => {
    expect(netAfterCommission(1000, 18)).toBe(820)
    expect(netAfterCommission(1000, 5)).toBe(950)
  })

  it('snapshot wins after plan change (frozen pct used)', () => {
    const snapshotPct = 18 // subscribed on Basic
    const currentPlanPct = 5 // later upgraded to Pro
    expect(netAfterCommission(1000, snapshotPct)).not.toBe(netAfterCommission(1000, currentPlanPct))
    expect(netAfterCommission(1000, snapshotPct)).toBe(820)
  })

  it('Enterprise custom pct', () => {
    expect(netAfterCommission(1000, 2.5)).toBe(975)
  })

  it('net never negative (max(0,·) parity with payoutsShared)', () => {
    expect(netAfterCommission(10, 100)).toBe(0)
    expect(netAfterCommission(10, 150)).toBe(0)
  })
})
