/**
 * GET /api/customer/loyalty/history?userId=&type=&page=&limit=
 * Points ledger history (earn/redeem/expiry only — PHP legs excluded).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveCustomer } from '../_shared'

const ALLOWED = ['earn', 'redeem', 'expiry']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type')
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (type && type !== 'all' && !ALLOWED.includes(type)) {
      return NextResponse.json({ error: `type must be one of all,${ALLOWED.join(',')}` }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const customer = await resolveCustomer(payload, userId)
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    const and: any[] = [
      { customer: { equals: customer.id } },
      { type: { in: ALLOWED } },
      { status: { equals: 'posted' } },
    ]
    if (type && type !== 'all') and.push({ type: { equals: type } })

    const res = await payload.find({
      collection: 'wallet-transactions',
      where: { and },
      sort: '-createdAt',
      page,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({
      data: {
        docs: ((res.docs || []) as any[]).map((d: any) => ({
          id: d.id,
          type: d.type,
          points: Math.floor(Number(d.points ?? 0)),
          pointsAfter: Math.floor(Number(d.points_balance_after ?? 0)),
          orderId: typeof d.order === 'object' ? d.order?.id : d.order,
          expiresAt: d.expires_at || null,
          createdAt: d.createdAt,
        })),
        pagination: {
          page: res.page,
          limit: res.limit,
          totalDocs: res.totalDocs,
          totalPages: res.totalPages,
          hasNextPage: res.hasNextPage,
          hasPrevPage: res.hasPrevPage,
        },
      },
    })
  } catch (err: any) {
    console.error('[customer/loyalty/history] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
