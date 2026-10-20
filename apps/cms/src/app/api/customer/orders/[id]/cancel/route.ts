import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { relationId } from '@/services/sellerShippingCheckout'
import {
  prepareSellerShippingCancellation,
  recordSellerShippingOrderEvent,
  SellerShippingCancellationError,
} from '@/services/sellerShippingCancellation'
import { authenticateCustomerOrMember } from '@/utils/mediaLibrary'
import { createAdminNotificationFanout, createMerchantNotificationFanout } from '@/utils/notificationFanout'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await authenticateCustomerOrMember(payload, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Invalid order ID.' }, { status: 400 })
    let body: Record<string, unknown> = {}
    try {
      const parsed: unknown = await request.json()
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>
      }
    } catch {
      body = {}
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

    const customerResult = await payload.find({
      collection: 'customers',
      where: { user: { equals: Number(user.id) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const customer = customerResult.docs[0]
    if (!customer) return NextResponse.json({ error: 'Customer account not found.' }, { status: 404 })

    const order = await payload.findByID({
      collection: 'orders',
      id: Number(id) as never,
      depth: 0,
      overrideAccess: true,
    }) as unknown as Record<string, unknown>
    if (relationId(order.customer) !== String(customer.id)) {
      return NextResponse.json({ error: 'This order does not belong to your account.' }, { status: 403 })
    }
    if (!order.seller_shipping_snapshot) {
      return NextResponse.json({
        code: 'SELLER_SHIPPING_NOT_MANAGED',
        error: 'This order uses a different cancellation process.',
      }, { status: 409 })
    }
    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'This order is already cancelled.' }, { status: 409 })
    }
    if (order.status === 'delivered') {
      return NextResponse.json({ error: 'Delivered orders cannot be cancelled.' }, { status: 409 })
    }

    if (order.status !== 'pending') {
      const existingRequest = await payload.find({
        collection: 'order-tracking',
        where: {
          and: [
            { order: { equals: Number(id) } },
            { description: { contains: 'Customer requested cancellation after seller acceptance' } },
          ],
        } as never,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (existingRequest.docs.length) {
        return NextResponse.json({
          reviewRequired: true,
          status: order.status,
          message: 'Your cancellation request is already awaiting seller/admin review.',
        }, { status: 202 })
      }
      await recordSellerShippingOrderEvent({
        payload,
        order,
        actorId: user.id,
        status: String(order.status),
        description: `Customer requested cancellation after seller acceptance${reason ? `: ${reason}` : ''}. Manual review is required; the order has not been cancelled.`,
      })
      const notification = {
        typeKey: 'seller_shipping.cancellation_review',
        domain: 'order' as const,
        priority: 'warning' as const,
        title: 'Cancellation review requested',
        body: `Customer requested cancellation for order #${id}. Review the order before changing its status or issuing a refund.`,
        sourceEntityType: 'order',
        sourceEntityId: id,
        metadata: { orderId: id, status: order.status, reason: reason || null },
      }
      try {
        await Promise.all([
          createAdminNotificationFanout(payload, notification),
          createMerchantNotificationFanout(payload, relationId(order.merchant), notification),
        ])
      } catch (notificationError) {
        console.error('[customer/orders/:id/cancel] review notification error:', notificationError)
      }
      return NextResponse.json({
        reviewRequired: true,
        status: order.status,
        message: 'Your cancellation request was sent for seller/admin review. The order remains active until reviewed.',
      }, { status: 202 })
    }

    const { refundRequested, pendingPaymentCancelled } = await prepareSellerShippingCancellation(payload, id)
    const updated = await payload.update({
      collection: 'orders',
      id: Number(id) as never,
      data: { status: 'cancelled' } as never,
      overrideAccess: true,
      context: { sellerShippingCancellation: true },
    })
    await recordSellerShippingOrderEvent({
      payload,
      order: { ...order, id: updated.id },
      actorId: user.id,
      status: 'cancelled',
      description: refundRequested > 0
        ? `Customer cancelled before seller acceptance. Full refund of PHP ${refundRequested.toFixed(2)} requested from PayMongo.`
        : pendingPaymentCancelled
          ? 'Customer cancelled before seller acceptance. Pending payment intent cancelled.'
          : 'Customer cancelled before seller acceptance and before payment.',
    })

    return NextResponse.json({
      cancelled: true,
      refundRequested,
      refundPending: refundRequested > 0,
      pendingPaymentCancelled,
    })
  } catch (error) {
    console.error('[customer/orders/:id/cancel] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to cancel this order.' },
      { status: error instanceof SellerShippingCancellationError ? error.status : 500 },
    )
  }
}
