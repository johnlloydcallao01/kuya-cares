import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import { getCached, setCached } from '@encreasl/cache'
import {
  ReportsDoc,
  buildReportsCacheQuery,
  buildReportsCore,
  getNum,
  parseReportsParams,
} from '@/utils/reportsShared'

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { searchParams } = new URL(request.url)
      const cacheKey = `admin:reports:summary:${admin.id}:${buildReportsCacheQuery(searchParams)}`
      const cached = await getCached<Record<string, unknown>>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-Reports-Cache': 'HIT' } })

      const params = parseReportsParams(searchParams)
      const { days, label, now, periodStart } = params

      const [vendorsRes, merchantsRes, ordersRes, transactionsRes, discountsRes] = await Promise.all([
        payload.find({ collection: 'vendors', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'merchants', limit: 2000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'orders', limit: 3000, sort: '-createdAt', depth: 0, overrideAccess: true }),
        payload.find({ collection: 'transactions', limit: 3000, depth: 0, overrideAccess: true }),
        payload.find({ collection: 'order-discounts', limit: 3000, depth: 0, overrideAccess: true }),
      ])

      const vendorsDocs = vendorsRes.docs as unknown as ReportsDoc[]
      const merchantsDocs = merchantsRes.docs as unknown as ReportsDoc[]
      const ordersDocs = ordersRes.docs as unknown as ReportsDoc[]
      const transactionsDocs = transactionsRes.docs as unknown as ReportsDoc[]
      const discountsDocs = (discountsRes.docs as unknown as ReportsDoc[]) ?? []

      const core = buildReportsCore(params, {
        vendorsDocs,
        merchantsDocs,
        ordersDocs,
        transactionsDocs,
        discountsDocs,
      })
      const { ordersPeriod, paidTxPeriod, refundedTxPeriod, failedTxPeriod, discountsPeriod } = core

      const totalRevenue = paidTxPeriod.reduce((s, t) => s + getNum(t.amount), 0)
      const totalRefunded = refundedTxPeriod.reduce((s, t) => s + getNum(t.amount), 0)
      const netRevenue = totalRevenue - totalRefunded
      const totalOrders = ordersPeriod.length
      const avgOrder = totalOrders ? totalRevenue / totalOrders : 0

      const periodLabel = days === 0 ? 'All time' : `${days}d`
      const periodStartIso =
        periodStart
          ? periodStart.toISOString()
          : ordersDocs.length
            ? String(ordersDocs[ordersDocs.length - 1]?.createdAt ?? '')
            : now.toISOString()

      const response = {
        meta: {
          range: label,
          periodLabel,
          days,
          generatedAt: now.toISOString(),
          periodStart: periodStartIso,
          periodEnd: now.toISOString(),
          totalDocs: {
            vendors: vendorsDocs.length,
            merchants: merchantsDocs.length,
            orders: ordersDocs.length,
            transactions: transactionsDocs.length,
          },
        },
        summary: {
          totalRevenue,
          totalRefunded,
          netRevenue,
          totalDiscounts: discountsPeriod.reduce((s, d) => s + getNum(d.amount_off), 0),
          vendorFundedDiscounts: discountsPeriod.reduce((s, d) => s + getNum(d.vendor_share), 0),
          totalOrders,
          avgOrder,
          totalVendors: vendorsDocs.length,
          activeVendors: vendorsDocs.filter((v) => v.isActive).length,
          totalMerchants: merchantsDocs.length,
          activeMerchants: merchantsDocs.filter((m) => m.isActive).length,
          failedCount: failedTxPeriod.length,
          refundedCount: refundedTxPeriod.length,
          paidCount: paidTxPeriod.length,
        },
      }
      await setCached(cacheKey, response, 30)
      return NextResponse.json(response, { headers: { 'X-Reports-Cache': 'MISS' } })
    } catch (error) {
      console.error('Reports summary aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load reports summary' }, { status: 500 })
    }
  })
}
