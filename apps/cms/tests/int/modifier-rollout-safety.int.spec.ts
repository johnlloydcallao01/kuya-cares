import { describe, expect, it } from 'vitest'
import { CartItems } from '@/collections/CartItems'
import { OrderItems } from '@/collections/OrderItems'

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
    update: async ({
      collection,
      id,
      data,
    }: {
      collection: string
      id: number | string
      data: Record<string, unknown>
    }) => {
      const docs = collections[collection] || []
      const index = docs.findIndex((doc) => String(doc.id) === String(id))
      if (index === -1) {
        throw new Error(`Document not found in ${collection} for id ${id}`)
      }

      docs[index] = {
        ...docs[index],
        ...data,
      }

      return docs[index]
    },
  }
}

function getCartBeforeChangeHook() {
  const hook = CartItems.hooks?.beforeChange?.[0]
  if (!hook) {
    throw new Error('CartItems beforeChange hook is not configured')
  }

  return hook
}

function getOrderBeforeValidateHook() {
  const hook = OrderItems.hooks?.beforeValidate?.[0]
  if (!hook) {
    throw new Error('OrderItems beforeValidate hook is not configured')
  }

  return hook
}

function createBaseCollections(overrides: CollectionMap = {}): CollectionMap {
  return {
    products: [
      {
        id: 100,
        name: 'Burger',
        productType: 'simple',
        createdByVendor: 700,
        createdByMerchant: null,
      },
    ],
    merchants: [
      {
        id: 300,
        outletName: 'Tap2Go Burgers',
        vendor: 700,
      },
    ],
    'merchant-products': [
      {
        id: 900,
        merchant_id: 300,
        product_id: 100,
      },
    ],
    'cart-items': [],
    'modifier-groups': [],
    'modifier-options': [],
    'variation-modifier-groups': [],
    'variation-modifier-options': [],
    'variation-modifier-group-overrides': [],
    'variation-modifier-option-overrides': [],
    'merchant-product-modifier-group-overrides': [],
    'merchant-product-modifier-option-overrides': [],
    'merchant-variation-modifier-group-overrides': [],
    'merchant-variation-modifier-option-overrides': [],
    'prod-variations': [],
    ...overrides,
  }
}

describe('Phase 11 rollout safety - CartItems hook', () => {
  it('accepts simple products with product-level modifiers', async () => {
    const payload = createMockPayload(
      createBaseCollections({
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
      }),
    )

    const hook = getCartBeforeChangeHook()
    const result = (await hook({
      data: {
        customer: 501,
        merchant: 300,
        product: 100,
        merchantProduct: 900,
        quantity: 2,
        priceAtAdd: 120,
        selectedModifiers: [{ groupId: 11, optionId: 101 }],
        selectedAddons: [],
        specialInstructions: ' No onions ',
      },
      operation: 'create',
      req: { payload },
      originalDoc: {},
    } as any)) as Record<string, any>

    expect(result.selectedModifiers).toEqual([
      {
        groupId: 11,
        groupName: 'Spice Level',
        optionId: 101,
        name: 'Mild',
        price: 0,
        isRequired: true,
        source: 'product-base',
      },
    ])
    expect(result.subtotal).toBe(240)
    expect(typeof result.itemHash).toBe('string')
    expect(result.itemHash.length).toBe(32)
  })

  it('allows optional modifier groups to be skipped even if min_selections was configured above zero', async () => {
    const payload = createMockPayload(
      createBaseCollections({
        'modifier-groups': [
          {
            id: 11,
            product_id: 100,
            name: 'Rice Choice',
            selection_type: 'single',
            is_required: false,
            min_selections: 1,
            max_selections: 1,
            sort_order: 0,
          },
        ],
        'modifier-options': [
          {
            id: 101,
            modifier_group_id: 11,
            name: 'Java Rice',
            price_adjustment: 25,
            is_default: false,
            is_available: true,
            sort_order: 0,
          },
        ],
      }),
    )

    const hook = getCartBeforeChangeHook()
    const result = (await hook({
      data: {
        customer: 501,
        merchant: 300,
        product: 100,
        merchantProduct: 900,
        quantity: 1,
        priceAtAdd: 120,
        selectedModifiers: [],
        selectedAddons: [],
      },
      operation: 'create',
      req: { payload },
      originalDoc: {},
    } as any)) as Record<string, any>

    expect(result.selectedModifiers).toEqual([])
    expect(result.subtotal).toBe(120)
  })

  it('accepts variable products that inherit product-level modifiers', async () => {
    const payload = createMockPayload(
      createBaseCollections({
        products: [
          {
            id: 100,
            name: 'Burger',
            productType: 'variable',
            createdByVendor: 700,
            createdByMerchant: null,
          },
        ],
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
            price_adjustment: 10,
            is_default: true,
            is_available: true,
            sort_order: 0,
          },
        ],
        'prod-variations': [
          {
            id: 501,
            product_id: 100,
            modifier_behavior_mode: 'inherit_product',
          },
        ],
      }),
    )

    const hook = getCartBeforeChangeHook()
    const result = (await hook({
      data: {
        customer: 501,
        merchant: 300,
        product: 100,
        merchantProduct: 900,
        quantity: 1,
        priceAtAdd: 150,
        selectedVariation: 501,
        selectedModifiers: [{ groupId: 11, optionId: 101 }],
        selectedAddons: [],
        specialInstructions: '',
      },
      operation: 'create',
      req: { payload },
      originalDoc: {},
    } as any)) as Record<string, any>

    expect(result.selectedVariation).toBe(501)
    expect(result.selectedModifiers[0]).toMatchObject({
      groupId: 11,
      optionId: 101,
      source: 'product-base',
    })
    expect(result.subtotal).toBe(160)
  })

  it('accepts variation-specific modifiers and normalizes them through the cart hook', async () => {
    const payload = createMockPayload(
      createBaseCollections({
        products: [
          {
            id: 100,
            name: 'Pizza',
            productType: 'variable',
            createdByVendor: 700,
            createdByMerchant: null,
          },
        ],
        'modifier-groups': [
          {
            id: 11,
            product_id: 100,
            name: 'Should not be used',
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
            name: 'Ignored',
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
            sort_order: 0,
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
        'prod-variations': [
          {
            id: 501,
            product_id: 100,
            modifier_behavior_mode: 'variation_specific',
          },
        ],
      }),
    )

    const hook = getCartBeforeChangeHook()
    const result = (await hook({
      data: {
        customer: 501,
        merchant: 300,
        product: 100,
        merchantProduct: 900,
        quantity: 1,
        priceAtAdd: 220,
        selectedVariation: 501,
        selectedModifiers: [{ groupId: 21, optionId: 201 }],
        selectedAddons: [],
      },
      operation: 'create',
      req: { payload },
      originalDoc: {},
    } as any)) as Record<string, any>

    expect(result.selectedModifiers).toEqual([
      {
        groupId: 21,
        groupName: 'Large-only toppings',
        optionId: 201,
        name: 'Cheese Burst',
        price: 25,
        isRequired: false,
        source: 'variation-added',
      },
    ])
    expect(result.subtotal).toBe(245)
  })

  it('rejects inherited product modifiers when a variation is strict variation-specific', async () => {
    const payload = createMockPayload(
      createBaseCollections({
        products: [
          {
            id: 100,
            name: 'Pizza',
            productType: 'variable',
            createdByVendor: 700,
            createdByMerchant: null,
          },
        ],
        'modifier-groups': [
          {
            id: 11,
            product_id: 100,
            name: 'Base toppings',
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
            name: 'Pepper',
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
            sort_order: 0,
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
        'prod-variations': [
          {
            id: 501,
            product_id: 100,
            modifier_behavior_mode: 'variation_specific',
          },
        ],
      }),
    )

    const hook = getCartBeforeChangeHook()

    await expect(
      hook({
        data: {
          customer: 501,
          merchant: 300,
          product: 100,
          merchantProduct: 900,
          quantity: 1,
          priceAtAdd: 220,
          selectedVariation: 501,
          selectedModifiers: [{ groupId: 11, optionId: 101 }],
          selectedAddons: [],
        },
        operation: 'create',
        req: { payload },
        originalDoc: {},
      } as any),
    ).rejects.toThrow('Modifier group 11 is not valid for this selection')
  })

  it('rejects hidden hybrid options in the actual cart validation flow', async () => {
    const payload = createMockPayload(
      createBaseCollections({
        products: [
          {
            id: 100,
            name: 'Burger',
            productType: 'variable',
            createdByVendor: 700,
            createdByMerchant: null,
          },
        ],
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
            price_adjustment: 15,
            is_default: false,
            is_available: true,
            sort_order: 1,
          },
        ],
        'variation-modifier-option-overrides': [
          {
            variation_id: 501,
            base_modifier_option_id: 102,
            mode: 'hide',
            is_active: true,
          },
        ],
        'prod-variations': [
          {
            id: 501,
            product_id: 100,
            modifier_behavior_mode: 'hybrid',
          },
        ],
      }),
    )

    const hook = getCartBeforeChangeHook()

    await expect(
      hook({
        data: {
          customer: 501,
          merchant: 300,
          product: 100,
          merchantProduct: 900,
          quantity: 1,
          priceAtAdd: 180,
          selectedVariation: 501,
          selectedModifiers: [{ groupId: 11, optionId: 102 }],
          selectedAddons: [],
        },
        operation: 'create',
        req: { payload },
        originalDoc: {},
      } as any),
    ).rejects.toThrow('Modifier option 102 is not available for group "Sauce"')
  })

  it('accepts hybrid overrides and carries the overridden source into normalized cart modifiers', async () => {
    const payload = createMockPayload(
      createBaseCollections({
        products: [
          {
            id: 100,
            name: 'Burger',
            productType: 'variable',
            createdByVendor: 700,
            createdByMerchant: null,
          },
        ],
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
        ],
        'variation-modifier-group-overrides': [
          {
            variation_id: 501,
            base_modifier_group_id: 11,
            mode: 'override',
            name_override: 'Premium Sauce',
            required_behavior: 'required',
            is_active: true,
          },
        ],
        'prod-variations': [
          {
            id: 501,
            product_id: 100,
            modifier_behavior_mode: 'hybrid',
          },
        ],
      }),
    )

    const hook = getCartBeforeChangeHook()
    const result = (await hook({
      data: {
        customer: 501,
        merchant: 300,
        product: 100,
        merchantProduct: 900,
        quantity: 1,
        priceAtAdd: 180,
        selectedVariation: 501,
        selectedModifiers: [{ groupId: 11, optionId: 101 }],
        selectedAddons: [],
      },
      operation: 'create',
      req: { payload },
      originalDoc: {},
    } as any)) as Record<string, any>

    expect(result.selectedModifiers).toEqual([
      {
        groupId: 11,
        groupName: 'Premium Sauce',
        optionId: 101,
        name: 'Ketchup',
        price: 0,
        isRequired: true,
        source: 'variation-overridden',
      },
    ])
  })
})

describe('Phase 11 rollout safety - OrderItems hook', () => {
  it('normalizes structured merchant-level snapshot entries through the collection hook', async () => {
    const hook = getOrderBeforeValidateHook()

    const result = hook({
      data: {
        order: 1,
        product_name_snapshot: 'Burger',
        price_at_purchase: 180,
        quantity: 1,
        total_price: 210,
        options_snapshot: [
          {
            entryType: 'variation',
            selectedVariationId: 501,
            selectedVariationName: 'Large',
            name: 'Large',
            price: 0,
          },
          {
            entryType: 'modifier',
            sourceType: 'merchant-variation-overridden',
            groupId: 21,
            groupName: 'Merchant Add-ons',
            optionId: 201,
            optionName: 'Merchant Cheese Burst',
            name: 'Merchant Cheese Burst',
            price: 30,
          },
        ],
      },
    } as any) as Record<string, any>

    expect(result.options_snapshot).toEqual([
      {
        entryType: 'variation',
        sourceType: undefined,
        groupId: undefined,
        groupName: undefined,
        optionId: undefined,
        optionName: 'Large',
        selectedVariationId: 501,
        selectedVariationName: 'Large',
        name: 'Large',
        price: 0,
      },
      {
        entryType: 'modifier',
        sourceType: 'merchant-variation-overridden',
        groupId: 21,
        groupName: 'Merchant Add-ons',
        optionId: 201,
        optionName: 'Merchant Cheese Burst',
        selectedVariationId: undefined,
        selectedVariationName: undefined,
        name: 'Merchant Cheese Burst',
        price: 30,
      },
    ])
  })

  it('normalizes legacy snapshot entries through the collection hook', async () => {
    const hook = getOrderBeforeValidateHook()

    const result = hook({
      data: {
        order: 1,
        product_name_snapshot: 'Burger',
        price_at_purchase: 180,
        quantity: 1,
        total_price: 200,
        options_snapshot: [{ name: 'Java Rice', price: 20 }],
      },
    } as any) as Record<string, any>

    expect(result.options_snapshot).toEqual([
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
