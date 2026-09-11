import { CollectionConfig } from 'payload'
import { modifierConfigurationAccess } from '../access/modifierAccess'

export const ModifierGroups: CollectionConfig = {
  slug: 'modifier-groups',
  labels: {
    singular: 'Modifier Group',
    plural: 'Modifier Groups',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'product_id', 'selection_type', 'is_required'],
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
      name: 'product_id',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      label: 'Product',
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 255,
      label: 'Group Name',
      admin: {
        description: 'e.g., Size, Extras',
      },
    },
    {
      name: 'selection_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Single', value: 'single' },
        { label: 'Multiple', value: 'multiple' },
      ],
      label: 'Selection Type',
    },
    {
      name: 'is_required',
      type: 'checkbox',
      defaultValue: false,
      label: 'Is Required',
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
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) {
          return data
        }

        const isRequired = Boolean(data.is_required)
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
          min_selections: isRequired ? minSelections : 0,
        }
      },
    ],
  },
  timestamps: true,
}
