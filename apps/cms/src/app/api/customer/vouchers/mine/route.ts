/**
 * GET /api/customer/vouchers/mine?userId=&filter=available|used|expired
 * Claimed voucher wallet with computed status. Expiry is computed from
 * coupons.expires_at (not stored) so it can never drift.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { CouponService } from '@/services/CouponService'
import { customerContact, resolveCustomer, sanitizeCoupon } from '../_shared'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const filter = searchParams.get('filter') || 'available'
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }
    if (!['available', 'used', 'expired'].includes(filter)) {
      return NextResponse.json({ error: 'filter must be available|used|expired' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const customer = await resolveCustomer(payload, userId)
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    const service = new CouponService(payload)
    const contact = await customerContact(payload, customer)
    const now = Date.now()

    const claims = await payload.find({
      collection: 'coupon-claims',
      where: { and: [{ customer: { equals: customer.id } }, { status: { not_equals: 'cancelled' } }] },
      sort: '-createdAt',
      pagination: false,
      limit: 500,
      depth: 1,
      overrideAccess: true,
    })

    const out: any[] = []
    for (const claim of ((claims as any).docs || []) as any[]) {
      const coupon = claim.coupon && typeof claim.coupon === 'object' ? claim.coupon : null
      if (!coupon) continue
      const expiresAt = coupon.expires_at ? new Date(coupon.expires_at).getTime() : NaN
      const isExpired = Number.isFinite(expiresAt) && expiresAt <= now

      let used = claim.status === 'used'
      let usesLeftForUser: number | null = null
      if (!used && !isExpired) {
        const perUser = Number(coupon.usage_limit_per_user ?? 0)
        if (perUser > 0) {
          const n = await service.countRedemptions(coupon.id, { customerId: customer.id, ...contact })
          usesLeftForUser = Math.max(0, perUser - n)
          if (usesLeftForUser <= 0) used = true
        }
      }

      const status = used ? 'used' : isExpired ? 'expired' : 'available'
      if (status !== filter) continue

      out.push({
        claimId: claim.id,
        claimedAt: claim.claimed_at || claim.createdAt,
        computedStatus: status,
        ...sanitizeCoupon(coupon, {
          usesLeft: null,
          usesLeftForUser,
          claimed: true,
          claimStatus: claim.status,
          used,
        }),
      })
    }

    return NextResponse.json({ data: out })
  } catch (err: any) {
    console.error('[customer/vouchers/mine] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
