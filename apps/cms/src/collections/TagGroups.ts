import { CollectionConfig } from 'payload'

export const TagGroups: CollectionConfig = {
  slug: 'tag-groups',
  labels: {
    singular: 'Tag Group',
    plural: 'Tag Groups',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'is_filterable', 'is_searchable', 'is_active'],
    group: 'Product Management',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 100,
      label: 'Group Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      maxLength: 100,
      unique: true,
      label: 'Slug',
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Description',
    },
    {
      name: 'color',
      type: 'text',
      maxLength: 7,
      label: 'Color',
      admin: {
        description: 'Hex color for group display',
      },
    },
    {
      name: 'icon',
      type: 'text',
      maxLength: 50,
      label: 'Icon',
      admin: {
        description: 'Icon class or name',
      },
    },
    {
      name: 'is_filterable',
      type: 'checkbox',
      defaultValue: true,
      label: 'Is Filterable',
      admin: {
        description: 'Show in filter UI',
      },
    },
    {
      name: 'is_searchable',
      type: 'checkbox',
      defaultValue: true,
      label: 'Is Searchable',
      admin: {
        description: 'Include in search',
      },
    },
    {
      name: 'display_order',
      type: 'number',
      defaultValue: 0,
      label: 'Display Order',
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Is Active',
    },
  ],
  timestamps: true,
}