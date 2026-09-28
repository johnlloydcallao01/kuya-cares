import type { CollectionConfig } from 'payload'

export const Devices: CollectionConfig = {
  slug: 'devices',
  admin: {
    useAsTitle: 'pushToken',
    defaultColumns: ['user', 'platform', 'createdAt'],
    group: 'User Management',
    description: 'Push-notification device tokens per user (FCM/Expo)',
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
      if (!user) return false
      if (user.role === 'service' || user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
  },
  timestamps: true,
  indexes: [{ fields: ['pushToken'], unique: true }, { fields: ['user'] }],
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Owning user',
      },
    },
    {
      name: 'pushToken',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'FCM/Expo push token (one row per token)',
      },
    },
    {
      name: 'platform',
      type: 'select',
      required: true,
      defaultValue: 'android',
      options: [
        { label: 'iOS', value: 'ios' },
        { label: 'Android', value: 'android' },
        { label: 'Web', value: 'web' },
      ],
    },
    {
      name: 'appVersion',
      type: 'text',
      admin: {
        description: 'App version that registered the token',
      },
    },
  ],
}
