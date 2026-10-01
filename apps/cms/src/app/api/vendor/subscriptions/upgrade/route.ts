/**
 * @file apps/cms/src/app/api/vendor/subscriptions/upgrade/route.ts
 * @description Upgrade to a higher-priced plan. Charges proration immediately.
 * POST { toPlanSlug, idempotencyKey? } -> 201 {invoiceId, prorationDelta, newAmountDue, effectiveAt, checkoutUrl?}
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
  prorateDelta,
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

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const cross = forbidCrossVendor(vendorId, body.vendorId ?? body.vendor)
    if (cross) return cross
    const toPlanSlug = typeof body.toPlanSlug === 'string' ? body.toPlanSlug.trim() : ''
    if (!toPlanSlug) return NextResponse.json({ error: 'toPlanSlug is required' }, { status: 400 })
    const idemKey = getIdempotencyKey(request, body) || newIdempotencyKey()

    const prior = await findByIdempotencyKey(payload, 'subscription-invoices', idemKey)
    if (prior) {
      const s = sanitizeInvoice(prior)
      return NextResponse.json(
        { invoiceId: s.id, prorationDelta: s.prorationDelta, newAmountDue: s.amount, effectiveAt: s.period_start, checkoutUrl: s.checkoutUrl, deduplicated: true },
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
    if (!current) return NextResponse.json({ error: 'No active subscription to upgrade', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 })

    const plans = await payload.find({ collection: 'membership-plans' as any, where: { slug: { equals: toPlanSlug } }, limit: 1, depth: 0, overrideAccess: true })
    const toPlan = plans?.docs?.[0] as any
    if (!toPlan) return NextResponse.json({ error: 'Target plan not found' }, { status: 404 })

    const oldPrice = Number(current.plan_snapshot?.price ?? 0)
    const newPrice = Number(toPlan.price ?? 0)
    const billingInterval = String(current.billing_interval ?? current.billingInterval ?? 'month')
    const periodEnd = String(current.current_period_end ?? current.currentPeriodEnd ?? '')
    const { delta } = prorateDelta(oldPrice, newPrice, billingInterval, periodEnd || null)
    if (delta < 0) {
      return NextResponse.json({ error: 'Target plan is cheaper; use downgrade instead', code: 'USE_DOWNGRADE' }, { status: 422 })
    }
    const newAmountDue = roundMoney(Math.max(0, delta))
    const paymentIntentId = `pi_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`

    const invoice = await payload.create({
      collection: 'subscription-invoices' as any,
      data: {
        subscription: current.id,
        vendor: vendorId,
        plan: toPlan.id,
        invoice_number: invoiceNumber(),
        amount: newAmountDue,
        currency: 'PHP',
        status: 'pending',
        billingReason: 'upgrade',
        prorationDelta: delta,
        payment_provider: current.payment_provider ?? 'paymongo',
        provider_payment_intent: paymentIntentId,
        period_start: new Date().toISOString(),
        period_end: periodEnd || null,
        due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        idempotencyKey: idemKey,
        metadata: { fromPlan: current.plan_snapshot?.name ?? null, toPlan: toPlanSlug, oldPrice, newPrice },
      } as any,
      overrideAccess: true,
    })

    await audit(payload, {
      vendor: vendorId, subscription: current.id, invoice: (invoice as any).id,
      action: 'upgrade', reason: `upgrade to ${toPlanSlug} delta=${delta}`,
      actor: vendorUser.id, metadata: { toPlanSlug, delta, newAmountDue },
    })

    const s = sanitizeInvoice(invoice)
    return NextResponse.json(
      { invoiceId: s.id, prorationDelta: delta, newAmountDue, effectiveAt: new Date().toISOString(), checkoutUrl: s.checkoutUrl },
      { status: 201 },
    )
  } catch (err: any) {
    console.error('[vendor/subscriptions/upgrade] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
