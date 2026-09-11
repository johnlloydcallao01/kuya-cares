import { extractRelationshipId, toFiniteNumber, toOptionalTrimmedText } from './modifierUtils'

export type OrderItemSnapshotEntry = {
  entryType: 'variation' | 'modifier'
  sourceType?:
    | 'product-base'
    | 'variation-added'
    | 'variation-overridden'
    | 'merchant-product-overridden'
    | 'merchant-variation-overridden'
  groupId?: number
  groupName?: string
  optionId?: number
  optionName?: string
  selectedVariationId?: number
  selectedVariationName?: string
  name: string
  price: number
}

function normalizeSnapshotEntry(value: unknown): OrderItemSnapshotEntry | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>
  const entryType = raw.entryType === 'variation' ? 'variation' : 'modifier'
  const name =
    toOptionalTrimmedText(raw.name) ??
    toOptionalTrimmedText(raw.optionName) ??
    toOptionalTrimmedText(raw.selectedVariationName)

  if (!name) {
    return null
  }

  const sourceType =
    raw.sourceType === 'variation-added' ||
    raw.sourceType === 'variation-overridden' ||
    raw.sourceType === 'merchant-product-overridden' ||
    raw.sourceType === 'merchant-variation-overridden' ||
    raw.sourceType === 'product-base'
      ? raw.sourceType
      : undefined

  const groupId = extractRelationshipId(raw.groupId as never) ?? undefined
  const optionId = extractRelationshipId(raw.optionId as never) ?? undefined
  const selectedVariationId = extractRelationshipId(raw.selectedVariationId as never) ?? undefined

  return {
    entryType,
    sourceType,
    groupId,
    groupName: toOptionalTrimmedText(raw.groupName),
    optionId,
    optionName: toOptionalTrimmedText(raw.optionName) ?? name,
    selectedVariationId,
    selectedVariationName: toOptionalTrimmedText(raw.selectedVariationName),
    name,
    price: toFiniteNumber(raw.price),
  }
}

export function normalizeOrderItemOptionsSnapshot(value: unknown): OrderItemSnapshotEntry[] {
  if (value === null || value === undefined) {
    return []
  }

  if (!Array.isArray(value)) {
    throw new Error('options_snapshot must be an array when provided')
  }

  return value
    .map((entry) => normalizeSnapshotEntry(entry))
    .filter((entry): entry is OrderItemSnapshotEntry => entry !== null)
}
