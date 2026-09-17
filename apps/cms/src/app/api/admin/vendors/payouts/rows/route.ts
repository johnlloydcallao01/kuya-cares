import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'
import {
  PayoutDoc,
  buildPayoutsCacheQuery,
  buildPayoutsCore,
  buildVendorAgg,
  enrichMerchantCounts,
  parsePayoutsParams,
  toPayoutRows,
} from '@/utils/payoutsShared'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const cacheKey = `admin:payouts:rows:${admin.id}:${buildPayoutsCacheQuery(searchParams)}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Payouts-Cache': 'HIT' } })

    const params = parsePayoutsParams(searchParams)

    const [vendorsRes, merchantsRes, ordersRes, transactionsRes] = await Promise.all([
      payload.find({ collection: 'vendors', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'merchants', limit: 2000, depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'orders', limit: 5000, sort: '-createdAt', depth: 0, overrideAccess: true, pagination: false } as any),
      payload.find({ collection: 'transactions', limit: 5000, depth: 0, overrideAccess: true, pagination: false } as any),
    ])

    const core = buildPayoutsCore(params, {
      vendorsDocs: (vendorsRes.docs as unknown as PayoutDoc[]) || [],
      merchantsDocs: (merchantsRes.docs as unknown as PayoutDoc[]) || [],
      ordersDocs: (ordersRes.docs as unknown as PayoutDoc[]) || [],
      transactionsDocs: (transactionsRes.docs as unknown as PayoutDoc[]) || [],
    })
    const vendorAgg = buildVendorAgg(core)
    enrichMerchantCounts(core, vendorAgg)
    const rows = toPayoutRows(vendorAgg)

    const response = { vendorPayouts: { rows, count: rows.length } }
    await setCached(cacheKey, response, 60)
    return NextResponse.json(response, { headers: { 'X-Payouts-Cache': 'MISS' } })
  } catch (err: unknown) {
    console.error('[admin/vendors/payouts/rows] error:', err)
    return NextResponse.json({ error: 'Failed to load payouts rows' }, { status: 500 })
  }
}
