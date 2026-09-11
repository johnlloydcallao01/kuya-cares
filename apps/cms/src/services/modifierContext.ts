import type { Payload } from 'payload'
import { extractRelationshipId } from './modifierUtils'

export type ModifierContext = {
  productId: number
  variationId: number | null
  merchantId: number | null
  merchantProductId: number | null
  variation: {
    id: number | string
    product_id?: unknown
    modifier_behavior_mode?: 'inherit_product' | 'variation_specific' | 'hybrid' | null
  } | null
}

export class ModifierContextError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: 400 | 404 = 400,
  ) {
    super(message)
    this.name = 'ModifierContextError'
  }
}

export async function validateModifierContext(
  payload: Payload,
  args: {
    productId: number
    variationId?: number | null
    merchantId?: number | null
    merchantProductId?: number | null
  },
): Promise<ModifierContext> {
  try {
    await payload.findByID({ collection: 'products', id: args.productId, depth: 0 })
  } catch {
    throw new ModifierContextError('Product not found', 'PRODUCT_NOT_FOUND', 404)
  }

  let variation: ModifierContext['variation'] = null
  if (args.variationId) {
    try {
      variation = (await payload.findByID({
        collection: 'prod-variations',
        id: args.variationId,
        depth: 0,
      })) as unknown as ModifierContext['variation']
    } catch {
      throw new ModifierContextError('Variation not found', 'VARIATION_NOT_FOUND', 404)
    }

    if (!variation) {
      throw new ModifierContextError('Variation not found', 'VARIATION_NOT_FOUND', 404)
    }

    const variationProductId = extractRelationshipId(variation.product_id as never)
    if (variationProductId !== args.productId) {
      throw new ModifierContextError(
        'Selected variation does not belong to the requested product',
        'VARIATION_PRODUCT_MISMATCH',
      )
    }
  }

  let merchantProductId = args.merchantProductId ?? null
  let merchantId = args.merchantId ?? null

  if (merchantProductId) {
    let merchantProduct: Record<string, unknown>
    try {
      merchantProduct = (await payload.findByID({
        collection: 'merchant-products',
        id: merchantProductId,
        depth: 0,
      })) as unknown as Record<string, unknown>
    } catch {
      throw new ModifierContextError('Merchant product not found', 'MERCHANT_PRODUCT_NOT_FOUND', 404)
    }

    const linkedProductId = extractRelationshipId(merchantProduct.product_id as never)
    const linkedMerchantId = extractRelationshipId(merchantProduct.merchant_id as never)
    if (linkedProductId !== args.productId) {
      throw new ModifierContextError(
        'Merchant product does not belong to the requested product',
        'MERCHANT_PRODUCT_PRODUCT_MISMATCH',
      )
    }

    if (merchantId && linkedMerchantId !== merchantId) {
      throw new ModifierContextError(
        'Merchant product does not belong to the requested merchant',
        'MERCHANT_PRODUCT_MERCHANT_MISMATCH',
      )
    }

    merchantId = linkedMerchantId
  } else if (merchantId) {
    const merchantProducts = await payload.find({
      collection: 'merchant-products',
      where: {
        and: [
          { product_id: { equals: args.productId } },
          { merchant_id: { equals: merchantId } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    merchantProductId = extractRelationshipId(merchantProducts.docs[0]?.id as never)
    if (!merchantProductId) {
      throw new ModifierContextError('Merchant product not found', 'MERCHANT_PRODUCT_NOT_FOUND', 404)
    }
  }

  return {
    productId: args.productId,
    variationId: args.variationId ?? null,
    merchantId,
    merchantProductId,
    variation,
  }
}
