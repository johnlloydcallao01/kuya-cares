import { PayloadRequest } from 'payload'
import { getDeliveryProvider, type DeliveryProvider } from '../services/deliveryProviders'
import type { LalamoveStop } from '../services/lalamoveClient'

type AnyDoc = {
  id?: number | string
  [key: string]: any
}

/**
 * Resolve an address id from a Payload relationship field. The field may be
 * populated (object) or just the id (number/string), depending on depth.
 */
async function resolveAddressId(payload: PayloadRequest['payload'], field: any): Promise<number | null> {
  if (!field) return null
  if (typeof field === 'object' && field.id != null) return Number(field.id)
  const id = Number(field)
  return Number.isFinite(id) ? id : null
}

/**
 * POST /api/delivery/quote
 *
 * Returns a Lalamove quotation for a delivery (pickup = merchant active address,
 * dropoff = customer active address). Delivery is motorcycle-only.
 * Read-only endpoint — no order is placed, no money is charged.
 *
 * Body (checkout-time, no order yet):
 *   { merchantId: number, customerId: number }
 *
 * Body (order-time):
 *   { orderId: number }   → derives merchant + dropoff from the order
 */
export const deliveryQuoteHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const provider = await getDeliveryProvider(req.payload)
    if (provider.name !== 'lalamove') {
      return Response.json({ data: { available: false } })
    }

    const hasJson = typeof (req as any).json === 'function'
    const parsed = (await (hasJson ? (req as any).json() : Promise.resolve((req as any).body))) ?? {}

    const {
      orderId,
      merchantId,
      customerId,
      lat,
      lng,
      address,
    } = parsed as {
      orderId?: number
      merchantId?: number
      customerId?: number
      lat?: number
      lng?: number
      address?: string
    }

    let merchant: AnyDoc | null = null
    let pickupLat: number | null = null
    let pickupLng: number | null = null
    let pickupAddress = 'Merchant Location'
    let dropoffLat: number | null = null
    let dropoffLng: number | null = null
    let dropoffAddress = 'Delivery Location'

    if (orderId) {
      // ─── Mode A: derive from an existing order ────────────────────────────
      const order = await req.payload.findByID({
        collection: 'orders',
        id: orderId,
        depth: 2,
      })

      if (!order) return Response.json({ error: 'Order not found' }, { status: 404 })
      if (order.fulfillment_type !== 'delivery') {
        return Response.json({ error: 'Order is not a delivery order' }, { status: 422 })
      }

      merchant =
        typeof order.merchant === 'object'
          ? order.merchant
          : await req.payload.findByID({ collection: 'merchants', id: order.merchant as any })

      const deliveryLocations = await req.payload.find({
        collection: 'delivery-locations',
        where: { order: { equals: orderId } },
        limit: 1,
      })

      if (deliveryLocations.docs.length > 0) {
        const coords = deliveryLocations.docs[0].coordinates as { lat?: number; lng?: number } | null
        dropoffLat = Number(coords?.lat ?? null)
        dropoffLng = Number(coords?.lng ?? null)
        dropoffAddress = deliveryLocations.docs[0].formatted_address || dropoffAddress
      } else if (order.customer && typeof order.customer === 'object' && order.customer.activeAddress) {
        const customerActiveAddrId = await resolveAddressId(
          req.payload,
          (order.customer as AnyDoc).activeAddress,
        )
        if (customerActiveAddrId) {
          const addr = await req.payload.findByID({ collection: 'addresses', id: customerActiveAddrId })
          dropoffLat = Number(addr?.latitude ?? null)
          dropoffLng = Number(addr?.longitude ?? null)
          dropoffAddress = addr?.formatted_address || dropoffAddress
        }
      }
    } else {
      // ─── Mode B: checkout-time — resolve from merchant + customer active addresses ──
      if (!merchantId) {
        return Response.json(
          { error: 'Either orderId or merchantId is required' },
          { status: 400 },
        )
      }

      merchant = await req.payload.findByID({
        collection: 'merchants',
        id: merchantId,
        depth: 1,
      })

      if (!merchant) return Response.json({ error: 'Merchant not found' }, { status: 404 })

      // Pickup = merchant.active_address_id → addresses
      const merchantAddrId = await resolveAddressId(req.payload, merchant.activeAddress)
      if (merchantAddrId) {
        const addr = await req.payload.findByID({ collection: 'addresses', id: merchantAddrId })
        pickupLat = Number(addr?.latitude ?? null)
        pickupLng = Number(addr?.longitude ?? null)
        pickupAddress = addr?.formatted_address || merchant.outletName || pickupAddress
      }

      // Dropoff = customer.active_address_id → addresses
      if (customerId) {
        const customer = await req.payload.findByID({
          collection: 'customers',
          id: customerId,
          depth: 1,
        })

        if (customer) {
          const customerAddrId = await resolveAddressId(req.payload, customer.activeAddress)
          if (customerAddrId) {
            const addr = await req.payload.findByID({ collection: 'addresses', id: customerAddrId })
            dropoffLat = Number(addr?.latitude ?? null)
            dropoffLng = Number(addr?.longitude ?? null)
            dropoffAddress = addr?.formatted_address || dropoffAddress
          }
        }
      }

      // Fallbacks if relationships are missing/unset
      if (!pickupLat || !pickupLng) {
        pickupLat = Number(merchant.merchant_latitude ?? null)
        pickupLng = Number(merchant.merchant_longitude ?? null)
        pickupAddress = merchant.outletName || pickupAddress
      }

      if (!dropoffLat || !dropoffLng) {
        dropoffLat = Number(lat ?? null)
        dropoffLng = Number(lng ?? null)
        dropoffAddress = address || dropoffAddress
      }
    }

    if (!merchant) return Response.json({ error: 'Merchant not found' }, { status: 404 })

    if (!pickupLat || !pickupLng) {
      return Response.json(
        { error: 'Merchant has no GPS coordinates configured' },
        { status: 422 },
      )
    }

    if (!dropoffLat || !dropoffLng) {
      return Response.json(
        { error: 'Delivery location has no GPS coordinates' },
        { status: 422 },
      )
    }

    const stops: LalamoveStop[] = [
      {
        coordinates: { lat: String(pickupLat), lng: String(pickupLng) },
        address: String(pickupAddress),
      },
      {
        coordinates: { lat: String(dropoffLat), lng: String(dropoffLng) },
        address: String(dropoffAddress),
      },
    ]

    const effectiveServiceType = provider.getServiceTypeDefault()

    const quotation = await provider.getQuotation(stops, effectiveServiceType, {
      language: 'en_PH',
    })

    const priorityFeeAmount = Number(provider.getPriorityFeeEnv())

    return Response.json({
      data: {
        quotationId: quotation.quotationId,
        serviceType: quotation.serviceType,
        deliveryFee: Number(quotation.priceBreakdown.total),
        priorityFee: priorityFeeAmount > 0 ? priorityFeeAmount : 0,
        currency: quotation.priceBreakdown.currency,
        distance: quotation.distance,
        expiresAt: quotation.expiresAt,
        stops: quotation.stops,
      },
    })
  } catch (error: any) {
    console.error('[delivery/quote] Error:', error.message || error)
    return Response.json({ error: error.message || 'Failed to get delivery quote' }, { status: 500 })
  }
}
