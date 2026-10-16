import { describe, expect, it } from 'vitest'
import { CommissionRules } from '../../src/collections/CommissionRules'
import { SystemSettings } from '../../src/globals/SystemSettings'
import {
  accruePaidOrderCommission,
  calculateRollingVendorNetMerchandiseSales,
  calculateCommissionAmounts,
  calculateProductCommissionAmounts,
  calculateRefundReversalDelta,
  getCommissionDiscountAmounts,
  selectApplicableCommissionRule,
  selectVendorVolumeTier,
} from '../../src/services/CommissionService'
import {
  buildDaily,
  buildPayoutsCore,
  buildVendorAgg,
  parsePayoutsParams,
  toPayoutRows,
} from '../../src/utils/payoutsShared'

describe('marketplace commission calculation', () => {
  it('validates product rule targets and rejects other scope relationships', () => {
    const validate = CommissionRules.hooks?.beforeValidate?.[0] as unknown as (args: {
      data: Record<string, unknown>
      originalDoc?: Record<string, unknown>
    }) => unknown
    const validRule = {
      name: 'Product rate',
      scope: 'product',
      product: 45,
      commission_percent: 5,
    }
    expect(validate({ data: validRule })).toBe(validRule)
    expect(() => validate({ data: { ...validRule, product: null } })).toThrow(
      'product commission rules require a matching product target.',
    )
    expect(() => validate({ data: { ...validRule, vendor: 9 } })).toThrow(
      'product commission rules cannot target vendor.',
    )
    const categoryRule = {
      name: 'Product category rate',
      scope: 'product_category',
      product_category: 7,
      commission_percent: 6,
    }
    expect(validate({ data: categoryRule })).toBe(categoryRule)
    expect(() => validate({ data: { ...categoryRule, product_category: null } })).toThrow(
      'product_category commission rules require a matching product_category target.',
    )
    expect(() => validate({ data: { ...categoryRule, category: 4 } })).toThrow(
      'product_category commission rules cannot target category.',
    )
  })

  it('calculates pre-discount commission from the recorded item subtotal including allocated discounts', () => {
    const result = calculateProductCommissionAmounts(200, 0, 50, [
      {
        productId: '45',
        itemIds: ['11'],
        subtotal: 200,
        quantity: 2,
        resolution: {
          method: 'percentage_of_pre_discount_subtotal',
          value: 10,
          pct: 10,
          transactionFee: 0,
          source: 'product',
          ruleId: 4,
        },
      },
    ])
    expect(result.amounts).toMatchObject({
      baseAmount: 150,
      commissionAmount: 20,
    })
    expect(result.breakdown[0]).toMatchObject({
      subtotal: 200,
      product_discount: 50,
      commission_base_amount: 150,
      commission_pre_discount_base_amount: 200,
      commission_method: 'percentage_of_pre_discount_subtotal',
      commission_value: 10,
      commission_amount: 20,
    })
  })

  it('validates method-aware rules while preserving legacy percentage inputs', () => {
    const validate = CommissionRules.hooks?.beforeValidate?.[0] as unknown as (args: {
      data: Record<string, unknown>
    }) => unknown
    expect(validate({
      data: {
        name: 'Per unit',
        scope: 'global',
        commission_method: 'fixed_amount_per_unit',
        commission_value: 4.25,
      },
    })).toBeDefined()
    expect(validate({
      data: {
        name: 'Pre-discount percentage',
        scope: 'global',
        commission_method: 'percentage_of_pre_discount_subtotal',
        commission_value: 10,
      },
    })).toBeDefined()
    expect(() => validate({
      data: {
        name: 'Invalid unit precision',
        scope: 'global',
        commission_method: 'fixed_amount_per_unit',
        commission_value: 1.005,
      },
    })).toThrow('Fixed-per-unit commission must use no more than two decimal places.')
    expect(() => validate({
      data: {
        name: 'Bad rate',
        scope: 'global',
        commission_method: 'percentage_of_vendor_cost',
        commission_value: 100.01,
      },
    })).toThrow('Commission percentage must be between 0 and 100.')
    expect(() => validate({
      data: {
        name: 'Bad method',
        scope: 'global',
        commission_method: 'unsupported',
        commission_value: 5,
      },
    })).toThrow('Commission method is not supported.')
    expect(() => validate({
      data: {
        name: 'Missing fixed value',
        scope: 'global',
        commission_method: 'fixed_amount_per_unit',
      },
    })).toThrow('Commission value is required for fixed-per-unit and vendor-cost methods.')
  })

  it('calculates fixed-per-unit and vendor-cost commission from paid line snapshots', () => {
    const result = calculateProductCommissionAmounts(200, 0, 20, [
      {
        productId: '45',
        itemIds: ['11'],
        subtotal: 100,
        quantity: 3,
        costBaseAmount: 0,
        resolution: {
          method: 'fixed_amount_per_unit',
          value: 4,
          pct: 0,
          transactionFee: 0,
          source: 'product',
          ruleId: 1,
        },
      },
      {
        productId: '46',
        itemIds: ['12'],
        subtotal: 100,
        quantity: 2,
        costBaseAmount: 30,
        costSnapshotComplete: true,
        resolution: {
          method: 'percentage_of_vendor_cost',
          value: 20,
          pct: 0,
          transactionFee: 0,
          source: 'product',
          ruleId: 2,
        },
      },
    ])
    expect(result.amounts).toEqual({
      baseAmount: 180,
      vendorDiscount: 0,
      commissionAmount: 18,
      transactionFee: 0,
      vendorNet: 182,
    })
    expect(result.breakdown).toEqual([
      expect.objectContaining({
        commission_method: 'fixed_amount_per_unit',
        commission_value: 4,
        commission_quantity: 3,
        commission_amount: 12,
      }),
      expect.objectContaining({
        commission_method: 'percentage_of_vendor_cost',
        commission_value: 20,
        commission_cost_base_amount: 30,
        commission_amount: 6,
      }),
    ])
    expect(() => calculateProductCommissionAmounts(100, 0, 0, [{
      productId: '47',
      itemIds: ['13'],
      subtotal: 100,
      quantity: 1,
      resolution: {
        method: 'percentage_of_vendor_cost',
        value: 10,
        pct: 0,
        transactionFee: 0,
        source: 'product',
        ruleId: null,
      },
    }])).toThrow('Vendor-cost commissions require a recorded vendor-cost snapshot for every order item.')
  })

  it('selects the highest qualifying tier and computes rolling net merchandise sales after refunds', async () => {
    expect(selectVendorVolumeTier([
      { name: 'Base', minimumNetSales: 0, commissionPercent: 8 },
      { name: 'Growth', minimumNetSales: 50000, commissionPercent: 6 },
      { name: 'Scale', minimumNetSales: 100000, commissionPercent: 4 },
    ], 100000)).toMatchObject({ name: 'Scale', commissionPercent: 4 })
    expect(selectVendorVolumeTier([
      { id: 8, name: 'Later', minimumNetSales: 500, commissionPercent: 6 },
      { id: 2, name: 'Earlier', minimumNetSales: 500, commissionPercent: 7 },
    ], 500)).toMatchObject({ id: 2, name: 'Earlier' })

    const payload = {
      find: async ({
        collection,
        where,
      }: { collection: string; where?: { order?: { equals?: string } } }) => {
        if (collection === 'transactions') {
          return {
            docs: [
              { order: 2, amount: 1200, refunded_amount: 200 },
              { order: 1, amount: 600, refunded_amount: 0 },
              { order: 3, amount: 1200, refunded_amount: 0 },
            ],
          }
        }
        if (collection === 'order-discounts') {
          const orderId = where?.order?.equals
          return { docs: orderId === '2'
            ? [{ food_discount: 100, total_discount: 100 }]
            : orderId === '1'
              ? [{ food_discount: 50, total_discount: 50 }]
              : [] }
        }
        throw new Error(`Unexpected collection: ${collection}`)
      },
      findByID: async ({ collection, id }: { collection: string; id: string | number }) => {
        if (collection === 'orders') {
          return {
            id,
            merchant: 20,
            subtotal: 1000,
            status: String(id) === '3' ? 'cancelled' : 'completed',
          }
        }
        if (collection === 'merchants') return { id: 20, vendor: 9 }
        throw new Error(`Unexpected findByID collection: ${collection}`)
      },
    }
    const sales = await calculateRollingVendorNetMerchandiseSales(
      payload as never,
      9,
      { merchant: 20, subtotal: 500, status: 'pending' },
      1,
      new Date('2026-10-15T10:00:00.000Z'),
    )
    expect(sales).toBe(1150)
  })

  it('validates volume-tier thresholds and rates', () => {
    const validate = SystemSettings.hooks?.beforeValidate?.[0] as unknown as (args: {
      data: { commissionVolumeTiers?: Array<Record<string, unknown>> }
    }) => unknown
    expect(validate({
      data: {
        commissionVolumeTiers: [
          { name: 'Base', minimumNetSales: 0, commissionPercent: 8 },
          { name: 'Growth', minimumNetSales: 50000, commissionPercent: 6 },
        ],
      },
    })).toBeDefined()
    expect(() => validate({
      data: {
        commissionVolumeTiers: [
          { name: 'Base', minimumNetSales: 0, commissionPercent: 8 },
          { name: 'Duplicate', minimumNetSales: 0, commissionPercent: 6 },
        ],
      },
    })).toThrow('Vendor volume tiers must have unique minimumNetSales thresholds.')
    expect(() => validate({
      data: {
        commissionVolumeTiers: [
          { name: 'Bad precision', minimumNetSales: 0.001, commissionPercent: 8 },
        ],
      },
    })).toThrow('Vendor volume tier minimumNetSales must use no more than two decimal places.')
  })

  it('stores a mixed product-rate accrual and exposes its breakdown on the order', async () => {
    const createdEntries: Array<Record<string, unknown>> = []
    const orderUpdates: Array<Record<string, unknown>> = []
    const rules = [
      { id: 31, scope: 'product_category', product_category: 7, priority: 20, commission_percent: 2, transaction_fee: 6, is_active: true },
      { id: 1, scope: 'global', priority: 0, commission_percent: 8, transaction_fee: 0, is_active: true },
    ]
    const payload = {
      findByID: async ({ collection, id }: { collection: string; id?: string | number }) => {
        if (collection === 'orders') return { id: 100, merchant: 20, subtotal: 1000, currency: 'PHP' }
        if (collection === 'merchants') return { id: 20, vendor: 9, merchant_categories: [] }
        if (collection === 'vendors') return { id: 9 }
        if (collection === 'products') {
          return { id, categories: String(id) === '45' ? [7] : [8] }
        }
        throw new Error(`Unexpected findByID collection: ${collection}`)
      },
      find: async ({ collection }: { collection: string }) => {
        if (collection === 'vendor-commission-entries' || collection === 'vendor-subscriptions') return { docs: [] }
        if (collection === 'commission-rules') return { docs: rules }
        if (collection === 'order-discounts') return {
          docs: [{ food_discount: 100, total_discount: 120, vendor_share: 20 }],
        }
        if (collection === 'order-items') return {
          docs: [
            { id: 11, product: 45, total_price: 600 },
            { id: 12, product: 46, total_price: 400 },
          ],
        }
        throw new Error(`Unexpected find collection: ${collection}`)
      },
      findGlobal: async () => ({ membership: { commissionDefaultPct: 8 } }),
      create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
        expect(collection).toBe('vendor-commission-entries')
        createdEntries.push(data)
        return { id: 900, ...data }
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        orderUpdates.push(data)
      },
    }

    await accruePaidOrderCommission(
      payload as never,
      100,
      200,
      new Date('2026-10-15T10:00:00.000Z'),
    )

    expect(createdEntries).toHaveLength(1)
    expect(createdEntries[0]).toMatchObject({
      commission_percent: 4.4,
      commission_base_amount: 900,
      commission_amount: 39.6,
      commission_transaction_fee: 3.6,
      commission_vendor_net: 936.8,
      commission_source: 'product',
      commission_rule: null,
      commission_product_breakdown: [
        expect.objectContaining({
          product: '45',
          commission_percent: 2,
          commission_amount: 10.8,
          commission_source: 'product_category',
          commission_rule: 31,
        }),
        expect.objectContaining({
          product: '46',
          commission_percent: 8,
          commission_amount: 28.8,
          commission_source: 'global',
          commission_rule: 1,
        }),
      ],
    })
    expect(orderUpdates[0]).toMatchObject({
      commission_source: 'product',
      commission_product_breakdown: createdEntries[0].commission_product_breakdown,
    })
  })

  it('accrues a fixed-per-unit commission from the paid order-item quantity', async () => {
    const entries: Array<Record<string, unknown>> = []
    const payload = {
      findByID: async ({ collection, id }: { collection: string; id?: string | number }) => {
        if (collection === 'orders') return { id: 100, merchant: 20, subtotal: 100, currency: 'PHP' }
        if (collection === 'merchants') return { id: 20, vendor: 9, merchant_categories: [] }
        if (collection === 'vendors') return { id: 9 }
        if (collection === 'products') return { id, categories: [] }
        throw new Error(`Unexpected findByID collection: ${collection}`)
      },
      find: async ({ collection }: { collection: string }) => {
        if (collection === 'vendor-commission-entries' || collection === 'vendor-subscriptions') {
          return { docs: [] }
        }
        if (collection === 'commission-rules') {
          return {
            docs: [{
              id: 2,
              scope: 'product',
              product: 42,
              commission_method: 'fixed_amount_per_unit',
              commission_value: 5,
              commission_percent: 0,
              is_active: true,
            }],
          }
        }
        if (collection === 'order-discounts') return { docs: [] }
        if (collection === 'order-items') {
          return {
            docs: [{
              id: 10,
              product: 42,
              total_price: 100,
              quantity: 3,
              vendor_cost_at_purchase: 20,
            }],
          }
        }
        throw new Error(`Unexpected find collection: ${collection}`)
      },
      findGlobal: async () => ({}),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        entries.push(data)
        return { id: 900, ...data }
      },
      update: async () => undefined,
    }
    await accruePaidOrderCommission(
      payload as never,
      100,
      200,
      new Date('2026-10-15T10:00:00.000Z'),
    )
    expect(entries[0]).toMatchObject({
      commission_amount: 15,
      commission_source: 'product',
      commission_product_breakdown: [
        expect.objectContaining({
          commission_method: 'fixed_amount_per_unit',
          commission_value: 5,
          commission_quantity: 3,
          commission_cost_base_amount: 60,
          commission_amount: 15,
        }),
      ],
    })
  })

  it('persists pre-discount item-price commission and its recorded base in the accrual', async () => {
    const entries: Array<Record<string, unknown>> = []
    const payload = {
      findByID: async ({ collection, id }: { collection: string; id?: string | number }) => {
        if (collection === 'orders') return { id: 100, merchant: 20, subtotal: 200, currency: 'PHP' }
        if (collection === 'merchants') return { id: 20, vendor: 9, merchant_categories: [] }
        if (collection === 'vendors') return { id: 9 }
        if (collection === 'products') return { id, categories: [] }
        throw new Error(`Unexpected findByID collection: ${collection}`)
      },
      find: async ({ collection }: { collection: string }) => {
        if (collection === 'vendor-commission-entries' || collection === 'vendor-subscriptions') {
          return { docs: [] }
        }
        if (collection === 'commission-rules') {
          return {
            docs: [{
              id: 7,
              scope: 'product',
              product: 42,
              commission_method: 'percentage_of_pre_discount_subtotal',
              commission_value: 10,
              commission_percent: 10,
              is_active: true,
            }],
          }
        }
        if (collection === 'order-discounts') {
          return { docs: [{ food_discount: 20, total_discount: 20 }] }
        }
        if (collection === 'order-items') {
          return {
            docs: [
              { id: 10, product: 42, total_price: 100, quantity: 1 },
              { id: 11, product: 43, total_price: 100, quantity: 1 },
            ],
          }
        }
        if (collection === 'transactions') return { docs: [] }
        throw new Error(`Unexpected find collection: ${collection}`)
      },
      findGlobal: async () => ({
        commissionVolumeTiers: [{ name: 'Base', minimumNetSales: 0, commissionPercent: 5 }],
      }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        entries.push(data)
        return { id: 900, ...data }
      },
      update: async () => undefined,
    }

    await accruePaidOrderCommission(
      payload as never,
      100,
      200,
      new Date('2026-10-15T10:00:00.000Z'),
    )
    expect(entries[0]).toMatchObject({
      commission_base_amount: 180,
      commission_amount: 14.5,
      commission_volume_tier_snapshot: {
        name: 'Base',
        minimumNetSales: 0,
        commissionPercent: 5,
        netSales: 180,
        windowDays: 30,
      },
      commission_product_breakdown: [
        expect.objectContaining({
          commission_method: 'percentage_of_pre_discount_subtotal',
          commission_value: 10,
          commission_pre_discount_base_amount: 100,
          commission_base_amount: 90,
          product_discount: 10,
          commission_amount: 10,
        }),
        expect.objectContaining({
          commission_source: 'volume_tier',
          commission_method: 'percentage_of_discounted_subtotal',
          commission_base_amount: 90,
          commission_amount: 4.5,
          commission_volume_tier_snapshot: {
            name: 'Base',
            minimumNetSales: 0,
            commissionPercent: 5,
            netSales: 180,
            windowDays: 30,
          },
        }),
      ],
    })
  })

  it('applies the qualifying volume tier to the current order at payment time', async () => {
    const entries: Array<Record<string, unknown>> = []
    const payload = {
      findByID: async ({ collection, id }: { collection: string; id?: string | number }) => {
        if (collection === 'orders') return { id: 100, merchant: 20, subtotal: 100, currency: 'PHP' }
        if (collection === 'merchants') return { id: 20, vendor: 9, merchant_categories: [] }
        if (collection === 'vendors') return { id: 9 }
        if (collection === 'products') return { id, categories: [] }
        throw new Error(`Unexpected findByID collection: ${collection}`)
      },
      find: async ({ collection }: { collection: string }) => {
        if (collection === 'vendor-commission-entries' || collection === 'vendor-subscriptions') {
          return { docs: [] }
        }
        if (collection === 'commission-rules' || collection === 'transactions' || collection === 'order-discounts') {
          return { docs: [] }
        }
        if (collection === 'order-items') {
          return { docs: [{ id: 10, product: 42, total_price: 100, quantity: 1, vendor_cost_at_purchase: 20 }] }
        }
        throw new Error(`Unexpected find collection: ${collection}`)
      },
      findGlobal: async () => ({
        commissionVolumeTiers: [{ name: 'Base', minimumNetSales: 100, commissionPercent: 6 }],
      }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        entries.push(data)
        return { id: 900, ...data }
      },
      update: async () => undefined,
    }
    await accruePaidOrderCommission(
      payload as never,
      100,
      200,
      new Date('2026-10-15T10:00:00.000Z'),
    )
    expect(entries[0]).toMatchObject({
      commission_source: 'volume_tier',
      commission_percent: 6,
      commission_amount: 6,
      commission_volume_tier_snapshot: {
        name: 'Base',
        minimumNetSales: 100,
        commissionPercent: 6,
        netSales: 100,
        windowDays: 30,
      },
    })
  })

  it('charges commission on the discounted product base, excluding checkout fees', () => {
    expect(
      calculateCommissionAmounts(1000, 50, {
        pct: 10,
        transactionFee: 5,
        source: 'vendor',
        ruleId: 12,
      }, 50),
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
      }, 0),
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
      }, 0).commissionAmount,
    ).toBe(0.99)
  })

  it('includes all product discounts but excludes delivery discounts from the commission base', () => {
    const discounts = getCommissionDiscountAmounts([
      { food_discount: 40, delivery_discount: 30, total_discount: 70, funded_by: 'split', vendor_share_pct: 50, vendor_share: 35 },
      { food_discount: 10, delivery_discount: 5, total_discount: 15, funded_by: 'vendor', vendor_share: 15 },
      { food_discount: 20, delivery_discount: 40, total_discount: 60, funded_by: 'platform', vendor_share: 0 },
    ])
    expect(discounts).toEqual({ vendorDiscount: 50, productDiscount: 70 })
    expect(
      calculateCommissionAmounts(1000, discounts.vendorDiscount, {
        pct: 10,
        transactionFee: 5,
        source: 'global',
        ruleId: null,
      }, discounts.productDiscount),
    ).toEqual({
      baseAmount: 930,
      vendorDiscount: 50,
      commissionAmount: 93,
      transactionFee: 5,
      vendorNet: 852,
    })
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

  it('matches product categories without treating merchant categories as product categories', () => {
    const at = new Date('2026-10-13T10:00:00.000Z')
    const rules = [
      { id: 10, scope: 'product_category', product_category: 7, priority: 10, commission_percent: 4, is_active: true },
      { id: 11, scope: 'global', priority: 0, commission_percent: 8, is_active: true },
    ]
    const matching = selectApplicableCommissionRule(
      rules,
      9,
      '',
      new Set(['4']),
      at,
      45,
      new Set(['7']),
    )
    const nonMatching = selectApplicableCommissionRule(
      rules,
      9,
      '',
      new Set(['7']),
      at,
      45,
      new Set(['8']),
    )

    expect(matching?.id).toBe(10)
    expect(nonMatching?.id).toBe(11)
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

  it('resolves equal-priority rules by specificity, latest start date, and stable ID', () => {
    const selected = selectApplicableCommissionRule(
      [
        { id: 8, scope: 'vendor', vendor: 9, priority: 20, commission_percent: 8, is_active: true, effective_from: '2026-10-12T00:00:00.000Z' },
        { id: 3, scope: 'vendor', vendor: 9, priority: 20, commission_percent: 7, is_active: true, effective_from: '2026-10-13T00:00:00.000Z' },
        { id: 4, scope: 'vendor', vendor: 9, priority: 20, commission_percent: 6, is_active: true, effective_from: '2026-10-13T00:00:00.000Z' },
        { id: 1, scope: 'category', category: 4, priority: 20, commission_percent: 5, is_active: true, effective_from: '2026-10-14T00:00:00.000Z' },
        { id: 5, scope: 'product_category', product_category: 7, priority: 20, commission_percent: 4, is_active: true },
      ],
      9,
      '',
      new Set(['4']),
      new Date('2026-10-14T12:00:00.000Z'),
      45,
      new Set(['7']),
    )
    expect(selected?.id).toBe(5)
  })

  it('matches product rules only to their product and prefers them on equal priority', () => {
    const selected = selectApplicableCommissionRule(
      [
        { id: 1, scope: 'global', priority: 10, commission_percent: 8, is_active: true },
        { id: 2, scope: 'vendor', vendor: 9, priority: 10, commission_percent: 5, is_active: true },
        { id: 4, scope: 'product_category', product_category: 7, priority: 10, commission_percent: 3, is_active: true },
        { id: 3, scope: 'product', product: 45, priority: 10, commission_percent: 2, is_active: true },
      ],
      9,
      '',
      new Set(),
      new Date('2026-10-14T12:00:00.000Z'),
      45,
      new Set(['7']),
    )
    expect(selected?.id).toBe(3)
    expect(selectApplicableCommissionRule(
      [{ id: 3, scope: 'product', product: 45, priority: 10, commission_percent: 2, is_active: true }],
      9,
      '',
      new Set(),
      new Date('2026-10-14T12:00:00.000Z'),
      46,
      new Set(['7']),
    )).toBeNull()
  })

  it('calculates mixed product rates with prorated food discounts and one order fee', () => {
    const result = calculateProductCommissionAmounts(1000, 20, 100, [
      {
        productId: '45',
        itemIds: ['11'],
        subtotal: 600,
        resolution: { pct: 10, transactionFee: 6, source: 'product', ruleId: 31 },
      },
      {
        productId: '46',
        itemIds: ['12'],
        subtotal: 400,
        resolution: { pct: 5, transactionFee: 2, source: 'global', ruleId: null },
      },
    ])
    expect(result.amounts).toEqual({
      baseAmount: 900,
      vendorDiscount: 20,
      commissionAmount: 72,
      transactionFee: 4.4,
      vendorNet: 903.6,
    })
    expect(result.effectivePercent).toBe(8)
    expect(result.source).toBe('product')
    expect(result.ruleId).toBeNull()
    expect(result.breakdown).toEqual([
      {
        product: '45',
        order_items: ['11'],
        subtotal: 600,
        product_discount: 60,
        commission_base_amount: 540,
        commission_percent: 10,
        commission_method: 'percentage_of_discounted_subtotal',
        commission_value: 10,
        commission_pre_discount_base_amount: 0,
        commission_cost_base_amount: 0,
        commission_quantity: 1,
        commission_amount: 54,
        commission_transaction_fee: 3.6,
        commission_source: 'product',
        commission_rule: 31,
        commission_volume_tier_snapshot: null,
      },
      {
        product: '46',
        order_items: ['12'],
        subtotal: 400,
        product_discount: 40,
        commission_base_amount: 360,
        commission_percent: 5,
        commission_method: 'percentage_of_discounted_subtotal',
        commission_value: 5,
        commission_pre_discount_base_amount: 0,
        commission_cost_base_amount: 0,
        commission_quantity: 1,
        commission_amount: 18,
        commission_transaction_fee: 0.8,
        commission_source: 'global',
        commission_rule: null,
        commission_volume_tier_snapshot: null,
      },
    ])
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

  it('includes manual commission-ledger adjustments in vendor payout balances', () => {
    const core = buildPayoutsCore(parsePayoutsParams(new URLSearchParams('range=all')), {
      vendorsDocs: [{ id: 9, businessName: 'Test vendor' }],
      merchantsDocs: [],
      ordersDocs: [],
      transactionsDocs: [],
      commissionAdjustmentsDocs: [{
        id: 101,
        vendor: 9,
        entry_type: 'adjustment',
        commission_amount: 3,
        commission_transaction_fee: -1,
        commission_vendor_net: 10,
        effective_at: '2026-10-13T10:00:00.000Z',
      }],
    })
    const [row] = toPayoutRows(buildVendorAgg(core))
    expect(row.manualAdjustments).toBe(10)
    expect(row.commissionFees).toBe(3)
    expect(row.commissionTransactionFees).toBe(-1)
    expect(row.net).toBe(10)
    expect(buildDaily(core)).toEqual([{
      date: '2026-10-13',
      gross: 0,
      net: 10,
      orders: 0,
    }])
  })
})
