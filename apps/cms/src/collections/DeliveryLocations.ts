import type { CollectionConfig } from 'payload'

export const DeliveryLocations: CollectionConfig = {
  slug: 'delivery-locations',
  admin: {
    useAsTitle: 'formatted_address',
    defaultColumns: ['order', 'formatted_address', 'contact_name', 'label'],
    group: 'Ordering System',
    description: 'Immutable snapshot of where the order must go',
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
      unique: true,
      admin: {
        description: 'One-to-one relationship with order',
      },
    },
    {
      name: 'formatted_address',
      type: 'textarea',
      required: true,
      admin: {
        description: 'SNAPSHOT: Full text address from Google Maps at time of order',
      },
    },
    {
      name: 'coordinates',
      type: 'json',
      admin: {
        description: 'SNAPSHOT: Lat/Lng for driver navigation',
      },
    },
    {
      name: 'street',
      type: 'text',
      admin: {
        description: 'SNAPSHOT: Street name at time of order',
      },
    },
    {
      name: 'floor_unit_room',
      type: 'text',
      admin: {
        description: 'SNAPSHOT: Floor, unit, or room number at time of order',
      },
    },
    {
      name: 'delivery_instructions',
      type: 'textarea',
      admin: {
        description: 'SNAPSHOT: Delivery instructions at time of order',
        rows: 3,
      },
    },
    {
      name: 'notes',
      type: 'text',
      admin: {
        description: 'Delivery instructions (e.g., "Gate code 1234")',
      },
    },
    {
      name: 'contact_name',
      type: 'text',
      admin: {
        description: 'Receivers name',
      },
    },
    {
      name: 'contact_phone',
      type: 'text',
      admin: {
        description: 'Receivers phone',
      },
    },
    {
      name: 'label',
      type: 'select',
      options: [
        { label: 'Home', value: 'home' },
        { label: 'Office', value: 'office' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'e.g., Home, Office',
      },
    },

    // === MERCHANT SNAPSHOT ===
    {
      name: 'merchant_formatted_address',
      type: 'textarea',
      admin: {
        description: 'SNAPSHOT: Merchant full-text address at time of order',
      },
    },
    {
      name: 'merchant_coordinates',
      type: 'json',
      admin: {
        description: 'SNAPSHOT: Merchant Lat/Lng at time of order',
      },
    },
    {
      name: 'merchant_street',
      type: 'text',
      admin: {
        description: 'SNAPSHOT: Merchant street name at time of order',
      },
    },
    {
      name: 'merchant_floor_unit_room',
      type: 'text',
      admin: {
        description: 'SNAPSHOT: Merchant floor, unit, or room number at time of order',
      },
    },
    {
      name: 'merchant_delivery_instructions',
      type: 'textarea',
      admin: {
        description: 'SNAPSHOT: Merchant delivery instructions at time of order',
        rows: 3,
      },
    },
    {
      name: 'merchant_label',
      type: 'text',
      admin: {
        description: 'SNAPSHOT: Merchant custom label at time of order',
      },
    },
  ],
}
