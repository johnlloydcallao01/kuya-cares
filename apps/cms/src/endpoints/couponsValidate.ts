import type { PayloadRequest } from 'payload'
import { CouponService } from '../services/CouponService'

/**
 * POST /api/coupons/validate
 *
 * Pre-payment coupon preview. No side effects (no holds, no writes).
 * Body: { code: string, customerId: number|string, merchantId: number|string,
 *         deliveryFee?: number, paymentMethod?: string }
 * Auth: service or admin (shared mobile service key + explicit customerId).
 */
export const couponsValidateHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasJson = typeof (req as any).json === 'function'
    const parsed = (await (hasJson ? (req as any).json() : Promise.resolve((req as any).body))) ?? {}
    const { code, customerId, merchantId, deliveryFee, paymentMethod } = parsed as {
      code?: unknown
      customerId?: unknown
      merchantId?: unknown
      deliveryFee?: unknown
      paymentMethod?: unknown
    }

    if (typeof code !== 'string' || !code.trim()) {
      return Response.json({ error: 'code is required' }, { status: 400 })
    }
    if (customerId === undefined || customerId === null || String(customerId) === '') {
      return Response.json({ error: 'customerId is required' }, { status: 400 })
    }
    if (merchantId === undefined || merchantId === null || String(merchantId) === '') {
      return Response.json({ error: 'merchantId is required' }, { status: 400 })
    }

    const service = new CouponService(req.payload)
    const result = await service.validate({
      code,
      customerId: customerId as number | string,
      merchantId: merchantId as number | string,
      deliveryFee: deliveryFee === undefined ? undefined : Number(deliveryFee),
      paymentMethod: typeof paymentMethod === 'string' ? paymentMethod : undefined,
    })

    return Response.json({ data: result })
  } catch (error: any) {
    console.error('[coupons/validate] Error:', error)
    return Response.json({ error: error?.message || 'Failed to validate coupon' }, { status: 500 })
  }
}
