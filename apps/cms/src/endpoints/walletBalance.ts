import type { PayloadRequest } from 'payload'
import { WalletService } from '../services/WalletService'

/**
 * GET /api/wallet/balance?customerId=
 * Auth: service or admin (shared service key + explicit customerId).
 */
export const walletBalanceHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }
    const url = new URL((req as unknown as Request).url)
    const customerId = url.searchParams.get('customerId')
    if (!customerId) {
      return Response.json({ error: 'customerId is required' }, { status: 400 })
    }
    const service = new WalletService(req.payload)
    const data = await service.getBalance(customerId)
    return Response.json({ data })
  } catch (error: any) {
    console.error('[wallet/balance] Error:', error)
    return Response.json({ error: error?.message || 'Failed to load wallet balance' }, { status: 500 })
  }
}
