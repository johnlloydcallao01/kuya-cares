import type { PayloadRequest } from 'payload'
import crypto from 'crypto'
import { WalletService, roundMoney } from '../services/WalletService'
import { getTopupProvider } from '../services/topupProviders'

/**
 * POST /api/wallet/topup
 * Body: { customerId: number|string, amount: number (PHP), gateway?: string }
 * Creates a wallet-topups row (pending) + a gateway intent via the
 * configured TopupProvider (PayMongo by default). Gateway-agnostic:
 * swap WALLET_TOPUP_PROVIDER without touching the ledger.
 * Auth: service or admin (shared service key + explicit customerId).
 */
export const walletTopupHandler = async (req: PayloadRequest) => {
  const requestId = crypto.randomUUID()
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasJson = typeof (req as any).json === 'function'
    const parsed = (await (hasJson ? (req as any).json() : Promise.resolve((req as any).body))) ?? {}
    const { customerId, amount, gateway } = parsed as {
      customerId?: unknown
      amount?: unknown
      gateway?: unknown
    }

    if (customerId === undefined || customerId === null || String(customerId) === '') {
      return Response.json({ error: 'customerId is required' }, { status: 400 })
    }
    const normalized = roundMoney(Number(amount))
    const minTopup = Number(process.env.WALLET_MIN_TOPUP || 1)
    if (!Number.isFinite(normalized) || normalized < minTopup) {
      return Response.json({ error: `amount must be at least PHP ${minTopup.toFixed(2)}` }, { status: 400 })
    }
    const maxBalance = Number(process.env.WALLET_MAX_BALANCE || 100000)
    const service = new WalletService(req.payload)
    const { balance } = await service.getBalance(customerId as number | string)
    if (balance + normalized > maxBalance) {
      return Response.json({ error: `Top-up would exceed max balance PHP ${maxBalance}` }, { status: 422 })
    }

    const provider = getTopupProvider(typeof gateway === 'string' ? gateway : undefined)
    const amountCentavos = Math.round(normalized * 100)
    const reference = `wallet-topup:${String(customerId)}:${Date.now()}`
    const intent = await provider.createIntent({
      amountCentavos,
      currency: 'PHP',
      reference,
      customerEmail: null,
    })

    const wallet = await service.getOrCreateWallet(customerId as number | string)
    const topup = await (req.payload as any).create({
      collection: 'wallet-topups',
      data: {
        wallet: wallet.id,
        customer: Number(customerId) || customerId,
        amount: normalized,
        currency: 'PHP',
        gateway: provider.name,
        payment_intent_id: intent.paymentIntentId,
        status: 'pending',
      },
      overrideAccess: true,
    })

    return Response.json({ data: { topupId: topup.id, paymentIntent: intent.raw, gateway: provider.name } })
  } catch (error: any) {
    console.error(`[wallet/topup] Error [${requestId}]:`, error)
    return Response.json({ error: error?.message || 'Failed to create top-up' }, { status: 500 })
  }
}
