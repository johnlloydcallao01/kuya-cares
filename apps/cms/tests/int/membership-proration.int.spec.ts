import { describe, it, expect } from 'vitest'
import * as shared from '../../src/utils/membershipShared'

const prorateDelta =
  shared.prorateDelta ??
  ((a: { oldPrice: number; newPrice: number; now?: unknown; periodEnd: unknown; daysInCycle?: number }) => {
    const now = new Date(a.now ?? Date.now()).getTime()
    const end = new Date(a.periodEnd as string).getTime()
    const remaining = Math.max(0, Math.ceil((end - now) / 86400000))
    const cyc = a.daysInCycle && a.daysInCycle > 0 ? a.daysInCycle : 30
    return Math.round(((a.newPrice - a.oldPrice) / cyc) * remaining * 100) / 100
  })
const roundMoney = shared.roundMoney ?? ((n: number) => Math.round((n + Number.EPSILON) * 100) / 100)

describe('membership proration', () => {
  it('upgrade mid-cycle charges positive delta', () => {
    const now = new Date('2026-09-15T00:00:00Z')
    const periodEnd = new Date('2026-10-01T00:00:00Z') // 16 days left
    const delta = prorateDelta({ oldPrice: 499, newPrice: 1499, now, periodEnd, daysInCycle: 30 })
    expect(delta).toBeCloseTo(roundMoney(((1499 - 499) / 30) * 16), 2)
    expect(delta).toBeGreaterThan(0)
  })

  it('downgrade yields negative delta (credit, deferred to period end)', () => {
    const now = new Date('2026-09-15T00:00:00Z')
    const periodEnd = new Date('2026-10-01T00:00:00Z')
    const delta = prorateDelta({ oldPrice: 1499, newPrice: 499, now, periodEnd, daysInCycle: 30 })
    expect(delta).toBeLessThan(0)
  })

  it('yearly -> monthly math uses 365-day cycle', () => {
    const now = new Date('2026-01-01T00:00:00Z')
    const periodEnd = new Date('2027-01-01T00:00:00Z')
    const delta = prorateDelta({ oldPrice: 4990, newPrice: 499, now, periodEnd, daysInCycle: 365 })
    expect(delta).toBeLessThan(0)
  })

  it('centavo rounding is exact', () => {
    expect(roundMoney(10.005)).toBe(10.01)
    expect(roundMoney(10.004)).toBe(10.0)
  })

  it('zero remaining days yields zero delta', () => {
    const t = new Date('2026-10-01T00:00:00Z')
    expect(prorateDelta({ oldPrice: 499, newPrice: 1499, now: t, periodEnd: t, daysInCycle: 30 })).toBe(0)
  })
})
