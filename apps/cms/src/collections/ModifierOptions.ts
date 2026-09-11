import { CollectionConfig } from 'payload'
import { modifierConfigurationAccess } from '../access/modifierAccess'

export const ModifierOptions: CollectionConfig = {
  slug: 'modifier-options',
  labels: {
    singular: 'Modifier Option',
    plural: 'Modifier Options',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'modifier_group_id', 'price_adjustment', 'is_available'],
    group: 'Product Management',
  },
  access: {
    read: modifierConfigurationAccess,
    create: modifierConfigurationAccess,
    update: modifierConfigurationAccess,
    delete: modifierConfigurationAccess,
  },
  fields: [
    {
      name: 'modifier_group_id',
      type: 'relationship',
      relationTo: 'modifier-groups',
      required: true,
      label: 'Modifier Group',
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: 'Option Name',
    },
    {
      name: 'price_adjustment',
      type: 'number',
      defaultValue: 0.00,
      label: 'Price Adjustment',
      admin: {
        step: 0.01,
        description: 'Additional cost for this option',
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
  timestamps: true,
}