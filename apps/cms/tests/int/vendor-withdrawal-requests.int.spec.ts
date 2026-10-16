import { describe, expect, it } from 'vitest'
import {
  calculateWithdrawalBalance,
  canTransitionWithdrawal,
  getOwnedActiveVendorIds,
  parsePhpAmount,
} from '../../src/utils/withdrawalRequests'

describe('vendor withdrawal request rules', () => {
  it('accepts only positive PHP amounts at cent precision', () => {
    expect(parsePhpAmount(1)).toBe(1)
    expect(parsePhpAmount('12.34')).toBe(12.34)
    expect(parsePhpAmount('12.345')).toBeNull()
    expect(parsePhpAmount('1e2')).toBeNull()
    expect(parsePhpAmount(true)).toBeNull()
    expect(parsePhpAmount(0.999)).toBeNull()
    expect(parsePhpAmount(-1)).toBeNull()
    expect(parsePhpAmount(1.001)).toBeNull()
    expect(parsePhpAmount(Number.MAX_VALUE)).toBeNull()
    expect(parsePhpAmount(Number.NaN)).toBeNull()
  })

  it('reserves pending and approved amounts and subtracts completed payouts', () => {
    expect(calculateWithdrawalBalance({
      lifetimePayable: '1000.00',
      reserved: '350.50',
      paid: '200',
    })).toEqual({
      lifetimePayable: 1000,
      reserved: 350.5,
      paid: 200,
      available: 449.5,
      currency: 'PHP',
    })
    expect(calculateWithdrawalBalance({
      lifetimePayable: 120,
      reserved: 200,
      paid: 30,
    }).available).toBe(0)
  })

  it('allows only the documented admin lifecycle transitions and is idempotent', () => {
    expect(canTransitionWithdrawal('pending', 'approved')).toBe(true)
    expect(canTransitionWithdrawal('pending', 'rejected')).toBe(true)
    expect(canTransitionWithdrawal('pending', 'cancelled')).toBe(true)
    expect(canTransitionWithdrawal('approved', 'paid')).toBe(true)
    expect(canTransitionWithdrawal('approved', 'cancelled')).toBe(true)
    expect(canTransitionWithdrawal('approved', 'approved')).toBe(true)
    expect(canTransitionWithdrawal('paid', 'paid')).toBe(true)
    expect(canTransitionWithdrawal('rejected', 'approved')).toBe(false)
    expect(canTransitionWithdrawal('cancelled', 'paid')).toBe(false)
    expect(canTransitionWithdrawal('pending', 'paid')).toBe(false)
  })

  it('derives vendor ownership from active vendor records linked to the authenticated user', () => {
    expect(getOwnedActiveVendorIds(7, [
      { id: 10, user: 7, isActive: true },
      { id: 11, user: { id: 7 }, isActive: false },
      { id: 12, user: 8, isActive: true },
      { id: 'invalid', user: 7, isActive: true },
    ])).toEqual([10])
  })

  it('releases reservations on rejection/cancellation but keeps paid amounts debited', () => {
    expect(calculateWithdrawalBalance({ lifetimePayable: 100, reserved: 50, paid: 0 }).available).toBe(50)
    expect(calculateWithdrawalBalance({ lifetimePayable: 100, reserved: 0, paid: 0 }).available).toBe(100)
    expect(calculateWithdrawalBalance({ lifetimePayable: 100, reserved: 0, paid: 50 }).available).toBe(50)
  })
})
