/**
 * @file apps/cms/src/endpoints/paymongoMembershipWebhook.ts
 * @description Canonical PayMongo membership webhook (Payload custom endpoint).
 * Raw text + HMAC-SHA256 verify (mirrors paymongoWebhook.ts), replay guard via
 * membership-audit-log eventId, dispatch to BillingService.handlePaid/handleFailed
 * (when present) else inline invoice+subscription transitions.
 * Served at /api/paymongo-membership/webhook once registered in payload.config.ts.
 */

import type { PayloadRequest } from 'payload'
import crypto from 'crypto'

function verifySignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader || !secret) return false
  const parts = signatureHeader.split(',')
  const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1]
  const liveSig = parts.find((p) => p.startsWith('li='))?.split('=')[1]
  const testSig = parts.find((p) => p.startsWith('te='))?.split('=')[1]
  const sig = liveSig || testSig
  if (!timestamp || !sig) return false
  const computed = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  try {
    const a = Buffer.from(computed)
    const b = Buffer.from(sig)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return computed === sig
  }
}

async function loadBillingService(): Promise<any | null> {
  try {
    const loader = new Function('s', 'return import(s)') as (s: string) => Promise<any>
    const mod = await loader('@/services/BillingService').catch(() => null)
    if (!mod) {
      const rel = await loader('../services/BillingService').catch(() => null)
      return rel?.BillingService ?? rel?.default ?? rel ?? null
    }
    return mod?.BillingService ?? mod?.default ?? mod ?? null
  } catch {
    return null
  }
}

async function isDuplicate(payload: any, eventId: string): Promise<boolean> {
  try {
    const res = await payload.find({
      collection: 'membership-audit-log' as any,
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return (res?.docs?.length ?? 0) > 0
  } catch {
    return false
  }
}

async function auditLog(payload: any, entry: Record<string, any>): Promise<void> {
  try {
    await payload.create({ collection: 'membership-audit-log' as any, data: entry as any, overrideAccess: true })
  } catch {
    // best-effort
  }
}

export const paymongoMembershipWebhook = async (req: PayloadRequest) => {
  try {
    const signature = req.headers.get('paymongo-signature')
    const rawBody = await (req as unknown as Request).text()
    let body: any
    try {
      body = JSON.parse(rawBody)
    } catch {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const secret = process.env.PAYMONGO_MEMBERSHIP_WEBHOOK_SECRET || process.env.PAYMONGO_WEBHOOK_SECRET || ''
    if (secret) {
      if (!verifySignature(rawBody, signature, secret)) {
        console.error('[paymongo-membership] signature verification failed')
        return Response.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      console.warn('[paymongo-membership] webhook secret not set; skipping verification')
    }

    const attrs = body?.data?.attributes
    const type = String(attrs?.type || '')
    const resource = attrs?.data
    const paymentRef: string = String(resource?.attributes?.payment_intent_id || resource?.id || '')
    const eventId: string = String(body?.data?.id || `${type}:${paymentRef}`)
    if (!paymentRef) return Response.json({ error: 'Missing payment reference' }, { status: 400 })

    if (await isDuplicate(req.payload, eventId)) {
      return Response.json({ status: 'duplicate' }, { status: 200 })
    }

    // Prefer BillingService when present (parallel Phase 1)
    try {
      const svc = await loadBillingService()
      if (type === 'payment.paid' && typeof svc?.handlePaid === 'function') {
        await svc.handlePaid(paymentRef, eventId)
        return Response.json({ status: 'received' }, { status: 200 })
      }
      if (type === 'payment.failed' && typeof svc?.handleFailed === 'function') {
        await svc.handleFailed(paymentRef, eventId)
        return Response.json({ status: 'received' }, { status: 200 })
      }
    } catch {
      // fall through to inline
    }

    if (type === 'payment.paid') {
      const inv = await req.payload.find({
        collection: 'subscription-invoices' as any,
        where: { provider_payment_intent: { equals: paymentRef } },
        limit: 1,
        depth: 0,
      })
      const invoice = inv?.docs?.[0] as any
      if (invoice && String(invoice.status) !== 'paid') {
        await req.payload.update({
          collection: 'subscription-invoices' as any,
          id: invoice.id,
          data: { status: 'paid', paid_at: new Date().toISOString() } as any,
        })
        const subId = invoice.subscription && typeof invoice.subscription === 'object' ? invoice.subscription.id : invoice.subscription
        if (subId) {
          await req.payload.update({
            collection: 'vendor-subscriptions' as any,
            id: subId,
            data: { status: 'active', retryCount: 0 } as any,
          }).catch(() => null)
        }
        const vendorId = invoice.vendor && typeof invoice.vendor === 'object' ? invoice.vendor.id : invoice.vendor
        await auditLog(req.payload, {
          vendor: vendorId ?? null, subscription: subId ?? null, invoice: invoice.id,
          action: 'webhook_paid', eventId, reason: `paid ref=${paymentRef}`,
        })
      } else if (!invoice) {
        await auditLog(req.payload, { action: 'webhook_paid', eventId, reason: `no invoice for ref=${paymentRef}` })
      }
    } else if (type === 'payment.failed') {
      const inv = await req.payload.find({
        collection: 'subscription-invoices' as any,
        where: { provider_payment_intent: { equals: paymentRef } },
        limit: 1,
        depth: 0,
      })
      const invoice = inv?.docs?.[0] as any
      if (invoice) {
        await req.payload.update({
          collection: 'subscription-invoices' as any,
          id: invoice.id,
          data: {
            status: 'failed',
            retry_count: Number(invoice.retry_count ?? invoice.retryCount ?? 0) + 1,
            failure_reason: 'payment.failed webhook',
          } as any,
        })
        const subId = invoice.subscription && typeof invoice.subscription === 'object' ? invoice.subscription.id : invoice.subscription
        if (subId) {
          await req.payload.update({
            collection: 'vendor-subscriptions' as any,
            id: subId,
            data: { status: 'past_due', lastRetryAt: new Date().toISOString() } as any,
          }).catch(() => null)
        }
        const vendorId = invoice.vendor && typeof invoice.vendor === 'object' ? invoice.vendor.id : invoice.vendor
        await auditLog(req.payload, {
          vendor: vendorId ?? null, subscription: subId ?? null, invoice: invoice.id,
          action: 'webhook_failed', eventId, reason: `failed ref=${paymentRef}`,
        })
      }
    } else {
      await auditLog(req.payload, { action: 'sync', eventId, reason: `unhandled membership event ${type}` })
    }

    return Response.json({ status: 'received' }, { status: 200 })
  } catch (error) {
    console.error('[paymongo-membership] webhook error:', error)
    return Response.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
