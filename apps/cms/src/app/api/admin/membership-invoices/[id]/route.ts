/**
 * @file apps/cms/src/app/api/admin/membership-invoices/[id]/route.ts
 * @description GET/PATCH invoice. PATCH { action:'refund'|'void', reason }.
 * void only when pending|failed|past_due; refund only when paid.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { audit, sanitizeInvoice, loadOptionalBillingService } from '@/utils/membershipApi'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    const { id } = await params
    let doc: any
    try {
      doc = await payload.findByID({ collection: 'subscription-invoices' as any, id: id as any, depth: 1, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    return NextResponse.json({ doc: sanitizeInvoice(doc) }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/membership-invoices/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    const { id } = await params
    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const action = String(body.action || '')
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!['refund', 'void'].includes(action)) {
      return NextResponse.json({ error: "action must be 'refund'|'void'" }, { status: 400 })
    }
    if (!reason) return NextResponse.json({ error: 'reason is required' }, { status: 400 })

    let invoice: any
    try {
      invoice = await payload.findByID({ collection: 'subscription-invoices' as any, id: id as any, depth: 0, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    const status = String(invoice.status)

    if (action === 'void' && !['pending', 'failed', 'past_due'].includes(status)) {
      return NextResponse.json({ error: `Cannot void invoice with status ${status}`, code: 'INVALID_TRANSITION' }, { status: 422 })
    }
    if (action === 'refund' && status !== 'paid') {
      return NextResponse.json({ error: `Cannot refund invoice with status ${status}`, code: 'INVALID_TRANSITION' }, { status: 422 })
    }

    // Prefer BillingService.refundOrVoid when present (parallel Phase 1)
    try {
      const svc = await loadOptionalBillingService()
      const fn = svc?.refundOrVoid || svc?.refund_or_void
      if (typeof fn === 'function') {
        const out = await fn.call(svc, payload, id, action, reason, admin.id)
        if (out) return NextResponse.json({ doc: sanitizeInvoice(out) }, { status: 200 })
      }
    } catch {
      // fall through to inline
    }

    // Best-effort PayMongo refund call on refund path (never blocks state change)
    if (action === 'refund') {
      try {
        const secret = process.env.PAYMONGO_SECRET_KEY || ''
        const intent = invoice.provider_payment_intent ?? invoice.providerPaymentIntent
        if (secret && intent) {
          await fetch('https://api.paymongo.com/v1/refunds', {
            method: 'POST',
            headers: {
              Authorization: `Basic ${Buffer.from(secret + ':').toString('base64')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: { attributes: { payment_id: String(intent), reason } } }),
          }).catch(() => null)
        }
      } catch {
        // best-effort
      }
    }

    const next = action === 'void' ? 'void' : 'refunded'
    const updated = await payload.update({
      collection: 'subscription-invoices' as any,
      id: id as any,
      data: { status: next, failure_reason: reason } as any,
      overrideAccess: true,
    })

    const vendorId = invoice.vendor && typeof invoice.vendor === 'object' ? String(invoice.vendor.id) : String(invoice.vendor ?? '')
    await audit(payload, {
      vendor: vendorId || null,
      subscription: invoice.subscription ?? null,
      invoice: id,
      action: 'sync',
      reason: `admin ${action}: ${reason}`,
      actor: admin.id,
      metadata: { action, from: status, to: next },
    })

    return NextResponse.json({ doc: sanitizeInvoice(updated as any) }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/membership-invoices/[id]] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
