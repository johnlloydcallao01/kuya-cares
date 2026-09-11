import type { PayloadRequest } from 'payload'
import { ModifierResolverService } from '../services/ModifierResolverService'
import { extractRelationshipId } from '../services/modifierUtils'
import { ModifierContextError, validateModifierContext } from '../services/modifierContext'

function parseId(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const merchantProductDetailHandler = async (req: PayloadRequest) => {
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

    const { productId: productIdParam, merchantId: merchantIdParam, variationId: variationIdParam } = req.query as {
      productId?: string
      merchantId?: string
      variationId?: string
    }

    const productId = parseId(productIdParam)
    const merchantId = parseId(merchantIdParam)
    const variationId = parseId(variationIdParam)

    if (!productId || !merchantId) {
      return Response.json(
        {
          success: false,
          error: 'Missing required parameters: productId and merchantId',
          code: 'MISSING_REQUIRED_PARAMS',
        },
        { status: 400 },
      )
    }

    const context = await validateModifierContext(req.payload, {
      productId,
      variationId,
      merchantId,
    })

    const merchantProduct = await req.payload.findByID({
      collection: 'merchant-products',
      id: context.merchantProductId as number,
      depth: 2,
    })

    const rawProduct = merchantProduct.product_id
    const product =
      rawProduct && typeof rawProduct === 'object'
        ? rawProduct
        : await req.payload.findByID({
            collection: 'products',
            id: productId,
            depth: 2,
          })

    const resolver = new ModifierResolverService(req.payload)
    const effectiveModifierGroups = await resolver.resolveEffectiveGroups({
      productId: context.productId,
      variationId: context.variationId,
      variationDoc: context.variation,
      merchantId: context.merchantId,
      merchantProductId: context.merchantProductId,
    })

    let selectedVariation = null
    if (context.variationId) {
      selectedVariation = await req.payload.findByID({
        collection: 'prod-variations',
        id: context.variationId,
        depth: 1,
      })
    }

    return Response.json({
      success: true,
      data: {
        merchantProduct,
        product,
        selectedVariation,
        effectiveModifierGroups,
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
        error: 'Failed to load merchant product detail',
        message,
        code: 'MERCHANT_PRODUCT_DETAIL_ERROR',
      },
      { status: 500 },
    )
  }
}
