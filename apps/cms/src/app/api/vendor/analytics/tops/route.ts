import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCached, setCached } from '@encreasl/cache'
import {
  VendorDoc,
  buildVendorAnalyticsCacheQuery,
  buildVendorAnalyticsCore,
  getNum,
  getStr,
  isInCurrentPeriod,
  parseVendorAnalyticsParams,
  resolveId,
} from '@/utils/vendorAnalyticsShared'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })

    const cacheKey = `vendor:analytics:tops:${userId}:${buildVendorAnalyticsCacheQuery(searchParams)}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VendorAnalytics-Cache': 'HIT' } })

    const params = parseVendorAnalyticsParams(searchParams)
    const { days } = params

    const vendorsRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorsRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: String(vendor.id) } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantsDocs = merchantsRes.docs as unknown as VendorDoc[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))

    if (merchantIds.size === 0) {
      const emptyBody = {
        revenueByCategory: [],
        topProducts: [],
        weekdayDistribution: [],
        ratingDistribution: [],
      }
      await setCached(cacheKey, emptyBody, 20)
      return NextResponse.json(emptyBody, { headers: { 'X-VendorAnalytics-Cache': 'MISS' } })
    }

    const ordersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: Array.from(merchantIds) } },
      limit: 3000,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })
    const ordersDocs = ordersRes.docs as unknown as VendorDoc[]
    const orderIds = Array.from(new Set(ordersDocs.map((o) => String(o.id))))

    const [transactionsRes, orderItemsRes, reviewsRes, productsRes, categoriesRes] = await Promise.all([
      orderIds.length
        ? payload.find({
            collection: 'transactions',
            where: { order: { in: orderIds } },
            limit: 3000,
            depth: 0,
            overrideAccess: true,
          })
        : Promise.resolve({ docs: [] as unknown[] } as unknown as Awaited<ReturnType<typeof payload.find>>),
      orderIds.length
        ? payload.find({
            collection: 'order-items',
            where: { order: { in: orderIds } },
            limit: 5000,
            depth: 0,
            overrideAccess: true,
          })
        : Promise.resolve({ docs: [] as unknown[] } as unknown as Awaited<ReturnType<typeof payload.find>>),
      payload.find({
        collection: 'reviews',
        where: { merchant: { in: Array.from(merchantIds) } },
        limit: 2000,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({ collection: 'products', limit: 2000, depth: 0, overrideAccess: true }),
      payload.find({ collection: 'product-categories', limit: 1000, depth: 0, overrideAccess: true }),
    ])
    const transactionsDocs = transactionsRes.docs as unknown as VendorDoc[]
    const orderItemsDocs = orderItemsRes.docs as unknown as VendorDoc[]
    const reviewsDocs = reviewsRes.docs as unknown as VendorDoc[]
    const productsDocs = productsRes.docs as unknown as VendorDoc[]
    const categoriesDocs = categoriesRes.docs as unknown as VendorDoc[]

    const core = buildVendorAnalyticsCore(params, {
      merchantsDocs,
      ordersDocs,
      transactionsDocs,
      orderItemsDocs,
      productsDocs,
      categoriesDocs,
    })
    const { ordersCurrent, verifiedRevenueByOrderId, verifiedOrderIds, productMap, categoryMap } = core

    const productAgg = new Map<string, { name: string; quantity: number; revenue: number; orders: number }>()
    orderItemsDocs.forEach((oi) => {
      const oid = resolveId(oi.order)
      if (!verifiedOrderIds.has(oid)) return
      const name = getStr(oi.product_name_snapshot, 'Unknown')
      const key = String(oi.product ?? name)
      const e = productAgg.get(key) || { name, quantity: 0, revenue: 0, orders: 0 }
      e.quantity += getNum(oi.quantity)
      e.revenue += getNum(oi.total_price)
      e.orders += 1
      productAgg.set(key, e)
    })
    const topProducts = Array.from(productAgg.entries())
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    const catRevenueMap = new Map<string, { category: string; revenue: number; quantity: number }>()
    orderItemsDocs.forEach((oi) => {
      const oid = resolveId(oi.order)
      if (!verifiedOrderIds.has(oid)) return
      const prodRaw = oi.product as unknown
      const pid =
        prodRaw && typeof prodRaw === 'object' ? String((prodRaw as VendorDoc).id ?? '') : String(prodRaw ?? '')
      const prod = pid ? productMap.get(pid) : null
      const cats = prod ? prod.categories : null
      const catIds: string[] = Array.isArray(cats) ? cats.map((c: unknown) => String((c as VendorDoc)?.id ?? c ?? '')) : []
      const rev = getNum(oi.total_price)
      const qty = getNum(oi.quantity)
      if (!catIds.length) {
        const e = catRevenueMap.get('uncategorized') || { category: 'uncategorized', revenue: 0, quantity: 0 }
        e.revenue += rev
        e.quantity += qty
        catRevenueMap.set('uncategorized', e)
      } else {
        catIds.forEach((cid) => {
          const cat = categoryMap.get(cid)
          const cname = cat ? getStr(cat.name, cid) : cid
          const e = catRevenueMap.get(cname) || { category: cname, revenue: 0, quantity: 0 }
          e.revenue += rev
          e.quantity += qty
          catRevenueMap.set(cname, e)
        })
      }
    })
    const revenueByCategory = Array.from(catRevenueMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weekday = Array.from({ length: 7 }, (_, i) => ({ day: weekdayLabels[i], orders: 0, revenue: 0 }))
    ordersCurrent.forEach((o) => {
      const d = new Date(String(o.createdAt ?? ''))
      if (isNaN(d.getTime())) return
      const w = d.getDay()
      weekday[w].orders += 1
      weekday[w].revenue += verifiedRevenueByOrderId.get(String(o.id)) || 0
    })

    const ratingBuckets = [1, 2, 3, 4, 5].map((r) => ({ rating: r, count: 0 }))
    const periodReviews =
      days === 0 ? reviewsDocs : reviewsDocs.filter((r) => isInCurrentPeriod(params, r, 'createdAt'))
    periodReviews.forEach((r) => {
      const v = Math.round(getNum(r.merchant_rating))
      const b = ratingBuckets.find((x) => x.rating === v)
      if (b) b.count += 1
    })

    const responseBody = {
      revenueByCategory,
      topProducts,
      weekdayDistribution: weekday,
      ratingDistribution: ratingBuckets,
    }
    await setCached(cacheKey, responseBody, 60)
    return NextResponse.json(responseBody, { headers: { 'X-VendorAnalytics-Cache': 'MISS' } })
  } catch (error) {
    console.error('Vendor analytics tops error:', error)
    return NextResponse.json({ error: 'Failed to load vendor analytics' }, { status: 500 })
  }
}
