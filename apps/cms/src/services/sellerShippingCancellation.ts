import type { Payload } from 'payload'
import { paymongoConfig, paymongoErrorMessage, paymongoFetch } from '@/app/api/admin/finance/payments/gateway'
import { relationId } from './sellerShippingCheckout'

type RecordValue = Record<string, unknown>

export class SellerShippingCancellationError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message)
    this.name = 'SellerShippingCancellationError'
  }
}

export async function prepareSellerShippingCancellation(
  payload: Payload,
  orderId: string | number,
): Promise<{ refundRequested: number; pendingPaymentCancelled: boolean }> {
  const transactions = await payload.find({
    collection: 'transactions',
    where: { order: { equals: orderId } },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  const docs = transactions.docs as unknown as RecordValue[]
  const pending = docs.filter((transaction) => transaction.status === 'pending')
  const refundable = docs.filter((transaction) =>
    ['paid', 'partially_refunded'].includes(String(transaction.status)),
  )

  if (pending.length) {
    const { secretKey } = paymongoConfig()
    for (const transaction of pending) {
      const paymentIntentId = typeof transaction.payment_intent_id === 'string'
        ? transaction.payment_intent_id
        : ''
      if (!paymentIntentId) {
        throw new SellerShippingCancellationError('A payment is still processing. Please check its status before cancelling this order.')
      }
      const response = await paymongoFetch(
        secretKey,
        `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}/cancel`,
        { method: 'POST', timeoutMs: 20000 },
      )
      if (!response.ok) {
        throw new SellerShippingCancellationError(
          `Unable to stop the pending payment safely: ${paymongoErrorMessage(response.data, response.status)}`,
          502,
        )
      }
    }
  }

  if (!refundable.length) {
    return { refundRequested: 0, pendingPaymentCancelled: pending.length > 0 }
  }

  const { secretKey } = paymongoConfig()
  let refundRequested = 0
  for (const transaction of refundable) {
    const amount = Number(transaction.amount)
    const alreadyRefunded = Number(transaction.refunded_amount ?? 0)
    const remaining = Math.round((amount - alreadyRefunded + Number.EPSILON) * 100) / 100
    if (!Number.isFinite(remaining) || remaining < 0) {
      throw new SellerShippingCancellationError('The transaction has an invalid refundable balance.')
    }
    if (remaining === 0) continue

    const paymentId = typeof transaction.payment_id === 'string' ? transaction.payment_id : ''
    if (!paymentId) {
      throw new SellerShippingCancellationError('The payment is confirmed but its gateway payment reference is not ready. Please retry shortly.')
    }

    const response = await paymongoFetch(secretKey, '/v1/refunds', {
      method: 'POST',
      body: {
        data: {
          attributes: {
            amount: Math.round(remaining * 100),
            payment_id: paymentId,
            reason: 'others',
            notes: `Seller-managed order ${String(orderId)} cancellation.`,
          },
        },
      },
      idempotencyKey: `seller-shipping-cancel-${String(orderId)}-${paymentId}-${Math.round(remaining * 100)}`,
      timeoutMs: 20000,
    })
    if (!response.ok) {
      throw new SellerShippingCancellationError(
        `Unable to request the order refund: ${paymongoErrorMessage(response.data, response.status)}`,
        502,
      )
    }
    refundRequested += remaining
  }

  return { refundRequested, pendingPaymentCancelled: pending.length > 0 }
}

export async function recordSellerShippingOrderEvent(args: {
  payload: Payload
  order: RecordValue
  actorId: string | number
  status: string
  description: string
}): Promise<void> {
  const orderId = relationId(args.order.id)
  if (!orderId) throw new Error('Order ID is required to record a shipping event.')
  await args.payload.create({
    collection: 'order-tracking',
    data: {
      order: Number(orderId),
      status: args.status,
      timestamp: new Date().toISOString(),
      actor: args.actorId,
      description: args.description,
    } as never,
    overrideAccess: true,
  })
}
