import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { WalletService } from '@/services/WalletService'

const ALLOWED_TYPES = ['topup', 'payment', 'refund', 'cashback', 'withdrawal', 'adjustment', 'expiry']

// Lifetime-stats cache (§docs/performance.md §4b item 5, client-safe slice):
// sums are identical for every tab/search of one customer, so one 20s entry
// serves them all instead of a 2000-doc scan per keystroke or tab switch.
// Page ROWS are never cached — only the 5 lifetime scalars. 20s staleness
// on lifetime sums is the documented rollup trade-off; balance itself is
// always read fresh from the wallet doc below.
const STATS_TTL_MS = 20_000
const statsCache = new Map<string, { ts: number; stats: Record<string, number> }>()
const statsInflight = new Map<string, Promise<Record<string, number>>>()

async function getLifetimeStats(payload: any, customerId: number | string): Promise<Record<string, number>> {
  const key = `wallet-stats:${customerId}`
  const hit = statsCache.get(key)
  if (hit && Date.now() - hit.ts <= STATS_TTL_MS) return hit.stats
  const running = statsInflight.get(key)
  if (running) return running
  const p = (async () => {
    const res = await payload.find({
      collection: 'wallet-transactions',
      where: { customer: { equals: Number(customerId) || customerId } },
      sort: '-createdAt',
      pagination: false,
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    const sumBy = (t: string) =>
      (res.docs || [])
        .filter((d: any) => d.type === t)
        .reduce((s: number, d: any) => s + Math.abs(toNum(d.amount, 0)), 0)
    const stats = {
      toppedUp: sumBy('topup'),
      spent: sumBy('payment'),
      cashback: sumBy('cashback'),
      refunded: sumBy('refund'),
      totalDocs: res.totalDocs ?? (res.docs || []).length,
    }
    statsCache.set(key, { ts: Date.now(), stats })
    return stats
  })().finally(() => {
    if (statsInflight.get(key) === p) statsInflight.delete(key)
  })
  statsInflight.set(key, p)
  return p
}

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

    // Lifetime stats are type-free: the old code scanned the TYPE-FILTERED
    // set, so switching tabs zeroed the other sums. One shared scan serves
    // every tab (20s cache above); page rows stay type-filtered below.
    const statsPromise = getLifetimeStats(payload, customerId!)

    let docs: any[]
    let pagination: { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
    if (q) {
      // Search must see past the current page: bounded candidate set with
      // the type filter applied, then filter + slice in memory with EXACT
      // totals. The old code filtered the 20 mapped page rows and kept the
      // unfiltered totals — wrong counts and broken Show-more.
      const candidateRes = await payload.find({
        collection: 'wallet-transactions',
        where: { and },
        sort: '-createdAt',
        pagination: false,
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
      const ql = q.toLowerCase()
      const matched = (candidateRes.docs || []).map(mapTx).filter((d: any) => {
        const hay = `${d.id} ${d.type} ${d.orderId ?? ''} ${d.gateway ?? ''} ${d.amount}`.toLowerCase()
        return hay.includes(ql)
      })
      const totalDocs = matched.length
      const totalPages = Math.max(1, Math.ceil(totalDocs / limit))
      const safePage = Math.min(page, totalPages)
      docs = matched.slice((safePage - 1) * limit, safePage * limit)
      pagination = {
        page: safePage,
        limit,
        totalDocs,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPrevPage: safePage > 1,
      }
    } else {
      const pageRes = await payload.find({
        collection: 'wallet-transactions',
        where: { and },
        sort: '-createdAt',
        page,
        limit,
        depth: 0,
        overrideAccess: true,
      })
      docs = (pageRes.docs || []).map(mapTx)
      pagination = {
        page: pageRes.page ?? page,
        limit: typeof pageRes.limit === 'number' ? pageRes.limit : limit,
        totalDocs: pageRes.totalDocs ?? docs.length,
        totalPages: pageRes.totalPages ?? 1,
        hasNextPage: pageRes.hasNextPage ?? false,
        hasPrevPage: pageRes.hasPrevPage ?? false,
      }
    }

    const stats = await statsPromise

    return NextResponse.json({
      data: {
        customerId,
        wallet,
        stats,
        history: {
          docs,
          pagination,
        },
      },
    })
  } catch (err: any) {
    console.error('[wallets/summary] Error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
