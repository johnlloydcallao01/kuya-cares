import { describe, expect, it } from 'vitest'
import { ModifierResolverService } from '@/services/ModifierResolverService'
import { normalizeOrderItemOptionsSnapshot } from '@/services/orderItemSnapshot'

type CollectionMap = Record<string, any[]>

function createMockPayload(collections: CollectionMap) {
  return {
    find: async ({ collection }: { collection: string }) => ({
      docs: collections[collection] || [],
    }),
    findByID: async ({ collection, id }: { collection: string; id: number | string }) => {
      const docs = collections[collection] || []
      const matched = docs.find((doc) => String(doc.id) === String(id))
      if (!matched) {
        throw new Error(`Document not found in ${collection} for id ${id}`)
      }

      return matched
    },
  }
}

describe('ModifierResolverService', () => {
  it('resolves product-level modifiers when no variation is selected', async () => {
    const payload = createMockPayload({
      'modifier-groups': [
        {
          id: 11,
          product_id: 100,
          name: 'Spice Level',
          selection_type: 'single',
          is_required: true,
          min_selections: 1,
          max_selections: 1,
          sort_order: 0,
        },
      ],
      'modifier-options': [
        {
          id: 101,
          modifier_group_id: 11,
          name: 'Mild',
          price_adjustment: 0,
          is_default: true,
          is_available: true,
          sort_order: 0,
        },
      ],
      'variation-modifier-groups': [],
      'variation-modifier-options': [],
      'variation-modifier-group-overrides': [],
      'variation-modifier-option-overrides': [],
      'merchant-products': [],
      'merchant-product-modifier-group-overrides': [],
      'merchant-product-modifier-option-overrides': [],
      'merchant-variation-modifier-group-overrides': [],
      'merchant-variation-modifier-option-overrides': [],
      'prod-variations': [
        {
          id: 501,
          product_id: 100,
          modifier_behavior_mode: 'inherit_product',
        },
      ],
    })

    const service = new ModifierResolverService(payload as any)
    const groups = await service.resolveEffectiveGroups({ productId: 100 })

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      id: 11,
      source: 'product-base',
      name: 'Spice Level',
    })
    expect(groups[0].options[0]).toMatchObject({
      id: 101,
      source: 'product-base',
      name: 'Mild',
    })
  })

  it('resolves variation-specific groups without inheriting product-level groups', async () => {
    const payload = createMockPayload({
      'modifier-groups': [
        {
          id: 11,
          product_id: 100,
          name: 'Spice Level',
          selection_type: 'single',
          is_required: false,
          min_selections: 0,
          max_selections: 1,
          sort_order: 0,
        },
      ],
      'modifier-options': [
        {
          id: 101,
          modifier_group_id: 11,
          name: 'Mild',
          price_adjustment: 0,
          is_default: true,
          is_available: true,
          sort_order: 0,
        },
      ],
      'variation-modifier-groups': [
        {
          id: 21,
          variation_id: 501,
          name: 'Large-only toppings',
          selection_type: 'multiple',
          is_required: false,
          min_selections: 0,
          max_selections: 2,
          sort_order: 10,
          is_active: true,
        },
      ],
      'variation-modifier-options': [
        {
          id: 201,
          variation_modifier_group_id: 21,
          name: 'Cheese Burst',
          price_adjustment: 25,
          is_default: false,
          is_available: true,
          sort_order: 0,
        },
      ],
      'variation-modifier-group-overrides': [],
      'variation-modifier-option-overrides': [],
      'merchant-products': [],
      'merchant-product-modifier-group-overrides': [],
      'merchant-product-modifier-option-overrides': [],
      'merchant-variation-modifier-group-overrides': [],
      'merchant-variation-modifier-option-overrides': [],
      'prod-variations': [
        {
          id: 501,
          product_id: 100,
          modifier_behavior_mode: 'variation_specific',
        },
      ],
    })

    const service = new ModifierResolverService(payload as any)
    const groups = await service.resolveEffectiveGroups({ productId: 100, variationId: 501 })

    expect(groups).toHaveLength(1)
    expect(groups.map((group) => group.source)).toEqual(['variation-added'])
    expect(groups[0].options[0]).toMatchObject({
      id: 201,
      source: 'variation-added',
      priceAdjustment: 25,
    })
  })

  it('applies hybrid group and option overrides for a variation', async () => {
    const payload = createMockPayload({
      'modifier-groups': [
        {
          id: 11,
          product_id: 100,
          name: 'Sauce',
          selection_type: 'single',
          is_required: false,
          min_selections: 0,
          max_selections: 1,
          sort_order: 0,
        },
      ],
      'modifier-options': [
        {
          id: 101,
          modifier_group_id: 11,
          name: 'Ketchup',
          price_adjustment: 0,
          is_default: true,
          is_available: true,
          sort_order: 0,
        },
        {
          id: 102,
          modifier_group_id: 11,
          name: 'Special Mayo',
          price_adjustment: 10,
          is_default: false,
          is_available: true,
          sort_order: 1,
        },
      ],
      'variation-modifier-groups': [],
      'variation-modifier-options': [],
      'variation-modifier-group-overrides': [
        {
          variation_id: 501,
          base_modifier_group_id: 11,
          mode: 'override',
          name_override: 'Premium Sauce',
          required_behavior: 'required',
          sort_order_override: 5,
          is_active: true,
        },
      ],
      'variation-modifier-option-overrides': [
        {
          variation_id: 501,
          base_modifier_option_id: 102,
          mode: 'override',
          name_override: 'Truffle Mayo',
          price_adjustment_override: 35,
          availability_behavior: 'available',
          is_active: true,
        },
      ],
      'merchant-products': [],
      'merchant-product-modifier-group-overrides': [],
      'merchant-product-modifier-option-overrides': [],
      'merchant-variation-modifier-group-overrides': [],
      'merchant-variation-modifier-option-overrides': [],
      'prod-variations': [
        {
          id: 501,
          product_id: 100,
          modifier_behavior_mode: 'hybrid',
        },
      ],
    })

    const service = new ModifierResolverService(payload as any)
    const groups = await service.resolveEffectiveGroups({ productId: 100, variationId: 501 })

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      name: 'Premium Sauce',
      isRequired: true,
      source: 'variation-overridden',
    })
    expect(groups[0].options[1]).toMatchObject({
      name: 'Truffle Mayo',
      priceAdjustment: 35,
      source: 'variation-overridden',
    })
  })

  it('keeps product-level only behavior when a variation is set to inherit product modifiers', async () => {
    const payload = createMockPayload({
      'modifier-groups': [
        {
          id: 11,
          product_id: 100,
          name: 'Drink Size',
          selection_type: 'single',
          is_required: true,
          min_selections: 1,
          max_selections: 1,
          sort_order: 0,
        },
      ],
      'modifier-options': [
        {
          id: 101,
          modifier_group_id: 11,
          name: 'Regular',
          price_adjustment: 0,
          is_default: true,
          is_available: true,
          sort_order: 0,
        },
      ],
      'variation-modifier-groups': [
        {
          id: 21,
          variation_id: 501,
          name: 'Should be ignored',
          selection_type: 'multiple',
          is_required: false,
          min_selections: 0,
          max_selections: 2,
          sort_order: 10,
          is_active: true,
        },
      ],
      'variation-modifier-options': [
        {
          id: 201,
          variation_modifier_group_id: 21,
          name: 'Ignored option',
          price_adjustment: 10,
          is_default: false,
          is_available: true,
          sort_order: 0,
        },
      ],
      'variation-modifier-group-overrides': [],
      'variation-modifier-option-overrides': [],
      'merchant-products': [],
      'merchant-product-modifier-group-overrides': [],
      'merchant-product-modifier-option-overrides': [],
      'merchant-variation-modifier-group-overrides': [],
      'merchant-variation-modifier-option-overrides': [],
      'prod-variations': [
        {
          id: 501,
          product_id: 100,
          modifier_behavior_mode: 'inherit_product',
        },
      ],
    })

    const service = new ModifierResolverService(payload as any)
    const groups = await service.resolveEffectiveGroups({ productId: 100, variationId: 501 })

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      name: 'Drink Size',
      source: 'product-base',
    })
  })

  it('applies merchant-product overrides on top of inherited product-level modifiers', async () => {
    const payload = createMockPayload({
      'modifier-groups': [
        {
          id: 11,
          product_id: 100,
          name: 'Sauce',
          selection_type: 'single',
          is_required: false,
          min_selections: 0,
          max_selections: 1,
          sort_order: 0,
        },
      ],
      'modifier-options': [
        {
          id: 101,
          modifier_group_id: 11,
          name: 'Ketchup',
          price_adjustment: 0,
          is_default: true,
          is_available: true,
          sort_order: 0,
        },
        {
          id: 102,
          modifier_group_id: 11,
          name: 'Mayo',
          price_adjustment: 10,
          is_default: false,
          is_available: true,
          sort_order: 1,
        },
      ],
      'variation-modifier-groups': [],
      'variation-modifier-options': [],
      'variation-modifier-group-overrides': [],
      'variation-modifier-option-overrides': [],
      'merchant-products': [
        {
          id: 901,
          merchant_id: 700,
          product_id: 100,
        },
      ],
      'merchant-product-modifier-group-overrides': [
        {
          merchant_product_id: 901,
          base_modifier_group_id: 11,
          mode: 'override',
          name_override: 'Merchant Sauce',
          required_behavior: 'required',
          is_active: true,
        },
      ],
      'merchant-product-modifier-option-overrides': [
        {
          merchant_product_id: 901,
          base_modifier_option_id: 102,
          mode: 'override',
          name_override: 'Merchant Mayo',
          price_adjustment_override: 25,
          is_active: true,
        },
      ],
      'merchant-variation-modifier-group-overrides': [],
      'merchant-variation-modifier-option-overrides': [],
      'prod-variations': [],
    })

    const service = new ModifierResolverService(payload as any)
    const groups = await service.resolveEffectiveGroups({
      productId: 100,
      merchantId: 700,
    })

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      name: 'Merchant Sauce',
      isRequired: true,
      source: 'merchant-product-overridden',
    })
    expect(groups[0].options[1]).toMatchObject({
      name: 'Merchant Mayo',
      priceAdjustment: 25,
      source: 'merchant-product-overridden',
    })
  })

  it('applies merchant-variation overrides on top of variation-owned modifiers', async () => {
    const payload = createMockPayload({
      'modifier-groups': [],
      'modifier-options': [],
      'variation-modifier-groups': [
        {
          id: 21,
          variation_id: 501,
          name: 'Large Add-ons',
          selection_type: 'multiple',
          is_required: false,
          min_selections: 0,
          max_selections: 2,
          sort_order: 0,
          is_active: true,
        },
      ],
      'variation-modifier-options': [
        {
          id: 201,
          variation_modifier_group_id: 21,
          name: 'Cheese Burst',
          price_adjustment: 20,
          is_default: false,
          is_available: true,
          sort_order: 0,
        },
      ],
      'variation-modifier-group-overrides': [],
      'variation-modifier-option-overrides': [],
      'merchant-products': [
        {
          id: 901,
          merchant_id: 700,
          product_id: 100,
        },
      ],
      'merchant-product-modifier-group-overrides': [],
      'merchant-product-modifier-option-overrides': [],
      'merchant-variation-modifier-group-overrides': [
        {
          merchant_product_id: 901,
          variation_id: 501,
          target_group_source: 'variation_added',
          variation_modifier_group_id: 21,
          mode: 'override',
          name_override: 'Merchant Large Add-ons',
          is_active: true,
        },
      ],
      'merchant-variation-modifier-option-overrides': [
        {
          merchant_product_id: 901,
          variation_id: 501,
          target_option_source: 'variation_added',
          variation_modifier_option_id: 201,
          mode: 'override',
          name_override: 'Merchant Cheese Burst',
          price_adjustment_override: 35,
          is_active: true,
        },
      ],
      'prod-variations': [
        {
          id: 501,
          product_id: 100,
          modifier_behavior_mode: 'variation_specific',
        },
      ],
    })

    const service = new ModifierResolverService(payload as any)
    const groups = await service.resolveEffectiveGroups({
      productId: 100,
      variationId: 501,
      merchantProductId: 901,
    })

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      name: 'Merchant Large Add-ons',
      source: 'merchant-variation-overridden',
    })
    expect(groups[0].options[0]).toMatchObject({
      name: 'Merchant Cheese Burst',
      priceAdjustment: 35,
      source: 'merchant-variation-overridden',
    })
  })
})

describe('normalizeOrderItemOptionsSnapshot', () => {
  it('keeps structured variation and modifier snapshot entries', () => {
    const snapshot = normalizeOrderItemOptionsSnapshot([
      {
        entryType: 'variation',
        name: 'Large',
        selectedVariationId: 77,
        selectedVariationName: 'Large',
        price: 0,
      },
      {
        entryType: 'modifier',
        sourceType: 'variation-added',
        groupId: 11,
        groupName: 'Add-ons',
        optionId: 101,
        optionName: 'Cheese',
        name: 'Cheese',
        price: 20,
      },
    ])

    expect(snapshot).toHaveLength(2)
    expect(snapshot[0]).toMatchObject({
      entryType: 'variation',
      selectedVariationId: 77,
      name: 'Large',
    })
    expect(snapshot[1]).toMatchObject({
      entryType: 'modifier',
      sourceType: 'variation-added',
      groupId: 11,
      optionId: 101,
      price: 20,
    })
  })

  it('preserves merchant-level modifier source types in snapshots', () => {
    const snapshot = normalizeOrderItemOptionsSnapshot([
      {
        entryType: 'modifier',
        sourceType: 'merchant-variation-overridden',
        groupId: 12,
        groupName: 'Merchant Add-ons',
        optionId: 202,
        optionName: 'Merchant Cheese',
        name: 'Merchant Cheese',
        price: 30,
      },
    ])

    expect(snapshot).toEqual([
      {
        entryType: 'modifier',
        sourceType: 'merchant-variation-overridden',
        groupId: 12,
        groupName: 'Merchant Add-ons',
        optionId: 202,
        optionName: 'Merchant Cheese',
        selectedVariationId: undefined,
        selectedVariationName: undefined,
        name: 'Merchant Cheese',
        price: 30,
      },
    ])
  })

  it('normalizes legacy simple snapshot entries without dropping them', () => {
    const snapshot = normalizeOrderItemOptionsSnapshot([
      { name: 'Java Rice', price: 20 },
    ])

    expect(snapshot).toEqual([
      {
        entryType: 'modifier',
        sourceType: undefined,
        groupId: undefined,
        groupName: undefined,
        optionId: undefined,
        optionName: 'Java Rice',
        selectedVariationId: undefined,
        selectedVariationName: undefined,
        name: 'Java Rice',
        price: 20,
      },
    ])
  })
})
