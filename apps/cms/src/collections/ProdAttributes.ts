import { CollectionConfig } from 'payload'

export const ProdAttributes: CollectionConfig = {
  slug: 'prod-attributes',
  labels: {
    singular: 'Product Attribute',
    plural: 'Product Attributes',
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'type', 'is_active'],
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
      label: 'Attribute Name',
      admin: {
        description: 'e.g., Size, Color, Flavor',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      maxLength: 100,
      unique: true,
      label: 'Slug',
      admin: {
        description: 'URL-friendly version of the name',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'select',
      options: [
        { label: 'Select', value: 'select' },
        { label: 'Color', value: 'color' },
        { label: 'Button', value: 'button' },
        { label: 'Radio', value: 'radio' },
      ],
      label: 'Attribute Type',
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
      label: 'Is Active',
    },
  ],
  timestamps: true,
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data) throw new Error('Data is required')
        const rec = data as Record<string, unknown>
        const sRaw = rec['slug'] as string | undefined
        const nRaw = rec['name'] as string | undefined
        const s = String(sRaw ?? '')
        const n = String(nRaw ?? '')
        const base = n
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/[\s-]+/g, '-')
        if (!s || s.trim().length === 0) {
          ;(rec['slug'] as unknown) = base
        }
        return data
      },
    ],
  },
}
