import type { PayloadRequest } from 'payload'
import { ModifierResolverService } from '../services/ModifierResolverService'
import { ModifierContextError, validateModifierContext } from '../services/modifierContext'

function parseId(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const effectiveModifiersHandler = async (req: PayloadRequest) => {
  try {
    if (!req.user) {
      return Response.json(
        {
          success: false,
          error: 'Authentication required. Please provide a valid API key.',
          code: 'UNAUTHENTICATED',
        },
        { status: 401 },
      )
    }

    if (req.user.role !== 'service' && req.user.role !== 'admin') {
      return Response.json(
        {
          success: false,
          error: 'Access denied. Service or admin role required.',
          code: 'INSUFFICIENT_PERMISSIONS',
        },
        { status: 403 },
      )
    }

    const {
      productId: productIdParam,
      variationId: variationIdParam,
      merchantId: merchantIdParam,
      merchantProductId: merchantProductIdParam,
    } = req.query as {
      productId?: string
      variationId?: string
      merchantId?: string
      merchantProductId?: string
    }

    const productId = parseId(productIdParam)
    const variationId = parseId(variationIdParam)
    const merchantId = parseId(merchantIdParam)
    const merchantProductId = parseId(merchantProductIdParam)

    if (!productId) {
      return Response.json(
        {
          success: false,
          error: 'Missing required parameter: productId',
          code: 'MISSING_PRODUCT_ID',
        },
        { status: 400 },
      )
    }

    const context = await validateModifierContext(req.payload, {
      productId,
      variationId,
      merchantId,
      merchantProductId,
    })

    const resolver = new ModifierResolverService(req.payload)
    const groups = await resolver.resolveEffectiveGroups({
      productId: context.productId,
      variationId: context.variationId,
      variationDoc: context.variation,
      merchantId: context.merchantId,
      merchantProductId: context.merchantProductId,
    })

    return Response.json({
      success: true,
      data: {
        productId,
        variationId,
        merchantId: context.merchantId,
        merchantProductId: context.merchantProductId,
        groups,
      },
    })
  } catch (error) {
    if (error instanceof ModifierContextError) {
      return Response.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      )
    }

    const message = error instanceof Error ? error.message : 'Unknown error'

    return Response.json(
      {
        success: false,
        error: 'Failed to resolve effective modifiers',
        message,
        code: 'EFFECTIVE_MODIFIERS_ERROR',
      },
      { status: 500 },
    )
  }
}
