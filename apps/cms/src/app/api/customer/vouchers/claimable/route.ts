/**
 * GET /api/customer/vouchers/claimable?userId=&merchantId=&featured=&limit=
 * Browse claimable vouchers. With merchantId, each candidate is fully
 * validated against the active cart (discount preview included).
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { CouponService } from '@/services/CouponService'
import {
  customerContact,
  previewClaimable,
  relId,
  resolveCustomer,
  sanitizeCoupon,
} from '../_shared'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const merchantId = searchParams.get('merchantId')
    const featuredOnly = searchParams.get('featured') === 'true'
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)))

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const customer = await resolveCustomer(payload, userId)
    if (!customer) {
      return NextResponse.json({ error: 'Customer not found for user', code: 'NO_CUSTOMER' }, { status: 404 })
    }

    const now = new Date()
    const contact = await customerContact(payload, customer)

    const where: any = { and: [{ status: { equals: 'published' } }, { claimable: { not_equals: false } }] }
    if (featuredOnly) where.and.push({ featured: { equals: true } })

    const res = await payload.find({
      collection: 'coupons',
      where,
      sort: '-priority',
      limit: Math.min(200, limit * 2),
      depth: 1,
      overrideAccess: true,
    })

    const claims = await payload.find({
      collection: 'coupon-claims',
      where: { and: [{ customer: { equals: customer.id } }, { status: { not_equals: 'cancelled' } }] },
      pagination: false,
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })
    const claimByCoupon = new Map<string, any>()
    for (const c of ((claims as any).docs || []) as any[]) {
      claimByCoupon.set(String(relId(c.coupon) ?? ''), c)
    }

    const service = new CouponService(payload)
    const out: any[] = []
    for (const coupon of ((res as any).docs || []) as any[]) {
      const preview = await previewClaimable(payload, coupon, customer.id, contact, now)
      if (!preview.ok) continue

      const claim = claimByCoupon.get(String(coupon.id))
      let discountPreview: { food: number; delivery: number; total: number } | null = null
      if (merchantId) {
        try {
          const v = await service.validate({
            code: coupon.code,
            customerId: customer.id,
            merchantId: Number(merchantId) || merchantId,
          })
          if (!v.valid) continue
          discountPreview = { food: v.foodDiscount, delivery: v.deliveryDiscount, total: v.totalDiscount }
        } catch {
          continue
        }
      }

      out.push(
        sanitizeCoupon(coupon, {
          usesLeft: preview.usesLeft,
          usesLeftForUser: preview.usesLeftForUser,
          claimed: !!claim,
          claimStatus: claim ? claim.status : null,
          used: claim ? claim.status === 'used' : false,
          discountPreview,
        }),
      )
      if (out.length >= limit) break
    }

    // Featured first, then priority, then soonest expiry.
    out.sort((a, b) => {
      if (a.featured !== b.featured) return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
      if (a.priority !== b.priority) return b.priority - a.priority
      return (a.expiresInDays ?? 9999) - (b.expiresInDays ?? 9999)
    })

    return NextResponse.json({ data: out })
  } catch (err: any) {
    console.error('[customer/vouchers/claimable] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
