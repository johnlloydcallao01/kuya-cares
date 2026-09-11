import { extractRelationshipId } from './modifierUtils'

export async function resolveMerchantProductDoc(req: any, merchantProductValue: unknown) {
  const merchantProductId = extractRelationshipId(merchantProductValue as never)
  if (!merchantProductId) {
    return null
  }

  return req.payload.findByID({
    collection: 'merchant-products',
    id: merchantProductId,
    depth: 0,
  })
}

export async function resolveMerchantProductProductId(
  req: any,
  merchantProductValue: unknown,
): Promise<number | null> {
  const merchantProduct = await resolveMerchantProductDoc(req, merchantProductValue)
  return extractRelationshipId(merchantProduct?.product_id as never)
}

export async function resolveVariationDoc(req: any, variationValue: unknown) {
  const variationId = extractRelationshipId(variationValue as never)
  if (!variationId) {
    return null
  }

  return req.payload.findByID({
    collection: 'prod-variations',
    id: variationId,
    depth: 0,
  })
}

export async function resolveVariationProductId(
  req: any,
  variationValue: unknown,
): Promise<number | null> {
  const variation = await resolveVariationDoc(req, variationValue)
  return extractRelationshipId(variation?.product_id as never)
}

export async function resolveProductModifierGroupIds(
  req: any,
  productId: number,
): Promise<number[]> {
  const groups = await req.payload.find({
    collection: 'modifier-groups',
    where: {
      product_id: {
        equals: productId,
      },
    },
    limit: 500,
    depth: 0,
  })

  return groups.docs
    .map((group: any) => extractRelationshipId(group?.id as never))
    .filter((id: number | null): id is number => id !== null)
}

export async function resolveVariationModifierGroupIds(
  req: any,
  variationId: number,
): Promise<number[]> {
  const groups = await req.payload.find({
    collection: 'variation-modifier-groups',
    where: {
      and: [
        {
          variation_id: {
            equals: variationId,
          },
        },
        {
          is_active: {
            not_equals: false,
          },
        },
      ],
    },
    limit: 500,
    depth: 0,
  })

  return groups.docs
    .map((group: any) => extractRelationshipId(group?.id as never))
    .filter((id: number | null): id is number => id !== null)
}
