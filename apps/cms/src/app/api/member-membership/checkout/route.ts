import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import crypto from 'crypto'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import { createMemberMembershipPaymentIntent } from '@/services/MemberMembershipService'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const user = await authenticateVendorOrMember(payload, request)
    if (!user || user.role !== 'member') {
      return NextResponse.json(
        { error: 'Member authentication required' },
        { status: 401, headers: corsHeaders },
      )
    }

    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      // An empty body is valid; the endpoint generates a fresh payment attempt.
    }
    const headerKey = request.headers.get('Idempotency-Key')
    const suppliedKey = headerKey || (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '')
    const idempotencyKey: string = suppliedKey.trim() || crypto.randomUUID()

    const payment = await createMemberMembershipPaymentIntent(payload, user.id, idempotencyKey)
    return NextResponse.json(payment, { status: 201, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message === 'MEMBERSHIP_ALREADY_ACTIVE') {
      return NextResponse.json(
        { error: 'Membership is already active', code: message },
        { status: 409, headers: corsHeaders },
      )
    }
    if (message.startsWith('MEMBERSHIP_FEE_')) {
      return NextResponse.json(
        { error: 'The one-time membership fee is not configured for online payment', code: message },
        { status: 503, headers: corsHeaders },
      )
    }
    if (message === 'MEMBERSHIP_WEBHOOK_NOT_CONFIGURED') {
      return NextResponse.json(
        { error: 'Membership payment confirmation is not configured', code: message },
        { status: 503, headers: corsHeaders },
      )
    }
    if (message === 'MEMBERSHIP_PAYMONGO_SECRET_NOT_CONFIGURED' ||
        message === 'MEMBERSHIP_PAYMONGO_PUBLIC_NOT_CONFIGURED') {
      return NextResponse.json(
        { error: 'PayMongo is not fully configured for membership payments', code: message },
        { status: 503, headers: corsHeaders },
      )
    }
    if (message === 'MEMBER_ACCOUNT_REQUIRED') {
      return NextResponse.json(
        { error: 'Member account required', code: message },
        { status: 403, headers: corsHeaders },
      )
    }
    if (message === 'IDEMPOTENCY_KEY_IN_USE' || message === 'MEMBERSHIP_PAYMENT_ALREADY_PROCESSED') {
      return NextResponse.json(
        { error: 'This payment attempt cannot be reused', code: message },
        { status: 409, headers: corsHeaders },
      )
    }
    console.error('[member-membership/checkout] POST error:', error)
    return NextResponse.json(
      { error: 'Could not start membership payment', code: 'MEMBERSHIP_CHECKOUT_FAILED' },
      { status: 502, headers: corsHeaders },
    )
  }
}
