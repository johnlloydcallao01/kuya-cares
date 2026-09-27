import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const ALLOWED_TYPES = ['topup', 'payment', 'refund', 'cashback', 'withdrawal', 'adjustment', 'expiry']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const customerIdParam = searchParams.get('customerId')
    const type = searchParams.get('type')
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))

    if (!userId && !customerIdParam) {
      return NextResponse.json({ error: 'userId or customerId is required' }, { status: 400 })
    }
    if (type && !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of ${ALLOWED_TYPES.join(',')}` }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })

    let customerId: number | string | undefined = customerIdParam
      ? Number(customerIdParam) || customerIdParam
      : undefined
    if (!customerId && userId) {
      const { docs: customers } = await payload.find({
        collection: 'customers',
        where: { user: { equals: Number(userId) } },
        limit: 1,
        overrideAccess: true,
      })
      if (!customers[0]) {
        return NextResponse.json({ data: { docs: [], pagination: { page: 1, limit, totalDocs: 0, totalPages: 0 } } })
      }
      customerId = customers[0].id
    }

    const and: any[] = [{ customer: { equals: Number(customerId) || customerId } }]
    if (type) and.push({ type: { equals: type } })

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
        docs: (res.docs || []).map((d: any) => ({
          id: d.id,
          type: d.type,
          amount: d.amount,
          balanceAfter: d.balance_after,
          orderId: typeof d.order === 'object' ? d.order?.id : d.order,
          gateway: d.gateway,
          status: d.status,
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
    console.error('[customer/wallet/history] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
