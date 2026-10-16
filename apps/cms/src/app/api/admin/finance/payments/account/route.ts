/**
 * @file apps/cms/src/app/api/admin/finance/payments/account/route.ts
 * @description PayMongo account money: wallet balances + next payout schedule.
 * GET /api/admin/finance/payments/account
 * Docs:
 * - https://docs.paymongo.com/reference/list-all-wallet-accounts (GET /v2/wallets)
 * - https://docs.paymongo.com/reference/retrieveschedule (GET /v1/merchants/{id}/schedules)
 * All money from PayMongo is integer centavos.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'
import { paymongoConfig, paymongoFetch } from '../gateway'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb)
const ts = (v: unknown): string | null => {
  const n = num(v)
  return n > 0 ? new Date(n * 1000).toISOString() : null
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const cacheKey = `admin:finance:payments:account:${admin.id}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Payments-Cache': 'HIT' } })

    let mode: string
    let secretKey: string
    try {
      ;({ mode, secretKey } = paymongoConfig())
    } catch {
      return NextResponse.json({ error: 'Server configuration error: Missing PayMongo Secret Key' }, { status: 500 })
    }

    // 1. Wallets (v2 preferred: available + pending). Fall back to v1 shape.
    let wallets: Array<Record<string, any>> = []
    const w2 = await paymongoFetch(secretKey, '/v2/wallets?fields=balance&fields=account', { timeoutMs: 20000 })
    if (w2.ok && Array.isArray(w2.data?.data)) {
      wallets = w2.data.data.map((w: any) => ({
        id: str(w?.id),
        merchant_id: str(w?.merchant_id),
        available: num(w?.balance?.available) / 100,
        pending: num(w?.balance?.pending) / 100,
        currency: str(w?.account?.currency, 'PHP'),
        account_name: w?.account?.account_name ?? null,
        account_number: w?.account?.account_number ?? null,
        is_default: !!w?.is_default,
        livemode: !!w?.livemode,
      }))
    } else {
      const w1 = await paymongoFetch(secretKey, '/v1/wallets?status=activated', { timeoutMs: 20000 })
      if (!w1.ok) {
        const d = w1.data
        const msg = d?.errors?.[0]?.detail || 'Failed to load PayMongo wallets'
        return NextResponse.json({ error: typeof msg === 'string' ? msg : 'Failed to load PayMongo wallets', details: d }, { status: w1.status })
      }
      wallets = (Array.isArray(w1.data?.data) ? w1.data.data : []).map((w: any) => ({
        id: str(w?.id),
        merchant_id: str(w?.attributes?.merchant_id),
        available: num(w?.attributes?.balance) / 100,
        pending: 0,
        currency: 'PHP',
        account_name: null,
        account_number: w?.attributes?.account_number ?? null,
        is_default: false,
        livemode: !!w?.attributes?.livemode,
      }))
    }

    // 2. Next payout schedule from the first wallet's merchant org id.
    let schedule: Record<string, any> | null = null
    const orgId = wallets.map((w) => w.merchant_id).find(Boolean)
    if (orgId) {
      const s = await paymongoFetch(secretKey, `/v1/merchants/${encodeURIComponent(orgId)}/schedules`, { timeoutMs: 20000 })
      if (s.ok) {
        const a = s.data?.data?.attributes ?? {}
        const lineup = Array.isArray(a.lineup) ? a.lineup : []
        const pick = (e: any) =>
          e
            ? {
                amount: num(e.amount) / 100,
                currency: str(e.currency, 'PHP'),
                generation_at: ts(e.generation_at),
                receive_at: ts(e.receive_at),
                payments: { amount: num(e.transactions?.payments?.amount) / 100, count: num(e.transactions?.payments?.count) },
                refunds: { amount: num(e.transactions?.refunds?.amount) / 100, count: num(e.transactions?.refunds?.count) },
                disputes: { amount: num(e.transactions?.disputes?.amount) / 100, count: num(e.transactions?.disputes?.count) },
                adjustments: { amount: num(e.transactions?.adjustments?.amount) / 100, count: num(e.transactions?.adjustments?.count) },
              }
            : null
        schedule = {
          merchant_id: orgId,
          type: a.type ?? null,
          days: a.days ?? null,
          options: Array.isArray(a.options) ? a.options : [],
          next: pick(lineup[0]),
          following: pick(lineup[1]),
        }
      }
    }

    const totalAvailable = wallets.reduce((s, w) => s + w.available, 0)
    const totalPending = wallets.reduce((s, w) => s + w.pending, 0)
    const response = {
      meta: { mode, generatedAt: new Date().toISOString() },
      totals: { available: Math.round(totalAvailable * 100) / 100, pending: Math.round(totalPending * 100) / 100, wallets: wallets.length },
      wallets,
      schedule,
    }
    await setCached(cacheKey, response, 60)
    return NextResponse.json(response, { headers: { 'X-Payments-Cache': 'MISS' } })
  } catch (err: unknown) {
    console.error('[admin/finance/payments/account] GET error:', err)
    return NextResponse.json({ error: 'Failed to load PayMongo account' }, { status: 500 })
  }
}
