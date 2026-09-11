import { describe, expect, it } from 'vitest'
import {
  isStoreOpen,
  findNextOpening,
  normalizeWeeklyHours,
  validateSpecialHours,
  validateWeeklyHours,
} from '../../src/utils/storeHours'

const weekly = (friday: { open: string; close: string }[] = []) => ({
  monday: [], tuesday: [], wednesday: [], thursday: [], friday, saturday: [], sunday: [],
})

describe('store hours', () => {
  it('normalizes legacy single periods and preserves canonical arrays', () => {
    expect(normalizeWeeklyHours({ Monday: { open: '09:00', close: '17:00', closed: false } })).toEqual({
      monday: [{ open: '09:00', close: '17:00' }], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
    })
    expect(validateWeeklyHours(weekly([{ open: '11:00', close: '14:00' }, { open: '17:00', close: '22:00' }])).friday).toHaveLength(2)
  })

  it('evaluates schedules in the merchant timezone', () => {
    const merchant = { timezone: 'Asia/Manila', operatingHours: { ...weekly(), thursday: [{ open: '09:00', close: '17:00' }] } }
    expect(isStoreOpen(merchant, new Date('2026-09-03T06:00:00.000Z')).isOpen).toBe(true)
    expect(isStoreOpen(merchant, new Date('2026-09-03T10:00:00.000Z')).isOpen).toBe(false)
  })

  it('handles periods spanning midnight from the previous day', () => {
    const merchant = { timezone: 'Asia/Manila', operatingHours: weekly([{ open: '22:00', close: '02:00' }]) }
    expect(isStoreOpen(merchant, new Date('2026-09-04T17:00:00.000Z')).isOpen).toBe(true)
    expect(isStoreOpen(merchant, new Date('2026-09-04T19:30:00.000Z')).isOpen).toBe(false)
  })

  it('gives a special closure priority over regular hours', () => {
    const merchant = {
      timezone: 'Asia/Manila',
      operatingHours: { ...weekly(), thursday: [{ open: '09:00', close: '17:00' }] },
      specialHours: [{ date: '2026-09-03', isClosed: true, reason: 'Holiday' }],
    }
    expect(isStoreOpen(merchant, new Date('2026-09-03T06:00:00.000Z'))).toMatchObject({ isOpen: false, reason: 'special-closed' })
  })

  it('uses delivery hours when they contain a schedule and otherwise falls back', () => {
    const merchant = {
      timezone: 'Asia/Manila',
      operatingHours: { ...weekly(), thursday: [{ open: '09:00', close: '17:00' }] },
      delivery_hours: { ...weekly(), thursday: [{ open: '11:00', close: '13:00' }] },
    }
    expect(isStoreOpen(merchant, new Date('2026-09-03T02:00:00.000Z')).isOpen).toBe(false)
    expect(isStoreOpen(merchant, new Date('2026-09-03T04:00:00.000Z')).isOpen).toBe(true)
    expect(isStoreOpen({ ...merchant, delivery_hours: null }, new Date('2026-09-03T03:00:00.000Z')).isOpen).toBe(true)
  })

  it('rejects invalid times and dates', () => {
    expect(() => validateWeeklyHours({ ...weekly(), monday: [{ open: '9:00', close: '17:00' }] })).toThrow()
    expect(() => validateWeeklyHours({ ...weekly(), monday: [{ open: '09:00' }] })).toThrow()
    expect(() => validateSpecialHours([{ date: '2026-02-30', isClosed: true }])).toThrow()
  })

  it('returns the next opening instant for a closed schedule', () => {
    const merchant = { timezone: 'Asia/Manila', operatingHours: { ...weekly(), friday: [{ open: '09:00', close: '10:00' }] } }
    expect(findNextOpening(merchant, new Date('2026-09-03T06:00:00.000Z'))).toBe('2026-09-04T01:00:00.000Z')
  })

  it('uses zone-specific hours when a delivery zone is selected', () => {
    const merchant = {
      timezone: 'Asia/Manila',
      operatingHours: { ...weekly(), thursday: [{ open: '09:00', close: '17:00' }] },
      delivery_zones: { premium: { hours: { ...weekly(), thursday: [{ open: '20:00', close: '21:00' }] } } },
    }
    expect(isStoreOpen(merchant, new Date('2026-09-03T12:30:00.000Z')).isOpen).toBe(false)
    expect(isStoreOpen(merchant, new Date('2026-09-03T12:30:00.000Z'), 'premium').isOpen).toBe(true)
  })
})
