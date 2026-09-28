import type { CollectionConfig } from 'payload'

export const Rewards: CollectionConfig = {
  slug: 'rewards',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'points_cost', 'category', 'stock', 'is_active'],
    group: 'Marketing',
    description: 'Loyalty rewards catalog — burned with points, optionally issues a voucher',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) {
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
      }
      return false
    },
    create: ({ req: { user } }) => {
      return user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      return user?.role === 'admin' || false
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'admin' || false
    },
  },
  timestamps: true,
  indexes: [{ fields: ['is_active', 'category'] }],
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Customer-facing reward name',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Customer-facing details',
      },
    },
    {
      name: 'points_cost',
      type: 'number',
      required: true,
      min: 1,
      admin: {
        description: 'Points burned on redeem (integer)',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      defaultValue: 'discount',
      options: [
        { label: 'Food', value: 'food' },
        { label: 'Delivery', value: 'delivery' },
        { label: 'Discount', value: 'discount' },
        { label: 'Exclusive', value: 'exclusive' },
      ],
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Reward artwork (optional)',
      },
    },
    {
      name: 'stock',
      type: 'number',
      min: 0,
      admin: {
        description: 'Remaining redemptions (empty = unlimited)',
      },
    },
    {
      name: 'terms',
      type: 'array',
      admin: {
        description: 'Customer-facing terms list',
      },
      fields: [{ name: 'term', type: 'text', required: true }],
    },
    {
      name: 'coupon',
      type: 'relationship',
      relationTo: 'coupons',
      admin: {
        description: 'Optional voucher auto-claimed into the wallet on redeem',
      },
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Browse order — higher first',
      },
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
