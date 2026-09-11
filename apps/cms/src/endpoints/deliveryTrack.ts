import { PayloadRequest } from 'payload'
import { getDeliveryProvider, mapLalamoveStatus, mapToOrderStatus } from '../services/deliveryProviders'
import type { LalamoveDriverDetails } from '../services/lalamoveClient'

type AnyDoc = Record<string, any>

/**
 * GET /api/delivery/track?orderId=123
 *
 * Returns the live tracking state for a Lalamove delivery so the mobile app
 * can render an in-app map without exposing the HMAC Lalamove API to clients.
 *
 * Fetches the order + driver from Lalamove (driver location refreshes every
 * ~10s), persists refreshed coords/status into delivery-bookings, and returns
 * a lightweight payload:
 *   { data: { deliveryStatus, driver, pickup, dropoff, distanceMeters, shareLink } }
 */
export const deliveryTrackHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { orderId } = req.query as { orderId?: string }

    if (!orderId) {
      return Response.json({ error: 'orderId is required' }, { status: 400 })
    }

    // 1. Load the order + booking
    const order = await req.payload.findByID({
      collection: 'orders',
      id: Number(orderId),
      depth: 1,
    })

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 })
    }

    if (order.fulfillment_type !== 'delivery') {
      return Response.json({ error: 'Order is not a delivery order' }, { status: 422 })
    }

    const bookings = await req.payload.find({
      collection: 'delivery-bookings',
      where: { order: { equals: Number(orderId) } },
      limit: 1,
    })

    const booking = bookings.docs[0] as AnyDoc | undefined
    const lalamoveOrderId = booking?.lalamove_order_id || order.lalamove_order_id

    if (!lalamoveOrderId) {
      return Response.json({ error: 'No active Lalamove delivery for this order' }, { status: 404 })
    }

    let rawStatus = booking?.lalamove_raw_status || ''
    let driverId = ''
    let liveDriver: LalamoveDriverDetails | null = null

    const provider = await getDeliveryProvider(req.payload)

    // 2. Pull live order state (status + matched driver id)
    try {
      const orderData = (await provider.getOrderDetails(lalamoveOrderId)) as any
      rawStatus = orderData?.status || rawStatus
      driverId = String(
        orderData?.driver?.driverId || orderData?.driverId || '',
      )
    } catch (err: any) {
      console.error('[delivery/track] getOrderDetails failed (using cached order state):', err?.message)
    }

    const mappedStatus = mapLalamoveStatus(rawStatus)

    // 3. Pull live driver location (if we have a driverId)
    if (driverId) {
      try {
        liveDriver = (await provider.getDriverDetails(lalamoveOrderId, driverId)) as LalamoveDriverDetails
      } catch (err: any) {
        console.error('[delivery/track] getDriverDetails failed (using cached driver data):', err?.message)
      }
    }

    // 4. Persist refreshed data back into delivery-bookings (denormalized)
    const bookingUpdateData: Record<string, any> = {
      status: mappedStatus,
      lalamove_raw_status: rawStatus,
    }

    if (liveDriver) {
      const coords = liveDriver?.coordinates
      if (coords?.lat != null && coords?.lng != null) {
        bookingUpdateData.driver_lat = Number(coords.lat)
        bookingUpdateData.driver_lng = Number(coords.lng)
        bookingUpdateData.driver_location_updated_at =
          coords.updatedAt || new Date().toISOString()
      }
      if (liveDriver.name) bookingUpdateData.driver_name = liveDriver.name
      if (liveDriver.phone) bookingUpdateData.driver_phone = liveDriver.phone
      if (liveDriver.plateNumber) bookingUpdateData.driver_plate_number = liveDriver.plateNumber
      if (liveDriver.photo) bookingUpdateData.driver_photo_url = liveDriver.photo
    }

    if (booking) {
      await req.payload.update({
        collection: 'delivery-bookings',
        id: booking.id,
        data: bookingUpdateData,
      })
    }

    // 5. Keep order.delivery_status in sync, and infer overall order status.
    //    Only write delivery_status values that exist in the orders enum,
    //    and only when it has actually changed (this endpoint is polled ~10s).
    const VALID_ORDER_DELIVERY_STATUSES = [
      'none',
      'pending',
      'assigning_driver',
      'driver_assigned',
      'picked_up',
      'completed',
      'canceled',
      'expired',
    ]

    const orderStatusUpdate: Record<string, any> = {}

    if (
      VALID_ORDER_DELIVERY_STATUSES.includes(mappedStatus) &&
      order.delivery_status !== mappedStatus
    ) {
      orderStatusUpdate.delivery_status = mappedStatus
    }

    const mappedOrderStatus = mapToOrderStatus(mappedStatus)
    if (mappedOrderStatus && order.status !== mappedOrderStatus) {
      orderStatusUpdate.status = mappedOrderStatus
    }

    if (Object.keys(orderStatusUpdate).length > 0) {
      await req.payload.update({
        collection: 'orders',
        id: order.id,
        data: orderStatusUpdate,
      })
    }

    // 6. Build the tracking payload (live driver data, cached booking as fallback)
    const driver = {
      driverId: driverId || null,
      name: liveDriver?.name || booking?.driver_name || null,
      phone: liveDriver?.phone || booking?.driver_phone || null,
      plateNumber: liveDriver?.plateNumber || booking?.driver_plate_number || null,
      photoUrl: liveDriver?.photo || booking?.driver_photo_url || null,
      lat:
        liveDriver?.coordinates?.lat != null
          ? Number(liveDriver.coordinates.lat)
          : (booking?.driver_lat ?? null),
      lng:
        liveDriver?.coordinates?.lng != null
          ? Number(liveDriver.coordinates.lng)
          : (booking?.driver_lng ?? null),
      locationUpdatedAt:
        liveDriver?.coordinates?.updatedAt ||
        booking?.driver_location_updated_at ||
        null,
    }

    return Response.json({
      data: {
        orderId: order.id,
        deliveryStatus: mappedStatus,
        lalamoveRawStatus: rawStatus,
        driver,
        pickup: {
          lat: Number(booking?.pickup_lat ?? null) || null,
          lng: Number(booking?.pickup_lng ?? null) || null,
          address: booking?.pickup_address || null,
        },
        dropoff: {
          lat: Number(booking?.dropoff_lat ?? null) || null,
          lng: Number(booking?.dropoff_lng ?? null) || null,
          address: booking?.dropoff_address || null,
        },
        distanceMeters: Number(booking?.distance_meters || 0) || null,
        priorityFee: Number(booking?.priority_fee || 0) || 0,
        shareLink: booking?.share_link || null,
      },
    })
  } catch (error: any) {
    console.error('[delivery/track] Error:', error)
    return Response.json(
      { error: error?.message || 'Failed to load tracking data' },
      { status: 500 },
    )
  }
}