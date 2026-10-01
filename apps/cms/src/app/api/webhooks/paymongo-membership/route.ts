/**
 * @file apps/cms/src/app/api/webhooks/paymongo-membership/route.ts
 * @description Thin Next alias of the canonical Payload endpoint. Same HMAC verify,
 * delegates to BillingService (when present) else inline. 410 when disabled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { checkRateLimit, clientIp, verifyPaymongoMembershipSignature, isDuplicateEvent, audit, loadOptionalBillingService } from '@/utils/membershipApi'

async function findMembershipInvoice(payload: any, paymentRef: string): Promise<any | null> {
  const ref = String(paymentRef ?? '')
  if (!ref) return null
  for (const field of ['reference_number', 'provider_payment_intent', 'paymongo_link_id']) {
    try {
      const res = await payload.find({
        collection: 'subscription-invoices' as any,
        where: { [field]: { equals: ref } },
        limit: 1, depth: 0, overrideAccess: true,
      })
      const doc = res?.docs?.[0]
      if (doc) return doc
    } catch {
      // Best effort per key.
    }
  }
  return null
}

async function handlePaidInline(payload: any, paymentRef: string, eventId: string): Promise<boolean> {
  try {
    const invoice = (await findMembershipInvoice(payload, paymentRef)) as any
    if (!invoice) return false
    if (String(invoice.status) === 'paid') return true
    await payload.update({
      collection: 'subscription-invoices' as any, id: invoice.id,
      data: { status: 'paid', paid_at: new Date().toISOString() } as any,
      overrideAccess: true,
    })
    const subId = invoice.subscription && typeof invoice.subscription === 'object' ? invoice.subscription.id : invoice.subscription
    if (subId) {
      await payload.update({
        collection: 'vendor-subscriptions' as any, id: subId,
        data: { status: 'active', retryCount: 0 } as any,
        overrideAccess: true,
      }).catch(() => null)
    }
    const vendorId = invoice.vendor && typeof invoice.vendor === 'object' ? String(invoice.vendor.id) : String(invoice.vendor ?? '')
    await audit(payload, { vendor: vendorId || null, subscription: subId ?? null, invoice: invoice.id, action: 'webhook_paid', eventId, reason: `paid ref=${paymentRef}` })
    return true
  } catch {
    return false
  }
}

async function handleFailedInline(payload: any, paymentRef: string, eventId: string): Promise<boolean> {
  try {
    const invoice = (await findMembershipInvoice(payload, paymentRef)) as any
    if (!invoice) return false
    await payload.update({
      collection: 'subscription-invoices' as any, id: invoice.id,
      data: { status: 'failed', retry_count: Number(invoice.retry_count ?? invoice.retryCount ?? 0) + 1, failure_reason: 'payment.failed webhook' } as any,
      overrideAccess: true,
    })
    const subId = invoice.subscription && typeof invoice.subscription === 'object' ? invoice.subscription.id : invoice.subscription
    if (subId) {
      await payload.update({
        collection: 'vendor-subscriptions' as any, id: subId,
        data: { status: 'past_due', lastRetryAt: new Date().toISOString() } as any,
        overrideAccess: true,
      }).catch(() => null)
    }
    const vendorId = invoice.vendor && typeof invoice.vendor === 'object' ? String(invoice.vendor.id) : String(invoice.vendor ?? '')
    await audit(payload, { vendor: vendorId || null, subscription: subId ?? null, invoice: invoice.id, action: 'webhook_failed', eventId, reason: `failed ref=${paymentRef}` })
    return true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.PAYMONGO_MEMBERSHIP_DISABLED === 'true') {
      return NextResponse.json({ error: 'Use canonical Payload endpoint /api/paymongo-membership/webhook' }, { status: 410 })
    }
    const limited = checkRateLimit('webhook-membership', `ip:${clientIp(request)}`, 300, 60 * 1000)
    if (limited) return limited

    const rawBody = await request.text()
    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Live and test secrets are independent: accept a live-signed event under a
    // live secret (li slot) or a test-signed event under a sandbox secret (te
    // slot). Fail-closed when neither verifies.
    const liveSecret =
      process.env.PAYMONGO_MEMBERSHIP_WEBHOOK_SECRET || process.env.PAYMONGO_WEBHOOK_SECRET || ''
    const testSecret = process.env.PAYMONGO_SANDBOX_WEBHOOK_SECRET || ''
    const signature = request.headers.get('paymongo-signature')
    const verified =
      (liveSecret && verifyPaymongoMembershipSignature(rawBody, signature, liveSecret, 'li')) ||
      (testSecret && verifyPaymongoMembershipSignature(rawBody, signature, testSecret, 'te'))
    if (!verified) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const payload = await getPayload({ config: configPromise })
    // DB-first alias kill-switch: System Settings membership.paymongoMembershipDisabled.
    try {
      const settings = await payload.findGlobal({ slug: 'system-settings' })
      if ((settings as any)?.membership?.paymongoMembershipDisabled === true) {
        return NextResponse.json({ error: 'Use canonical Payload endpoint /api/paymongo-membership/webhook' }, { status: 410 })
      }
    } catch {
      // Best effort; fall through to event handling.
    }
    const attrs = body?.data?.attributes
    const type = String(attrs?.type || '')
    const resource = attrs?.data
    const resourceAttrs = resource?.attributes ?? {}
    const paymentRef: string = String(
      resourceAttrs?.metadata?.pm_reference_number ??
        resourceAttrs?.external_reference_number ??
        resourceAttrs?.reference_number ??
        resourceAttrs?.payment_intent_id ??
        resource?.id ??
        '',
    )
    const eventId: string = String(body?.data?.id || `${type}:${paymentRef}`)
    if (!paymentRef) return NextResponse.json({ error: 'Missing payment reference' }, { status: 400 })

    if (await isDuplicateEvent(payload, eventId)) {
      return NextResponse.json({ status: 'duplicate' }, { status: 200 })
    }

    // Prefer BillingService when present. link.payment.paid is the Links success
    // event (there is no link.payment.failed — failures arrive as payment.failed).
    const isPaidEvent = type === 'payment.paid' || type === 'link.payment.paid'
    try {
      const svc = await loadOptionalBillingService()
      if (isPaidEvent && typeof svc?.handlePaid === 'function') {
        await svc.handlePaid(paymentRef, eventId)
        return NextResponse.json({ status: 'received' }, { status: 200 })
      }
      if (type === 'payment.failed' && typeof svc?.handleFailed === 'function') {
        await svc.handleFailed(paymentRef, eventId)
        return NextResponse.json({ status: 'received' }, { status: 200 })
      }
    } catch {
      // fall through to inline
    }

    if (isPaidEvent) await handlePaidInline(payload, paymentRef, eventId)
    else if (type === 'payment.failed') await handleFailedInline(payload, paymentRef, eventId)
    else await audit(payload, { action: 'sync', eventId, reason: `unhandled membership event ${type}`, metadata: { type } })

    return NextResponse.json({ status: 'received' }, { status: 200 })
  } catch (err: any) {
    console.error('[webhooks/paymongo-membership] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
