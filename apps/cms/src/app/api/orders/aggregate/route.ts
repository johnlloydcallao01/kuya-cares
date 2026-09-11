import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const orderId = searchParams.get('orderId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    // 1. Resolve customer from userId
    const { docs: customers } = await payload.find({
      collection: 'customers',
      where: { user: { equals: Number(userId) } },
      limit: 1,
      overrideAccess: true,
    })
    const customerId = customers[0]?.id
    if (!customerId) {
      return NextResponse.json({ docs: [] })
    }

    // 2. Fetch orders
    const orderWhere: Record<string, any> = { 'customer.user': { equals: Number(userId) } }
    if (orderId) {
      orderWhere.id = { equals: Number(orderId) }
    }
    const { docs: orders } = await payload.find({
      collection: 'orders',
      where: orderWhere,
      sort: '-placed_at',
      depth: 2,
      limit: orderId ? 1 : 100,
      overrideAccess: true,
    })

    if (orders.length === 0) {
      return NextResponse.json(orderId ? null : { docs: [] })
    }

    // 3. Collect order IDs for batch queries
    const orderIds = orders.map((o: any) => o.id) as number[]

    // 4. Batch fetch related collections
    const [itemsRes, bookingsRes, locationsRes, txRes] = await Promise.all([
      payload.find({
        collection: 'order-items',
        where: { order: { in: orderIds as number[] } },
        depth: 1,
        limit: 500,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'delivery-bookings',
        where: { order: { in: orderIds as number[] } },
        depth: 0,
        limit: 200,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'delivery-locations',
        where: { order: { in: orderIds as number[] } },
        depth: 0,
        limit: 200,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'transactions',
        where: { order: { in: orderIds as number[] }, status: { equals: 'paid' } },
        depth: 0,
        limit: 200,
        overrideAccess: true,
      }),
    ])

    const allItems = itemsRes.docs
    const allBookings = bookingsRes.docs
    const allLocations = locationsRes.docs
    const paidTxSet = new Set(txRes.docs.map((tx: any) => {
      const oid = typeof tx.order === 'object' ? tx.order.id : tx.order
      return Number(oid)
    }))

    // 5. Build frontend-ready response
    const mapped = orders.map((order: any) => {
      const merchant = order.merchant && typeof order.merchant === 'object' ? order.merchant : null
      const vendor = merchant?.vendor && typeof merchant.vendor === 'object' ? merchant.vendor : null

      const items = allItems
        .filter((item: any) => {
          const oid = typeof item.order === 'object' ? item.order.id : item.order
          return Number(oid) === Number(order.id)
        })
        .map((item: any) => {
          const product = item.product && typeof item.product === 'object' ? item.product : null
          return {
            id: item.id,
            name: item.product_name_snapshot || product?.name || product?.productName || 'Item',
            quantity: item.quantity || 1,
            price: item.price_at_purchase || 0,
            total: item.total_price || 0,
            image: product?.media?.primaryImage?.cloudinaryURL
              || product?.media?.primaryImage?.url
              || product?.image?.cloudinaryURL
              || product?.image?.url
              || null,
          }
        })

      const booking = allBookings.find((b: any) => {
        const oid = typeof b.order === 'object' ? b.order.id : b.order
        return Number(oid) === Number(order.id)
      })

      const location = allLocations.find((l: any) => {
        const oid = typeof l.order === 'object' ? l.order.id : l.order
        return Number(oid) === Number(order.id)
      })

      return {
        id: order.id,
        orderNumber: `#${String(order.id).padStart(5, '0')}`,
        status: order.status || 'pending',
        fulfillmentType: order.fulfillment_type,
        total: order.total || 0,
        subtotal: order.subtotal || 0,
        deliveryFee: order.delivery_fee || 0,
        platformFee: order.platform_fee || 0,
        placedAt: order.placed_at || null,
        notes: order.notes || null,

        // Payment
        isPaid: paidTxSet.has(order.id),

        // Merchant
        merchant: merchant ? {
          id: merchant.id,
          name: merchant.outletName || merchant.name || vendor?.businessName || 'Restaurant',
          phone: merchant.contactInfo?.phone || null,
          logo: vendor?.logo?.cloudinaryURL || vendor?.logo?.url || null,
        } : null,

        // Customer
        customer: order.customer && typeof order.customer === 'object' ? {
          id: order.customer.id,
          email: order.customer.email || null,
          user: order.customer.user && typeof order.customer.user === 'object' ? {
            id: order.customer.user.id,
            firstName: order.customer.user.firstName || null,
            lastName: order.customer.user.lastName || null,
            phone: order.customer.user.phone || null,
            email: order.customer.user.email || null,
          } : null,
        } : null,

        // Items
        items,

        // Delivery
        delivery: booking ? {
          id: booking.id,
          lalamoveOrderId: booking.lalamove_order_id || null,
          shareLink: booking.share_link || null,
          status: booking.status || null,
          rawStatus: booking.lalamove_raw_status || null,
          deliveryFee: booking.delivery_fee || 0,
          priorityFee: booking.priority_fee || 0,
          distanceMeters: booking.distance_meters || null,
          driver: {
            name: booking.driver_name || null,
            phone: booking.driver_phone || null,
            plateNumber: booking.driver_plate_number || null,
            photoUrl: booking.driver_photo_url || null,
            lat: booking.driver_lat || null,
            lng: booking.driver_lng || null,
            locationUpdatedAt: booking.driver_location_updated_at || null,
          },
        } : null,

        // Delivery snapshot
        deliveryLocation: location ? {
          id: location.id,
          formattedAddress: location.formatted_address || null,
          street: location.street || null,
          floorUnitRoom: location.floor_unit_room || null,
          deliveryInstructions: location.delivery_instructions || null,
          notes: location.notes || null,
          contactName: location.contact_name || null,
          contactPhone: location.contact_phone || null,
          label: location.label || null,
          merchantFormattedAddress: location.merchant_formatted_address || null,
          merchantStreet: location.merchant_street || null,
          merchantFloorUnitRoom: location.merchant_floor_unit_room || null,
          merchantDeliveryInstructions: location.merchant_delivery_instructions || null,
        } : null,
      }
    })

    if (orderId) {
      return NextResponse.json(mapped[0] || null)
    }
    return NextResponse.json({ docs: mapped })
  } catch (err: any) {
    console.error('[orders/aggregate] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
