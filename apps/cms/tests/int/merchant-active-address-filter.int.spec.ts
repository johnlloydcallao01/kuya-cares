import { describe, expect, it, vi } from 'vitest'
import { Merchants } from '../../src/collections/Merchants'

describe('merchant active address relationship filter', () => {
  it('uses the existing merchant vendor on partial updates without vendor data', async () => {
    const field = Merchants.fields.find(
      (candidate) => 'name' in candidate && candidate.name === 'activeAddress',
    )
    if (!field || !('filterOptions' in field) || typeof field.filterOptions !== 'function') {
      throw new Error('Merchants.activeAddress filterOptions is not configured')
    }

    const findByID = vi.fn().mockResolvedValue({
      id: 6,
      vendor: { id: 12, user: { id: 34 } },
    })
    const where = await field.filterOptions({
      relationTo: 'addresses',
      data: { seller_shipping_settings: { version: 1 } },
      id: 6,
      user: {},
      req: { payload: { findByID } },
    } as never)

    expect(where).toEqual({ user: { equals: 34 } })
    expect(findByID).toHaveBeenCalledWith({
      collection: 'merchants',
      id: 6,
      depth: 1,
      overrideAccess: true,
    })
  })

  it('resolves the vendor user when partial update data contains only a vendor ID', async () => {
    const field = Merchants.fields.find(
      (candidate) => 'name' in candidate && candidate.name === 'activeAddress',
    )
    if (!field || !('filterOptions' in field) || typeof field.filterOptions !== 'function') {
      throw new Error('Merchants.activeAddress filterOptions is not configured')
    }

    const findByID = vi.fn().mockResolvedValue({
      id: 12,
      user: { id: 34 },
    })
    const where = await field.filterOptions({
      relationTo: 'addresses',
      data: { vendor: { id: 12 }, seller_shipping_settings: { version: 1 } },
      id: 6,
      user: {},
      req: { payload: { findByID } },
    } as never)

    expect(where).toEqual({ user: { equals: 34 } })
    expect(findByID).toHaveBeenCalledWith({
      collection: 'vendors',
      id: 12,
      depth: 1,
    })
  })

  it('keeps the outlet current address valid during unrelated updates', async () => {
    const field = Merchants.fields.find(
      (candidate) => 'name' in candidate && candidate.name === 'activeAddress',
    )
    if (!field || !('filterOptions' in field) || typeof field.filterOptions !== 'function') {
      throw new Error('Merchants.activeAddress filterOptions is not configured')
    }

    const findByID = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'merchants') {
        return Promise.resolve({
          id: 6,
          vendor: { id: 12, user: { id: 34 } },
          activeAddress: { id: 9 },
        })
      }
      return Promise.resolve({ id: 12, user: { id: 34 } })
    })
    const where = await field.filterOptions({
      relationTo: 'addresses',
      data: { vendor: 12, seller_shipping_settings: { version: 1 } },
      id: 6,
      user: {},
      req: { payload: { findByID } },
    } as never)

    expect(where).toEqual({
      or: [
        { user: { equals: 34 } },
        { id: { equals: 9 } },
      ],
    })
  })
})
