/**
 * @file apps/cms/src/app/api/admin/finance/payments/route.ts
 * @description Gateway-aware payment list: PayMongo payments merged with local
 * transactions for reconciliation.
 * GET /api/admin/finance/payments?limit=&after=&before=&status=&date_from=&date_to=&search=
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { getCached, setCached } from '@encreasl/cache'
import { paymongoConfig, paymongoFetch, paymongoErrorMessage } from './gateway'

type Doc = Record<string, any>

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const str = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb)
const idOf = (v: unknown): string => {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return ''
}
const toDateInput = (v: string | null): string | null => {
  if (!v) return null
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10) || 10, 1), 25)
    const after = (searchParams.get('after') || '').trim()
    const before = (searchParams.get('before') || '').trim()
    const status = (searchParams.get('status') || '').trim()
    const dateFrom = toDateInput(searchParams.get('date_from'))
    const dateTo = toDateInput(searchParams.get('date_to'))
    const search = (searchParams.get('search') || '').trim()

    const cacheKey = `admin:finance:payments:${admin.id}:l${limit}:a${after}:b${before}:s${status}:f${dateFrom}:t${dateTo}:q${search}`
    const cached = await getCached<Record<string, unknown>>(cacheKey)
    if (cached) return NextResponse.json(cached, { headers: { 'X-Payments-Cache': 'HIT' } })

    let mode: string
    let secretKey: string
    try {
      ;({ mode, secretKey } = paymongoConfig())
    } catch {
      return NextResponse.json({ error: 'Server configuration error: Missing PayMongo Secret Key' }, { status: 500 })
    }

    const qp = new URLSearchParams()
    qp.set('limit', String(limit))
    if (after) qp.set('after', after)
    if (before) qp.set('before', before)
    if (status) qp.set('status', status)
    if (dateFrom) qp.set('created_at.gte', dateFrom)
    if (dateTo) qp.set('created_at.lte', dateTo)

    const gw = await paymongoFetch(secretKey, `/v1/payments?${qp.toString()}`, { timeoutMs: 20000 })
    if (!gw.ok) {
      return NextResponse.json({ error: paymongoErrorMessage(gw.data, gw.status), details: gw.data }, { status: gw.status })
    }
    const gwPayments: Doc[] = Array.isArray(gw.data?.data) ? gw.data.data : []

    // Join local transactions by payment_intent_id / payment_id.
    const intentIds = [...new Set(gwPayments.map((p) => str(p?.attributes?.payment_intent_id)).filter(Boolean))]
    const payIds = [...new Set(gwPayments.map((p) => str(p?.id)).filter(Boolean))]
    const or: Record<string, unknown>[] = []
    if (intentIds.length) or.push({ payment_intent_id: { in: intentIds } })
    if (payIds.length) or.push({ payment_id: { in: payIds } })
    let localByIntent = new Map<string, Doc>()
    let localByPayId = new Map<string, Doc>()
    if (or.length) {
      const localRes = (await payload.find({
        collection: 'transactions',
        where: { or },
        limit: 100,
        depth: 1,
        overrideAccess: true,
        pagination: false,
      } as any)) as unknown as { docs: Doc[] }
      for (const t of localRes.docs ?? []) {
        if (t.payment_intent_id) localByIntent.set(String(t.payment_intent_id), t)
        if (t.payment_id) localByPayId.set(String(t.payment_id), t)
      }
    }

    // Order context for matched rows (merchant/outlet + totals + commission).
    const orderIds = [...new Set([...localByIntent.values(), ...localByPayId.values()].map((t) => idOf(t.order)).filter(Boolean))]
    const orderMap = new Map<string, Doc>()
    if (orderIds.length) {
      const ordersRes = (await payload.find({
        collection: 'orders',
        where: { id: { in: orderIds } },
        limit: orderIds.length,
        depth: 1,
        overrideAccess: true,
        pagination: false,
      } as any)) as unknown as { docs: Doc[] }
      for (const o of ordersRes.docs ?? []) orderMap.set(String(o.id), o)
    }

    const q = search.toLowerCase()
    const payments = gwPayments
      .map((p) => {
        const a: Doc = p?.attributes ?? {}
        const local = localByPayId.get(String(p?.id)) ?? localByIntent.get(str(a.payment_intent_id)) ?? null
        const order = local ? orderMap.get(idOf(local.order)) ?? null : null
        const amountPhp = num(a.amount) / 100
        const mismatches: string[] = []
        if (local) {
          if (Math.abs(num(local.amount) - amountPhp) > 0.01) mismatches.push('amount')
          const ls = String(local.status ?? '')
          const gs = String(a.status ?? '')
          if ((gs === 'paid' && !['paid', 'partially_refunded', 'refunded'].includes(ls)) || (gs === 'failed' && ls !== 'failed')) {
            mismatches.push('status')
          }
        } else {
          mismatches.push('unmatched')
        }
        const merchant = order?.merchant && typeof order.merchant === 'object' ? order.merchant : null
        return {
          id: str(p?.id),
          amount: amountPhp,
          currency: str(a.currency, 'PHP'),
          status: str(a.status),
          fee: num(a.fee) / 100,
          net_amount: num(a.net_amount) / 100,
          payment_intent_id: str(a.payment_intent_id),
          payment_method: str(a?.source?.type),
          method_detail: a?.source?.brand ? `${a.source.brand} •• ${a.source.last4 ?? ''}` : null,
          description: a.description ?? null,
          billing_name: a?.billing?.name ?? null,
          billing_email: a?.billing?.email ?? null,
          disputed: !!a.disputed,
          livemode: !!a.livemode,
          paid_at: a.paid_at ? new Date(num(a.paid_at) * 1000).toISOString() : null,
          created_at: a.created_at ? new Date(num(a.created_at) * 1000).toISOString() : null,
          refunds: Array.isArray(a.refunds) ? a.refunds : [],
          local: local
            ? {
                transactionId: local.id,
                orderId: idOf(local.order),
                status: local.status,
                amount: num(local.amount),
                refunded_amount: num(local.refunded_amount),
                outlet: merchant ? str(merchant.outletName) : null,
                vendor: merchant?.vendor && typeof merchant.vendor === 'object' ? str(merchant.vendor.businessName) : null,
                commission_amount: order ? num(order.commission_amount) : null,
                commission_status: order ? str(order.commission_status) : null,
              }
            : null,
          reconciled: mismatches.length === 0,
          mismatches,
        }
      })
      .filter((p) => {
        if (!q) return true
        return [p.id, p.payment_intent_id, p.description, p.billing_name, p.billing_email, p.local?.orderId ? `#${p.local.orderId}` : '', String(p.local?.transactionId ?? '')]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      })

    const matched = payments.filter((p) => p.local).length
    const response = {
      meta: { mode, limit, has_more: !!gw.data?.has_more, matched, total: payments.length, generatedAt: new Date().toISOString() },
      payments,
    }
    await setCached(cacheKey, response, 20)
    return NextResponse.json(response, { headers: { 'X-Payments-Cache': 'MISS' } })
  } catch (err: unknown) {
    console.error('[admin/finance/payments] GET error:', err)
    return NextResponse.json({ error: 'Failed to load gateway payments' }, { status: 500 })
  }
}
