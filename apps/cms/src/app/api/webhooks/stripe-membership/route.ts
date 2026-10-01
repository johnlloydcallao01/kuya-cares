/**
 * @file apps/cms/src/app/api/webhooks/stripe-membership/route.ts
 * @description Stripe membership webhook stub. 501 unless STRIPE_* configured.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(_request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
  if (!secret) {
    return NextResponse.json({ error: 'Stripe not configured', code: 'STRIPE_NOT_CONFIGURED' }, { status: 501 })
  }
  // Stub: signature verify + dispatch lands here once Stripe is live.
  return NextResponse.json({ error: 'Stripe membership billing not implemented', code: 'STRIPE_NOT_CONFIGURED' }, { status: 501 })
}
