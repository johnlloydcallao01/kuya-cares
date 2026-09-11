import type { CollectionConfig, Where } from 'payload'
import { extractRelationshipId } from '../services/modifierUtils'
import {
  resolveMerchantProductProductId,
  resolveProductModifierGroupIds,
} from '../services/merchantModifierOverrideUtils'
import { modifierConfigurationAccess } from '../access/modifierAccess'

export const MerchantProductModifierOptionOverrides: CollectionConfig = {
  slug: 'merchant-product-modifier-option-overrides',
  labels: {
    singular: 'Merchant Product Modifier Option Override',
    plural: 'Merchant Product Modifier Option Overrides',
  },
  admin: {
    useAsTitle: 'base_modifier_option_id',
    defaultColumns: ['merchant_product_id', 'base_modifier_option_id', 'mode', 'availability_behavior', 'is_active'],
    group: 'Product Management',
    description:
      'Merchant-level overrides for inherited product modifier options. Use these when one merchant needs different option names, pricing, or availability.',
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
        description: 'Choose the merchant product that should override the base product modifier option.',
      },
    },
    {
      name: 'base_modifier_option_id',
      type: 'relationship',
      relationTo: 'modifier-options',
      required: true,
      label: 'Base Product Modifier Option',
      filterOptions: async ({ data, req }): Promise<boolean | Where> => {
        const productId = await resolveMerchantProductProductId(req, data?.merchant_product_id)
        if (!productId) {
          return false
        }

        const groupIds = await resolveProductModifierGroupIds(req, productId)
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
        description: 'Only options from product-level modifier groups of the merchant product catalog item are allowed.',
      },
    },
    {
      name: 'mode',
      type: 'select',
      enumName: 'enum_merchant_modifier_option_override_mode',
      required: true,
      defaultValue: 'inherit',
      options: [
        { label: 'Inherit', value: 'inherit' },
        { label: 'Hide', value: 'hide' },
        { label: 'Override', value: 'override' },
      ],
      label: 'Mode',
      admin: {
        description: 'Inherit keeps the base option, Hide removes it, Override changes pricing, naming, availability, or default status for this merchant.',
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
      enumName: 'enum_merchant_modifier_option_default_behavior',
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
      enumName: 'enum_merchant_modifier_option_availability_behavior',
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
      fields: ['merchant_product_id', 'base_modifier_option_id'],
      unique: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data?.merchant_product_id || !data?.base_modifier_option_id) {
          return data
        }

        const productId = await resolveMerchantProductProductId(req, data.merchant_product_id)
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
          throw new Error('The selected base modifier option does not belong to the selected merchant product catalog item')
        }

        return data
      },
    ],
  },
  timestamps: true,
}
