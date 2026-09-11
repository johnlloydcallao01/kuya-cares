import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCached, setCached } from '@encreasl/cache'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

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

function resolveId(val: unknown): string | null {
  if (val == null) return null
  if (typeof val === 'string' || typeof val === 'number') return String(val)
  if (typeof val === 'object' && val !== null && 'id' in (val as Record<string, unknown>)) {
    return String((val as Record<string, unknown>).id)
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const cacheKey = `merchant:dashboard:${userId}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-MerchantDashboard-Cache': 'HIT' } })

    const payload = await getPayload({ config: configPromise })

    // 1. Resolve vendor from user (overrideAccess because vendors collection blocks vendor-role reads)
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

    // 2. Fetch all merchants belonging to this vendor
    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 1,
      overrideAccess: true,
    })
    const merchantsDocs = merchantsRes.docs as unknown as Record<string, unknown>[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))

    if (merchantIds.size === 0) {
      const emptyBody = {
        metrics: {
          totalRevenue: 0,
          revenueChange: 0,
          todayRevenue: 0,
          totalOrders: 0,
          ordersChange: 0,
          pendingOrders: 0,
          activeOrders: 0,
          totalOutlets: 0,
          openOutlets: 0,
          acceptingOrders: 0,
          averageRating: 0,
          totalReviews: 0,
          ratingChange: 0,
        },
        outlets: [],
        revenueChart: [],
        orderStatusChart: [],
        topProducts: [],
        activeDeliveries: [],
        pendingOrders: [],
        recentOrders: [],
      }
      await setCached(cacheKey, emptyBody, 20)
      return NextResponse.json(emptyBody, { headers: { 'X-MerchantDashboard-Cache': 'MISS' } })
    }

    // 2. Fetch orders scoped to this vendor's merchants
    const ordersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: Array.from(merchantIds) } },
      limit: 1000,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
    })
    const ordersDocs = ordersRes.docs as unknown as Record<string, unknown>[]

    // 3. Fetch paid transactions scoped to this vendor's orders
    const orderIds = new Set(ordersDocs.map((o) => String(o.id)))
    const transactionsRes = await payload.find({
      collection: 'transactions',
      where: {
        and: [
          { order: { in: Array.from(orderIds) } },
          { status: { equals: 'paid' } },
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const paidTransactions = transactionsRes.docs as unknown as Record<string, unknown>[]

    // 4. Fetch order items for top products calculation
    const orderItemsRes = await payload.find({
      collection: 'order-items',
      where: { order: { in: Array.from(orderIds) } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const orderItemsDocs = orderItemsRes.docs as unknown as Record<string, unknown>[]

    // 5. Fetch delivery bookings for active deliveries
    const activeDeliveryOrders = ordersDocs.filter(
      (o) => getStr(o.status) === 'on_delivery'
    )
    const activeDeliveryOrderIds = activeDeliveryOrders.map((o) => String(o.id))
    const deliveryBookingsRes = activeDeliveryOrderIds.length > 0
      ? await payload.find({
          collection: 'delivery-bookings',
          where: { order: { in: activeDeliveryOrderIds } },
          limit: 50,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] as unknown[] }
    const deliveryBookingsDocs = deliveryBookingsRes.docs as unknown as Record<string, unknown>[]

    // 6. Fetch delivery locations for active deliveries
    const deliveryLocationsRes = activeDeliveryOrderIds.length > 0
      ? await payload.find({
          collection: 'delivery-locations',
          where: { order: { in: activeDeliveryOrderIds } },
          limit: 50,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] as unknown[] }
    const deliveryLocationsDocs = deliveryLocationsRes.docs as unknown as Record<string, unknown>[]

    // 7. Fetch reviews for this vendor's merchants
    const reviewsRes = await payload.find({
      collection: 'reviews',
      where: { merchant: { in: Array.from(merchantIds) } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const reviewsDocs = reviewsRes.docs as unknown as Record<string, unknown>[]

    // === AGGREGATE METRICS ===

    const thirtyDaysAgo = daysAgo(30)
    const sixtyDaysAgo = daysAgo(60)
    const today = daysAgo(0)

    const recentOrders = ordersDocs.filter((o) => String(o.createdAt ?? '') >= thirtyDaysAgo)
    const previousOrders = ordersDocs.filter((o) => {
      const c = String(o.createdAt ?? '')
      return c >= sixtyDaysAgo && c < thirtyDaysAgo
    })
    const recentTransactions = paidTransactions.filter((t) => {
      const paidAt = String(t.paid_at ?? '')
      return paidAt >= thirtyDaysAgo
    })
    const previousTransactions = paidTransactions.filter((t) => {
      const paidAt = String(t.paid_at ?? '')
      return paidAt >= sixtyDaysAgo && paidAt < thirtyDaysAgo
    })

    const totalRevenue = paidTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)
    const recentRevenue = recentTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)
    const previousRevenue = previousTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)

    const todayTransactions = paidTransactions.filter((t) =>
      String(t.paid_at ?? '').startsWith(today)
    )
    const todayRevenue = todayTransactions.reduce((sum, t) => sum + getNum(t.amount), 0)

    const pendingOrdersCount = ordersDocs.filter((o) => getStr(o.status) === 'pending').length
    const activeOrdersCount = ordersDocs.filter((o) => {
      const s = getStr(o.status)
      return s === 'accepted' || s === 'preparing' || s === 'ready_for_pickup' || s === 'on_delivery'
    }).length

    const totalReviewsCount = reviewsDocs.length
    const avgRating = totalReviewsCount > 0
      ? reviewsDocs.reduce((sum, r) => sum + getNum(r.merchant_rating, 0), 0) / totalReviewsCount
      : 0

    const metrics = {
      totalRevenue,
      revenueChange: previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
      todayRevenue,
      totalOrders: ordersDocs.length,
      ordersChange: previousOrders.length > 0 ? ((recentOrders.length - previousOrders.length) / previousOrders.length) * 100 : 0,
      pendingOrders: pendingOrdersCount,
      activeOrders: activeOrdersCount,
      totalOutlets: merchantsDocs.length,
      openOutlets: merchantsDocs.filter((m) => getStr(m.operationalStatus) === 'open').length,
      acceptingOrders: merchantsDocs.filter((m) => m.isAcceptingOrders === true).length,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: totalReviewsCount,
      ratingChange: 0,
    }

    // === OUTLET STATUS ===

    const todayOrderMap = new Map<string, number>()
    ordersDocs.forEach((o) => {
      const mId = resolveId(o.merchant)
      if (!mId) return
      if (String(o.createdAt ?? '').startsWith(today)) {
        todayOrderMap.set(mId, (todayOrderMap.get(mId) || 0) + 1)
      }
    })

    const todayRevenueMap = new Map<string, number>()
    paidTransactions.forEach((t) => {
      const tPaidAt = String(t.paid_at ?? '')
      if (!tPaidAt.startsWith(today)) return
      const orderId = resolveId(t.order)
      if (!orderId) return
      const order = ordersDocs.find((o) => String(o.id) === orderId)
      if (!order) return
      const mId = resolveId(order.merchant)
      if (!mId) return
      todayRevenueMap.set(mId, (todayRevenueMap.get(mId) || 0) + getNum(t.amount))
    })

    const outlets = merchantsDocs.map((m) => {
      const mId = String(m.id)
      return {
        id: mId,
        name: getStr(m.outletName, `Outlet #${mId}`),
        operationalStatus: getStr(m.operationalStatus, 'closed'),
        isAcceptingOrders: m.isAcceptingOrders === true,
        todayOrders: todayOrderMap.get(mId) || 0,
        todayRevenue: todayRevenueMap.get(mId) || 0,
        avgDeliveryTime: getNum(m.avg_delivery_time_minutes),
      }
    })

    // === REVENUE CHART (30 days) ===

    const revenueChart = []
    for (let i = 29; i >= 0; i--) {
      const date = daysAgo(i)
      const dayTransactions = paidTransactions.filter((t) => String(t.paid_at ?? '').startsWith(date))
      revenueChart.push({
        date: formatDate(date),
        revenue: dayTransactions.reduce((sum, t) => sum + getNum(t.amount), 0),
        orders: dayTransactions.length,
      })
    }

    // === ORDER STATUS CHART ===

    const statusMap = new Map<string, number>()
    ordersDocs.forEach((o) => {
      const status = getStr(o.status, 'unknown')
      statusMap.set(status, (statusMap.get(status) || 0) + 1)
    })
    const orderStatusChart = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }))

    // === TOP PRODUCTS ===

    const productSalesMap = new Map<string, { name: string; totalSold: number; revenue: number }>()
    orderItemsDocs.forEach((item) => {
      const productName = getStr(item.product_name_snapshot, 'Unknown Product')
      const quantity = getNum(item.quantity)
      const totalPrice = getNum(item.total_price)
      const existing = productSalesMap.get(productName) || { name: productName, totalSold: 0, revenue: 0 }
      existing.totalSold += quantity
      existing.revenue += totalPrice
      productSalesMap.set(productName, existing)
    })
    const topProducts = Array.from(productSalesMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 5)

    // === ACTIVE DELIVERIES ===

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

    const activeDeliveries = activeDeliveryOrders.map((o) => {
      const orderId = String(o.id)
      const booking = bookingMap.get(orderId)
      const location = locationMap.get(orderId)
      const merchantRaw = o.merchant
      const merchantObj = (merchantRaw && typeof merchantRaw === 'object') ? merchantRaw as Record<string, unknown> : null

      return {
        orderId,
        outletName: getStr(merchantObj?.outletName, 'N/A'),
        status: getStr(booking?.status, getStr(o.delivery_status, 'unknown')),
        customerAddress: getStr(location?.formatted_address, 'N/A'),
        driverName: getStr(booking?.driver_name, ''),
        placedAt: String(o.placed_at ?? o.createdAt ?? ''),
      }
    })

    // === PENDING ORDERS ===

    const pendingOrdersList = ordersDocs
      .filter((o) => getStr(o.status) === 'pending')
      .slice(0, 10)
      .map((o) => {
        const merchantRaw = o.merchant
        const merchantObj = (merchantRaw && typeof merchantRaw === 'object') ? merchantRaw as Record<string, unknown> : null
        const customerRaw = o.customer
        const customerObj = (customerRaw && typeof customerRaw === 'object') ? customerRaw as Record<string, unknown> : null
        const userRaw = customerObj?.user
        const userObj = (userRaw && typeof userRaw === 'object') ? userRaw as Record<string, unknown> : null

        return {
          id: String(o.id),
          outletName: getStr(merchantObj?.outletName, 'N/A'),
          customerEmail: getStr(userObj?.email, customerObj ? `Customer #${customerObj.id}` : 'N/A'),
          total: getNum(o.total),
          itemCount: orderItemsDocs.filter((item) => resolveId(item.order) === String(o.id)).length,
          placedAt: String(o.placed_at ?? o.createdAt ?? ''),
          fulfillmentType: getStr(o.fulfillment_type, 'delivery'),
        }
      })

    // === RECENT ORDERS (last 10) ===

    const recentOrdersList = ordersDocs.slice(0, 10).map((o) => {
      const merchantRaw = o.merchant
      const merchantObj = (merchantRaw && typeof merchantRaw === 'object') ? merchantRaw as Record<string, unknown> : null
      const customerRaw = o.customer
      const customerObj = (customerRaw && typeof customerRaw === 'object') ? customerRaw as Record<string, unknown> : null
      const userRaw = customerObj?.user
      const userObj = (userRaw && typeof userRaw === 'object') ? userRaw as Record<string, unknown> : null

      return {
        id: String(o.id),
        merchantName: getStr(merchantObj?.outletName, 'N/A'),
        customerEmail: getStr(userObj?.email, customerObj ? `Customer #${customerObj.id}` : 'N/A'),
        total: getNum(o.total),
        status: getStr(o.status, 'unknown'),
        createdAt: String(o.createdAt ?? ''),
      }
    })

    const responseBody = {
      metrics,
      outlets,
      revenueChart,
      orderStatusChart,
      topProducts,
      activeDeliveries,
      pendingOrders: pendingOrdersList,
      recentOrders: recentOrdersList,
    }
    await setCached(cacheKey, responseBody, 20)
    return NextResponse.json(responseBody, { headers: { 'X-MerchantDashboard-Cache': 'MISS' } })
  } catch (error) {
    console.error('Merchant dashboard aggregation error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard data' }, { status: 500 })
  }
}
