import { beforeEach, describe, expect, it, vi } from 'vitest'

const { paymongoConfig, paymongoFetch, paymongoErrorMessage } = vi.hoisted(() => ({
  paymongoConfig: vi.fn(() => ({ secretKey: 'test-secret' })),
  paymongoFetch: vi.fn(),
  paymongoErrorMessage: vi.fn(() => 'Gateway error'),
}))

vi.mock('../../src/app/api/admin/finance/payments/gateway', () => ({
  paymongoConfig,
  paymongoFetch,
  paymongoErrorMessage,
}))

import {
  prepareSellerShippingCancellation,
  SellerShippingCancellationError,
} from '../../src/services/sellerShippingCancellation'

function payloadWithTransactions(docs: Record<string, unknown>[]) {
  return {
    find: vi.fn(async () => ({ docs })),
  } as never
}

describe('seller-managed cancellation refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    paymongoConfig.mockReturnValue({ secretKey: 'test-secret' })
  })

  it('cancels an in-flight payment intent before the order is cancelled', async () => {
    paymongoFetch.mockResolvedValue({ ok: true, status: 200, data: {} })

    const result = await prepareSellerShippingCancellation(payloadWithTransactions([
      { status: 'pending', payment_intent_id: 'pi_pending' },
    ]), 42)

    expect(result).toEqual({ refundRequested: 0, pendingPaymentCancelled: true })
    expect(paymongoFetch).toHaveBeenCalledWith(
      'test-secret',
      '/v1/payment_intents/pi_pending/cancel',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('requests a full refund of each captured payment balance', async () => {
    paymongoFetch.mockResolvedValue({ ok: true, status: 200, data: {} })

    const result = await prepareSellerShippingCancellation(payloadWithTransactions([
      { status: 'paid', amount: 150.5, refunded_amount: 20.5, payment_id: 'pay_captured' },
    ]), 42)

    expect(result).toEqual({ refundRequested: 130, pendingPaymentCancelled: false })
    expect(paymongoFetch).toHaveBeenCalledWith(
      'test-secret',
      '/v1/refunds',
      expect.objectContaining({
        body: {
          data: {
            attributes: expect.objectContaining({
              amount: 13000,
              payment_id: 'pay_captured',
            }),
          },
        },
        idempotencyKey: 'seller-shipping-cancel-42-pay_captured-13000',
      }),
    )
  })

  it('returns a gateway error when a pending payment cannot be safely cancelled', async () => {
    paymongoFetch.mockResolvedValue({ ok: false, status: 409, data: {} })

    await expect(prepareSellerShippingCancellation(payloadWithTransactions([
      { status: 'pending', payment_intent_id: 'pi_pending' },
    ]), 42)).rejects.toMatchObject({
      name: 'SellerShippingCancellationError',
      status: 502,
      message: 'Unable to stop the pending payment safely: Gateway error',
    } satisfies Partial<SellerShippingCancellationError>)
  })
})
