import type { CollectionConfig, Where } from 'payload'
import { extractRelationshipId } from '../services/modifierUtils'
import {
  resolveMerchantProductProductId,
  resolveVariationDoc,
  resolveVariationModifierGroupIds,
} from '../services/merchantModifierOverrideUtils'
import { modifierConfigurationAccess } from '../access/modifierAccess'

export const MerchantVariationModifierGroupOverrides: CollectionConfig = {
  slug: 'merchant-variation-modifier-group-overrides',
  labels: {
    singular: 'Merchant Variation Modifier Group Override',
    plural: 'Merchant Variation Modifier Group Overrides',
  },
  admin: {
    useAsTitle: 'variation_id',
    defaultColumns: ['merchant_product_id', 'variation_id', 'target_group_source', 'mode', 'is_active'],
    group: 'Product Management',
    description:
      'Merchant-level overrides for one selected variation. Target inherited product groups or variation-owned groups after the variation behavior mode is resolved.',
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
        description: 'Choose the merchant product that owns this merchant-specific variation override.',
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
      name: 'target_group_source',
      type: 'select',
      enumName: 'enum_merchant_variation_modifier_group_target_source',
      required: true,
      defaultValue: 'product_base',
      label: 'Target Group Source',
      options: [
        { label: 'Product Base', value: 'product_base' },
        { label: 'Variation Added', value: 'variation_added' },
      ],
      admin: {
        description: 'Product Base targets inherited product groups. Variation Added targets groups owned directly by the selected variation.',
      },
    },
    {
      name: 'base_modifier_group_id',
      type: 'relationship',
      relationTo: 'modifier-groups',
      label: 'Base Product Modifier Group',
      admin: {
        condition: (_, siblingData) => siblingData?.target_group_source === 'product_base',
        description: 'Use this when overriding a product-level group that the variation inherits.',
      },
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
    },
    {
      name: 'variation_modifier_group_id',
      type: 'relationship',
      relationTo: 'variation-modifier-groups',
      label: 'Variation Modifier Group',
      admin: {
        condition: (_, siblingData) => siblingData?.target_group_source === 'variation_added',
        description: 'Use this when overriding a group that belongs directly to the selected variation.',
      },
      filterOptions: async ({ data, req }): Promise<boolean | Where> => {
        const variationId = extractRelationshipId(data?.variation_id as never)
        if (!variationId) {
          return false
        }

        const where: Where = {
          and: [
            {
              variation_id: {
                equals: variationId,
              },
            },
            {
              is_active: {
                not_equals: false,
              },
            },
          ],
        }
        return where
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
      fields: ['merchant_product_id', 'variation_id', 'base_modifier_group_id'],
      unique: true,
    },
    {
      fields: ['merchant_product_id', 'variation_id', 'variation_modifier_group_id'],
      unique: true,
    },
  ],
  hooks: {
    beforeValidate: [
      async ({ data, req }) => {
        if (!data?.merchant_product_id || !data?.variation_id || !data?.target_group_source) {
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

        if (data.target_group_source === 'product_base') {
          const baseGroupId = extractRelationshipId(data.base_modifier_group_id as never)
          if (!baseGroupId) {
            throw new Error('A base product modifier group is required when the target source is Product Base')
          }

          if (data.variation_modifier_group_id) {
            data.variation_modifier_group_id = null
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
        }

        const variationGroupId = extractRelationshipId(data.variation_modifier_group_id as never)
        if (!variationGroupId) {
          throw new Error('A variation modifier group is required when the target source is Variation Added')
        }

        if (data.base_modifier_group_id) {
          data.base_modifier_group_id = null
        }

        const validVariationGroupIds = await resolveVariationModifierGroupIds(req, variationId)
        if (!validVariationGroupIds.includes(variationGroupId)) {
          throw new Error('The selected variation modifier group does not belong to the selected variation')
        }

        return data
      },
    ],
  },
  timestamps: true,
}
