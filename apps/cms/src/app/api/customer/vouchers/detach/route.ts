/**
 * POST /api/customer/vouchers/detach { userId, orderId, code? }
 * Removes applied voucher(s) from a pending order: cancels held
 * redemptions, deletes order-discount rows, rewrites totals. Paid orders
 * are never touched (refunds go through reverseForOrder).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { roundMoney } from '@/services/CouponService'
import { relId, resolveCustomer } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const { userId, orderId, code } = body as { userId?: unknown; orderId?: unknown; code?: unknown }
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
      return NextResponse.json({ error: 'Only pending orders can drop vouchers', code: 'ORDER_NOT_EDITABLE' }, { status: 409 })
    }

    const codeFilter = typeof code === 'string' && code.trim() ? code.trim().toUpperCase() : null

    const discounts = await payload.find({
      collection: 'order-discounts',
      where: { order: { equals: order.id } },
      pagination: false,
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    const rows = ((discounts as any).docs || []) as any[]
    const targets = codeFilter ? rows.filter((r) => String(r.code || '').toUpperCase() === codeFilter) : rows
    if (targets.length === 0) {
      return NextResponse.json({ error: 'No matching voucher on this order', code: 'NOTHING_TO_DETACH' }, { status: 404 })
    }

    const removedCodes = new Set(targets.map((r) => String(r.code || '').toUpperCase()))
    let removedTotal = 0
    let removedFreeDelivery = false

    for (const row of targets) {
      removedTotal = roundMoney(removedTotal + Number(row.amount_off ?? 0))
      // Cancel the matching held redemption (never touches applied/paid rows).
      try {
        const holds = await payload.find({
          collection: 'coupon-redemptions',
          where: {
            and: [
              { order: { equals: order.id } },
              { status: { equals: 'held' } },
              { code_snapshot: { equals: row.code } },
            ],
          },
          pagination: false,
          limit: 10,
          depth: 0,
          overrideAccess: true,
        })
        for (const h of ((holds as any).docs || []) as any[]) {
          await payload.update({
            collection: 'coupon-redemptions',
            id: h.id,
            data: { status: 'cancelled' },
            overrideAccess: true,
          })
        }
      } catch {
        /* hold already gone — continue with discount removal */
      }
      if (row.coupon) {
        try {
          const coupon = await payload.findByID({
            collection: 'coupons',
            id: relId(row.coupon) as string,
            depth: 0,
            overrideAccess: true,
          })
          if ((coupon as any)?.free_delivery) removedFreeDelivery = true
        } catch {
          /* coupon deleted — treat as plain discount */
        }
      }
      await payload.delete({ collection: 'order-discounts', id: row.id, overrideAccess: true })
    }

    const remaining = rows.filter((r) => !removedCodes.has(String(r.code || '').toUpperCase()))
    const newDiscountTotal = roundMoney(Math.max(0, Number(order.discount_total ?? 0) - removedTotal))
    const newTotal = roundMoney(
      Math.max(
        0,
        Number(order.subtotal ?? 0) +
          Number(order.delivery_fee ?? 0) +
          Number(order.platform_fee ?? 0) +
          Number(order.priority_fee ?? 0) -
          newDiscountTotal -
          Number((order as any).wallet_amount_used ?? 0),
      ),
    )

    await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        discount_total: newDiscountTotal,
        total: newTotal,
        coupon_code: remaining.length > 0 ? remaining[remaining.length - 1].code : null,
        free_delivery_applied: removedFreeDelivery ? false : order.free_delivery_applied,
      },
      overrideAccess: true,
    })

    return NextResponse.json({
      data: {
        removed: [...removedCodes],
        removedTotal,
        discountTotal: newDiscountTotal,
        orderTotal: newTotal,
      },
    })
  } catch (err: any) {
    console.error('[customer/vouchers/detach] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
