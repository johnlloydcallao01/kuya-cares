import type { CollectionConfig } from 'payload'

export const NotificationPreferences: CollectionConfig = {
  slug: 'notification-preferences',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'marketingOptIn', 'updatedAt'],
    group: 'User Management',
    description: 'Per-user notification toggles (Amazon-grade settings support)',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'service' || user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'service' || user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'service' || user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  timestamps: true,
  indexes: [{ fields: ['user'], unique: true }],
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      admin: {
        description: 'Owning user (one preferences row per user)',
      },
    },
    {
      name: 'orderEmail',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Order updates via email' },
    },
    {
      name: 'orderPush',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Order updates via push' },
    },
    {
      name: 'orderSms',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Order updates via SMS' },
    },
    {
      name: 'promoEmail',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Promotions via email' },
    },
    {
      name: 'promoPush',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Promotions via push' },
    },
    {
      name: 'promoSms',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Promotions via SMS' },
    },
    {
      name: 'accountEmail',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Security/account emails (receipts, password changes)' },
    },
    {
      name: 'marketingOptIn',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Master marketing switch — fanout skips marketing when false' },
    },
  ],
}
