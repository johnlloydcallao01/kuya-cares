import { NextRequest, NextResponse } from 'next/server'
import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import { refreshMemberMembershipPayment } from '@/services/MemberMembershipService'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    let user = await authenticateVendorOrMember(payload, request)
    if (!user || user.role !== 'member') {
      return NextResponse.json(
        { error: 'Member authentication required' },
        { status: 401, headers: corsHeaders },
      )
    }

    const settings = await payload.findGlobal({ slug: 'system-settings' })
    const membershipFeeAmount = Number(
      (settings as Record<string, any>)?.membership?.memberMembershipFeePhp,
    )
    const paymentIntentId = request.nextUrl.searchParams.get('paymentIntentId')
    const where: Where = paymentIntentId
      ? {
          and: [
            { user: { equals: user.id } },
            { providerReference: { equals: paymentIntentId } },
          ],
        }
      : { user: { equals: user.id } }
    let payments = await payload.find({
      collection: 'member-membership-payments',
      where,
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    let latest = payments.docs[0] as Record<string, any> | undefined
    if (latest?.status === 'pending') {
      await refreshMemberMembershipPayment(payload, latest)
      payments = await payload.find({
        collection: 'member-membership-payments',
        where,
        sort: '-createdAt',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      latest = payments.docs[0] as Record<string, any> | undefined
      user = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 0,
        overrideAccess: true,
      })
    }

    return NextResponse.json(
      {
        membershipStatus: user.memberMembershipStatus ?? 'pending_payment',
        paidAt: user.memberMembershipPaidAt ?? null,
        membershipFeeAmount: Number.isFinite(membershipFeeAmount) ? membershipFeeAmount : null,
        payment: latest
          ? {
              amount: latest.amount,
              currency: latest.currency,
              status: latest.status,
              createdAt: latest.createdAt,
            }
          : null,
      },
      { headers: { ...corsHeaders, 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('[member-membership] GET status error:', error)
    return NextResponse.json(
      { error: 'Could not load membership status' },
      { status: 500, headers: corsHeaders },
    )
  }
}
