import type { CollectionConfig } from 'payload'
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

export const VariationModifierGroupOverrides: CollectionConfig = {
  slug: 'variation-modifier-group-overrides',
  labels: {
    singular: 'Variation Modifier Group Override',
    plural: 'Variation Modifier Group Overrides',
  },
  admin: {
    useAsTitle: 'base_modifier_group_id',
    defaultColumns: ['variation_id', 'base_modifier_group_id', 'mode', 'required_behavior', 'is_active'],
    group: 'Product Management',
    description: 'Hybrid rules for inherited product-level modifier groups. Use these to hide or override base product groups for one variation.',
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
        description: 'Choose the variation that will inherit, hide, or override a base product modifier group.',
      },
    },
    {
      name: 'base_modifier_group_id',
      type: 'relationship',
      relationTo: 'modifier-groups',
      required: true,
      label: 'Base Product Modifier Group',
      filterOptions: async ({ data, req }) => {
        const productId = await resolveVariationProductId(req, data?.variation_id)
        if (!productId) {
          return false
        }

        return {
          product_id: {
            equals: productId,
          },
        }
      },
      admin: {
        description: 'Only product-level modifier groups from the selected variation parent product are allowed.',
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
        description: 'Inherit keeps the base group, Hide removes it, Override changes how the inherited group behaves.',
      },
    },
    {
      name: 'name_override',
      type: 'text',
      label: 'Name Override',
    },
    {
      name: 'selection_type_override',
      type: 'select',
      options: [
        { label: 'Single', value: 'single' },
        { label: 'Multiple', value: 'multiple' },
      ],
      label: 'Selection Type Override',
    },
    {
      name: 'required_behavior',
      type: 'select',
      defaultValue: 'inherit',
      options: [
        { label: 'Inherit', value: 'inherit' },
        { label: 'Required', value: 'required' },
        { label: 'Optional', value: 'optional' },
      ],
      label: 'Required Behavior',
    },
    {
      name: 'min_selections_override',
      type: 'number',
      label: 'Minimum Selections Override',
    },
    {
      name: 'max_selections_override',
      type: 'number',
      label: 'Maximum Selections Override',
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
      fields: ['variation_id', 'base_modifier_group_id'],
      unique: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data?.variation_id || !data?.base_modifier_group_id) {
          return data
        }

        const productId = await resolveVariationProductId(req, data.variation_id)
        const baseGroupId = extractRelationshipId(data.base_modifier_group_id as never)

        if (!productId || !baseGroupId) {
          return data
        }

        const baseGroup = await req.payload.findByID({
          collection: 'modifier-groups',
          id: baseGroupId,
          depth: 0,
        })

        const groupProductId = extractRelationshipId(baseGroup?.product_id as never)
        if (!groupProductId || groupProductId !== productId) {
          throw new Error('The selected base modifier group does not belong to the selected variation parent product')
        }

        return data
      },
    ],
  },
  timestamps: true,
}
