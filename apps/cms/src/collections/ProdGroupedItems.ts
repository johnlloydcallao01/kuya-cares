import { CollectionConfig } from 'payload'

export const ProdGroupedItems: CollectionConfig = {
  slug: 'prod-grouped-items',
  labels: {
    singular: 'Product Grouped Item',
    plural: 'Product Grouped Items',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['parent_product_id', 'child_product_id', 'default_quantity'],
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
      name: 'parent_product_id',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      label: 'Parent Product',
      admin: {
        description: 'The grouped product',
      },
    },
    {
      name: 'child_product_id',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      label: 'Child Product',
      admin: {
        description: 'Individual product in the group',
      },
    },
    {
      name: 'default_quantity',
      type: 'number',
      defaultValue: 1,
      label: 'Default Quantity',
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