import { PayloadRequest } from 'payload'
import { getDeliveryProvider } from '../services/deliveryProviders'

/**
 * POST /api/delivery/cancel
 *
 * Cancels a Lalamove-delivered order so the delivery fee is not charged.
 * Per the Lalamove API, cancellation is allowed while the order is in
 * `ASSIGNING_DRIVER`, or within 5 minutes of a rider being matched.
 *
 * Body: { orderId: number }
 *
 * Response: { data: { canceled: true, deliveredId, refundedDeliveryFee } }
 * or 409 if the order can no longer be cancelled.
 */
export const deliveryCancelHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasJson = typeof (req as any).json === 'function'
    const parsed = (await (hasJson ? (req as any).json() : Promise.resolve((req as any).body))) ?? {}
    const { orderId } = parsed as { orderId?: number }

    if (!orderId) {
      return Response.json({ error: 'orderId is required' }, { status: 400 })
    }

    // 1. Load the order
    const order = await req.payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 1,
    })

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.fulfillment_type !== 'delivery') {
      return Response.json({ error: 'Order is not a delivery order' }, { status: 422 })
    }

    // Already cancelled → idempotent success
    if (
      order.status === 'cancelled' ||
      order.delivery_status === 'canceled' ||
      order.delivery_status === 'expired'
    ) {
      return Response.json({ data: { canceled: true, alreadyCanceled: true } })
    }

    // Find the delivery booking to get the Lalamove order id
    const bookings = await req.payload.find({
      collection: 'delivery-bookings',
      where: { order: { equals: orderId } },
      limit: 1,
    })

    const booking = bookings.docs[0] as
      | { id: number | string; lalamove_order_id?: string | null; delivery_fee?: number | null; status?: string }
      | undefined

    const lalamoveOrderId = booking?.lalamove_order_id || order.lalamove_order_id

    if (!lalamoveOrderId) {
      return Response.json(
        {
          error:
            'This order has no active Lalamove delivery to cancel. If a rider is already assigned, contact support.',
        },
        { status: 409 },
      )
    }

    // 2. Ask the active delivery provider to cancel the delivery
    try {
      const provider = await getDeliveryProvider(req.payload)
      await provider.cancelOrder(lalamoveOrderId)
    } catch (cancelErr: any) {
      if (cancelErr?.isCancellationForbidden) {
        return Response.json(
          {
            error:
              'This order can no longer be cancelled — a rider has already been dispatched (cancellation is only allowed while we are still finding a rider, or within 5 minutes of matching).',
            code: 'ERR_CANCELLATION_FORBIDDEN',
          },
          { status: 409 },
        )
      }
      throw cancelErr
    }

    // 3. Update our records to reflect the cancelled delivery.
    // Preserve coupon math: the delivery fee is refunded, but food discounts
    // and the (already spent) priority fee stay in the total.
    const refundedFee = booking?.delivery_fee || order.delivery_fee || 0
    const preservedDiscount = Number((order as any).discount_total) || 0
    const preservedPriority = Number((order as any).priority_fee) || 0
    const newTotal = Math.max(
      0,
      Math.round(
        ((order.subtotal || 0) + (order.platform_fee || 0) + preservedPriority - preservedDiscount) * 100,
      ) / 100,
    )

    if (booking) {
      await req.payload.update({
        collection: 'delivery-bookings',
        id: booking.id,
        data: {
          status: 'canceled',
          lalamove_raw_status: 'CANCELED',
        },
      })
    } else {
      await req.payload.update({
        collection: 'orders',
        id: orderId,
        data: {
          delivery_status: 'canceled',
        },
      })
    }

    // 4. Update the order: reflect cancelled delivery + refund the delivery fee
    await req.payload.update({
      collection: 'orders',
      id: orderId,
      data: {
        status: 'cancelled',
        delivery_status: 'canceled',
        // Do not charge the delivery fee if the delivery was cancelled upfront
        delivery_fee: 0,
        total: newTotal,
      },
    })

    // 5. Log the cancellation in tracking
    await req.payload.create({
      collection: 'order-tracking',
      data: {
        order: orderId,
        status: 'cancelled' as any,
        timestamp: new Date().toISOString(),
        description: `Delivery cancelled on Lalamove. Delivery fee of ₱${refundedFee} was not charged.`,
      },
    })

    return Response.json({
      data: {
        canceled: true,
        orderId,
        refundedDeliveryFee: refundedFee,
      },
    })
  } catch (error: any) {
    console.error('[delivery/cancel] Error:', error)
    return Response.json(
      { error: error?.message || 'Failed to cancel delivery' },
      { status: 500 },
    )
  }
}