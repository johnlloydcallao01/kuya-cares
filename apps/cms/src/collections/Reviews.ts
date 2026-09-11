import type { CollectionConfig } from 'payload'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['order', 'customer', 'merchant', 'merchant_rating', 'is_public'],
    group: 'Ordering System',
    description: 'Post-order feedback',
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
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  fields: [
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      admin: {
        description: 'Verified purchase link',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      admin: {
        description: 'Reviewer',
      },
    },
    {
      name: 'merchant',
      type: 'relationship',
      relationTo: 'merchants',
      required: true,
      admin: {
        description: 'Reviewed entity',
      },
    },
    {
      name: 'driver',
      type: 'relationship',
      relationTo: 'drivers',
      admin: {
        description: 'Reviewed entity (optional)',
      },
    },
    {
      name: 'merchant_rating',
      type: 'number',
      min: 1,
      max: 5,
      required: true,
      admin: {
        description: '1-5 stars',
      },
    },
    {
      name: 'driver_rating',
      type: 'number',
      min: 1,
      max: 5,
      admin: {
        description: '1-5 stars',
      },
    },
    {
      name: 'comment',
      type: 'textarea',
      admin: {
        description: 'User feedback',
      },
    },
    {
      name: 'is_public',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Moderation flag',
      },
    },
  ],
}
