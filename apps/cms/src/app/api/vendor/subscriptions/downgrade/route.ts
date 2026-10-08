/**
 * @file apps/cms/src/app/api/vendor/subscriptions/downgrade/route.ts
 * @description Downgrade: negative delta -> credit + scheduledPlan at period end.
 * POST { toPlanSlug, idempotencyKey? } -> 201 {invoiceId?, prorationDelta, newAmountDue, effectiveAt, checkoutUrl?}
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
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
  resolveOwnedVendorId,
  forbidCrossVendor,
  invoiceNumber,
  roundMoney,
} from '@/utils/membershipApi'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const vendorUser = await authenticateVendorOrMember(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: seller authentication required' }, { status: 401 })
    const requestedVendorId = new URL(request.url).searchParams.get('vendorId')
    if (vendorUser.role === 'member' && !requestedVendorId) {
      return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    }
    const vendorId = requestedVendorId
      ? await resolveOwnedVendorId(payload, vendorUser.id, requestedVendorId)
      : await resolveOwnVendorId(payload, vendorUser.id)
    if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found or not owned by account' }, { status: requestedVendorId ? 403 : 404 })
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
        where: { and: [{ vendor: { equals: vendorId } }, { status: { in: ['trialing', 'active'] } }] },
        limit: 1, sort: '-createdAt', depth: 1, overrideAccess: true,
      })
      current = subs?.docs?.[0] ?? null
    } catch (err: any) {
      if (isMissingCollection(err)) return NextResponse.json({ error: 'Membership collections not installed', code: 'COLLECTION_MISSING' }, { status: 500 })
      throw err
    }
    if (!current) return NextResponse.json({ error: 'No active subscription to downgrade', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 })

    const plans = await payload.find({ collection: 'membership-plans' as any, where: { slug: { equals: toPlanSlug } }, limit: 1, depth: 0, overrideAccess: true })
    const toPlan = plans?.docs?.[0] as any
    if (!toPlan) return NextResponse.json({ error: 'Target plan not found' }, { status: 404 })

    const oldPrice = Number(current.plan_snapshot?.price ?? 0)
    const newPrice = Number(toPlan.price ?? 0)
    const billingInterval = String(current.billing_interval ?? current.billingInterval ?? 'month')
    const periodEnd = String(current.current_period_end ?? current.currentPeriodEnd ?? '')
    const { delta } = prorateDelta(oldPrice, newPrice, billingInterval, periodEnd || null)

    // Schedule downgrade at period end (no immediate charge when delta <= 0)
    try {
      await payload.update({
        collection: 'vendor-subscriptions' as any,
        id: current.id,
        data: { scheduledPlan: toPlan.id, scheduledEffectiveAt: periodEnd || null, meta: { ...(current.meta ?? {}), downgradeDelta: delta } } as any,
        overrideAccess: true,
      })
    } catch {
      // best-effort
    }

    let invoice: any = null
    const newAmountDue = roundMoney(Math.max(0, delta))
    if (newAmountDue > 0) {
      invoice = await payload.create({
        collection: 'subscription-invoices' as any,
        data: {
          subscription: current.id,
          vendor: vendorId,
          plan: toPlan.id,
          invoice_number: invoiceNumber(),
          amount: newAmountDue,
          currency: 'PHP',
          status: 'pending',
          billingReason: 'downgrade',
          prorationDelta: delta,
          payment_provider: current.payment_provider ?? 'paymongo',
          period_start: new Date().toISOString(),
          period_end: periodEnd || null,
          due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          idempotencyKey: idemKey,
          metadata: { toPlan: toPlanSlug, oldPrice, newPrice, scheduled: true },
        } as any,
        overrideAccess: true,
      })
    }

    await audit(payload, {
      vendor: vendorId, subscription: current.id, invoice: invoice?.id ?? null,
      action: 'downgrade', reason: `downgrade scheduled to ${toPlanSlug} at period end delta=${delta}`,
      actor: vendorUser.id, metadata: { toPlanSlug, delta, effectiveAt: periodEnd },
    })

    return NextResponse.json(
      {
        invoiceId: invoice ? (invoice as any).id : null,
        prorationDelta: delta,
        newAmountDue,
        effectiveAt: periodEnd || null,
        checkoutUrl: invoice ? sanitizeInvoice(invoice).checkoutUrl : null,
      },
      { status: 201 },
    )
  } catch (err: any) {
    console.error('[vendor/subscriptions/downgrade] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
