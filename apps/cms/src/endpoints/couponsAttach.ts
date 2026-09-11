import type { PayloadRequest } from 'payload'
import { CouponService } from '../services/CouponService'

/**
 * POST /api/coupons/attach
 *
 * Server-side coupon application. Validates the code, creates the
 * order-discount row + held redemption, and rewrites order totals.
 * Only pending (unpaid) orders accept coupons — one per order by default.
 * Body: { orderId: number|string, code: string, customerId: number|string }
 * Auth: service or admin (shared mobile service key + explicit customerId,
 *       ownership verified against the order server-side).
 */
export const couponsAttachHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const hasJson = typeof (req as any).json === 'function'
    const parsed = (await (hasJson ? (req as any).json() : Promise.resolve((req as any).body))) ?? {}
    const { orderId, code, customerId } = parsed as {
      orderId?: unknown
      code?: unknown
      customerId?: unknown
    }

    if (orderId === undefined || orderId === null || String(orderId) === '') {
      return Response.json({ error: 'orderId is required' }, { status: 400 })
    }
    if (typeof code !== 'string' || !code.trim()) {
      return Response.json({ error: 'code is required' }, { status: 400 })
    }
    if (customerId === undefined || customerId === null || String(customerId) === '') {
      return Response.json({ error: 'customerId is required' }, { status: 400 })
    }

    const service = new CouponService(req.payload)
    const result = await service.applyToOrder({
      orderId: orderId as number | string,
      code,
      customerId: customerId as number | string,
    })

    if (!result.valid) {
      const status =
        result.reason === 'ORDER_NOT_FOUND'
          ? 404
          : result.reason === 'CONTACT_NOT_ALLOWED'
            ? 403
            : result.reason === 'ORDER_NOT_EDITABLE' || result.reason === 'ALREADY_APPLIED'
              ? 409
              : 422
      return Response.json(
        { error: result.message, reason: result.reason, wooCode: result.wooCode },
        { status },
      )
    }

    return Response.json({ data: result })
  } catch (error: any) {
    console.error('[coupons/attach] Error:', error)
    return Response.json({ error: error?.message || 'Failed to apply coupon' }, { status: 500 })
  }
}
