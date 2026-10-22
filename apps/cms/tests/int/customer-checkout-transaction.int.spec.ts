import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import { authenticateCustomerOrMember } from '../../src/utils/mediaLibrary'
import { resolveAuthenticatedCustomer } from '../../src/services/sellerShippingCheckout'
import { POST } from '../../src/app/api/customer/checkout/transaction/route'

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return { ...actual, getPayload: vi.fn() }
})
vi.mock('@payload-config', () => ({ default: Promise.resolve({}) }))
vi.mock('../../src/utils/mediaLibrary', () => ({ authenticateCustomerOrMember: vi.fn() }))
vi.mock('../../src/services/sellerShippingCheckout', () => ({ resolveAuthenticatedCustomer: vi.fn() }))

const body = {
  orderId: '12', paymentIntentId: 'pi_verified', amount: 1250, currency: 'PHP', paymentMethod: 'gcash',
}
const providerIntent = {
  data: { id: 'pi_verified', attributes: {
    amount: 125000, currency: 'PHP', status: 'awaiting_payment_method',
    metadata: { order_id: '12', user_id: '7' },
  } },
}
let payload: any
let transaction: Record<string, unknown> | null

function request(payloadBody: unknown = body) {
  return new NextRequest('http://localhost/api/customer/checkout/transaction', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payloadBody),
  })
}

describe('customer checkout transaction endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('PAYMONGO_SANDBOX', 'true')
    vi.stubEnv('PAYMONGO_SANDBOX_API_KEY', 'sk_test_checkout')
    transaction = null
    payload = {
      findByID: vi.fn().mockResolvedValue({ id: 12, customer: 30, status: 'pending', total: 1250 }),
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'transactions' && transaction) return { docs: [transaction] }
        return { docs: [] }
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        transaction = { id: 90, ...data }
        return transaction
      }),
    }
    vi.mocked(getPayload).mockResolvedValue(payload)
    vi.mocked(authenticateCustomerOrMember).mockResolvedValue({ id: 7, role: 'customer' } as never)
    vi.mocked(resolveAuthenticatedCustomer).mockResolvedValue({ id: 30 } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(providerIntent), { status: 200 })))
  })

  it('verifies ownership, order totals and PayMongo intent before creating pending transaction with overrideAccess', async () => {
    const response = await POST(request())
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ transactionId: '90', status: 'pending', reused: false })
    expect(payload.create).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'transactions', overrideAccess: true,
      data: expect.objectContaining({ order: 12, payment_intent_id: 'pi_verified', amount: 1250, currency: 'PHP', status: 'pending' }),
    }))
    expect(fetch).toHaveBeenCalledWith('https://api.paymongo.com/v1/payment_intents/pi_verified', expect.any(Object))
  })

  it('returns the same transaction on an exact retry without another PayMongo request', async () => {
    transaction = {
      id: 90,
      order: 12,
      payment_intent_id: 'pi_verified',
      payment_method: 'gcash',
      amount: 1250,
      currency: 'PHP',
      status: 'pending',
    }
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ transactionId: '90', reused: true })
    expect(fetch).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('rejects an order owned by another customer', async () => {
    payload.findByID.mockResolvedValue({ id: 12, customer: 99, status: 'pending', total: 1250 })
    const response = await POST(request())
    expect(response.status).toBe(403)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('rejects amount mismatch and provider intent metadata mismatch', async () => {
    const amountResponse = await POST(request({ ...body, amount: 10 }))
    expect(amountResponse.status).toBe(400)
    const wrongIntent = structuredClone(providerIntent)
    wrongIntent.data.attributes.metadata.user_id = '8'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(wrongIntent), { status: 200 })))
    const intentResponse = await POST(request())
    expect(intentResponse.status).toBe(422)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('does not create a second pending transaction for the order', async () => {
    payload.find.mockImplementation(async ({ collection, where }: { collection: string; where?: any }) => ({
      docs: collection === 'transactions' && where?.and
        ? [{ id: 91, order: 12, payment_intent_id: 'pi_other', amount: 1250, status: 'pending' }]
        : [],
    }))
    const response = await POST(request())
    expect(response.status).toBe(409)
    expect(payload.create).not.toHaveBeenCalled()
  })
})
