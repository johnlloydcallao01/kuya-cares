import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getCached, setCached } from '@encreasl/cache'
import {
  VendorReportDoc,
  buildVendorReportsCacheQuery,
  buildVendorReportsCore,
  getNum,
  getStr,
  parseVendorReportsParams,
} from '@/utils/vendorReportsShared'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const cacheKey = `vendor:reports:summary:${userId}:${buildVendorReportsCacheQuery(searchParams)}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VendorReports-Cache': 'HIT' } })

    const params = parseVendorReportsParams(searchParams)
    const { days, label, now, periodStart } = params

    const vendorsRes = await payload.find({
      collection: 'vendors',
      where: { user: { equals: userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vendor = vendorsRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    const vendorId = String(vendor.id)
    const vendorName = getStr(vendor.businessName, 'Vendor')

    const merchantsRes = await payload.find({
      collection: 'merchants',
      where: { vendor: { equals: vendorId } },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })
    const merchantsDocs = merchantsRes.docs as unknown as VendorReportDoc[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))

    if (merchantIds.size === 0) {
      const emptyBody = {
        meta: {
          range: label,
          days,
          generatedAt: now.toISOString(),
          vendorId,
          vendorName,
          periodStart: periodStart ? periodStart.toISOString() : null,
          periodEnd: now.toISOString(),
        },
        summary: {
          totalRevenue: 0,
          totalRefunded: 0,
          netRevenue: 0,
          totalOrders: 0,
          avgOrder: 0,
          paidCount: 0,
          refundedCount: 0,
          failedCount: 0,
          totalOutlets: 0,
        },
      }
      await setCached(cacheKey, emptyBody, 20)
      return NextResponse.json(emptyBody, { headers: { 'X-VendorReports-Cache': 'MISS' } })
    }

    const ordersRes = await payload.find({
      collection: 'orders',
      where: { merchant: { in: Array.from(merchantIds) } },
      limit: 3000,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    })
    const ordersDocs = ordersRes.docs as unknown as VendorReportDoc[]
    const orderIds = Array.from(new Set(ordersDocs.map((o) => String(o.id))))

    const transactionsRes = orderIds.length
      ? await payload.find({
          collection: 'transactions',
          where: { order: { in: orderIds } },
          limit: 3000,
          depth: 0,
          overrideAccess: true,
        })
      : ({ docs: [] as unknown[] } as unknown as Awaited<ReturnType<typeof payload.find>>)
    const transactionsDocs = transactionsRes.docs as unknown as VendorReportDoc[]

    const core = buildVendorReportsCore(params, { merchantsDocs, ordersDocs, transactionsDocs })
    const { ordersPeriod, paidTxPeriod, refundedTxPeriod, failedTxPeriod } = core

    const totalRevenue = paidTxPeriod.reduce((s, t) => s + getNum(t.amount), 0)
    const totalRefunded = refundedTxPeriod.reduce((s, t) => s + getNum(t.amount), 0)
    const totalOrders = ordersPeriod.length

    const responseBody = {
      meta: {
        range: label,
        days,
        generatedAt: now.toISOString(),
        vendorId,
        vendorName,
        periodStart: periodStart ? periodStart.toISOString() : null,
        periodEnd: now.toISOString(),
        totalOrders: ordersDocs.length,
      },
      summary: {
        totalRevenue,
        totalRefunded,
        netRevenue: totalRevenue - totalRefunded,
        totalOrders,
        avgOrder: totalOrders ? totalRevenue / totalOrders : 0,
        paidCount: paidTxPeriod.length,
        refundedCount: refundedTxPeriod.length,
        failedCount: failedTxPeriod.length,
        totalOutlets: merchantsDocs.length,
      },
    }
    await setCached(cacheKey, responseBody, 30)
    return NextResponse.json(responseBody, { headers: { 'X-VendorReports-Cache': 'MISS' } })
  } catch (e) {
    console.error('Vendor reports summary error:', e)
    return NextResponse.json({ error: 'Failed to load vendor reports' }, { status: 500 })
  }
}
