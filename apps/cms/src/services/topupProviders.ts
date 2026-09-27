/**
 * Gateway-agnostic top-up provider abstraction.
 *
 * The wallet ledger itself never talks to a gateway. A provider only:
 *  1. creates an external payment intent for a top-up amount, and
 *  2. identifies incoming webhook events as top-up credits.
 *
 * Add new rails (xendit, stripe, manual) by implementing TopupProvider
 * and registering it in the registry below. WalletService stays unchanged.
 */

export interface TopupIntentRequest {
  amountCentavos: number
  currency: string
  reference: string
  customerEmail?: string | null
}

export interface TopupIntentResult {
  paymentIntentId: string
  raw: unknown
}

export interface TopupProvider {
  name: string
  createIntent(req: TopupIntentRequest): Promise<TopupIntentResult>
}

async function createPaymongoIntent(req: TopupIntentRequest): Promise<TopupIntentResult> {
  const sandbox = process.env.PAYMONGO_SANDBOX === 'true'
  const secretKey = sandbox
    ? process.env.PAYMONGO_SANDBOX_API_KEY
    : process.env.PAYMONGO_SECRET_KEY_LIVE
  if (!secretKey) {
    throw new Error('Server configuration error: Missing PayMongo Secret Key')
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
    const errMsg = data?.errors?.[0]?.detail || data?.error || 'Failed to create top-up intent'
    throw new Error(errMsg)
  }
  return { paymentIntentId: data?.data?.id, raw: data }
}

const paymongoProvider: TopupProvider = {
  name: 'paymongo',
  createIntent: createPaymongoIntent,
}

const manualProvider: TopupProvider = {
  name: 'manual',
  createIntent: async (req) => ({
    paymentIntentId: `manual_${req.reference}`,
    raw: { manual: true, reference: req.reference },
  }),
}

const registry: Record<string, TopupProvider> = {
  paymongo: paymongoProvider,
  manual: manualProvider,
}

export function getTopupProvider(name?: string | null): TopupProvider {
  const key = (name || process.env.WALLET_TOPUP_PROVIDER || 'paymongo').toLowerCase()
  return registry[key] || registry.paymongo
}

export function listTopupProviders(): string[] {
  return Object.keys(registry)
}
