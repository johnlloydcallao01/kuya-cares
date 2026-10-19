import type { Payload } from 'payload'
import { validateOrderItemSnapshot } from './orderItemValidation'
import { extractRelationshipId } from './modifierUtils'
import { ModifierResolverService } from './ModifierResolverService'

type RecordValue = Record<string, unknown>

export function relationId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null
  }
  return null
}

export async function resolveAuthenticatedCustomer(
  payload: Payload,
  userId: string | number,
): Promise<RecordValue | null> {
  const result = await payload.find({
    collection: 'customers',
    where: { user: { equals: Number(userId) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (result.docs[0] as unknown as RecordValue | undefined) ?? null
}

export async function loadCustomerAddress(
  payload: Payload,
  addressId: string | null,
  userId: string | number,
): Promise<RecordValue | null> {
  if (!addressId) return null
  const address = await payload.findByID({
    collection: 'addresses',
    id: Number(addressId) as never,
    depth: 0,
    overrideAccess: true,
  }) as unknown as RecordValue
  if (relationId(address.user) !== String(userId)) return null
  return address
}

export async function loadActiveMerchantCart(
  payload: Payload,
  customerId: string | number,
  merchantId: string | number,
): Promise<RecordValue[]> {
  const result = await payload.find({
    collection: 'cart-items',
    where: {
      and: [
        { customer: { equals: customerId } },
        { merchant: { equals: merchantId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs as unknown as RecordValue[]
}

export type AuthoritativeCartLine = {
  cartItem: RecordValue
  productId: string
  merchantProductId: string
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  optionsSnapshot: Array<Record<string, unknown>>
}

function finiteNonNegative(value: unknown, label: string): number {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    throw new Error(`The cart contains an invalid ${label}.`)
  }
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`The cart contains an invalid ${label}.`)
  }
  return amount
}

function finiteAmount(value: unknown, label: string): number {
  if (
    (typeof value !== 'number' && typeof value !== 'string') ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    throw new Error(`The cart contains an invalid ${label}.`)
  }
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    throw new Error(`The cart contains an invalid ${label}.`)
  }
  return amount
}

export async function repriceActiveMerchantCart(
  payload: Payload,
  items: RecordValue[],
  merchantId: string | number,
): Promise<{ lines: AuthoritativeCartLine[]; subtotal: number }> {
  const lines = await Promise.all(items.map(async (cartItem): Promise<AuthoritativeCartLine> => {
    const productId = relationId(cartItem.product)
    const merchantProductId = relationId(cartItem.merchantProduct)
    const quantity = Number(cartItem.quantity)
    if (!productId || !merchantProductId || !Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new Error('The cart contains an invalid product or quantity.')
    }

    const [product, listing] = await Promise.all([
      payload.findByID({
        collection: 'products',
        id: Number(productId) as never,
        depth: 0,
        overrideAccess: true,
      }),
      payload.findByID({
        collection: 'merchant-products',
        id: Number(merchantProductId) as never,
        depth: 0,
        overrideAccess: true,
      }) as Promise<unknown>,
    ]) as unknown as [RecordValue, RecordValue]

    if (product.approvalStatus !== 'approved') {
      throw new Error('A product in your cart is no longer approved for sale.')
    }
    if (
      relationId(listing.merchant_id) !== String(merchantId) ||
      relationId(listing.product_id) !== productId ||
      listing.is_active === false ||
      listing.is_available === false
    ) {
      throw new Error('A product in your cart is no longer available from this seller.')
    }

    const variationId = extractRelationshipId(cartItem.selectedVariation as never)
    const selectedVariation = variationId
      ? await payload.findByID({
          collection: 'prod-variations',
          id: variationId as never,
          depth: 0,
          overrideAccess: true,
        }) as unknown as RecordValue
      : null
    if (selectedVariation) {
      if (
        relationId(selectedVariation.product_id) !== productId ||
        selectedVariation.is_visible === false
      ) {
        throw new Error('A selected product variation is no longer available.')
      }
    } else if (product.productType === 'variable') {
      throw new Error('Please select a variation for every variable product.')
    }

    const override = listing.price_override
    const basePrice = override !== null && override !== undefined
      ? finiteNonNegative(override, 'product price')
      : selectedVariation
        ? finiteNonNegative(selectedVariation.base_price, 'variation price')
        : finiteNonNegative(product.basePrice, 'product price')

    const modifiers = Array.isArray(cartItem.selectedModifiers)
      ? cartItem.selectedModifiers as Array<Record<string, unknown>>
      : []
    const addOns = Array.isArray(cartItem.selectedAddons) ? cartItem.selectedAddons : []
    if (addOns.length > 0) {
      throw new Error('Add-on items must be configured as seller-managed modifiers before checkout.')
    }
    const optionsSnapshot: Array<Record<string, unknown>> = []
    if (selectedVariation) {
      optionsSnapshot.push({
        entryType: 'variation',
        selectedVariationId: Number(variationId),
        selectedVariationName: String(selectedVariation.name ?? ''),
        name: String(selectedVariation.name ?? ''),
        price: 0,
      })
    }
    let modifierTotal = 0
    for (const modifier of modifiers) {
      const groupId = extractRelationshipId(modifier.groupId as never)
      const optionId = extractRelationshipId(modifier.optionId as never)
      if (!groupId || !optionId) throw new Error('A selected product modifier is invalid.')
      const price = finiteAmount(modifier.price, 'modifier price')
      modifierTotal += price
      optionsSnapshot.push({
        entryType: 'modifier',
        groupId,
        groupName: modifier.groupName,
        optionId,
        optionName: modifier.name,
        name: modifier.name,
        price,
      })
    }
    await validateOrderItemSnapshot({
      payload,
      productId: Number(productId),
      merchantProductId: Number(merchantProductId),
      optionsSnapshot,
      requireStructuredEntries: true,
    })
    const groups = await new ModifierResolverService(payload).resolveEffectiveGroups({
      productId: Number(productId),
      variationId,
      merchantProductId: Number(merchantProductId),
    })
    const selectedOptionIds = new Set<string>()
    const selectionsByGroup = new Map<number, number>()
    for (const modifier of modifiers) {
      const groupId = extractRelationshipId(modifier.groupId as never)
      const optionId = extractRelationshipId(modifier.optionId as never)
      if (!groupId || !optionId) continue
      const selectionKey = `${groupId}:${optionId}`
      if (selectedOptionIds.has(selectionKey)) {
        throw new Error('A product modifier was selected more than once.')
      }
      selectedOptionIds.add(selectionKey)
      selectionsByGroup.set(groupId, (selectionsByGroup.get(groupId) ?? 0) + 1)
    }
    for (const group of groups) {
      const selectionCount = selectionsByGroup.get(group.id) ?? 0
      const requiredMinimum = group.isRequired ? Math.max(1, group.minSelections) : 0
      if (
        selectionCount < requiredMinimum ||
        (group.selectionType === 'single' && selectionCount > 1) ||
        (group.maxSelections !== null && selectionCount > group.maxSelections)
      ) {
        throw new Error(`Please update your selections for "${group.name}".`)
      }
    }

    const rawUnitPrice = basePrice + modifierTotal
    if (rawUnitPrice < 0) throw new Error('A cart item price cannot be negative.')
    const unitPrice = Math.round((rawUnitPrice + Number.EPSILON) * 100) / 100
    const totalPrice = Math.round((unitPrice * quantity + Number.EPSILON) * 100) / 100
    return {
      cartItem,
      productId,
      merchantProductId,
      productName: String(product.name ?? 'Product'),
      quantity,
      unitPrice: basePrice,
      totalPrice,
      optionsSnapshot,
    }
  }))
  const subtotal = Math.round((lines.reduce((sum, line) => sum + line.totalPrice, 0) + Number.EPSILON) * 100) / 100
  return { lines, subtotal }
}
