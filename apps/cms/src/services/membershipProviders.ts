/**
 * @file apps/cms/src/services/membershipProviders.ts
 * @description Gateway-agnostic membership billing provider abstraction.
 *
 * Mirrors src/services/topupProviders.ts: the billing ledger itself never
 * talks to a gateway. A provider only:
 *  1. creates an external membership payment intent for an invoice amount, and
 *  2. normalizes incoming webhook events into invoice lifecycle events.
 *
 * Add new rails by implementing BillingProvider and registering it below.
 * BillingService stays unchanged.
 */

export interface MembershipIntentRequest {
  amountCentavos: number
  currency: string
  reference: string
  customerEmail?: string | null
  successUrl?: string | null
}

export interface MembershipIntentResult {
  paymentRef: string
  checkoutUrl?: string
  raw: unknown
}

export type MembershipEventKind = 'invoice.paid' | 'payment.failed' | 'refund'

export interface MembershipNormalizedEvent {
  kind: MembershipEventKind
  paymentRef: string
  eventId: string
  paidAt?: string
}

export interface BillingProvider {
  name: string
  createMembershipIntent(req: MembershipIntentRequest): Promise<MembershipIntentResult>
  normalizeEvent(raw: any): MembershipNormalizedEvent
}

function toPaidAtIso(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value)
    return Number.isNaN(ms) ? value : new Date(ms).toISOString()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // PayMongo timestamps are unix seconds; millis if large.
    const ms = value > 1e12 ? value : value * 1000
    return new Date(ms).toISOString()
  }
  return undefined
}

async function createPaymongoMembershipIntent(
  req: MembershipIntentRequest,
): Promise<MembershipIntentResult> {
  const sandbox = process.env.PAYMONGO_SANDBOX === 'true'
  const secretKey = sandbox
    ? process.env.PAYMONGO_SANDBOX_API_KEY
    : process.env.PAYMONGO_SECRET_KEY_LIVE
  if (!secretKey) {
    throw new Error('Server configuration error: Missing PayMongo Secret Key')
  }
  if (!Number.isInteger(req.amountCentavos) || req.amountCentavos < 0) {
    throw new Error('Membership intent amount must be a non-negative integer (centavos)')
  }
  const response = await fetch('https://api.paymongo.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: req.amountCentavos,
          payment_method_allowed: ['card', 'gcash', 'grab_pay', 'paymaya', 'billease', 'dob', 'brankas', 'qrph'],
          payment_method_options: { card: { request_three_d_secure: 'any' } },
          currency: req.currency,
          description: req.reference,
        },
      },
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    const errMsg = data?.errors?.[0]?.detail || data?.error || 'Failed to create membership intent'
    throw new Error(errMsg)
  }
  return { paymentRef: data?.data?.id, checkoutUrl: undefined, raw: data }
}

function normalizePaymongoMembershipEvent(raw: any): MembershipNormalizedEvent {
  const envelope = raw?.data?.attributes ?? {}
  const type = String(envelope?.type ?? raw?.type ?? raw?.kind ?? '')
  const nested = envelope?.data ?? {}
  const paymentRef = String(
    nested?.id ?? envelope?.payment_intent_id ?? raw?.paymentRef ?? raw?.data?.id ?? '',
  )
  const eventId = String(raw?.data?.id ?? raw?.id ?? (type && paymentRef ? `${type}:${paymentRef}` : ''))
  if (!paymentRef || !eventId) {
    throw new Error('UNKNOWN_MEMBERSHIP_EVENT')
  }
  const paidAt =
    toPaidAtIso(envelope?.paid_at ?? nested?.attributes?.created_at ?? nested?.attributes?.paid_at) ??
    new Date().toISOString()
  if (/refund/i.test(type)) {
    return { kind: 'refund', paymentRef, eventId }
  }
  if (/paid|success|succeeded|captured/i.test(type)) {
    return { kind: 'invoice.paid', paymentRef, eventId, paidAt }
  }
  if (/fail|cancel|expire/i.test(type)) {
    return { kind: 'payment.failed', paymentRef, eventId }
  }
  throw new Error(`UNKNOWN_MEMBERSHIP_EVENT (type=${type || 'missing'})`)
}

const paymongoMembershipProvider: BillingProvider = {
  name: 'paymongo',
  createMembershipIntent: createPaymongoMembershipIntent,
  normalizeEvent: normalizePaymongoMembershipEvent,
}

const manualMembershipProvider: BillingProvider = {
  name: 'manual',
  createMembershipIntent: async (req) => ({
    paymentRef: `manual_${req.reference}`,
    checkoutUrl: undefined,
    raw: { manual: true, reference: req.reference },
  }),
  normalizeEvent: (raw: any) => {
    const paymentRef = String(raw?.paymentRef ?? raw?.reference ?? '')
    if (!paymentRef) throw new Error('UNKNOWN_MEMBERSHIP_EVENT')
    const eventId = String(raw?.eventId ?? raw?.id ?? `manual:${paymentRef}`)
    const kindRaw = String(raw?.kind ?? 'paid').toLowerCase()
    const kind: MembershipEventKind =
      kindRaw === 'refund' ? 'refund' : kindRaw === 'failed' ? 'payment.failed' : 'invoice.paid'
    return {
      kind,
      paymentRef,
      eventId,
      paidAt: kind === 'invoice.paid' ? new Date().toISOString() : undefined,
    }
  },
}

const stripeMembershipProvider: BillingProvider = {
  name: 'stripe',
  createMembershipIntent: async () => {
    throw new Error('STRIPE_NOT_CONFIGURED')
  },
  normalizeEvent: () => {
    throw new Error('STRIPE_NOT_CONFIGURED')
  },
}

const registry: Record<string, BillingProvider> = {
  paymongo: paymongoMembershipProvider,
  manual: manualMembershipProvider,
  stripe: stripeMembershipProvider,
}

export function getMembershipProvider(name?: string | null): BillingProvider {
  const key = (name || process.env.MEMBERSHIP_BILLING_PROVIDER || process.env.BILLING_PROVIDER_DEFAULT || 'paymongo').toLowerCase()
  return registry[key] || registry.paymongo
}

export function listMembershipProviders(): string[] {
  return Object.keys(registry)
}
