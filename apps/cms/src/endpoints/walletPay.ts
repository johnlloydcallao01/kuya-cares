import type { PayloadRequest } from 'payload'
import { WalletService } from '../services/WalletService'

/**
 * POST /api/wallet/pay
 * Body: { orderId: number|string, customerId: number|string, amount?: number (PHP) }
 * Debits wallet + rewrites order totals (wallet_amount_used, total).
 * Only pending orders. Ownership verified server-side.
 * Auth: service or admin (shared service key + explicit customerId).
 */
export const walletPayHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasJson = typeof (req as any).json === 'function'
    const parsed = (await (hasJson ? (req as any).json() : Promise.resolve((req as any).body))) ?? {}
    const { orderId, customerId, amount } = parsed as {
      orderId?: unknown
      customerId?: unknown
      amount?: unknown
    }

    if (orderId === undefined || orderId === null || String(orderId) === '') {
      return Response.json({ error: 'orderId is required' }, { status: 400 })
    }
    if (customerId === undefined || customerId === null || String(customerId) === '') {
      return Response.json({ error: 'customerId is required' }, { status: 400 })
    }

    const service = new WalletService(req.payload)
    const result = await service.payWithWallet({
      orderId: orderId as number | string,
      customerId: customerId as number | string,
      amount: amount === undefined ? undefined : Number(amount),
    })

    return Response.json({ data: result })
  } catch (error: any) {
    console.error('[wallet/pay] Error:', error)
    const msg = error?.message || 'Failed to pay with wallet'
    const status = msg === 'ORDER_NOT_FOUND'
      ? 404
      : msg === 'CONTACT_NOT_ALLOWED'
        ? 403
        : msg === 'ORDER_NOT_EDITABLE'
          ? 409
          : msg === 'INSUFFICIENT_WALLET_BALANCE'
            ? 422
            : 500
    return Response.json({ error: msg }, { status })
  }
}
