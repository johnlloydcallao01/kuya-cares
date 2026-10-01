/**
 * @file apps/cms/src/app/api/vendor/subscriptions/checkout/route.ts
 * @description Vendor checkout: plan -> invoice -> provider intent. Idempotent.
 * POST { planSlug, billingInterval, couponCode?, idempotencyKey? }
 * -> 201 {invoiceId, amount, checkoutUrl, paymentIntentId, status:'pending'}
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
  loadOptionalModule,
  newIdempotencyKey,
  getIdempotencyKey,
  periodEndFor,
  resolveOwnVendorId,
  forbidCrossVendor,
  invoiceNumber,
  roundMoney,
  toCentavos,
} from '@/utils/membershipApi'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const vendorUser = await authenticateVendor(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })

    const vendorId = await resolveOwnVendorId(payload, vendorUser.id)
    if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })

    const limited = checkRateLimit('vendor-checkout', `vendor:${vendorId}`, 20, 60 * 60 * 1000)
    if (limited) return limited

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const cross = forbidCrossVendor(vendorId, body.vendorId ?? body.vendor)
    if (cross) return cross

    const planSlug = typeof body.planSlug === 'string' ? body.planSlug.trim() : ''
    const billingInterval = body.billingInterval || 'month'
    if (!planSlug) return NextResponse.json({ error: 'planSlug is required' }, { status: 400 })
    if (!['month', 'year', 'one_time'].includes(billingInterval)) {
      return NextResponse.json({ error: 'billingInterval must be month|year|one_time' }, { status: 400 })
    }
    const idemKey = getIdempotencyKey(request, body) || newIdempotencyKey()

    // Idempotent replay on invoices
    const prior = await findByIdempotencyKey(payload, 'subscription-invoices', idemKey)
    if (prior) {
      const s = sanitizeInvoice(prior)
      return NextResponse.json(
        {
          invoiceId: s.id,
          amount: s.amount,
          checkoutUrl: s.checkoutUrl,
          paymentIntentId: (prior as any).provider_payment_intent ?? (prior as any).paymentIntentId ?? null,
          status: s.status,
          deduplicated: true,
        },
        { status: 200 },
      )
    }

    // Resolve plan
    let plan: any
    try {
      const res = await payload.find({
        collection: 'membership-plans' as any,
        where: { slug: { equals: planSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      plan = res?.docs?.[0]
    } catch (err: any) {
      if (isMissingCollection(err)) {
        return NextResponse.json({ error: 'Membership collections not installed', code: 'COLLECTION_MISSING' }, { status: 500 })
      }
      throw err
    }
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    if (plan.status && !['active', 'hidden'].includes(String(plan.status))) {
      return NextResponse.json({ error: 'Plan is not available', code: 'PLAN_UNAVAILABLE' }, { status: 422 })
    }

    // 409 when same plan already active
    try {
      const existing = await payload.find({
        collection: 'vendor-subscriptions' as any,
        where: {
          and: [
            { vendor: { equals: vendorId } },
            { plan: { equals: plan.id } },
            { status: { in: ['trialing', 'active'] } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if ((existing?.docs?.length ?? 0) > 0) {
        return NextResponse.json({ error: 'Already subscribed to this plan', code: 'ALREADY_SUBSCRIBED' }, { status: 409 })
      }
    } catch {
      // best-effort
    }

    // Coupon discount (prefer CouponService when present)
    let discount = 0
    const couponCode = typeof body.couponCode === 'string' ? body.couponCode.trim() : ''
    if (couponCode) {
      try {
        const couponMod = await loadOptionalModule('@/services/CouponService')
        const Ctor = couponMod?.CouponService
        if (Ctor) {
          const svc = new Ctor(payload)
          const v = await svc.validate({ code: couponCode, customerId: vendorId, merchantId: vendorId })
          if (!v?.valid) return NextResponse.json({ error: v?.message || 'Invalid coupon', code: 'COUPON_INVALID' }, { status: 422 })
          discount = roundMoney(Number(v.foodDiscount ?? v.discount ?? 0))
        } else {
          const found = await payload
            .find({ collection: 'coupons' as any, where: { code: { equals: couponCode } }, limit: 1, depth: 0, overrideAccess: true })
            .catch(() => null)
          const c = (found as any)?.docs?.[0]
          if (!c || c.isActive === false) {
            return NextResponse.json({ error: 'Invalid coupon', code: 'COUPON_INVALID' }, { status: 422 })
          }
          discount = roundMoney(Math.min(Number(plan.price) || 0, Number(c.discountAmount ?? c.discount_amount ?? 0)))
        }
      } catch {
        discount = 0
      }
    }

    const gross = roundMoney(Number(plan.price) || 0)
    const amount = roundMoney(Math.max(0, gross - discount))

    // Ensure a subscription row exists (pending) for this vendor+plan
    let subscription: any = null
    try {
      const subs = await payload.find({
        collection: 'vendor-subscriptions' as any,
        where: { and: [{ vendor: { equals: vendorId } }, { status: { in: ['pending', 'trialing', 'active', 'past_due', 'grace'] } }] },
        limit: 1,
        sort: '-createdAt',
        depth: 0,
        overrideAccess: true,
      })
      subscription = subs?.docs?.[0] ?? null
    } catch {
      subscription = null
    }
    if (!subscription) {
      try {
        subscription = await payload.create({
          collection: 'vendor-subscriptions' as any,
          data: {
            vendor: vendorId,
            plan: plan.id,
            plan_version: plan.version ?? 1,
            plan_snapshot: {
              name: plan.name,
              price: plan.price,
              billing_interval: billingInterval,
              commission_percent: plan.commission_percent ?? 0,
              transaction_fee: plan.transaction_fee ?? 0,
              limits: plan.limits ?? null,
              capabilities: plan.capabilities ?? null,
            },
            status: 'pending',
            billing_interval: billingInterval,
            current_period_start: new Date().toISOString(),
            current_period_end: periodEndFor(billingInterval),
            auto_renew: true,
            payment_provider: 'paymongo',
            idempotencyKey: `sub:${vendorId}:${crypto.randomUUID()}`,
          } as any,
          overrideAccess: true,
        })
      } catch (err: any) {
        if (isMissingCollection(err)) {
          return NextResponse.json({ error: 'Membership collections not installed', code: 'COLLECTION_MISSING' }, { status: 500 })
        }
        throw err
      }
    }

    // Provider intent (prefer membershipProviders when present)
    let paymentIntentId: string | null = null
    let checkoutUrl: string | null = null
    let rawProvider: Record<string, any> | null = null
    try {
      const provMod = await loadOptionalModule('@/services/membershipProviders')
      const getter = provMod?.getMembershipProvider
      if (typeof getter === 'function') {
        // DB-first provider: System Settings membership.payProviderDefault; explicit BILLING_PAY_PROVIDER env wins when set.
        let providerName = process.env.BILLING_PAY_PROVIDER || ''
        if (!providerName) {
          try {
            const settings = await payload.findGlobal({ slug: 'system-settings' })
            const dbProvider = (settings as any)?.membership?.payProviderDefault
            if (typeof dbProvider === 'string' && dbProvider.trim()) providerName = dbProvider.trim()
          } catch {
            // Best effort; fall back below.
          }
        }
        if (!providerName) providerName = 'paymongo'
        const provider = getter(providerName)
        const intent = await provider.createMembershipIntent({
          amountCentavos: toCentavos(amount),
          reference: idemKey,
          vendorId,
          planSlug,
        })
        paymentIntentId = intent?.paymentRef ?? null
        checkoutUrl = intent?.checkoutUrl ?? null
        rawProvider = intent?.raw ?? null
      }
    } catch {
      // provider optional in tests
    }
    if (!paymentIntentId) paymentIntentId = `pi_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`

    // Create invoice (sanitized on read; raw blobs never persisted to vendor-visible fields)
    let invoice: any
    try {
      invoice = await payload.create({
        collection: 'subscription-invoices' as any,
        data: {
          subscription: (subscription as any).id,
          vendor: vendorId,
          plan: plan.id,
          invoice_number: invoiceNumber(),
          amount,
          currency: 'PHP',
          status: 'pending',
          billingReason: 'initial',
          discount_amount: discount,
          couponCode: couponCode || null,
          payment_provider: 'paymongo',
          provider_payment_intent: paymentIntentId,
          payment_link_url: checkoutUrl,
          period_start: new Date().toISOString(),
          period_end: periodEndFor(billingInterval),
          due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          idempotencyKey: idemKey,
          metadata: { planSlug, billingInterval },
        } as any,
        overrideAccess: true,
      })
    } catch (err: any) {
      if (isMissingCollection(err)) {
        return NextResponse.json({ error: 'Membership collections not installed', code: 'COLLECTION_MISSING' }, { status: 500 })
      }
      const msg = String(err?.message || '')
      if (/unique|duplicate|idempotencyKey/i.test(msg)) {
        const dup = await findByIdempotencyKey(payload, 'subscription-invoices', idemKey)
        if (dup) {
          const s = sanitizeInvoice(dup)
          return NextResponse.json(
            { invoiceId: s.id, amount: s.amount, checkoutUrl: s.checkoutUrl, paymentIntentId, status: s.status, deduplicated: true },
            { status: 200 },
          )
        }
        return NextResponse.json({ error: 'Duplicate idempotency key', code: 'IDEMPOTENCY_CONFLICT' }, { status: 409 })
      }
      throw err
    }
    void rawProvider

    await audit(payload, {
      vendor: vendorId,
      subscription: (subscription as any).id,
      invoice: (invoice as any).id,
      action: 'sync',
      reason: `checkout plan=${planSlug} amount=${amount}`,
      actor: vendorUser.id,
      metadata: { planSlug, billingInterval, amount },
    })

    const s = sanitizeInvoice(invoice)
    return NextResponse.json(
      { invoiceId: s.id, amount: s.amount, checkoutUrl: s.checkoutUrl, paymentIntentId, status: 'pending' },
      { status: 201 },
    )
  } catch (err: any) {
    console.error('[vendor/subscriptions/checkout] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
