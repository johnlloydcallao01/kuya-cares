import { describe, expect, it, vi } from 'vitest'
import {
  getSellerShippingOptions,
  loadSellerShippingSettings,
  parseSellerShippingSettings,
  replaceSellerShippingZones,
  signShippingQuote,
  verifyShippingQuote,
} from '../../src/services/SellerShippingService'
import { repriceActiveMerchantCart } from '../../src/services/sellerShippingCheckout'

const address = {
  country: 'Philippines',
  administrative_area_level_1: 'Metro Manila',
  administrative_area_level_2: 'Metro Manila',
  locality: 'Quezon City',
  barangay: 'Bagong Pag-asa',
  postal_code: '1105',
}

const settings = () => parseSellerShippingSettings({
  pickup: { enabled: true, instructions: 'Use the side entrance.' },
  zones: [
    {
      id: 'quezon-city',
      name: 'Quezon City',
      areas: [{ province: 'Metro Manila', city: 'Quezon City', postalCodes: ['1105'] }],
      deliveryFee: 85,
      minimumOrderAmount: 250,
      freeDeliveryThreshold: 1000,
      estimatedDeliveryMinMinutes: 45,
      estimatedDeliveryMaxMinutes: 90,
    },
    {
      id: 'metro-manila',
      name: 'Metro Manila',
      areas: [{ region: 'Metro Manila' }],
      deliveryFee: 120,
    },
  ],
})

describe('seller-managed shipping', () => {
  it('loads dedicated zones in display order with pickup settings', async () => {
    const payload = {
      find: vi.fn(async () => ({
        docs: [
          {
            id: 2,
            zoneId: 'later',
            name: 'Later zone',
            enabled: true,
            displayOrder: 1,
            areas: [{ city: 'Cebu' }],
            geometry: null,
            deliveryFee: 80,
            minimumOrderAmount: 0,
            freeDeliveryThreshold: null,
            estimatedDeliveryMinMinutes: 0,
            estimatedDeliveryMaxMinutes: 0,
          },
          {
            id: 1,
            zoneId: 'first',
            name: '',
            enabled: true,
            displayOrder: 0,
            areas: [{ city: 'Manila' }],
            geometry: null,
            deliveryFee: 50,
            minimumOrderAmount: 0,
            freeDeliveryThreshold: null,
            estimatedDeliveryMinMinutes: 0,
            estimatedDeliveryMaxMinutes: 0,
          },
        ],
      })),
    }

    const loaded = await loadSellerShippingSettings(payload as never, {
      id: 7,
      seller_pickup_enabled: true,
      seller_pickup_instructions: 'Use the side entrance.',
    })

    expect(loaded.pickup).toEqual({
      enabled: true,
      instructions: 'Use the side entrance.',
    })
    expect(loaded.zones.map((zone) => zone.id)).toEqual(['first', 'later'])
  })

  it('upserts submitted zones and removes zones omitted from the saved settings', async () => {
    const payload = {
      find: vi.fn(async () => ({
        docs: [
          { id: 3, zoneId: 'keep' },
          { id: 4, zoneId: 'remove' },
        ],
      })),
      update: vi.fn(async () => ({})),
      create: vi.fn(async () => ({})),
      delete: vi.fn(async () => ({})),
    }
    const settings = parseSellerShippingSettings({
      zones: [
        { id: 'keep', areas: [{ city: 'Manila' }], deliveryFee: 10 },
        { id: 'add', areas: [{ city: 'Cebu' }], deliveryFee: 20 },
      ],
    })

    await replaceSellerShippingZones(payload as never, 7, settings)

    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      id: 3,
      collection: 'seller-shipping-zones',
      data: expect.objectContaining({ merchant: 7, zoneId: 'keep', displayOrder: 0 }),
      overrideAccess: true,
    }))
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'seller-shipping-zones',
      data: expect.objectContaining({ merchant: 7, zoneId: 'add', displayOrder: 1 }),
      overrideAccess: true,
    }))
    expect(payload.delete).toHaveBeenCalledWith({
      collection: 'seller-shipping-zones',
      id: 4,
      overrideAccess: true,
    })
  })

  it('validates configuration and rejects empty or duplicate delivery zones', () => {
    expect(() => parseSellerShippingSettings({
      zones: [{ id: 'empty', name: 'Empty', areas: [{}], deliveryFee: 10 }],
    })).toThrow()
    expect(() => parseSellerShippingSettings({
      zones: [
        { id: 'same', name: 'First', areas: [{ city: 'Manila' }], deliveryFee: 10 },
        { id: 'same', name: 'Second', areas: [{ city: 'Cebu' }], deliveryFee: 20 },
      ],
    })).toThrow(/Duplicate shipping zone id/)
  })

  it('matches Philippine delivery areas, applies minimums and free-delivery thresholds', () => {
    const config = settings()
    expect(getSellerShippingOptions({ settings: config, address, cartSubtotal: 249 }))
      .toEqual([expect.objectContaining({ id: 'pickup', fee: 0 })])

    expect(getSellerShippingOptions({ settings: config, address, cartSubtotal: 500 })[0])
      .toMatchObject({ id: 'delivery:quezon-city', fee: 85 })
    expect(getSellerShippingOptions({ settings: config, address, cartSubtotal: 1000 })[0])
      .toMatchObject({ id: 'delivery:quezon-city', fee: 0 })
  })

  it('does not quote delivery outside the Philippines but preserves pickup', () => {
    const options = getSellerShippingOptions({
      settings: settings(),
      address: { ...address, country: 'United States' },
      cartSubtotal: 500,
    })
    expect(options).toEqual([expect.objectContaining({ id: 'pickup' })])
    expect(getSellerShippingOptions({
      settings: settings(),
      address: { ...address, country: undefined },
      cartSubtotal: 500,
    })).toEqual([expect.objectContaining({ id: 'pickup' })])
  })

  it('signs quotes, rejects tampering and rejects expired tokens', () => {
    const option = getSellerShippingOptions({ settings: settings(), address, cartSubtotal: 500 })[0]
    const quote = {
      version: 1 as const,
      customerId: '12',
      merchantId: '34',
      addressId: '56',
      cartSubtotal: 500,
      selectedOption: option,
      settingsDigest: 'a'.repeat(64),
    }
    const token = signShippingQuote(quote, 'test-secret', 1000, 100)
    expect(verifyShippingQuote(token, 'test-secret', 500)).toMatchObject({
      customerId: '12',
      merchantId: '34',
      cartSubtotal: 500,
    })
    expect(() => verifyShippingQuote(`${token}x`, 'test-secret', 500)).toThrow(/invalid/)
    expect(() => verifyShippingQuote(token, 'test-secret', 1100)).toThrow(/expired/)
  })

  it('reprices from the current seller listing instead of trusting cart totals or unit prices', async () => {
    const payload = {
      findByID: async ({ collection }: { collection: string }) => {
        if (collection === 'products') {
          return { id: 15, name: 'Test product', approvalStatus: 'approved', productType: 'simple', basePrice: 999 }
        }
        if (collection === 'merchant-products') {
          return {
            id: 25,
            merchant_id: 8,
            product_id: 15,
            is_active: true,
            is_available: true,
            price_override: 150,
          }
        }
        throw new Error(`Unexpected collection ${collection}`)
      },
      find: async () => ({ docs: [] }),
    }
    const result = await repriceActiveMerchantCart(payload as never, [{
      id: 40,
      product: 15,
      merchantProduct: 25,
      quantity: 2,
      priceAtAdd: 1,
      subtotal: 2,
      selectedModifiers: [],
      selectedAddons: [],
    }], 8)

    expect(result.subtotal).toBe(300)
    expect(result.lines[0]).toMatchObject({ unitPrice: 150, totalPrice: 300 })
  })
})
