import type { Payload } from 'payload'
import {
  extractRelationshipId,
  toFiniteNumber,
  toNullableNumber,
  toOptionalTrimmedText,
} from './modifierUtils'

type SelectionType = 'single' | 'multiple'
type ModifierSource =
  | 'product-base'
  | 'variation-added'
  | 'variation-overridden'
  | 'merchant-product-overridden'
  | 'merchant-variation-overridden'

type BaseGroupDoc = {
  id: number | string
  name?: string | null
  selection_type?: SelectionType | null
  is_required?: boolean | null
  min_selections?: number | string | null
  max_selections?: number | string | null
  sort_order?: number | string | null
}

type BaseOptionDoc = {
  id: number | string
  name?: string | null
  price_adjustment?: number | string | null
  is_default?: boolean | null
  is_available?: boolean | null
  sort_order?: number | string | null
}

type GroupOverrideDoc = {
  base_modifier_group_id?: unknown
  mode?: 'inherit' | 'hide' | 'override' | null
  name_override?: string | null
  selection_type_override?: SelectionType | null
  required_behavior?: 'inherit' | 'required' | 'optional' | null
  min_selections_override?: number | string | null
  max_selections_override?: number | string | null
  sort_order_override?: number | string | null
  is_active?: boolean | null
}

type OptionOverrideDoc = {
  base_modifier_option_id?: unknown
  mode?: 'inherit' | 'hide' | 'override' | null
  name_override?: string | null
  price_adjustment_override?: number | string | null
  default_behavior?: 'inherit' | 'default' | 'not_default' | null
  availability_behavior?: 'inherit' | 'available' | 'unavailable' | null
  sort_order_override?: number | string | null
  is_active?: boolean | null
}

export type EffectiveModifierOption = {
  id: number
  name: string
  priceAdjustment: number
  isDefault: boolean
  isAvailable: boolean
  sortOrder: number
  source: ModifierSource
  baseOptionId?: number
}

export type EffectiveModifierGroup = {
  id: number
  name: string
  selectionType: SelectionType
  isRequired: boolean
  minSelections: number
  maxSelections: number | null
  sortOrder: number
  source: ModifierSource
  baseGroupId?: number
  options: EffectiveModifierOption[]
}

type ResolveArgs = {
  productId: number
  variationId?: number | null
  variationDoc?: VariationDoc | null
  merchantId?: number | null
  merchantProductId?: number | null
}

type VariationDoc = {
  id: number | string
  product_id?: unknown
  modifier_behavior_mode?: 'inherit_product' | 'variation_specific' | 'hybrid' | null
}

type MerchantVariationTargetSource = 'product_base' | 'variation_added'

type MerchantVariationGroupOverrideDoc = GroupOverrideDoc & {
  target_group_source?: MerchantVariationTargetSource | null
  variation_modifier_group_id?: unknown
}

type MerchantVariationOptionOverrideDoc = OptionOverrideDoc & {
  target_option_source?: MerchantVariationTargetSource | null
  variation_modifier_option_id?: unknown
}

type HydratedOptionDoc = BaseOptionDoc & {
  modifier_group_id?: unknown
  variation_modifier_group_id?: unknown
}

function relationshipId(value: unknown): number | null {
  return extractRelationshipId(value as never)
}

export class ModifierResolverService {
  constructor(private readonly payload: Payload) {}

  async resolveEffectiveGroups({
    productId,
    variationId,
    variationDoc: inputVariationDoc,
    merchantId,
    merchantProductId,
  }: ResolveArgs): Promise<EffectiveModifierGroup[]> {
    const baseGroups = await this.fetchProductGroups(productId)
    let resolvedGroups = baseGroups

    if (variationId) {
      const variationDoc = inputVariationDoc
        ?? ((await this.payload.findByID({
          collection: 'prod-variations',
          id: variationId,
          depth: 0,
        })) as VariationDoc)

      const modifierBehaviorMode = variationDoc?.modifier_behavior_mode ?? 'inherit_product'

      const [variationGroups, groupOverrides, optionOverrides] = await Promise.all([
        this.fetchVariationGroups(variationId),
        this.fetchGroupOverrides(variationId),
        this.fetchOptionOverrides(variationId),
      ])

      if (modifierBehaviorMode === 'variation_specific') {
        resolvedGroups = variationGroups
      } else if (modifierBehaviorMode === 'hybrid') {
        const mergedBaseGroups = this.applyResolvedOverrides({
          groups: baseGroups,
          groupOverrides: groupOverrides
            .map((override) => {
              const baseGroupId = relationshipId(override.base_modifier_group_id)
              if (!baseGroupId) {
                return null
              }

              return {
                override,
                targetKey: this.buildTargetKey('product_base', baseGroupId),
              }
            })
            .filter(
              (entry): entry is { override: GroupOverrideDoc; targetKey: string } => entry !== null,
            ),
          optionOverrides: optionOverrides
            .map((override) => {
              const baseOptionId = relationshipId(override.base_modifier_option_id)
              if (!baseOptionId) {
                return null
              }

              return {
                override,
                targetKey: this.buildTargetKey('product_base', baseOptionId),
              }
            })
            .filter(
              (entry): entry is { override: OptionOverrideDoc; targetKey: string } => entry !== null,
            ),
          overrideSource: 'variation-overridden',
        })

        resolvedGroups = [...mergedBaseGroups, ...variationGroups].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
        )
      }
    }

    const resolvedMerchantProductId = await this.resolveMerchantProductId({
      productId,
      merchantId,
      merchantProductId,
    })

    if (resolvedMerchantProductId) {
      resolvedGroups = await this.applyMerchantProductOverrides(resolvedGroups, resolvedMerchantProductId)

      if (variationId) {
        resolvedGroups = await this.applyMerchantVariationOverrides(
          resolvedGroups,
          resolvedMerchantProductId,
          variationId,
        )
      }
    }

    return resolvedGroups
  }

  private async fetchProductGroups(productId: number): Promise<EffectiveModifierGroup[]> {
    const groupsResult = await this.payload.find({
      collection: 'modifier-groups',
      where: { product_id: { equals: productId } },
      limit: 200,
      sort: 'sort_order',
      depth: 0,
    })

    return this.hydrateGroups({
      groups: groupsResult.docs as BaseGroupDoc[],
      optionCollection: 'modifier-options',
      optionGroupField: 'modifier_group_id',
      source: 'product-base',
    })
  }

  private async fetchVariationGroups(variationId: number): Promise<EffectiveModifierGroup[]> {
    const groupsResult = await this.payload.find({
      collection: 'variation-modifier-groups',
      where: {
        and: [
          { variation_id: { equals: variationId } },
          { is_active: { not_equals: false } },
        ],
      },
      limit: 200,
      sort: 'sort_order',
      depth: 0,
    })

    return this.hydrateGroups({
      groups: groupsResult.docs as BaseGroupDoc[],
      optionCollection: 'variation-modifier-options',
      optionGroupField: 'variation_modifier_group_id',
      source: 'variation-added',
    })
  }

  private async fetchGroupOverrides(variationId: number): Promise<GroupOverrideDoc[]> {
    const result = await this.payload.find({
      collection: 'variation-modifier-group-overrides',
      where: {
        and: [
          { variation_id: { equals: variationId } },
          { is_active: { not_equals: false } },
        ],
      },
      limit: 500,
      depth: 0,
    })

    return result.docs as GroupOverrideDoc[]
  }

  private async fetchOptionOverrides(variationId: number): Promise<OptionOverrideDoc[]> {
    const result = await this.payload.find({
      collection: 'variation-modifier-option-overrides',
      where: {
        and: [
          { variation_id: { equals: variationId } },
          { is_active: { not_equals: false } },
        ],
      },
      limit: 1000,
      depth: 0,
    })

    return result.docs as OptionOverrideDoc[]
  }

  private async resolveMerchantProductId(args: {
    productId: number
    merchantId?: number | null
    merchantProductId?: number | null
  }): Promise<number | null> {
    if (args.merchantProductId) {
      return args.merchantProductId
    }

    if (!args.merchantId) {
      return null
    }

    const result = await this.payload.find({
      collection: 'merchant-products',
      where: {
        and: [
          { product_id: { equals: args.productId } },
          { merchant_id: { equals: args.merchantId } },
        ],
      },
      limit: 1,
      depth: 0,
    })

    return extractRelationshipId(result.docs[0]?.id as never)
  }

  private async applyMerchantProductOverrides(
    groups: EffectiveModifierGroup[],
    merchantProductId: number,
  ): Promise<EffectiveModifierGroup[]> {
    const [groupOverrides, optionOverrides] = await Promise.all([
      this.fetchMerchantProductGroupOverrides(merchantProductId),
      this.fetchMerchantProductOptionOverrides(merchantProductId),
    ])

    return this.applyResolvedOverrides({
      groups,
      groupOverrides: groupOverrides
        .map((override) => {
          const baseGroupId = relationshipId(override.base_modifier_group_id)
          if (!baseGroupId) {
            return null
          }

          return {
            override,
            targetKey: this.buildTargetKey('product_base', baseGroupId),
          }
        })
        .filter(
          (entry): entry is { override: GroupOverrideDoc; targetKey: string } => entry !== null,
        ),
      optionOverrides: optionOverrides
        .map((override) => {
          const baseOptionId = relationshipId(override.base_modifier_option_id)
          if (!baseOptionId) {
            return null
          }

          return {
            override,
            targetKey: this.buildTargetKey('product_base', baseOptionId),
          }
        })
        .filter(
          (entry): entry is { override: OptionOverrideDoc; targetKey: string } => entry !== null,
        ),
      overrideSource: 'merchant-product-overridden',
    })
  }

  private async applyMerchantVariationOverrides(
    groups: EffectiveModifierGroup[],
    merchantProductId: number,
    variationId: number,
  ): Promise<EffectiveModifierGroup[]> {
    const [groupOverrides, optionOverrides] = await Promise.all([
      this.fetchMerchantVariationGroupOverrides(merchantProductId, variationId),
      this.fetchMerchantVariationOptionOverrides(merchantProductId, variationId),
    ])

    return this.applyResolvedOverrides({
      groups,
      groupOverrides: groupOverrides
        .map((override) => {
          const target = this.resolveMerchantVariationTarget({
            source: override.target_group_source,
            productBaseId: override.base_modifier_group_id,
            variationAddedId: override.variation_modifier_group_id,
          })

          if (!target) {
            return null
          }

          return {
            override,
            targetKey: target,
          }
        })
        .filter(
          (entry): entry is { override: GroupOverrideDoc; targetKey: string } => entry !== null,
        ),
      optionOverrides: optionOverrides
        .map((override) => {
          const target = this.resolveMerchantVariationTarget({
            source: override.target_option_source,
            productBaseId: override.base_modifier_option_id,
            variationAddedId: override.variation_modifier_option_id,
          })

          if (!target) {
            return null
          }

          return {
            override,
            targetKey: target,
          }
        })
        .filter(
          (entry): entry is { override: OptionOverrideDoc; targetKey: string } => entry !== null,
        ),
      overrideSource: 'merchant-variation-overridden',
    })
  }

  private resolveMerchantVariationTarget(args: {
    source?: MerchantVariationTargetSource | null
    productBaseId?: unknown
    variationAddedId?: unknown
  }): string | null {
    if (args.source === 'variation_added') {
      const id = relationshipId(args.variationAddedId)
      return id ? this.buildTargetKey('variation_added', id) : null
    }

    const id = relationshipId(args.productBaseId)
    return id ? this.buildTargetKey('product_base', id) : null
  }

  private async fetchMerchantProductGroupOverrides(
    merchantProductId: number,
  ): Promise<GroupOverrideDoc[]> {
    const result = await this.payload.find({
      collection: 'merchant-product-modifier-group-overrides',
      where: {
        and: [
          { merchant_product_id: { equals: merchantProductId } },
          { is_active: { not_equals: false } },
        ],
      },
      limit: 500,
      depth: 0,
    })

    return result.docs as GroupOverrideDoc[]
  }

  private async fetchMerchantProductOptionOverrides(
    merchantProductId: number,
  ): Promise<OptionOverrideDoc[]> {
    const result = await this.payload.find({
      collection: 'merchant-product-modifier-option-overrides',
      where: {
        and: [
          { merchant_product_id: { equals: merchantProductId } },
          { is_active: { not_equals: false } },
        ],
      },
      limit: 1000,
      depth: 0,
    })

    return result.docs as OptionOverrideDoc[]
  }

  private async fetchMerchantVariationGroupOverrides(
    merchantProductId: number,
    variationId: number,
  ): Promise<MerchantVariationGroupOverrideDoc[]> {
    const result = await this.payload.find({
      collection: 'merchant-variation-modifier-group-overrides',
      where: {
        and: [
          { merchant_product_id: { equals: merchantProductId } },
          { variation_id: { equals: variationId } },
          { is_active: { not_equals: false } },
        ],
      },
      limit: 500,
      depth: 0,
    })

    return result.docs as MerchantVariationGroupOverrideDoc[]
  }

  private async fetchMerchantVariationOptionOverrides(
    merchantProductId: number,
    variationId: number,
  ): Promise<MerchantVariationOptionOverrideDoc[]> {
    const result = await this.payload.find({
      collection: 'merchant-variation-modifier-option-overrides',
      where: {
        and: [
          { merchant_product_id: { equals: merchantProductId } },
          { variation_id: { equals: variationId } },
          { is_active: { not_equals: false } },
        ],
      },
      limit: 1000,
      depth: 0,
    })

    return result.docs as MerchantVariationOptionOverrideDoc[]
  }

  private buildTargetKey(source: MerchantVariationTargetSource, id: number): string {
    return `${source}:${id}`
  }

  private getGroupTargetKeys(group: EffectiveModifierGroup): string[] {
    if (group.baseGroupId) {
      return [this.buildTargetKey('product_base', group.baseGroupId)]
    }

    return [this.buildTargetKey('variation_added', group.id)]
  }

  private getOptionTargetKeys(option: EffectiveModifierOption): string[] {
    if (option.baseOptionId) {
      return [this.buildTargetKey('product_base', option.baseOptionId)]
    }

    return [this.buildTargetKey('variation_added', option.id)]
  }

  private applyResolvedOverrides(args: {
    groups: EffectiveModifierGroup[]
    groupOverrides: Array<{ override: GroupOverrideDoc; targetKey: string }>
    optionOverrides: Array<{ override: OptionOverrideDoc; targetKey: string }>
    overrideSource: Extract<
      ModifierSource,
      'variation-overridden' | 'merchant-product-overridden' | 'merchant-variation-overridden'
    >
  }): EffectiveModifierGroup[] {
    const groupOverrideMap = new Map<string, GroupOverrideDoc>()
    for (const entry of args.groupOverrides) {
      groupOverrideMap.set(entry.targetKey, entry.override)
    }

    const optionOverrideMap = new Map<string, OptionOverrideDoc>()
    for (const entry of args.optionOverrides) {
      optionOverrideMap.set(entry.targetKey, entry.override)
    }

    return args.groups
      .map((group) => {
        const override = this.getGroupTargetKeys(group)
          .map((key) => groupOverrideMap.get(key))
          .find((candidate) => candidate !== undefined)

        if (override?.is_active === false || override?.mode === 'hide') {
          return null
        }

        const isOverrideMode = override?.mode === 'override'

        const resolvedIsRequired = isOverrideMode
          ? override?.required_behavior === 'required'
            ? true
            : override?.required_behavior === 'optional'
              ? false
              : group.isRequired
          : group.isRequired

        const resolvedMinSelections = isOverrideMode
          ? toNullableNumber(override?.min_selections_override) ?? group.minSelections
          : group.minSelections

        return {
          ...group,
          name: isOverrideMode ? toOptionalTrimmedText(override?.name_override) ?? group.name : group.name,
          selectionType: isOverrideMode
            ? (override?.selection_type_override ?? group.selectionType)
            : group.selectionType,
          isRequired: resolvedIsRequired,
          minSelections: resolvedIsRequired ? resolvedMinSelections : 0,
          maxSelections: isOverrideMode
            ? toNullableNumber(override?.max_selections_override) ?? group.maxSelections
            : group.maxSelections,
          sortOrder: isOverrideMode
            ? toNullableNumber(override?.sort_order_override) ?? group.sortOrder
            : group.sortOrder,
          source: isOverrideMode ? args.overrideSource : group.source,
          options: group.options
            .map((option) => {
              const optionOverride = this.getOptionTargetKeys(option)
                .map((key) => optionOverrideMap.get(key))
                .find((candidate) => candidate !== undefined)

              if (optionOverride?.is_active === false || optionOverride?.mode === 'hide') {
                return null
              }

              const optionIsOverrideMode = optionOverride?.mode === 'override'

              return {
                ...option,
                name: optionIsOverrideMode
                  ? toOptionalTrimmedText(optionOverride?.name_override) ?? option.name
                  : option.name,
                priceAdjustment: optionIsOverrideMode
                  ? toNullableNumber(optionOverride?.price_adjustment_override) ?? option.priceAdjustment
                  : option.priceAdjustment,
                isDefault: optionIsOverrideMode
                  ? optionOverride?.default_behavior === 'default'
                    ? true
                    : optionOverride?.default_behavior === 'not_default'
                      ? false
                      : option.isDefault
                  : option.isDefault,
                isAvailable: optionIsOverrideMode
                  ? optionOverride?.availability_behavior === 'available'
                    ? true
                    : optionOverride?.availability_behavior === 'unavailable'
                      ? false
                      : option.isAvailable
                  : option.isAvailable,
                sortOrder: optionIsOverrideMode
                  ? toNullableNumber(optionOverride?.sort_order_override) ?? option.sortOrder
                  : option.sortOrder,
                source: optionIsOverrideMode ? args.overrideSource : option.source,
              } satisfies EffectiveModifierOption
            })
            .filter((option): option is EffectiveModifierOption => option !== null)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
        } satisfies EffectiveModifierGroup
      })
      .filter((group): group is EffectiveModifierGroup => group !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  }

  private async hydrateGroups(args: {
    groups: BaseGroupDoc[]
    optionCollection:
      | 'modifier-options'
      | 'variation-modifier-options'
    optionGroupField:
      | 'modifier_group_id'
      | 'variation_modifier_group_id'
    source: ModifierSource
  }): Promise<EffectiveModifierGroup[]> {
    const groupIds = args.groups
      .map((group) => extractRelationshipId(group.id))
      .filter((id): id is number => id !== null)

    const optionLookup = new Map<number, EffectiveModifierOption[]>()

    if (groupIds.length > 0) {
      const optionsResult = await this.payload.find({
        collection: args.optionCollection,
        where: {
          and: [
            { [args.optionGroupField]: { in: groupIds } },
            { is_available: { not_equals: false } },
          ],
        },
        limit: 1000,
        sort: 'sort_order',
        depth: 0,
      })

      for (const rawOption of optionsResult.docs as unknown as HydratedOptionDoc[]) {
        const optionId = relationshipId(rawOption.id)
        const groupId = relationshipId(rawOption[args.optionGroupField])

        if (!optionId || !groupId) {
          continue
        }

        const entry: EffectiveModifierOption = {
          id: optionId,
          name: toOptionalTrimmedText(rawOption.name) ?? `Option ${optionId}`,
          priceAdjustment: toFiniteNumber(rawOption.price_adjustment),
          isDefault: Boolean(rawOption.is_default),
          isAvailable: rawOption.is_available !== false,
          sortOrder: toFiniteNumber(rawOption.sort_order),
          source: args.source,
          baseOptionId: args.source === 'product-base' ? optionId : undefined,
        }

        const current = optionLookup.get(groupId) ?? []
        current.push(entry)
        optionLookup.set(groupId, current)
      }
    }

    const hydratedGroups: Array<EffectiveModifierGroup | null> = args.groups.map((group) => {
        const groupId = extractRelationshipId(group.id)
        if (!groupId) {
          return null
        }

        const isRequired = Boolean(group.is_required)
        const minSelections = isRequired ? toFiniteNumber(group.min_selections) : 0
        const maxSelections = toNullableNumber(group.max_selections)

        return {
          id: groupId,
          name: toOptionalTrimmedText(group.name) ?? `Group ${groupId}`,
          selectionType: (group.selection_type ?? 'single') as SelectionType,
          isRequired,
          minSelections,
          maxSelections,
          sortOrder: toFiniteNumber(group.sort_order),
          source: args.source,
          baseGroupId: args.source === 'product-base' ? groupId : undefined,
          options: (optionLookup.get(groupId) ?? []).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
        } satisfies EffectiveModifierGroup
      })

    return hydratedGroups.filter((group): group is EffectiveModifierGroup => group !== null)
  }
}
