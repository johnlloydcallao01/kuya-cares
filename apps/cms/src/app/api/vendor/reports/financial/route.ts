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
  resolveId,
} from '@/utils/vendorReportsShared'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const cacheKey = `vendor:reports:financial:${userId}:${buildVendorReportsCacheQuery(searchParams)}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-VendorReports-Cache': 'HIT' } })

    const params = parseVendorReportsParams(searchParams)

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
    const merchantsDocs = merchantsRes.docs as unknown as VendorReportDoc[]
    const merchantIds = new Set(merchantsDocs.map((m) => String(m.id)))

    if (merchantIds.size === 0) {
      const emptyBody = {
        financialReconciliation: { rows: [], totals: { gross: 0, platformFees: 0, deliveryFees: 0 }, count: 0 },
        outletPayouts: { rows: [], count: 0 },
        refundsFailures: { rows: [], count: 0 },
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
    const { merchantMap, orderMap, paidTxPeriod, refundedTxPeriod, failedTxPeriod } = core

    const resolveOutlet = (
      order: VendorReportDoc | null,
    ): { mid: string; merchant: VendorReportDoc | null; raw: unknown } => {
      const merchantRaw = order ? order.merchant : null
      const mObj =
        merchantRaw && typeof merchantRaw === 'object' ? (merchantRaw as VendorReportDoc) : null
      const mid = mObj ? String(mObj.id ?? '') : String(merchantRaw ?? '')
      // NOTE: mirrors the monolith — map hit wins, otherwise the populated
      // object (unreachable at depth: 0, kept for identical fallback shape).
      const merchant = mid ? merchantMap.get(mid) ?? mObj : mObj
      return { mid, merchant, raw: merchantRaw }
    }

    const financialRows = paidTxPeriod.slice(0, 200).map((t) => {
      const oid = resolveId(t.order)
      const order = oid ? (orderMap.get(oid) ?? null) : null
      const { mid, merchant } = resolveOutlet(order)
      const outName = merchant ? getStr(merchant.outletName, `Outlet #${mid}`) : 'N/A'
      return {
        transactionId: String(t.id),
        orderId: oid || '—',
        date: String(t.paid_at ?? t.createdAt ?? ''),
        outlet: outName,
        amount: getNum(t.amount),
        platformFee: order ? getNum(order.platform_fee) : 0,
        deliveryFee: order ? getNum(order.delivery_fee) : 0,
        status: String(t.status),
        paymentMethod: getStr(t.payment_method, 'unknown'),
        gross: order ? getNum(order.total) : getNum(t.amount),
      }
    })

    const outletAgg = new Map<
      string,
      { outletName: string; orders: number; gross: number; platformFees: number; deliveryFees: number; net: number }
    >()
    paidTxPeriod.forEach((t) => {
      const oid = resolveId(t.order)
      const order = oid ? (orderMap.get(oid) ?? null) : null
      if (!order) return
      const { mid } = resolveOutlet(order)
      if (!mid) return
      const outlet = merchantMap.get(mid)
      const name = outlet ? getStr(outlet.outletName, mid) : mid
      const agg = outletAgg.get(mid) || { outletName: name, orders: 0, gross: 0, platformFees: 0, deliveryFees: 0, net: 0 }
      const amt = getNum(t.amount)
      agg.orders += 1
      agg.gross += amt
      agg.platformFees += getNum(order.platform_fee)
      agg.deliveryFees += getNum(order.delivery_fee)
      agg.net += Math.max(0, amt - getNum(order.platform_fee) - getNum(order.delivery_fee))
      outletAgg.set(mid, agg)
    })
    const outletPayouts = Array.from(outletAgg.entries())
      .map(([outletId, v]) => ({ outletId, ...v }))
      .sort((a, b) => b.gross - a.gross)

    const refundsRows = [...refundedTxPeriod, ...failedTxPeriod].slice(0, 100).map((t) => ({
      transactionId: String(t.id),
      orderId: resolveId(t.order) || '—',
      date: String(t.createdAt ?? ''),
      amount: getNum(t.amount),
      status: String(t.status),
      paymentMethod: getStr(t.payment_method, 'unknown'),
    }))

    const totalRevenue = paidTxPeriod.reduce((s, t) => s + getNum(t.amount), 0)
    const responseBody = {
      financialReconciliation: {
        rows: financialRows,
        totals: {
          gross: totalRevenue,
          platformFees: financialRows.reduce((s, r) => s + r.platformFee, 0),
          deliveryFees: financialRows.reduce((s, r) => s + r.deliveryFee, 0),
        },
        count: financialRows.length,
        totalCount: paidTxPeriod.length,
      },
      outletPayouts: { rows: outletPayouts, count: outletPayouts.length },
      refundsFailures: { rows: refundsRows, count: refundsRows.length },
    }
    await setCached(cacheKey, responseBody, 60)
    return NextResponse.json(responseBody, { headers: { 'X-VendorReports-Cache': 'MISS' } })
  } catch (e) {
    console.error('Vendor reports financial error:', e)
    return NextResponse.json({ error: 'Failed to load vendor reports' }, { status: 500 })
  }
}
