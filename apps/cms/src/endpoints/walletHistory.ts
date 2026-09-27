import type { PayloadRequest } from 'payload'

/**
 * GET /api/wallet/history?customerId=&type=&page=&limit=
 * Auth: service or admin (shared service key + explicit customerId).
 */
const ALLOWED_TYPES = ['topup', 'payment', 'refund', 'cashback', 'withdrawal', 'adjustment', 'expiry']

export const walletHistoryHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    const url = new URL((req as unknown as Request).url)
    const customerId = url.searchParams.get('customerId')
    const type = url.searchParams.get('type')
    const page = Math.max(1, Number(url.searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 20)))
    if (!customerId) {
      return Response.json({ error: 'customerId is required' }, { status: 400 })
    }
    if (type && !ALLOWED_TYPES.includes(type)) {
      return Response.json({ error: `type must be one of ${ALLOWED_TYPES.join(',')}` }, { status: 400 })
    }

    const and: any[] = [{ customer: { equals: Number(customerId) || customerId } }]
    if (type) and.push({ type: { equals: type } })

    const res = await (req.payload as any).find({
      collection: 'wallet-transactions',
      where: { and },
      sort: '-createdAt',
      page,
      limit,
      depth: 0,
      overrideAccess: true,
    })

    const docs = (res.docs || []).map((d: any) => ({
      id: d.id,
      type: d.type,
      amount: d.amount,
      balanceAfter: d.balance_after,
      orderId: typeof d.order === 'object' ? d.order?.id : d.order,
      gateway: d.gateway,
      status: d.status,
      createdAt: d.createdAt,
    }))

    return Response.json({
      data: {
        docs,
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
  } catch (error: any) {
    console.error('[wallet/history] Error:', error)
    return Response.json({ error: error?.message || 'Failed to load wallet history' }, { status: 500 })
  }
}
