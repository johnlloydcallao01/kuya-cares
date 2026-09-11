import type { CollectionConfig } from 'payload'

export const OrderDiscounts: CollectionConfig = {
  slug: 'order-discounts',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['order', 'code', 'amount_off', 'type'],
    group: 'Ordering System',
    description: 'Records which promo was used',
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
      name: 'code',
      type: 'text',
      required: true,
      admin: {
        description: 'The code used (e.g., WELCOME100)',
      },
    },
    {
      name: 'amount_off',
      type: 'number',
      required: true,
      admin: {
        description: 'Total value deducted',
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Percentage', value: 'percentage' },
        { label: 'Fixed', value: 'fixed' },
      ],
      required: true,
      admin: {
        description: 'percentage or fixed',
      },
    },
    {
      name: 'coupon',
      type: 'relationship',
      relationTo: 'coupons',
      admin: {
        description: 'Master coupon (null = legacy manual code)',
      },
    },
    {
      name: 'coupon_snapshot',
      type: 'json',
      admin: {
        description: 'Coupon definition at apply time (history never rewrites)',
      },
    },
    {
      name: 'food_discount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Pesos discounted on the food subtotal leg',
      },
    },
    {
      name: 'delivery_discount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Pesos discounted on the delivery fee leg',
      },
    },
    {
      name: 'funded_by',
      type: 'select',
      defaultValue: 'platform',
      options: [
        { label: 'Platform', value: 'platform' },
        { label: 'Vendor', value: 'vendor' },
        { label: 'Split', value: 'split' },
      ],
      admin: {
        description: 'Who pays for this discount at settlement',
      },
    },
    {
      name: 'vendor_share_pct',
      type: 'number',
      defaultValue: 0,
      min: 0,
      max: 100,
    },
    {
      name: 'platform_share',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Pesos absorbed by the platform',
      },
    },
    {
      name: 'vendor_share',
      type: 'number',
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Pesos absorbed by the vendor (deducted from payout)',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'coupon',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Coupon', value: 'coupon' },
        { label: 'Auto campaign', value: 'auto_campaign' },
      ],
    },
  ],
  indexes: [
    { fields: ['order', 'coupon'] },
    { fields: ['coupon'] },
  ],
}
