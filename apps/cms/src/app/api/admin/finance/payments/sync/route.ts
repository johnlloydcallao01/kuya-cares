/**
 * @file apps/cms/src/app/api/admin/finance/payments/sync/route.ts
 * @description Read-only gateway reconciliation for one transaction: compares
 * CMS state against live PayMongo intent/payment. Never writes local state
 * (webhook remains the sole writer).
 * POST /api/admin/finance/payments/sync {transaction_id}
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { paymongoConfig, paymongoFetch, paymongoErrorMessage } from '../gateway'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const tid = Number(body.transaction_id)
    if (!Number.isFinite(tid)) return NextResponse.json({ error: 'transaction_id must be a valid ID' }, { status: 400 })

    let tx: Record<string, any>
    try {
      tx = (await payload.findByID({ collection: 'transactions', id: tid as never, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
    } catch {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }
    const piId = typeof tx.payment_intent_id === 'string' ? tx.payment_intent_id : ''
    const payId = typeof tx.payment_id === 'string' ? tx.payment_id : ''
    if (!piId && !payId) return NextResponse.json({ error: 'Transaction has no gateway references yet' }, { status: 409 })

    let secretKey: string
    let mode: string
    try {
      ;({ mode, secretKey } = paymongoConfig())
    } catch {
      return NextResponse.json({ error: 'Server configuration error: Missing PayMongo Secret Key' }, { status: 500 })
    }

    let intent: any = null
    if (piId) {
      const r = await paymongoFetch(secretKey, `/v1/payment_intents/${encodeURIComponent(piId)}`, { timeoutMs: 15000 })
      if (!r.ok) return NextResponse.json({ error: paymongoErrorMessage(r.data, r.status) }, { status: r.status })
      intent = r.data?.data ?? null
    }
    let payment: any = null
    const resolvedPayId = payId || (Array.isArray(intent?.attributes?.payments) ? intent.attributes.payments[0]?.id : null)
    if (resolvedPayId) {
      const r = await paymongoFetch(secretKey, `/v1/payments/${encodeURIComponent(resolvedPayId)}`, { timeoutMs: 15000 })
      if (r.ok) payment = r.data?.data ?? null
    }

    const gatewayAmount = payment ? num(payment.attributes?.amount) / 100 : intent ? num(intent.attributes?.amount) / 100 : null
    const mismatches: string[] = []
    if (gatewayAmount !== null && Math.abs(num(tx.amount) - gatewayAmount) > 0.01) mismatches.push('amount')
    const localStatus = String(tx.status ?? '')
    const intentStatus = intent ? String(intent.attributes?.status ?? '') : null
    if (intentStatus === 'succeeded' && !['paid', 'partially_refunded', 'refunded'].includes(localStatus)) mismatches.push('status')
    if (intentStatus === 'cancelled' && localStatus === 'pending') mismatches.push('status')

    return NextResponse.json({
      mode,
      local: {
        transactionId: tx.id,
        orderId: typeof tx.order === 'object' ? tx.order?.id : tx.order,
        status: localStatus,
        amount: num(tx.amount),
        payment_intent_id: piId || null,
        payment_id: payId || null,
        refunded_amount: num(tx.refunded_amount),
        paid_at: tx.paid_at ?? null,
      },
      gateway: intent
        ? {
            intent_id: intent.id,
            intent_status: intentStatus,
            payment_id: resolvedPayId,
            payment_status: payment ? String(payment.attributes?.status ?? '') : null,
            amount: gatewayAmount,
            paid_at: payment?.attributes?.paid_at ? new Date(num(payment.attributes.paid_at) * 1000).toISOString() : null,
          }
        : null,
      reconciled: mismatches.length === 0,
      mismatches,
      checkedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    console.error('[admin/finance/payments/sync] POST error:', err)
    return NextResponse.json({ error: 'Failed to sync with PayMongo' }, { status: 500 })
  }
}
