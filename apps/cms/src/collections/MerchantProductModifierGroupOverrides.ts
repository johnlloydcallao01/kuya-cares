import type { CollectionConfig } from 'payload'
import { extractRelationshipId } from '../services/modifierUtils'
import { resolveMerchantProductProductId } from '../services/merchantModifierOverrideUtils'
import { modifierConfigurationAccess } from '../access/modifierAccess'

export const MerchantProductModifierGroupOverrides: CollectionConfig = {
  slug: 'merchant-product-modifier-group-overrides',
  labels: {
    singular: 'Merchant Product Modifier Group Override',
    plural: 'Merchant Product Modifier Group Overrides',
  },
  admin: {
    useAsTitle: 'base_modifier_group_id',
    defaultColumns: ['merchant_product_id', 'base_modifier_group_id', 'mode', 'required_behavior', 'is_active'],
    group: 'Product Management',
    description:
      'Merchant-level overrides for inherited product modifier groups. Use these when one merchant needs different modifier rules for the same catalog product.',
  },
  access: {
    read: modifierConfigurationAccess,
    create: modifierConfigurationAccess,
    update: modifierConfigurationAccess,
    delete: modifierConfigurationAccess,
  },
  fields: [
    {
      name: 'merchant_product_id',
      type: 'relationship',
      relationTo: 'merchant-products',
      required: true,
      label: 'Merchant Product',
      admin: {
        description: 'Choose the merchant product that should override the base product modifier group.',
      },
    },
    {
      name: 'base_modifier_group_id',
      type: 'relationship',
      relationTo: 'modifier-groups',
      required: true,
      label: 'Base Product Modifier Group',
      filterOptions: async ({ data, req }) => {
        const productId = await resolveMerchantProductProductId(req, data?.merchant_product_id)
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
        description: 'Only product-level modifier groups from the merchant product catalog item are allowed.',
      },
    },
    {
      name: 'mode',
      type: 'select',
      enumName: 'enum_merchant_modifier_group_override_mode',
      required: true,
      defaultValue: 'inherit',
      options: [
        { label: 'Inherit', value: 'inherit' },
        { label: 'Hide', value: 'hide' },
        { label: 'Override', value: 'override' },
      ],
      label: 'Mode',
      admin: {
        description: 'Inherit keeps the base group, Hide removes it, Override changes how the group behaves for this merchant.',
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
      enumName: 'enum_merchant_modifier_selection_type',
      options: [
        { label: 'Single', value: 'single' },
        { label: 'Multiple', value: 'multiple' },
      ],
      label: 'Selection Type Override',
    },
    {
      name: 'required_behavior',
      type: 'select',
      enumName: 'enum_merchant_modifier_group_required_behavior',
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
      fields: ['merchant_product_id', 'base_modifier_group_id'],
      unique: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data?.merchant_product_id || !data?.base_modifier_group_id) {
          return data
        }

        const productId = await resolveMerchantProductProductId(req, data.merchant_product_id)
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
          throw new Error('The selected base modifier group does not belong to the selected merchant product catalog item')
        }

        return data
      },
    ],
  },
  timestamps: true,
}
