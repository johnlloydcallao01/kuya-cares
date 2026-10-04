/**
 * POST /api/customer/vouchers/claim { userId, couponId | code }
 * 1-tap claim to the customer's voucher wallet. Idempotent on
 * [coupon+customer]. Never burns usage_count (only holds/finalize do).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { normalizeCouponCode } from '@/collections/Coupons'
import { customerContact, previewClaimable, relId, resolveCustomer, sanitizeCoupon } from '../_shared'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    const { userId, couponId, code } = body as { userId?: unknown; couponId?: unknown; code?: unknown }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (couponId == null && typeof code !== 'string') {
      return NextResponse.json({ error: 'couponId or code is required' }, { status: 400 })
    }

    const customer = await resolveCustomer(payload, String(userId))
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    let coupon: any = null
    if (couponId != null && String(couponId) !== '') {
      try {
        coupon = await payload.findByID({
          collection: 'coupons',
          id: Number(couponId) || (couponId as string),
          depth: 1,
          overrideAccess: true,
        })
      } catch {
        return NextResponse.json({ error: 'Voucher not found', code: 'NOT_FOUND' }, { status: 404 })
      }
    } else {
      const normalized = normalizeCouponCode(code)
      const { docs } = await payload.find({
        collection: 'coupons',
        where: { code: { equals: normalized } },
        limit: 1,
        depth: 1,
        overrideAccess: true,
      })
      coupon = docs[0] ?? null
      if (!coupon) {
        return NextResponse.json({ error: 'Voucher not found', code: 'NOT_FOUND' }, { status: 404 })
      }
    }

    // Idempotent: existing non-cancelled claim returns as-is.
    const { docs: existing } = await payload.find({
      collection: 'coupon-claims',
      where: {
        and: [{ coupon: { equals: coupon.id } }, { customer: { equals: customer.id } }, { status: { not_equals: 'cancelled' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing[0]) {
      return NextResponse.json({
        data: sanitizeCoupon(coupon, {
          usesLeft: null,
          usesLeftForUser: null,
          claimed: true,
          claimStatus: (existing[0] as any).status,
          used: (existing[0] as any).status === 'used',
        }),
      })
    }

    const now = new Date()
    const contact = await customerContact(payload, customer)
    const preview = await previewClaimable(payload, coupon, customer.id, contact, now)
    if (!preview.ok) {
      return NextResponse.json(
        { error: `Voucher not claimable: ${preview.reason}`, code: 'NOT_CLAIMABLE' },
        { status: 422 },
      )
    }

    let created: any
    try {
      created = (await payload.create({
        collection: 'coupon-claims',
        data: { coupon: coupon.id, customer: customer.id, status: 'claimed' },
        overrideAccess: true,
      })) as any
    } catch (createErr: any) {
      // Cross-tab/device race: two first-claims can both pass the check
      // above (check-then-create is not atomic, unique index is). On any
      // create failure, re-read — if the rival claim exists, return it as
      // 200 instead of surfacing a 500 duplicate error.
      const { docs: raced } = await payload.find({
        collection: 'coupon-claims',
        where: {
          and: [{ coupon: { equals: coupon.id } }, { customer: { equals: customer.id } }, { status: { not_equals: 'cancelled' } }],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (raced[0]) {
        return NextResponse.json({
          data: sanitizeCoupon(coupon, {
            usesLeft: null,
            usesLeftForUser: null,
            claimed: true,
            claimStatus: (raced[0] as any).status,
            used: (raced[0] as any).status === 'used',
          }),
        })
      }
      throw createErr
    }

    return NextResponse.json(
      {
        data: sanitizeCoupon(coupon, {
          usesLeft: preview.usesLeft,
          usesLeftForUser: preview.usesLeftForUser,
          claimed: true,
          claimStatus: created.status,
          used: false,
        }),
      },
      { status: 201 },
    )
  } catch (err: any) {
    console.error('[customer/vouchers/claim] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
