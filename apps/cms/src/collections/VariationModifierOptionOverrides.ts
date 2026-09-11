import type { CollectionConfig, Where } from 'payload'
import { extractRelationshipId } from '../services/modifierUtils'
import { modifierConfigurationAccess } from '../access/modifierAccess'

async function resolveVariationProductId(req: any, variationValue: unknown): Promise<number | null> {
  const variationId = extractRelationshipId(variationValue as never)
  if (!variationId) {
    return null
  }

  const variation = await req.payload.findByID({
    collection: 'prod-variations',
    id: variationId,
    depth: 0,
  })

  return extractRelationshipId(variation?.product_id as never)
}

export const VariationModifierOptionOverrides: CollectionConfig = {
  slug: 'variation-modifier-option-overrides',
  labels: {
    singular: 'Variation Modifier Option Override',
    plural: 'Variation Modifier Option Overrides',
  },
  admin: {
    useAsTitle: 'base_modifier_option_id',
    defaultColumns: ['variation_id', 'base_modifier_option_id', 'mode', 'availability_behavior', 'is_active'],
    group: 'Product Management',
    description: 'Hybrid rules for inherited product-level modifier options. Use these to hide or override base options for one variation.',
  },
  access: {
    read: modifierConfigurationAccess,
    create: modifierConfigurationAccess,
    update: modifierConfigurationAccess,
    delete: modifierConfigurationAccess,
  },
  fields: [
    {
      name: 'variation_id',
      type: 'relationship',
      relationTo: 'prod-variations',
      required: true,
      label: 'Variation',
      admin: {
        description: 'Choose the variation that will inherit, hide, or override a base product modifier option.',
      },
    },
    {
      name: 'base_modifier_option_id',
      type: 'relationship',
      relationTo: 'modifier-options',
      required: true,
      label: 'Base Product Modifier Option',
      filterOptions: async ({ data, req }): Promise<boolean | Where> => {
        const productId = await resolveVariationProductId(req, data?.variation_id)
        if (!productId) {
          return false
        }

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

        const groupIds = groups.docs
          .map((group: any) => extractRelationshipId(group?.id as never))
          .filter((id: number | null): id is number => id !== null)

        if (groupIds.length === 0) {
          const where: Where = {
            id: {
              equals: -1,
            },
          }
          return where
        }

        const where: Where = {
          modifier_group_id: {
            in: groupIds,
          },
        }
        return where
      },
      admin: {
        description: 'Only options from product-level modifier groups of the selected variation parent product are allowed.',
      },
    },
    {
      name: 'mode',
      type: 'select',
      required: true,
      defaultValue: 'inherit',
      options: [
        { label: 'Inherit', value: 'inherit' },
        { label: 'Hide', value: 'hide' },
        { label: 'Override', value: 'override' },
      ],
      label: 'Mode',
      admin: {
        description: 'Inherit keeps the base option, Hide removes it, Override changes inherited pricing or availability.',
      },
    },
    {
      name: 'name_override',
      type: 'text',
      label: 'Name Override',
    },
    {
      name: 'price_adjustment_override',
      type: 'number',
      label: 'Price Adjustment Override',
      admin: {
        step: 0.01,
      },
    },
    {
      name: 'default_behavior',
      type: 'select',
      defaultValue: 'inherit',
      options: [
        { label: 'Inherit', value: 'inherit' },
        { label: 'Default', value: 'default' },
        { label: 'Not Default', value: 'not_default' },
      ],
      label: 'Default Behavior',
    },
    {
      name: 'availability_behavior',
      type: 'select',
      defaultValue: 'inherit',
      options: [
        { label: 'Inherit', value: 'inherit' },
        { label: 'Available', value: 'available' },
        { label: 'Unavailable', value: 'unavailable' },
      ],
      label: 'Availability Behavior',
    },
    {
      name: 'sort_order_override',
      type: 'number',
      label: 'Sort Order Override',
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Is Active',
    },
  ],
  indexes: [
    {
      fields: ['variation_id', 'base_modifier_option_id'],
      unique: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data?.variation_id || !data?.base_modifier_option_id) {
          return data
        }

        const productId = await resolveVariationProductId(req, data.variation_id)
        const baseOptionId = extractRelationshipId(data.base_modifier_option_id as never)

        if (!productId || !baseOptionId) {
          return data
        }

        const baseOption = await req.payload.findByID({
          collection: 'modifier-options',
          id: baseOptionId,
          depth: 0,
        })

        const baseGroupId = extractRelationshipId(baseOption?.modifier_group_id as never)
        if (!baseGroupId) {
          throw new Error('The selected base modifier option is missing its parent modifier group')
        }

        const baseGroup = await req.payload.findByID({
          collection: 'modifier-groups',
          id: baseGroupId,
          depth: 0,
        })

        const groupProductId = extractRelationshipId(baseGroup?.product_id as never)
        if (!groupProductId || groupProductId !== productId) {
          throw new Error('The selected base modifier option does not belong to the selected variation parent product')
        }

        return data
      },
    ],
  },
  timestamps: true,
}
