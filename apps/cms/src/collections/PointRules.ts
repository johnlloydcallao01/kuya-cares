import type { CollectionConfig } from 'payload'

export const PointRules: CollectionConfig = {
  slug: 'point-rules',
  admin: {
    useAsTitle: 'event',
    defaultColumns: ['event', 'points', 'rate_per_peso', 'is_active'],
    group: 'Marketing',
    description: 'Loyalty earn rules (1pt/₱10 orders, review bonus, ...)',
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
  indexes: [{ fields: ['event', 'is_active'] }],
  fields: [
    {
      name: 'event',
      type: 'select',
      required: true,
      options: [
        { label: 'Order Delivered', value: 'order_delivered' },
        { label: 'Review Written', value: 'review' },
        { label: 'First Order', value: 'first_order' },
      ],
      admin: {
        description: 'Business event that earns points',
      },
    },
    {
      name: 'points',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Fixed points per event (0 = use rate_per_peso)',
      },
    },
    {
      name: 'rate_per_peso',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Points per ₱1 of order total, e.g. 0.1 = 1pt/₱10',
      },
    },
    {
      name: 'min_order_total',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Minimum order total in PHP to earn (0 = none)',
      },
    },
    {
      name: 'cap_points',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Max points per event (0 = uncapped)',
      },
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
