import { CollectionConfig } from 'payload'

export const ProdTags: CollectionConfig = {
  slug: 'prod-tags',
  labels: {
    singular: 'Product Tag',
    plural: 'Product Tags',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'tag_type', 'is_active', 'is_featured'],
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
      label: 'Tag Name',
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
        description: 'Hex color code for UI display (e.g., #FF5733)',
      },
    },
    {
      name: 'tag_type',
      type: 'select',
      defaultValue: 'general',
      options: [
        { label: 'General', value: 'general' },
        { label: 'Dietary', value: 'dietary' },
        { label: 'Cuisine', value: 'cuisine' },
        { label: 'Promotion', value: 'promotion' },
        { label: 'Feature', value: 'feature' },
        { label: 'Allergen', value: 'allergen' },
        { label: 'Spice Level', value: 'spice_level' },
        { label: 'Temperature', value: 'temperature' },
        { label: 'Size Category', value: 'size_category' },
      ],
      label: 'Tag Type',
    },
    {
      name: 'parent_tag_id',
      type: 'relationship',
      relationTo: 'prod-tags',
      label: 'Parent Tag',
      admin: {
        description: 'For nested tags',
      },
    },
    {
      name: 'usage_count',
      type: 'number',
      defaultValue: 0,
      label: 'Usage Count',
      admin: {
        description: 'Auto-updated via triggers',
        readOnly: true,
      },
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Is Active',
    },
    {
      name: 'is_featured',
      type: 'checkbox',
      defaultValue: false,
      label: 'Is Featured',
      admin: {
        description: 'For highlighting important tags',
      },
    },
  ],
  timestamps: true,
}