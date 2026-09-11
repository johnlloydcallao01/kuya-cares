import type { CollectionConfig } from 'payload'
import { modifierConfigurationAccess } from '../access/modifierAccess'

export const VariationModifierGroups: CollectionConfig = {
  slug: 'variation-modifier-groups',
  labels: {
    singular: 'Variation Modifier Group',
    plural: 'Variation Modifier Groups',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'variation_id', 'selection_type', 'is_required', 'is_active'],
    group: 'Product Management',
    description: 'Variation-owned modifier groups. Use these when a specific variation needs its own required/optional choices.',
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
        description: 'Choose the specific variation that owns this modifier group.',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: 'Group Name',
      admin: {
        description: 'Examples: Large-only toppings, Combo side choice, Premium sauces.',
      },
    },
    {
      name: 'selection_type',
      type: 'select',
      required: true,
      defaultValue: 'single',
      options: [
        { label: 'Single', value: 'single' },
        { label: 'Multiple', value: 'multiple' },
      ],
      label: 'Selection Type',
      admin: {
        description: 'Single = radio-style, Multiple = checkbox-style.',
      },
    },
    {
      name: 'is_required',
      type: 'checkbox',
      defaultValue: false,
      label: 'Is Required',
      admin: {
        description: 'If enabled, the customer must satisfy the selection rule before checkout.',
      },
    },
    {
      name: 'min_selections',
      type: 'number',
      defaultValue: 0,
      label: 'Minimum Selections',
      admin: {
        description: 'Used only when the group is required. Optional groups are normalized to 0.',
      },
    },
    {
      name: 'max_selections',
      type: 'number',
      label: 'Maximum Selections',
      admin: {
        description: 'Leave empty for unlimited',
      },
    },
    {
      name: 'sort_order',
      type: 'number',
      defaultValue: 0,
      label: 'Sort Order',
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
      fields: ['variation_id', 'sort_order'],
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) {
          return data
        }

        const minSelections =
          typeof data.min_selections === 'number' ? data.min_selections : Number(data.min_selections ?? 0)
        const maxSelections =
          data.max_selections === null || data.max_selections === undefined || data.max_selections === ''
            ? null
            : typeof data.max_selections === 'number'
              ? data.max_selections
              : Number(data.max_selections)

        if (Number.isFinite(minSelections) && minSelections < 0) {
          throw new Error('Minimum selections cannot be negative')
        }

        if (maxSelections !== null) {
          if (!Number.isFinite(maxSelections) || maxSelections < 1) {
            throw new Error('Maximum selections must be at least 1 when provided')
          }

          if (Number.isFinite(minSelections) && maxSelections < minSelections) {
            throw new Error('Maximum selections cannot be lower than minimum selections')
          }
        }

        if (data.selection_type === 'single' && maxSelections !== null && maxSelections > 1) {
          throw new Error('Single-selection groups cannot allow more than 1 selection')
        }

        return {
          ...data,
          min_selections: data.is_required ? minSelections : 0,
        }
      },
    ],
  },
  timestamps: true,
}
