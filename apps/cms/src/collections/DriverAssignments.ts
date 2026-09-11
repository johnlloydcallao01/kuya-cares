import type { CollectionConfig } from 'payload'

export const DriverAssignments: CollectionConfig = {
  slug: 'driver-assignments',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['order', 'driver', 'status', 'assigned_at'],
    group: 'Ordering System',
    description: 'Manages the logistics of "Who is bringing this?"',
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
        description: 'Link to order',
      },
    },
    {
      name: 'driver',
      type: 'relationship',
      relationTo: 'drivers',
      required: true,
      admin: {
        description: 'The assigned driver',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Offered', value: 'offered' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Completed', value: 'completed' },
      ],
      defaultValue: 'offered',
    },
    {
      name: 'assigned_at',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        description: 'When the driver was pinged',
      },
    },
    {
      name: 'accepted_at',
      type: 'date',
      admin: {
        description: 'When the driver said "Yes"',
      },
    },
    {
      name: 'completed_at',
      type: 'date',
      admin: {
        description: 'When delivery finished',
      },
    },
  ],
}
