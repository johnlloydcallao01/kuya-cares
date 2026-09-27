import type { PayloadRequest } from 'payload'
import { WalletService, roundMoney } from '../services/WalletService'

/**
 * POST /api/wallet/withdraw
 * Body: { customerId: number|string, amount: number (PHP), destination?: string }
 * Phase 1: debits wallet as type=withdrawal (pending) and records destination
 * in meta for manual disbursement review. A future disbursement provider
 * can pick up pending rows without changing this contract.
 * Auth: service or admin (shared service key + explicit customerId).
 */
export const walletWithdrawHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasJson = typeof (req as any).json === 'function'
    const parsed = (await (hasJson ? (req as any).json() : Promise.resolve((req as any).body))) ?? {}
    const { customerId, amount, destination } = parsed as {
      customerId?: unknown
      amount?: unknown
      destination?: unknown
    }

    if (customerId === undefined || customerId === null || String(customerId) === '') {
      return Response.json({ error: 'customerId is required' }, { status: 400 })
    }
    const normalized = roundMoney(Number(amount))
    const minPayout = Number(process.env.WALLET_MIN_PAYOUT || 100)
    if (!Number.isFinite(normalized) || normalized < minPayout) {
      return Response.json({ error: `amount must be at least PHP ${minPayout.toFixed(2)}` }, { status: 400 })
    }

    const service = new WalletService(req.payload)
    const entry = await service.postEntry({
      customerId: customerId as number | string,
      type: 'withdrawal',
      amount: -normalized,
      gateway: 'manual',
      meta: { destination: typeof destination === 'string' ? destination : 'manual_review' },
    })

    return Response.json({ data: { entryId: entry.id, amount: normalized } })
  } catch (error: any) {
    console.error('[wallet/withdraw] Error:', error)
    const msg = error?.message || 'Failed to withdraw'
    return Response.json({ error: msg }, { status: msg === 'INSUFFICIENT_WALLET_BALANCE' ? 422 : 500 })
  }
}
