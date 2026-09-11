import type { CollectionConfig } from 'payload'
import { modifierConfigurationAccess } from '../access/modifierAccess'

export const VariationModifierOptions: CollectionConfig = {
  slug: 'variation-modifier-options',
  labels: {
    singular: 'Variation Modifier Option',
    plural: 'Variation Modifier Options',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'variation_modifier_group_id',
      'price_adjustment',
      'is_available',
      'is_default',
    ],
    group: 'Product Management',
    description: 'Variation-owned modifier options. These options belong only to a specific variation modifier group.',
  },
  access: {
    read: modifierConfigurationAccess,
    create: modifierConfigurationAccess,
    update: modifierConfigurationAccess,
    delete: modifierConfigurationAccess,
  },
  fields: [
    {
      name: 'variation_modifier_group_id',
      type: 'relationship',
      relationTo: 'variation-modifier-groups',
      required: true,
      label: 'Variation Modifier Group',
      admin: {
        description: 'Pick the variation-owned group that this option belongs to.',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: 'Option Name',
      admin: {
        description: 'Examples: Extra Cheese, Sweet Corn, Garlic Mayo.',
      },
    },
    {
      name: 'price_adjustment',
      type: 'number',
      defaultValue: 0,
      label: 'Price Adjustment',
      admin: {
        step: 0.01,
        description: 'Additional amount added when this option is selected.',
      },
    },
    {
      name: 'is_default',
      type: 'checkbox',
      defaultValue: false,
      label: 'Is Default',
    },
    {
      name: 'is_available',
      type: 'checkbox',
      defaultValue: true,
      label: 'Is Available',
    },
    {
      name: 'sort_order',
      type: 'number',
      defaultValue: 0,
      label: 'Sort Order',
    },
  ],
  indexes: [
    {
      fields: ['variation_modifier_group_id', 'sort_order'],
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) {
          return data
        }

        const priceAdjustment =
          typeof data.price_adjustment === 'number'
            ? data.price_adjustment
            : Number(data.price_adjustment ?? 0)

        if (!Number.isFinite(priceAdjustment)) {
          throw new Error('Price adjustment must be a valid number')
        }

        return data
      },
    ],
  },
  timestamps: true,
}
