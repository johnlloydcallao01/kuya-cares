import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticateAdmin } from '../../src/utils/mediaLibrary'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  createLocalReq: vi.fn(),
  initTransaction: vi.fn(),
  commitTransaction: vi.fn(),
  killTransaction: vi.fn(),
  authenticateAdmin: vi.fn(),
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: mocks.getPayload,
    createLocalReq: mocks.createLocalReq,
    initTransaction: mocks.initTransaction,
    commitTransaction: mocks.commitTransaction,
    killTransaction: mocks.killTransaction,
  }
})
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('../../src/utils/mediaLibrary', () => ({ authenticateAdmin: mocks.authenticateAdmin }))

import { PUT } from '../../src/app/api/admin/merchants/[id]/shipping-settings/route'

const settings = {
  version: 1,
  pickup: { enabled: true, instructions: null },
  zones: [],
}

function makePayload(find: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue({ docs: [] })) {
  return {
    find,
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  }
}

describe('admin merchant shipping settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createLocalReq.mockResolvedValue({ payload: {} })
    mocks.initTransaction.mockResolvedValue(true)
    mocks.commitTransaction.mockResolvedValue(undefined)
    mocks.killTransaction.mockResolvedValue(undefined)
    vi.mocked(authenticateAdmin).mockResolvedValue({ id: 2, role: 'admin' })
  })

  it('locks and saves pickup settings and commits the shared Payload transaction', async () => {
    const payload = makePayload(vi.fn()
      .mockResolvedValueOnce({ docs: [{ id: 6, outletName: 'Outlet 6', seller_pickup_enabled: false }] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [{
          id: 6,
          outletName: 'Outlet 6',
          seller_pickup_enabled: true,
          seller_pickup_instructions: null,
        }],
      })
      .mockResolvedValueOnce({ docs: [] }))
    mocks.getPayload.mockResolvedValue(payload)

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/merchants/6/shipping-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerShippingSettings: settings }),
      }),
      { params: Promise.resolve({ id: '6' }) },
    )

    expect(response.status).toBe(200)
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'merchants',
      id: 6,
      data: { seller_pickup_enabled: true, seller_pickup_instructions: null },
      req: expect.anything(),
    }))
    expect(payload.find).toHaveBeenLastCalledWith(expect.objectContaining({
      collection: 'seller-shipping-zones',
      req: expect.anything(),
    }))
    expect(payload.find.mock.calls[2][0]).toEqual(expect.objectContaining({
      collection: 'merchants',
      req: expect.anything(),
    }))
    const result = await response.json()
    expect(result.outlet.sellerShippingSettings.pickup.enabled).toBe(true)
    expect(payload.find.mock.invocationCallOrder[1]).toBeGreaterThan(
      payload.update.mock.invocationCallOrder[0],
    )
    expect(mocks.commitTransaction).toHaveBeenCalledOnce()
    expect(mocks.killTransaction).not.toHaveBeenCalled()
  })

  it('rolls back the entire settings update when a zone write fails', async () => {
    const payload = makePayload(vi.fn(async ({ collection }: { collection: string }) => ({
      docs: collection === 'merchants'
        ? [{ id: 6, outletName: 'Outlet 6', seller_pickup_enabled: false }]
        : [],
    })))
    payload.create.mockRejectedValue(new Error('zone insert failed'))
    mocks.getPayload.mockResolvedValue(payload)
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const zoneSettings = {
      ...settings,
      zones: [{
        id: 'zone-1',
        name: 'Zone 1',
        enabled: true,
        areas: [{ city: 'Manila' }],
        geometry: null,
        deliveryFee: 10,
        minimumOrderAmount: 0,
        freeDeliveryThreshold: null,
        estimatedDeliveryMinMinutes: 0,
        estimatedDeliveryMaxMinutes: 0,
      }],
    }

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/merchants/6/shipping-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerShippingSettings: zoneSettings }),
      }),
      { params: Promise.resolve({ id: '6' }) },
    )

    expect(response.status).toBe(500)
    expect(mocks.commitTransaction).not.toHaveBeenCalled()
    expect(mocks.killTransaction).toHaveBeenCalledOnce()
    logError.mockRestore()
  })

  it('rolls back when the pickup value fails persisted verification', async () => {
    const payload = makePayload(vi.fn()
      .mockResolvedValueOnce({ docs: [{ id: 6, outletName: 'Outlet 6' }] })
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({
        docs: [{ id: 6, outletName: 'Outlet 6', seller_pickup_enabled: false }],
      })
      .mockResolvedValueOnce({ docs: [] }))
    mocks.getPayload.mockResolvedValue(payload)
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/merchants/6/shipping-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerShippingSettings: settings }),
      }),
      { params: Promise.resolve({ id: '6' }) },
    )

    expect(response.status).toBe(500)
    expect(mocks.commitTransaction).not.toHaveBeenCalled()
    expect(mocks.killTransaction).toHaveBeenCalledOnce()
    expect(logError).toHaveBeenCalledWith(
      '[admin/merchants/[id]/shipping-settings] PUT failed:',
      expect.objectContaining({ message: 'Shipping settings save verification failed' }),
    )
    logError.mockRestore()
  })
})
