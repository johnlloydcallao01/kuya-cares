import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import { relationId } from '@/services/sellerShippingCheckout'

export const dynamic = 'force-dynamic'

type JsonRecord = Record<string, unknown>

const allowedTransitions: Record<string, string[]> = {
  accepted: ['preparing'],
  preparing: ['ready_for_pickup'],
  ready_for_pickup: ['on_delivery', 'delivered'],
  on_delivery: ['delivered'],
}

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (text.length > maxLength) return undefined
  return text || null
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await authenticateVendorOrMember(payload, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await context.params
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'Invalid order id.' }, { status: 400 })

    let body: JsonRecord
    try {
      const parsed: unknown = await request.json()
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 })
      }
      body = parsed as JsonRecord
    } catch {
      return NextResponse.json({ error: 'The request body is not valid JSON.' }, { status: 400 })
    }

    const order = await payload.findByID({
      collection: 'orders',
      id: Number(id) as never,
      depth: 0,
      overrideAccess: true,
    }) as unknown as JsonRecord
    const merchantId = relationId(order.merchant)
    if (!merchantId) return NextResponse.json({ error: 'Order seller was not found.' }, { status: 404 })

    const vendors = await payload.find({
      collection: 'vendors',
      where: { user: { equals: String(user.id) } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const vendorIds = vendors.docs.map((vendor) => String(vendor.id))
    if (!vendorIds.length) return NextResponse.json({ error: 'Seller profile not found.' }, { status: 404 })
    const ownedMerchant = await payload.find({
      collection: 'merchants',
      where: {
        and: [
          { id: { equals: Number(merchantId) } },
          { vendor: { in: vendorIds } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!ownedMerchant.docs.length) return NextResponse.json({ error: 'You do not own this order.' }, { status: 403 })
    if (!order.seller_shipping_snapshot) {
      return NextResponse.json({ error: 'This order does not use seller-managed shipping.' }, { status: 409 })
    }
    const paidTransactions = await payload.find({
      collection: 'transactions',
      where: {
        and: [
          { order: { equals: order.id } },
          { status: { in: ['paid', 'partially_refunded'] } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!paidTransactions.docs.length) {
      return NextResponse.json({ error: 'Sellers can fulfill an order only after payment is confirmed.' }, { status: 409 })
    }

    const currentStatus = String(order.status ?? '')
    if (currentStatus === 'pending') {
      return NextResponse.json({ error: 'The order is not ready for seller fulfillment.' }, { status: 409 })
    }
    if (currentStatus === 'cancelled' || currentStatus === 'delivered') {
      return NextResponse.json({ error: 'Fulfillment details cannot be changed for a completed or cancelled order.' }, { status: 409 })
    }
    const nextStatus = body.status === undefined ? currentStatus : String(body.status)
    if (nextStatus !== currentStatus && !allowedTransitions[currentStatus]?.includes(nextStatus)) {
      return NextResponse.json({ error: `The order cannot move from ${currentStatus} to ${nextStatus}.` }, { status: 409 })
    }

    const carrierName = optionalText(body.carrierName, 120)
    const trackingReference = optionalText(body.trackingReference, 200)
    const trackingUrl = optionalText(body.trackingUrl, 2000)
    if (
      (body.carrierName !== undefined && carrierName === undefined) ||
      (body.trackingReference !== undefined && trackingReference === undefined) ||
      (body.trackingUrl !== undefined && trackingUrl === undefined)
    ) {
      return NextResponse.json({ error: 'Delivery details must be text values.' }, { status: 400 })
    }
    if (trackingUrl && !isHttpsUrl(trackingUrl)) {
      return NextResponse.json({ error: 'Tracking links must use HTTPS.' }, { status: 400 })
    }
    if (
      [carrierName, trackingReference, trackingUrl].some((value) => value !== undefined) &&
      (order.seller_shipping_snapshot as JsonRecord).type !== 'seller_delivery'
    ) {
      return NextResponse.json({ error: 'Tracking details apply only to seller-delivery orders.' }, { status: 409 })
    }
    if (nextStatus === 'on_delivery' && (order.seller_shipping_snapshot as JsonRecord).type !== 'seller_delivery') {
      return NextResponse.json({ error: 'Pickup orders cannot enter delivery status.' }, { status: 409 })
    }
    if (
      nextStatus === 'delivered' &&
      (order.seller_shipping_snapshot as JsonRecord).type === 'seller_delivery' &&
      currentStatus !== 'on_delivery'
    ) {
      return NextResponse.json({ error: 'Mark delivery as in transit before completing it.' }, { status: 409 })
    }

    const data: JsonRecord = {}
    if (body.status !== undefined) data.status = nextStatus
    if (carrierName !== undefined) data.seller_carrier_name = carrierName
    if (trackingReference !== undefined) data.seller_tracking_reference = trackingReference
    if (trackingUrl !== undefined) data.seller_tracking_url = trackingUrl
    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'Provide an order status or seller tracking detail to update.' }, { status: 400 })
    }

    const updated = await payload.update({
      collection: 'orders',
      id: order.id as never,
      data: data as never,
      overrideAccess: true,
      context: { sellerFulfillmentUpdate: true },
    })

    if (nextStatus !== currentStatus) {
      await payload.create({
        collection: 'order-tracking',
        data: {
          order: order.id,
          status: nextStatus,
          timestamp: new Date().toISOString(),
          actor: user.id,
          description: `Seller updated fulfillment status to ${nextStatus.replace(/_/g, ' ')}.`,
        } as never,
        overrideAccess: true,
      })
    }

    const updatedOrder = updated as unknown as JsonRecord
    return NextResponse.json({
      orderId: String(updated.id),
      status: updatedOrder.status,
      carrierName: updatedOrder.seller_carrier_name ?? null,
      trackingReference: updatedOrder.seller_tracking_reference ?? null,
      trackingUrl: updatedOrder.seller_tracking_url ?? null,
    })
  } catch (error) {
    console.error('[vendor/orders/fulfillment] PATCH error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update order fulfillment.' },
      { status: 500 },
    )
  }
}
