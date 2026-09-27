import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { WalletService } from '@/services/WalletService'

const ALLOWED_TYPES = ['topup', 'payment', 'refund', 'cashback', 'withdrawal', 'adjustment', 'expiry']

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function mapTx(d: any) {
  return {
    id: d.id,
    type: d.type,
    amount: toNum(d.amount, 0),
    balanceAfter: toNum(d.balance_after, 0),
    orderId: typeof d.order === 'object' ? d.order?.id : d.order,
    gateway: d.gateway,
    status: d.status,
    createdAt: d.createdAt,
  }
}

/**
 * GET /api/wallets/summary?userId=&type=&page=&limit=&q=
 *
 * Backend aggregation endpoint for the /wallets page (BFF pattern).
 * Owns: user -> customer resolution (auto-provisions the customers row),
 * wallet balance, stats, and paginated/filtered ledger history.
 * The frontend calls only this endpoint for reads — no raw collection
 * fetching, no localStorage orchestration in the page.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const type = searchParams.get('type')
    const q = (searchParams.get('q') || '').trim().toLowerCase()
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)))

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (type && type !== 'all' && !ALLOWED_TYPES.includes(type)) {
      return NextResponse.json({ error: `type must be one of all,${ALLOWED_TYPES.join(',')}` }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const numericUser = Number(userId)

    // 1. Resolve customer — auto-provision so the page never 404s on first visit.
    let customerId: number | string | undefined
    const { docs: customers } = await payload.find({
      collection: 'customers',
      where: { user: { equals: Number.isFinite(numericUser) ? numericUser : userId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (customers[0]) {
      customerId = customers[0].id
    } else {
      try {
        const created = await payload.create({
          collection: 'customers',
          data: { user: Number.isFinite(numericUser) ? numericUser : (userId as any) },
          overrideAccess: true,
        })
        customerId = (created as any).id
      } catch {
        return NextResponse.json(
          { error: 'Customer not found for user', code: 'NO_CUSTOMER' },
          { status: 404 },
        )
      }
    }

    // 2. Wallet (auto-created on first read) + full ledger for stats.
    const service = new WalletService(payload)
    const wallet = await service.getBalance(customerId!)

    const and: any[] = [{ customer: { equals: Number(customerId) || customerId } }]
    if (type && type !== 'all') and.push({ type: { equals: type } })

    const [allRes, pageRes] = await Promise.all([
      payload.find({
        collection: 'wallet-transactions',
        where: { and },
        sort: '-createdAt',
        pagination: false,
        limit: 2000,
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({
        collection: 'wallet-transactions',
        where: { and },
        sort: '-createdAt',
        page,
        limit,
        depth: 0,
        overrideAccess: true,
      }),
    ])

    const sumBy = (t: string) =>
      (allRes.docs || [])
        .filter((d: any) => d.type === t)
        .reduce((s: number, d: any) => s + Math.abs(toNum(d.amount, 0)), 0)

    let docs = (pageRes.docs || []).map(mapTx)
    if (q) {
      docs = docs.filter((d: any) => {
        const hay = `${d.id} ${d.type} ${d.orderId ?? ''} ${d.gateway ?? ''} ${d.amount}`.toLowerCase()
        return hay.includes(q)
      })
    }

    return NextResponse.json({
      data: {
        customerId,
        wallet,
        stats: {
          toppedUp: sumBy('topup'),
          spent: sumBy('payment'),
          cashback: sumBy('cashback'),
          refunded: sumBy('refund'),
          totalDocs: allRes.totalDocs ?? (allRes.docs || []).length,
        },
        history: {
          docs,
          pagination: {
            page: pageRes.page,
            limit: pageRes.limit,
            totalDocs: pageRes.totalDocs,
            totalPages: pageRes.totalPages,
            hasNextPage: pageRes.hasNextPage,
            hasPrevPage: pageRes.hasPrevPage,
          },
        },
      },
    })
  } catch (err: any) {
    console.error('[wallets/summary] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
