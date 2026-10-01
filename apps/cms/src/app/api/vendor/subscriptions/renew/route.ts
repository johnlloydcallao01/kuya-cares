/**
 * @file apps/cms/src/app/api/vendor/subscriptions/renew/route.ts
 * @description Renew current subscription for another cycle.
 * POST { idempotencyKey? } -> 201 {invoiceId, amount, checkoutUrl?, periodEnd}
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import crypto from 'crypto'
import { authenticateVendor } from '@/utils/mediaLibrary'
import {
  audit,
  checkRateLimit,
  sanitizeInvoice,
  findByIdempotencyKey,
  isMissingCollection,
  getIdempotencyKey,
  newIdempotencyKey,
  periodEndFor,
  resolveOwnVendorId,
  forbidCrossVendor,
  invoiceNumber,
  roundMoney,
} from '@/utils/membershipApi'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const vendorUser = await authenticateVendor(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    const vendorId = await resolveOwnVendorId(payload, vendorUser.id)
    if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })
    const limited = checkRateLimit('vendor-sub-mutate', `vendor:${vendorId}`, 20, 60 * 60 * 1000)
    if (limited) return limited

    let body: Record<string, any> = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const cross = forbidCrossVendor(vendorId, body.vendorId ?? body.vendor)
    if (cross) return cross
    const idemKey = getIdempotencyKey(request, body) || newIdempotencyKey()

    const prior = await findByIdempotencyKey(payload, 'subscription-invoices', idemKey)
    if (prior) {
      const s = sanitizeInvoice(prior)
      return NextResponse.json(
        { invoiceId: s.id, amount: s.amount, checkoutUrl: s.checkoutUrl, periodEnd: s.period_end, deduplicated: true },
        { status: 200 },
      )
    }

    let current: any = null
    try {
      const subs = await payload.find({
        collection: 'vendor-subscriptions' as any,
        where: { and: [{ vendor: { equals: vendorId } }, { status: { in: ['trialing', 'active', 'past_due', 'grace'] } }] },
        limit: 1, sort: '-createdAt', depth: 1, overrideAccess: true,
      })
      current = subs?.docs?.[0] ?? null
    } catch (err: any) {
      if (isMissingCollection(err)) return NextResponse.json({ error: 'Membership collections not installed', code: 'COLLECTION_MISSING' }, { status: 500 })
      throw err
    }
    if (!current) return NextResponse.json({ error: 'No subscription to renew', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 })

    const billingInterval = String(current.billing_interval ?? current.billingInterval ?? 'month')
    const amount = roundMoney(Number(current.plan_snapshot?.price ?? 0))
    const periodEnd = periodEndFor(billingInterval)
    const paymentIntentId = `pi_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`

    const invoice = await payload.create({
      collection: 'subscription-invoices' as any,
      data: {
        subscription: current.id,
        vendor: vendorId,
        plan: typeof current.plan === 'object' ? (current.plan as any).id : current.plan,
        invoice_number: invoiceNumber(),
        amount,
        currency: 'PHP',
        status: 'pending',
        billingReason: 'renewal',
        payment_provider: current.payment_provider ?? 'paymongo',
        provider_payment_intent: paymentIntentId,
        period_start: new Date().toISOString(),
        period_end: periodEnd,
        due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        idempotencyKey: idemKey,
        metadata: { renewal: true },
      } as any,
      overrideAccess: true,
    })

    await audit(payload, {
      vendor: vendorId, subscription: current.id, invoice: (invoice as any).id,
      action: 'renew', reason: `renewal amount=${amount}`, actor: vendorUser.id,
      metadata: { amount, periodEnd },
    })

    const s = sanitizeInvoice(invoice)
    return NextResponse.json(
      { invoiceId: s.id, amount: s.amount, checkoutUrl: s.checkoutUrl, periodEnd },
      { status: 201 },
    )
  } catch (err: any) {
    console.error('[vendor/subscriptions/renew] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
