import type { CollectionConfig } from 'payload'

export const SellerShippingZones: CollectionConfig = {
  slug: 'seller-shipping-zones',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'merchant', 'enabled', 'displayOrder', 'deliveryFee'],
    group: 'Food Delivery',
    description: 'Seller-managed delivery coverage and rates for each outlet.',
  },
  access: {
    read: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'service',
    create: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'service',
    update: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'service',
    delete: ({ req: { user } }) => user?.role === 'admin' || user?.role === 'service',
  },
  indexes: [
    { fields: ['merchant', 'displayOrder'] },
    { fields: ['merchant', 'zoneId'], unique: true },
  ],
  fields: [
    {
      name: 'merchant',
      type: 'relationship',
      relationTo: 'merchants',
      required: true,
      index: true,
    },
    {
      name: 'zoneId',
      type: 'text',
      required: true,
      maxLength: 64,
    },
    {
      name: 'name',
      type: 'text',
      defaultValue: '',
      maxLength: 100,
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      required: true,
    },
    {
      name: 'displayOrder',
      type: 'number',
      min: 0,
      required: true,
    },
    {
      name: 'areas',
      type: 'json',
      defaultValue: [],
      required: true,
    },
    {
      name: 'geometry',
      type: 'json',
    },
    {
      name: 'deliveryFee',
      type: 'number',
      min: 0,
      max: 100000,
      required: true,
    },
    {
      name: 'minimumOrderAmount',
      type: 'number',
      min: 0,
      max: 1000000,
      defaultValue: 0,
      required: true,
    },
    {
      name: 'freeDeliveryThreshold',
      type: 'number',
      min: 0,
      max: 1000000,
    },
    {
      name: 'estimatedDeliveryMinMinutes',
      type: 'number',
      min: 0,
      max: 10080,
      defaultValue: 0,
      required: true,
    },
    {
      name: 'estimatedDeliveryMaxMinutes',
      type: 'number',
      min: 0,
      max: 10080,
      defaultValue: 0,
      required: true,
    },
  ],
}
