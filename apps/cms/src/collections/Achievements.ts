import type { CollectionConfig } from 'payload'

export const Achievements: CollectionConfig = {
  slug: 'achievements',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'metric', 'target', 'points_reward', 'is_active'],
    group: 'Marketing',
    description: 'Loyalty challenges — progress auto-tracks, completion grants points',
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
  indexes: [{ fields: ['is_active'] }],
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'points_reward',
      type: 'number',
      required: true,
      min: 1,
      admin: {
        description: 'Points granted on completion (integer)',
      },
    },
    {
      name: 'metric',
      type: 'select',
      required: true,
      options: [
        { label: 'Delivered Orders', value: 'orders_count' },
        { label: 'Reviews Written', value: 'reviews_count' },
        { label: 'Lifetime Spend (PHP)', value: 'total_spent' },
      ],
      admin: {
        description: 'Counter that drives progress',
      },
    },
    {
      name: 'target',
      type: 'number',
      required: true,
      min: 1,
      admin: {
        description: 'Goal, e.g. 10 orders or ₱5000 spend',
      },
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'Icon key for the client (e.g. target, star, crown)',
      },
    },
    {
      name: 'is_active',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
