/**
 * @file apps/cms/src/app/api/vendor/subscription/coupon/route.ts
 * @description Apply a coupon to a pending invoice. POST { code, invoiceId? } -> 200 {invoiceId, discount, newTotal}.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import {
  audit,
  checkRateLimit,
  sanitizeInvoice,
  isMissingCollection,
  loadOptionalModule,
  resolveOwnVendorId,
  resolveOwnedVendorId,
  forbidCrossVendor,
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
    const limited = checkRateLimit('vendor-coupon', `vendor:${vendorId}`, 20, 60 * 60 * 1000)
    if (limited) return limited

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const cross = forbidCrossVendor(vendorId, body.vendorId ?? body.vendor)
    if (cross) return cross
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

    // Resolve target invoice: explicit id (must belong to vendor) or latest pending
    let invoice: any = null
    try {
      if (body.invoiceId) {
        invoice = await payload.findByID({ collection: 'subscription-invoices' as any, id: body.invoiceId, depth: 0, overrideAccess: true }).catch(() => null)
        const owner = invoice?.vendor && typeof invoice.vendor === 'object' ? String(invoice.vendor.id) : String(invoice?.vendor ?? '')
        if (!invoice || owner !== String(vendorId)) {
          return NextResponse.json({ error: 'Forbidden: invoice does not belong to vendor' }, { status: 403 })
        }
      } else {
        const res = await payload.find({
          collection: 'subscription-invoices' as any,
          where: { and: [{ vendor: { equals: vendorId } }, { status: { in: ['pending', 'past_due'] } }] },
          limit: 1, sort: '-createdAt', depth: 0, overrideAccess: true,
        })
        invoice = res?.docs?.[0] ?? null
      }
    } catch (err: any) {
      if (isMissingCollection(err)) return NextResponse.json({ error: 'Membership collections not installed', code: 'COLLECTION_MISSING' }, { status: 500 })
      throw err
    }
    if (!invoice) return NextResponse.json({ error: 'No pending invoice to apply coupon to', code: 'NO_PENDING_INVOICE' }, { status: 404 })
    if (!['pending', 'past_due'].includes(String(invoice.status))) {
      return NextResponse.json({ error: 'Invoice is not coupon-eligible', code: 'INVOICE_NOT_PENDING' }, { status: 422 })
    }

    // Validate coupon (prefer CouponService with appliesTo membership)
    let discount = 0
    try {
      const couponMod = await loadOptionalModule('@/services/CouponService')
      const Ctor = couponMod?.CouponService
      if (Ctor) {
        const svc = new Ctor(payload)
        const v = await svc.validate({ code, customerId: vendorId, merchantId: vendorId })
        if (!v?.valid) return NextResponse.json({ error: v?.message || 'Invalid coupon', code: 'COUPON_INVALID' }, { status: 422 })
        discount = roundMoney(Number(v.foodDiscount ?? v.discount ?? 0))
      } else {
        const found = await payload
          .find({ collection: 'coupons' as any, where: { code: { equals: code } }, limit: 1, depth: 0, overrideAccess: true })
          .catch(() => null)
        const c = (found as any)?.docs?.[0]
        if (!c || c.isActive === false) {
          return NextResponse.json({ error: 'Invalid coupon', code: 'COUPON_INVALID' }, { status: 422 })
        }
        discount = roundMoney(Math.min(Number(invoice.amount) || 0, Number(c.discountAmount ?? c.discount_amount ?? 0)))
      }
    } catch (err: any) {
      return NextResponse.json({ error: 'Invalid coupon', code: 'COUPON_INVALID', details: String(err?.message || err) }, { status: 422 })
    }

    const newTotal = roundMoney(Math.max(0, Number(invoice.amount || 0) - discount))
    const updated = await payload.update({
      collection: 'subscription-invoices' as any,
      id: invoice.id,
      data: { discount_amount: discount, couponCode: code, amount: newTotal } as any,
      overrideAccess: true,
    })

    await audit(payload, {
      vendor: vendorId, subscription: invoice.subscription ?? null, invoice: invoice.id,
      action: 'sync', reason: `coupon ${code} discount=${discount}`, actor: vendorUser.id,
      metadata: { code, discount, newTotal },
    })

    const s = sanitizeInvoice(updated as any)
    return NextResponse.json({ invoiceId: s.id, discount, newTotal: s.amount }, { status: 200 })
  } catch (err: any) {
    console.error('[vendor/subscription/coupon] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
