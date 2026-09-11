import type { CollectionConfig } from 'payload'

export const OrderTracking: CollectionConfig = {
  slug: 'order-tracking',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['order', 'status', 'timestamp', 'actor'],
    group: 'Ordering System',
    description: 'Audit trail for status changes',
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
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Preparing', value: 'preparing' },
        { label: 'Ready for Pickup', value: 'ready_for_pickup' },
        { label: 'On Delivery', value: 'on_delivery' },
        { label: 'Delivered', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        description: 'The status moved TO',
      },
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      defaultValue: () => new Date().toISOString(),
      admin: {
        description: 'When the change happened',
      },
    },
    {
      name: 'actor',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'Who triggered it? (Driver, Merchant Staff, System)',
      },
    },
    {
      name: 'description',
      type: 'text',
      admin: {
        description: 'e.g., "Kitchen marked order as ready"',
      },
    },
  ],
}
