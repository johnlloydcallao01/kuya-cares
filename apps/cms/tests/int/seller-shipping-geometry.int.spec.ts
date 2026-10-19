import { describe, expect, it } from 'vitest'
import {
  getSellerShippingOptions,
  parseSellerShippingSettings,
} from '../../src/services/SellerShippingService'

const deliveryBoundary = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [120.9, 14.5],
      [121.1, 14.5],
      [121.1, 14.8],
      [120.9, 14.8],
      [120.9, 14.5],
    ],
  ],
}

const baseAddress = {
  country: 'Philippines',
  latitude: 14.65,
  longitude: 120.99,
}

function settingsForGeometry(geometry: typeof deliveryBoundary) {
  return parseSellerShippingSettings({
    pickup: { enabled: true },
    zones: [
      {
        id: 'drawn-zone',
        name: 'Drawn zone',
        areas: [],
        geometry,
        deliveryFee: 85,
      },
    ],
  })
}

describe('seller shipping polygon coverage', () => {
  it('matches an address point inside a drawn delivery boundary', () => {
    const options = getSellerShippingOptions({
      settings: settingsForGeometry(deliveryBoundary),
      address: baseAddress,
      cartSubtotal: 500,
    })

    expect(options[0]).toMatchObject({
      id: 'delivery:drawn-zone',
      fee: 85,
    })
  })

  it('allows a drawn boundary with no zone name and uses a generic delivery label', () => {
    const settings = parseSellerShippingSettings({
      pickup: { enabled: false },
      zones: [
        {
          id: 'unnamed-zone',
          name: '',
          areas: [],
          geometry: deliveryBoundary,
          deliveryFee: 85,
        },
      ],
    })
    const options = getSellerShippingOptions({
      settings,
      address: baseAddress,
      cartSubtotal: 500,
    })

    expect(options[0]).toMatchObject({
      id: 'delivery:unnamed-zone',
      name: 'Seller delivery',
      zoneName: null,
      fee: 85,
    })
  })

  it('includes points on the polygon boundary', () => {
    const options = getSellerShippingOptions({
      settings: settingsForGeometry(deliveryBoundary),
      address: { ...baseAddress, latitude: 14.5 },
      cartSubtotal: 500,
    })

    expect(options[0]).toMatchObject({ id: 'delivery:drawn-zone' })
  })

  it('matches any polygon in a multipolygon boundary', () => {
    const settings = parseSellerShippingSettings({
      pickup: { enabled: true },
      zones: [
        {
          id: 'islands-zone',
          name: 'Islands zone',
          areas: [],
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [
                [
                  [122, 10],
                  [123, 10],
                  [123, 11],
                  [122, 11],
                  [122, 10],
                ],
              ],
              deliveryBoundary.coordinates,
            ],
          },
          deliveryFee: 100,
        },
      ],
    })
    const options = getSellerShippingOptions({
      settings,
      address: baseAddress,
      cartSubtotal: 500,
    })

    expect(options[0]).toMatchObject({ id: 'delivery:islands-zone', fee: 100 })
  })

  it('does not match outside or unlocated addresses and keeps pickup available', () => {
    const settings = settingsForGeometry(deliveryBoundary)
    const outsideOptions = getSellerShippingOptions({
      settings,
      address: { ...baseAddress, latitude: 13 },
      cartSubtotal: 500,
    })
    const unlocatedOptions = getSellerShippingOptions({
      settings,
      address: { country: 'Philippines' },
      cartSubtotal: 500,
    })

    expect(outsideOptions).toEqual([expect.objectContaining({ id: 'pickup', fee: 0 })])
    expect(unlocatedOptions).toEqual([expect.objectContaining({ id: 'pickup', fee: 0 })])
  })

  it('excludes points inside a polygon hole', () => {
    const geometry = {
      type: 'Polygon' as const,
      coordinates: [
        deliveryBoundary.coordinates[0],
        [
          [120.95, 14.6],
          [121.05, 14.6],
          [121.05, 14.7],
          [120.95, 14.7],
          [120.95, 14.6],
        ],
      ],
    }
    const options = getSellerShippingOptions({
      settings: settingsForGeometry(geometry),
      address: baseAddress,
      cartSubtotal: 500,
    })

    expect(options).toEqual([expect.objectContaining({ id: 'pickup', fee: 0 })])
  })

  it('rejects unclosed or out-of-range polygon rings', () => {
    expect(() =>
      settingsForGeometry({
        type: 'Polygon',
        coordinates: [[[120.9, 14.5], [121.1, 14.5], [121.1, 14.8], [120.9, 14.8]]],
      }),
    ).toThrow()
    expect(() =>
      settingsForGeometry({
        type: 'Polygon',
        coordinates: [
          [
            [120.9, 14.5],
            [181, 14.5],
            [121.1, 14.8],
            [120.9, 14.5],
          ],
        ],
      }),
    ).toThrow()
    expect(() =>
      settingsForGeometry({
        type: 'Polygon',
        coordinates: [
          [
            [120.9, 14.5],
            [121.1, 14.8],
            [120.9, 14.8],
            [121.05, 14.5],
            [120.9, 14.5],
          ],
        ],
      }),
    ).toThrow()
  })
})
