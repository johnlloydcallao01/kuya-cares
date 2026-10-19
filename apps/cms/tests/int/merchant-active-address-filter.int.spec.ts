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
})
