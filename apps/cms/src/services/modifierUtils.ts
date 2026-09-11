type RelationshipValue =
  | number
  | string
  | null
  | undefined
  | {
      id?: number | string | null
      value?: number | string | { id?: number | string | null } | null
      relationTo?: string | null
    }

export function extractRelationshipId(value: RelationshipValue): number | null {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  if (typeof value === 'object') {
    if ('value' in value) {
      return extractRelationshipId(value.value as RelationshipValue)
    }

    if ('id' in value) {
      return extractRelationshipId(value.id as RelationshipValue)
    }
  }

  return null
}

export function extractRelationshipRelationTo(value: RelationshipValue): string | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  if ('relationTo' in value && typeof value.relationTo === 'string') {
    return value.relationTo
  }

  return null
}

export function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = toNullableNumber(value)
  return parsed ?? fallback
}

export function toOptionalTrimmedText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}
