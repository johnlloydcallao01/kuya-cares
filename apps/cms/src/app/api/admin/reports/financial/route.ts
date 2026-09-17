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
  getStr,
  parseReportsParams,
  resolveId,
} from '@/utils/reportsShared'

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { searchParams } = new URL(request.url)
      const cacheKey = `admin:reports:financial:${admin.id}:${buildReportsCacheQuery(searchParams)}`
      const cached = await getCached<Record<string, unknown>>(cacheKey)
      if (cached) return NextResponse.json(cached, { headers: { 'X-Reports-Cache': 'HIT' } })

      const params = parseReportsParams(searchParams)

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
      const { merchantMap, vendorMap, orderMap, paidTxPeriod, refundedTxPeriod, failedTxPeriod, discountByOrder } =
        core

      function resolveMerchant(order: ReportsDoc | null): { id: string; doc: ReportsDoc | null; raw: unknown } {
        const merchantRaw = order ? order.merchant : null
        const merchantObj =
          merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as ReportsDoc) : null
        const merchantId = merchantObj ? String(merchantObj.id ?? '') : String(merchantRaw ?? '')
        const doc = merchantId ? (merchantMap.get(merchantId) ?? null) : null
        return { id: merchantId, doc: doc ?? merchantObj, raw: merchantRaw }
      }
      function resolveVendor(merchant: ReportsDoc | null): { id: string; doc: ReportsDoc | null; raw: unknown } {
        const vendorRaw = merchant ? merchant.vendor : null
        const vendorObj = vendorRaw && typeof vendorRaw === 'object' ? (vendorRaw as ReportsDoc) : null
        const vendorId = vendorObj ? String(vendorObj.id ?? '') : String(vendorRaw ?? '')
        const doc = vendorId ? (vendorMap.get(vendorId) ?? null) : null
        return { id: vendorId, doc: doc ?? vendorObj, raw: vendorRaw }
      }

      const financialRows = paidTxPeriod.slice(0, 200).map((t) => {
        const orderId = resolveId(t.order)
        const order = orderId ? (orderMap.get(orderId) ?? null) : null
        const merchant = resolveMerchant(order)
        const merchantName = merchant.doc
          ? getStr(merchant.doc.outletName, `Merchant #${merchant.id}`)
          : 'N/A'
        const vendor = resolveVendor(merchant.doc)
        const vendorName = vendor.doc ? getStr(vendor.doc.businessName, `Vendor #${vendor.id}`) : 'N/A'
        const orderDiscount = orderId ? discountByOrder.get(orderId) : undefined
        return {
          transactionId: String(t.id),
          orderId: orderId || '—',
          date: String(t.paid_at ?? t.createdAt ?? ''),
          merchant: merchantName,
          vendor: vendorName,
          amount: getNum(t.amount),
          platformFee: order ? getNum(order.platform_fee) : 0,
          deliveryFee: order ? getNum(order.delivery_fee) : 0,
          discount: orderDiscount ? orderDiscount.total : 0,
          couponCode: orderDiscount ? orderDiscount.code : '',
          status: String(t.status),
          paymentMethod: getStr(t.payment_method, 'unknown'),
          gross: order ? getNum(order.total) : getNum(t.amount),
        }
      })

      const vendorAgg = new Map<
        string,
        {
          businessName: string
          orders: number
          gross: number
          platformFees: number
          deliveryFees: number
          discountShare: number
          net: number
        }
      >()
      paidTxPeriod.forEach((t) => {
        const orderId = resolveId(t.order)
        const order = orderId ? (orderMap.get(orderId) ?? null) : null
        if (!order) return
        const merchant = resolveMerchant(order)
        const vendor = resolveVendor(merchant.doc)
        if (!vendor.id) return
        const businessName = vendor.doc
          ? getStr(vendor.doc.businessName, `Vendor #${vendor.id}`)
          : `Vendor #${vendor.id}`
        const agg = vendorAgg.get(vendor.id) || {
          businessName,
          orders: 0,
          gross: 0,
          platformFees: 0,
          deliveryFees: 0,
          discountShare: 0,
          net: 0,
        }
        const amt = getNum(t.amount)
        const vendorDiscount = orderId ? (discountByOrder.get(orderId)?.vendorShare ?? 0) : 0
        agg.orders += 1
        agg.gross += amt
        agg.platformFees += getNum(order.platform_fee)
        agg.deliveryFees += getNum(order.delivery_fee)
        agg.discountShare += vendorDiscount
        agg.net += Math.max(
          0,
          amt - getNum(order.platform_fee) - getNum(order.delivery_fee) - vendorDiscount,
        )
        vendorAgg.set(vendor.id, agg)
      })
      const vendorPayouts = Array.from(vendorAgg.entries())
        .map(([vendorId, v]) => ({ vendorId, ...v }))
        .sort((a, b) => b.gross - a.gross)
        .slice(0, 20)

      const refundsRows = [...refundedTxPeriod, ...failedTxPeriod].slice(0, 100).map((t) => ({
        transactionId: String(t.id),
        orderId: resolveId(t.order) || '—',
        date: String(t.createdAt ?? ''),
        amount: getNum(t.amount),
        status: String(t.status),
        paymentMethod: getStr(t.payment_method, 'unknown'),
      }))

      const totalRefunded = refundedTxPeriod.reduce((s, t) => s + getNum(t.amount), 0)
      const response = {
        financialReconciliation: {
          rows: financialRows,
          totals: {
            gross: paidTxPeriod.reduce((s, t) => s + getNum(t.amount), 0),
            platformFees: financialRows.reduce((s, r) => s + r.platformFee, 0),
            deliveryFees: financialRows.reduce((s, r) => s + r.deliveryFee, 0),
            discounts: financialRows.reduce((s, r) => s + (r.discount || 0), 0),
          },
          count: financialRows.length,
          totalCount: paidTxPeriod.length,
        },
        vendorPayouts: { rows: vendorPayouts, count: vendorPayouts.length },
        refundsFailures: {
          rows: refundsRows,
          totals: {
            refunded: totalRefunded,
            failed: failedTxPeriod.reduce((s, t) => s + getNum(t.amount), 0),
          },
          count: refundsRows.length,
        },
      }
      await setCached(cacheKey, response, 60)
      return NextResponse.json(response, { headers: { 'X-Reports-Cache': 'MISS' } })
    } catch (error) {
      console.error('Reports financial aggregation error:', error)
      return NextResponse.json({ error: 'Failed to load reports financial' }, { status: 500 })
    }
  })
}
