/**
 * POST /api/customer/vouchers/apply-best { userId, orderId }
 * Evaluates claimed + published vouchers against the pending order and
 * applies the single best discount via CouponService.applyToOrder.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { CouponService, roundMoney } from '@/services/CouponService'
import { relId, resolveCustomer, sanitizeCoupon } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const { userId, orderId } = body as { userId?: unknown; orderId?: unknown }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (orderId == null || String(orderId) === '') {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }

    const customer = await resolveCustomer(payload, String(userId))
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    let order: any = null
    try {
      order = await payload.findByID({
        collection: 'orders',
        id: Number(orderId) || (orderId as string),
        depth: 0,
        overrideAccess: true,
      })
    } catch {
      return NextResponse.json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' }, { status: 404 })
    }
    if (relId(order.customer) !== String(customer.id)) {
      return NextResponse.json({ error: 'Order does not belong to user', code: 'FORBIDDEN' }, { status: 403 })
    }
    if (order.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending orders accept vouchers', code: 'ORDER_NOT_EDITABLE' }, { status: 409 })
    }

    const discounts = await payload.find({
      collection: 'order-discounts',
      where: { order: { equals: order.id } },
      pagination: false,
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    const existingCouponCount = ((discounts as any).docs || []).length

    const claims = await payload.find({
      collection: 'coupon-claims',
      where: { and: [{ customer: { equals: customer.id } }, { status: { equals: 'claimed' } }] },
      pagination: false,
      limit: 100,
      depth: 1,
      overrideAccess: true,
    })
    const published = await payload.find({
      collection: 'coupons',
      where: { status: { equals: 'published' } },
      sort: '-priority',
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    const seen = new Set<string>()
    const candidates: Array<{ code: string }> = []
    for (const c of ((claims as any).docs || []) as any[]) {
      const coupon = c.coupon && typeof c.coupon === 'object' ? c.coupon : null
      const code = coupon?.code ? String(coupon.code) : null
      if (code && !seen.has(code)) {
        seen.add(code)
        candidates.push({ code })
      }
    }
    for (const coupon of ((published as any).docs || []) as any[]) {
      const code = coupon?.code ? String(coupon.code) : null
      if (code && !seen.has(code)) {
        seen.add(code)
        candidates.push({ code })
      }
    }

    const service = new CouponService(payload)
    const merchantId = relId(order.merchant)
    let best: any = null
    for (const c of candidates) {
      try {
        const v = await service.validate({
          code: c.code,
          customerId: customer.id,
          merchantId: Number(merchantId) || (merchantId as string),
          deliveryFee: Number(order.delivery_fee ?? 0),
          foodSubtotal: Number(order.subtotal ?? 0),
          existingCouponCount,
        })
        if (v.valid && (!best || v.totalDiscount > best.totalDiscount)) best = v
      } catch {
        continue
      }
    }

    if (!best) {
      return NextResponse.json({ error: 'No applicable voucher for this order', code: 'NO_APPLICABLE' }, { status: 422 })
    }

    const applied = await service.applyToOrder({ orderId: order.id, code: best.code, customerId: customer.id })
    if (!applied.valid) {
      return NextResponse.json(
        { error: applied.message, reason: applied.reason, wooCode: applied.wooCode },
        { status: 422 },
      )
    }

    return NextResponse.json({
      data: {
        code: best.code,
        foodDiscount: best.foodDiscount,
        deliveryDiscount: best.deliveryDiscount,
        totalDiscount: best.totalDiscount,
        orderTotal: (applied as any).orderTotal ?? roundMoney(Number(order.total ?? 0) - best.totalDiscount),
        voucher: sanitizeCoupon(
          { ...(best.couponSnapshot as object), id: best.couponId, code: best.code },
          { usesLeft: null, usesLeftForUser: null, claimed: true, claimStatus: 'claimed', used: false },
        ),
      },
    })
  } catch (err: any) {
    console.error('[customer/vouchers/apply-best] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
