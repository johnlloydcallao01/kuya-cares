import type { Payload } from 'payload'
import { ModifierResolverService, type EffectiveModifierGroup } from './ModifierResolverService'
import { extractRelationshipId } from './modifierUtils'
import {
  normalizeOrderItemOptionsSnapshot,
  type OrderItemSnapshotEntry,
} from './orderItemSnapshot'

const PRICE_EPSILON = 0.005

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < PRICE_EPSILON
}

function getVariationId(snapshot: OrderItemSnapshotEntry[]): number | null {
  const ids = new Set(
    snapshot
      .map((entry) => entry.selectedVariationId)
      .filter((id): id is number => typeof id === 'number'),
  )

  if (ids.size > 1) {
    throw new Error('Order item snapshot contains multiple selected variations')
  }

  return ids.values().next().value ?? null
}

function validateModifierEntries(
  snapshot: OrderItemSnapshotEntry[],
  groups: EffectiveModifierGroup[],
  requireStructuredEntries: boolean,
): number {
  const groupsById = new Map(groups.map((group) => [group.id, group]))
  let modifierTotal = 0

  for (const entry of snapshot) {
    if (entry.entryType === 'variation') {
      continue
    }

    if (!entry.groupId || !entry.optionId) {
      if (requireStructuredEntries) {
        throw new Error('New order modifier snapshots must include groupId and optionId')
      }
      continue
    }

    const group = groupsById.get(entry.groupId)
    const option = group?.options.find((candidate) => candidate.id === entry.optionId)
    if (!group || !option || !option.isAvailable) {
      throw new Error(`Order modifier ${entry.optionId} is not valid for the selected product context`)
    }

    if (entry.name !== option.name && entry.optionName !== option.name) {
      throw new Error(`Order modifier ${entry.optionId} name does not match the catalog snapshot`)
    }

    if (!nearlyEqual(entry.price, option.priceAdjustment)) {
      throw new Error(`Order modifier ${entry.optionId} price does not match the catalog`)
    }

    modifierTotal += option.priceAdjustment
  }

  return modifierTotal
}

export async function validateOrderItemSnapshot(args: {
  payload: Payload
  productId: number | null
  merchantProductId: number | null
  optionsSnapshot: unknown
  requireStructuredEntries: boolean
}): Promise<void> {
  if (!args.productId || args.optionsSnapshot === undefined || args.optionsSnapshot === null) {
    return
  }

  const snapshot = normalizeOrderItemOptionsSnapshot(args.optionsSnapshot)
  const variationId = getVariationId(snapshot)

  if (variationId) {
    const variation = await args.payload.findByID({
      collection: 'prod-variations',
      id: variationId,
      depth: 0,
    })
    const variationProductId = extractRelationshipId(variation.product_id as never)
    if (variationProductId !== args.productId) {
      throw new Error('Order item selected variation does not belong to its product')
    }
  }

  const groups = await new ModifierResolverService(args.payload).resolveEffectiveGroups({
    productId: args.productId,
    variationId,
    merchantProductId: args.merchantProductId,
  })
  validateModifierEntries(snapshot, groups, args.requireStructuredEntries)
}
