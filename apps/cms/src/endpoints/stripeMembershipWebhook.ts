/**
 * @file apps/cms/src/endpoints/stripeMembershipWebhook.ts
 * @description Stripe membership webhook stub (same interface as PayMongo).
 * Returns 501 {code:'STRIPE_NOT_CONFIGURED'} when STRIPE_WEBHOOK_SECRET missing.
 */

import type { PayloadRequest } from 'payload'

export const stripeMembershipWebhook = async (_req: PayloadRequest) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
  if (!secret) {
    return Response.json(
      { error: 'Stripe not configured', code: 'STRIPE_NOT_CONFIGURED' },
      { status: 501 },
    )
  }
  // Stub: verify signature + dispatch once Stripe billing is live.
  return Response.json(
    { error: 'Stripe membership billing not implemented', code: 'STRIPE_NOT_CONFIGURED' },
    { status: 501 },
  )
}
