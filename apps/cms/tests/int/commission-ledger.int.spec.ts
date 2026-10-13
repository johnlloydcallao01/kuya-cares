import { describe, expect, it } from 'vitest'
import {
  calculateCommissionAmounts,
  calculateRefundReversalDelta,
  selectApplicableCommissionRule,
} from '../../src/services/CommissionService'

describe('marketplace commission calculation', () => {
  it('charges commission on merchandise after vendor-funded discounts, excluding checkout fees', () => {
    expect(
      calculateCommissionAmounts(1000, 50, {
        pct: 10,
        transactionFee: 5,
        source: 'vendor',
        ruleId: 12,
      }),
    ).toEqual({
      baseAmount: 950,
      vendorDiscount: 50,
      commissionAmount: 95,
      transactionFee: 5,
      vendorNet: 850,
    })
  })

  it('rounds money and never makes vendor net negative', () => {
    expect(
      calculateCommissionAmounts(100, 0, {
        pct: 100,
        transactionFee: 25,
        source: 'global',
        ruleId: null,
      }),
    ).toEqual({
      baseAmount: 100,
      vendorDiscount: 0,
      commissionAmount: 100,
      transactionFee: 25,
      vendorNet: 0,
    })
    expect(
      calculateCommissionAmounts(12.345, 0, {
        pct: 8,
        transactionFee: 0,
        source: 'global',
        ruleId: null,
      }).commissionAmount,
    ).toBe(0.99)
  })

  it('chooses the highest-priority active rule that matches the seller context', () => {
    const at = new Date('2026-10-13T10:00:00.000Z')
    const selected = selectApplicableCommissionRule(
      [
        { id: 1, scope: 'global', priority: 0, commission_percent: 8, is_active: true },
        { id: 2, scope: 'plan', plan: 7, priority: 10, commission_percent: 6, is_active: true },
        { id: 3, scope: 'category', category: 4, priority: 50, commission_percent: 5, is_active: true },
        { id: 4, scope: 'vendor', vendor: 9, priority: 100, commission_percent: 3, is_active: true },
        { id: 5, scope: 'vendor', vendor: 8, priority: 200, commission_percent: 1, is_active: true },
        {
          id: 6,
          scope: 'vendor',
          vendor: 9,
          priority: 500,
          commission_percent: 1,
          is_active: true,
          effective_from: '2026-10-14T00:00:00.000Z',
        },
        { id: 7, scope: 'vendor', vendor: 9, priority: 1000, commission_percent: 1, is_active: false },
      ],
      9,
      '7',
      new Set(['4']),
      at,
    )
    expect(selected?.id).toBe(4)
  })

  it('uses the next matching rule after an override expires', () => {
    const at = new Date('2026-10-13T10:00:00.000Z')
    const selected = selectApplicableCommissionRule(
      [
        {
          id: 1,
          scope: 'vendor',
          vendor: 9,
          priority: 100,
          commission_percent: 3,
          is_active: true,
          effective_to: '2026-10-12T23:59:59.999Z',
        },
        { id: 2, scope: 'category', category: 4, priority: 50, commission_percent: 5, is_active: true },
      ],
      9,
      '',
      new Set(['4']),
      at,
    )
    expect(selected?.id).toBe(2)
  })

  it('prorates partial refunds cumulatively and caps reversals at the accrual', () => {
    const accrual = {
      commission_base_amount: 950,
      commission_vendor_discount: 50,
      commission_amount: 95,
      commission_transaction_fee: 5,
      commission_vendor_net: 850,
    }
    const first = calculateRefundReversalDelta(accrual, [], 250, 1000)
    expect(first).toEqual({
      commission_base_amount: -237.5,
      commission_vendor_discount: -12.5,
      commission_amount: -23.75,
      commission_transaction_fee: -1.25,
      commission_vendor_net: -212.5,
    })

    const second = calculateRefundReversalDelta(accrual, [first], 600, 1000)
    expect(second).toEqual({
      commission_base_amount: -332.5,
      commission_vendor_discount: -17.5,
      commission_amount: -33.25,
      commission_transaction_fee: -1.75,
      commission_vendor_net: -297.5,
    })

    const final = calculateRefundReversalDelta(accrual, [first, second], 1200, 1000)
    expect(final).toEqual({
      commission_base_amount: -380,
      commission_vendor_discount: -20,
      commission_amount: -38,
      commission_transaction_fee: -2,
      commission_vendor_net: -340,
    })
  })
})
