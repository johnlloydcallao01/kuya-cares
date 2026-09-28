import type { CollectionConfig } from 'payload'

export const UserAchievements: CollectionConfig = {
  slug: 'user-achievements',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['user', 'achievement', 'progress', 'completed', 'claimed'],
    group: 'Marketing',
    description: 'Per-user challenge progress (auto-tracked, points on claim)',
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
  timestamps: true,
  indexes: [
    { fields: ['user', 'achievement'], unique: true },
    { fields: ['user'] },
    { fields: ['achievement'] },
  ],
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Progress owner (users id, not customers)',
      },
    },
    {
      name: 'achievement',
      type: 'relationship',
      relationTo: 'achievements',
      required: true,
    },
    {
      name: 'progress',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'target',
      type: 'number',
      required: true,
      min: 1,
      admin: {
        description: 'Snapshot of the goal at completion time',
      },
    },
    {
      name: 'completed',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'claimed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Points granted (one-shot, idempotent)',
      },
    },
    {
      name: 'completed_at',
      type: 'date',
    },
  ],
}
