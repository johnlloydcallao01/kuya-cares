import type { CollectionConfig, Where } from 'payload'
import { extractRelationshipId } from '../services/modifierUtils'
import {
  resolveMerchantProductProductId,
  resolveProductModifierGroupIds,
  resolveVariationDoc,
  resolveVariationModifierGroupIds,
} from '../services/merchantModifierOverrideUtils'
import { modifierConfigurationAccess } from '../access/modifierAccess'

export const MerchantVariationModifierOptionOverrides: CollectionConfig = {
  slug: 'merchant-variation-modifier-option-overrides',
  labels: {
    singular: 'Merchant Variation Modifier Option Override',
    plural: 'Merchant Variation Modifier Option Overrides',
  },
  admin: {
    useAsTitle: 'variation_id',
    defaultColumns: ['merchant_product_id', 'variation_id', 'target_option_source', 'mode', 'availability_behavior', 'is_active'],
    group: 'Product Management',
    description:
      'Merchant-level overrides for one selected variation option. Target inherited product options or variation-owned options after the variation behavior mode is resolved.',
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
        description: 'Choose the merchant product that owns this merchant-specific variation option override.',
      },
    },
    {
      name: 'variation_id',
      type: 'relationship',
      relationTo: 'prod-variations',
      required: true,
      label: 'Variation',
      filterOptions: async ({ data, req }): Promise<boolean | Where> => {
        const productId = await resolveMerchantProductProductId(req, data?.merchant_product_id)
        if (!productId) {
          return false
        }

        const where: Where = {
          product_id: {
            equals: productId,
          },
        }
        return where
      },
      admin: {
        description: 'Only variations from the merchant product catalog item are allowed.',
      },
    },
    {
      name: 'target_option_source',
      type: 'select',
      enumName: 'enum_merchant_variation_modifier_option_target_source',
      required: true,
      defaultValue: 'product_base',
      label: 'Target Option Source',
      options: [
        { label: 'Product Base', value: 'product_base' },
        { label: 'Variation Added', value: 'variation_added' },
      ],
      admin: {
        description: 'Product Base targets inherited product options. Variation Added targets options owned directly by the selected variation.',
      },
    },
    {
      name: 'base_modifier_option_id',
      type: 'relationship',
      relationTo: 'modifier-options',
      label: 'Base Product Modifier Option',
      admin: {
        condition: (_, siblingData) => siblingData?.target_option_source === 'product_base',
        description: 'Use this when overriding a product-level option that the variation inherits.',
      },
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
    },
    {
      name: 'variation_modifier_option_id',
      type: 'relationship',
      relationTo: 'variation-modifier-options',
      label: 'Variation Modifier Option',
      admin: {
        condition: (_, siblingData) => siblingData?.target_option_source === 'variation_added',
        description: 'Use this when overriding an option that belongs directly to the selected variation.',
      },
      filterOptions: async ({ data, req }): Promise<boolean | Where> => {
        const variationId = extractRelationshipId(data?.variation_id as never)
        if (!variationId) {
          return false
        }

        const groupIds = await resolveVariationModifierGroupIds(req, variationId)
        if (groupIds.length === 0) {
          const where: Where = {
            id: {
              equals: -1,
            },
          }
          return where
        }

        const where: Where = {
          variation_modifier_group_id: {
            in: groupIds,
          },
        }
        return where
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
      fields: ['merchant_product_id', 'variation_id', 'base_modifier_option_id'],
      unique: true,
    },
    {
      fields: ['merchant_product_id', 'variation_id', 'variation_modifier_option_id'],
      unique: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data?.merchant_product_id || !data?.variation_id || !data?.target_option_source) {
          return data
        }

        const productId = await resolveMerchantProductProductId(req, data.merchant_product_id)
        const variation = await resolveVariationDoc(req, data.variation_id)
        const variationId = extractRelationshipId(variation?.id as never)
        const variationProductId = extractRelationshipId(variation?.product_id as never)

        if (!productId || !variationId || !variationProductId) {
          return data
        }

        if (variationProductId !== productId) {
          throw new Error('The selected variation does not belong to the selected merchant product catalog item')
        }

        if (data.target_option_source === 'product_base') {
          const baseOptionId = extractRelationshipId(data.base_modifier_option_id as never)
          if (!baseOptionId) {
            throw new Error('A base product modifier option is required when the target source is Product Base')
          }

          if (data.variation_modifier_option_id) {
            data.variation_modifier_option_id = null
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
        }

        const variationOptionId = extractRelationshipId(data.variation_modifier_option_id as never)
        if (!variationOptionId) {
          throw new Error('A variation modifier option is required when the target source is Variation Added')
        }

        if (data.base_modifier_option_id) {
          data.base_modifier_option_id = null
        }

        const variationOption = await req.payload.findByID({
          collection: 'variation-modifier-options',
          id: variationOptionId,
          depth: 0,
        })

        const groupId = extractRelationshipId(variationOption?.variation_modifier_group_id as never)
        if (!groupId) {
          throw new Error('The selected variation modifier option is missing its parent variation modifier group')
        }

        const validVariationGroupIds = await resolveVariationModifierGroupIds(req, variationId)
        if (!validVariationGroupIds.includes(groupId)) {
          throw new Error('The selected variation modifier option does not belong to the selected variation')
        }

        return data
      },
    ],
  },
  timestamps: true,
}
