/**
 * @file apps/cms/src/app/api/admin/finance/payments/refunds/route.ts
 * @description Admin-issued PayMongo refund. Calls POST /v1/refunds with the
 * server-side secret key; local transaction state is finalized by the existing
 * PayMongo webhook (webhook-write-only design is preserved).
 * POST /api/admin/finance/payments/refunds {transaction_id?, payment_id?, amount?, reason, notes?}
 * Docs: https://docs.paymongo.com/docs/payment-acceptance-refunds
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { deleteCachedByPrefix } from '@encreasl/cache'
import { paymongoConfig, paymongoFetch, paymongoErrorMessage, REFUND_REASONS } from '../gateway'

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

    const reason = String(body.reason ?? '').trim()
    if (!(REFUND_REASONS as readonly string[]).includes(reason)) {
      return NextResponse.json({ error: `reason must be one of ${REFUND_REASONS.join(', ')}` }, { status: 400 })
    }
    const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : undefined
    const requestedAmount = body.amount !== undefined && body.amount !== null && body.amount !== '' ? Number(body.amount) : null
    if (requestedAmount !== null && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
      return NextResponse.json({ error: 'amount must be a positive number (PHP)' }, { status: 400 })
    }

    // Resolve the gateway payment id (pay_xxx). Prefer explicit payment_id,
    // else load the local transaction (must already be paid at gateway).
    let paymentId = typeof body.payment_id === 'string' ? body.payment_id.trim() : ''
    let tx: Record<string, any> | null = null
    if (!paymentId && body.transaction_id !== undefined) {
      const tid = Number(body.transaction_id)
      if (!Number.isFinite(tid)) return NextResponse.json({ error: 'transaction_id must be a valid ID' }, { status: 400 })
      try {
        tx = (await payload.findByID({ collection: 'transactions', id: tid as never, depth: 0, overrideAccess: true })) as unknown as Record<string, any>
      } catch {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
      }
      paymentId = typeof tx.payment_id === 'string' ? tx.payment_id : ''
      if (!paymentId) {
        return NextResponse.json({ error: 'Transaction has no gateway payment yet (PayMongo has not confirmed it)' }, { status: 409 })
      }
      if (!['paid', 'partially_refunded'].includes(String(tx.status))) {
        return NextResponse.json({ error: `Transaction status '${tx.status}' cannot be refunded` }, { status: 409 })
      }
      const remaining = num(tx.amount) - num(tx.refunded_amount)
      const amount = requestedAmount ?? remaining
      if (amount > remaining + 0.01) {
        return NextResponse.json({ error: `Amount exceeds refundable balance of ${remaining.toFixed(2)} PHP` }, { status: 400 })
      }
    }
    if (!paymentId) return NextResponse.json({ error: 'Provide payment_id (pay_xxx) or transaction_id' }, { status: 400 })
    const amount = requestedAmount ?? (tx ? num(tx.amount) - num(tx.refunded_amount) : 0)
    if (!(amount > 0)) return NextResponse.json({ error: 'Nothing left to refund on this payment' }, { status: 400 })

    let secretKey: string
    try {
      ;({ secretKey } = paymongoConfig())
    } catch {
      return NextResponse.json({ error: 'Server configuration error: Missing PayMongo Secret Key' }, { status: 500 })
    }

    const refundBody: Record<string, any> = {
      data: { attributes: { amount: Math.round(amount * 100), payment_id: paymentId, reason } },
    }
    if (notes) refundBody.data.attributes.notes = notes

    const gw = await paymongoFetch(secretKey, '/v1/refunds', {
      method: 'POST',
      body: refundBody,
      idempotencyKey: `refund-${paymentId}-${Math.round(amount * 100)}`,
      timeoutMs: 20000,
    })
    if (!gw.ok) {
      return NextResponse.json({ error: paymongoErrorMessage(gw.data, gw.status), details: gw.data }, { status: gw.status })
    }

    await deleteCachedByPrefix('admin:finance:')
    await deleteCachedByPrefix('admin:transactions:')
    const r = gw.data?.data
    return NextResponse.json(
      {
        refund: r
          ? {
              id: r.id,
              amount: num(r.attributes?.amount) / 100,
              currency: r.attributes?.currency ?? 'PHP',
              status: r.attributes?.status,
              payment_id: r.attributes?.payment_id ?? paymentId,
              reason: r.attributes?.reason ?? reason,
            }
          : null,
        message: 'Refund issued at PayMongo. Local status finalizes when the refund webhook arrives.',
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    console.error('[admin/finance/payments/refunds] POST error:', err)
    return NextResponse.json({ error: 'Failed to issue refund' }, { status: 500 })
  }
}
