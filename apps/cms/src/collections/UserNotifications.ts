import type { CollectionConfig } from 'payload'

export const UserNotifications: CollectionConfig = {
  slug: 'user-notifications',
  admin: {
    useAsTitle: 'notificationEvent',
    defaultColumns: ['user', 'notificationEvent', 'status', 'channel'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'service' || user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    create: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      if (user?.role === 'service' || user?.role === 'admin') return true
      return { user: { equals: user?.id || '' } }
    },
    delete: ({ req: { user } }) => {
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'notificationEvent',
      type: 'relationship',
      relationTo: 'notification-events',
      required: true,
    },
    {
      name: 'channel',
      type: 'select',
      required: true,
      defaultValue: 'in_app',
      options: [
        {
          label: 'In App',
          value: 'in_app',
        },
        {
          label: 'Email',
          value: 'email',
        },
        {
          label: 'Push',
          value: 'push',
        },
        {
          label: 'SMS',
          value: 'sms',
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'unread',
      options: [
        {
          label: 'Unread',
          value: 'unread',
        },
        {
          label: 'Read',
          value: 'read',
        },
        {
          label: 'Dismissed',
          value: 'dismissed',
        },
        {
          label: 'Hidden',
          value: 'hidden',
        },
      ],
    },
    {
      name: 'deliveredAt',
      type: 'date',
    },
    {
      name: 'seenAt',
      type: 'date',
      admin: {
        description: 'When the user opened/visited their notifications (clears the bell badge, notifications stay unread)',
      },
    },
    {
      name: 'readAt',
      type: 'date',
    },
    {
      name: 'archivedAt',
      type: 'date',
    },
    {
      name: 'isPinned',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}

