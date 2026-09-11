import { CollectionConfig } from 'payload'

export const ProdTagsJunction: CollectionConfig = {
  slug: 'prod-tags-junction',
  labels: {
    singular: 'Product Tag Junction',
    plural: 'Product Tag Junctions',
  },
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['product_id', 'tag_id', 'added_by_type', 'priority', 'is_active'],
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
      name: 'product_id',
      type: 'relationship',
      relationTo: 'products',
      required: true,
      label: 'Product',
    },
    {
      name: 'tag_id',
      type: 'relationship',
      relationTo: 'prod-tags',
      required: true,
      label: 'Tag',
    },
    {
      name: 'added_by_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Vendor', value: 'vendor' },
        { label: 'Merchant', value: 'merchant' },
        { label: 'System', value: 'system' },
      ],
      label: 'Added By Type',
    },
    {
      name: 'added_by_vendor_id',
      type: 'relationship',
      relationTo: 'vendors',
      label: 'Added By Vendor',
      admin: {
        condition: (data) => data.added_by_type === 'vendor',
      },
    },
    {
      name: 'added_by_merchant_id',
      type: 'relationship',
      relationTo: 'merchants',
      label: 'Added By Merchant',
      admin: {
        condition: (data) => data.added_by_type === 'merchant',
      },
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 0,
      label: 'Priority',
      admin: {
        description: 'Higher = more important',
      },
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