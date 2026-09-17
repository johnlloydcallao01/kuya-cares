import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCached, setCached } from '@encreasl/cache'

function getNum(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return val
  if (typeof val === 'string') return parseFloat(val) || fallback
  return fallback
}

function getStr(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val
  if (typeof val === 'number') return String(val)
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>
    if ('outletName' in obj) return String(obj.outletName ?? fallback)
    if ('businessName' in obj) return String(obj.businessName ?? fallback)
    if ('email' in obj) return String(obj.email ?? fallback)
  }
  return fallback
}

function resolveId(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'string' || typeof val === 'number') return String(val)
  if (typeof val === 'object' && val !== null && 'id' in (val as Record<string, unknown>))
    return String((val as Record<string, unknown>).id)
  return ''
}

const EMPTY_BODY = {
  activeDeliveries: [],
  pendingOrders: [],
  recentOrders: [],
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const cacheKey = `merchant:dashboard:tables:${userId}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-MerchantDashboard-Cache': 'HIT' } })

    const payload = await getPayload({ config: configPromise })

    const vendorsRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorsRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }
    const vendorId = String(vendor.id)

    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantsDocs = merchantsRes.docs as unknown as Record<string, unknown>[]
    const merchantIds = Array.from(new Set(merchantsDocs.map((m) => String(m.id))))
    const outletNameById = new Map<string, string>()
    merchantsDocs.forEach((m) => outletNameById.set(String(m.id), getStr(m.outletName, `Outlet #${m.id}`)))

    if (merchantIds.length === 0) {
      await setCached(cacheKey, EMPTY_BODY, 20)
      return NextResponse.json(EMPTY_BODY, { headers: { 'X-MerchantDashboard-Cache': 'MISS' } })
    }

    // Targeted small queries instead of hydrating 1000 depth:1 orders.
    // Display names resolve via the merchants map; customerEmail keeps the
    // monolith's `Customer #id` fallback byte-identical (depth:1 never
    // populated customer.user, so user.email never resolved there either).
    const [pendingRes, recentRes, deliveringRes] = await Promise.all([
      payload.find({
        collection: 'orders',
        where: { and: [{ merchant: { in: merchantIds } }, { status: { equals: 'pending' } }] },
        limit: 10,
        sort: '-createdAt',
        depth: 0,
        overrideAccess: true,
      } as any),
      payload.find({
        collection: 'orders',
        where: { merchant: { in: merchantIds } },
        limit: 10,
        sort: '-createdAt',
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'orders',
        where: { and: [{ merchant: { in: merchantIds } }, { status: { equals: 'on_delivery' } }] },
        limit: 100,
        sort: '-createdAt',
        depth: 0,
        overrideAccess: true,
      } as any),
    ])
    const pendingDocs = pendingRes.docs as unknown as Record<string, unknown>[]
    const recentDocs = recentRes.docs as unknown as Record<string, unknown>[]
    const deliveringDocs = deliveringRes.docs as unknown as Record<string, unknown>[]

    const pendingIds = pendingDocs.map((o) => String(o.id))
    const activeIds = deliveringDocs.map((o) => String(o.id))
    const [orderItemsRes, bookingsRes, locationsRes] = await Promise.all([
      pendingIds.length
        ? payload.find({
            collection: 'order-items',
            where: { order: { in: pendingIds } },
            limit: 500,
            depth: 0,
            overrideAccess: true,
          })
        : Promise.resolve({ docs: [] } as unknown as Awaited<ReturnType<typeof payload.find>>),
      activeIds.length
        ? payload.find({
            collection: 'delivery-bookings',
            where: { order: { in: activeIds } },
            limit: 50,
            depth: 0,
            overrideAccess: true,
          })
        : Promise.resolve({ docs: [] } as unknown as Awaited<ReturnType<typeof payload.find>>),
      activeIds.length
        ? payload.find({
            collection: 'delivery-locations',
            where: { order: { in: activeIds } },
            limit: 50,
            depth: 0,
            overrideAccess: true,
          })
        : Promise.resolve({ docs: [] } as unknown as Awaited<ReturnType<typeof payload.find>>),
    ])
    const orderItemsDocs = orderItemsRes.docs as unknown as Record<string, unknown>[]
    const deliveryBookingsDocs = bookingsRes.docs as unknown as Record<string, unknown>[]
    const deliveryLocationsDocs = locationsRes.docs as unknown as Record<string, unknown>[]

    const itemCountByOrder = new Map<string, number>()
    orderItemsDocs.forEach((item) => {
      const oid = resolveId(item.order)
      if (!oid) return
      itemCountByOrder.set(oid, (itemCountByOrder.get(oid) || 0) + 1)
    })

    const bookingMap = new Map<string, Record<string, unknown>>()
    deliveryBookingsDocs.forEach((b) => {
      const orderId = resolveId(b.order)
      if (orderId) bookingMap.set(orderId, b)
    })
    const locationMap = new Map<string, Record<string, unknown>>()
    deliveryLocationsDocs.forEach((l) => {
      const orderId = resolveId(l.order)
      if (orderId) locationMap.set(orderId, l)
    })

    const outletNameOf = (o: Record<string, unknown>, fallback: string): string => {
      const mId = resolveId(o.merchant)
      if (mId && outletNameById.has(mId)) return outletNameById.get(mId) as string
      return fallback
    }
    const customerEmailOf = (o: Record<string, unknown>): string => {
      const customerRaw = o.customer
      const customerObj =
        customerRaw && typeof customerRaw === 'object' ? (customerRaw as Record<string, unknown>) : null
      return customerObj ? `Customer #${customerObj.id}` : 'N/A'
    }

    const activeDeliveries = deliveringDocs.map((o) => {
      const orderId = String(o.id)
      const booking = bookingMap.get(orderId)
      const location = locationMap.get(orderId)
      return {
        orderId,
        outletName: outletNameOf(o, 'N/A'),
        status: getStr(booking?.status, getStr(o.delivery_status, 'unknown')),
        customerAddress: getStr(location?.formatted_address, 'N/A'),
        driverName: getStr(booking?.driver_name, ''),
        placedAt: String(o.placed_at ?? o.createdAt ?? ''),
      }
    })

    const pendingOrders = pendingDocs.map((o) => ({
      id: String(o.id),
      outletName: outletNameOf(o, 'N/A'),
      customerEmail: customerEmailOf(o),
      total: getNum(o.total),
      itemCount: itemCountByOrder.get(String(o.id)) || 0,
      placedAt: String(o.placed_at ?? o.createdAt ?? ''),
      fulfillmentType: getStr(o.fulfillment_type, 'delivery'),
    }))

    const recentOrders = recentDocs.map((o) => ({
      id: String(o.id),
      merchantName: outletNameOf(o, 'N/A'),
      customerEmail: customerEmailOf(o),
      total: getNum(o.total),
      status: getStr(o.status, 'unknown'),
      createdAt: String(o.createdAt ?? ''),
    }))

    const responseBody = { activeDeliveries, pendingOrders, recentOrders }
    await setCached(cacheKey, responseBody, 30)
    return NextResponse.json(responseBody, { headers: { 'X-MerchantDashboard-Cache': 'MISS' } })
  } catch (error) {
    console.error('Merchant dashboard tables aggregation error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
