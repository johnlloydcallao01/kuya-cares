import type { CollectionConfig } from 'payload'

export const CouponRedemptions: CollectionConfig = {
  slug: 'coupon-redemptions',
  admin: {
    useAsTitle: 'code_snapshot',
    defaultColumns: ['coupon', 'order', 'customer', 'total_discount', 'status', 'createdAt'],
    group: 'Marketing',
    description: 'One row per coupon redemption (usage tracking + settlement audit).',
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
    { fields: ['coupon', 'order'], unique: true },
    { fields: ['coupon', 'customer'] },
    { fields: ['coupon', 'status'] },
    { fields: ['order'] },
    { fields: ['customer'] },
    { fields: ['held_until'] },
  ],
  fields: [
    {
      name: 'coupon',
      type: 'relationship',
      relationTo: 'coupons',
      required: true,
      admin: {
        description: 'Redeemed coupon',
      },
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      required: true,
      admin: {
        description: 'Order the coupon was applied to',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
    },
    {
      name: 'customer_email',
      type: 'text',
      admin: {
        description: 'Lowercased snapshot for guest matching',
      },
    },
    {
      name: 'customer_phone',
      type: 'text',
      admin: {
        description: 'Snapshot for guest matching',
      },
    },
    {
      name: 'code_snapshot',
      type: 'text',
      required: true,
      admin: {
        description: 'Coupon code at redeem time (history never rewrites)',
      },
    },
    {
      name: 'coupon_snapshot',
      type: 'json',
      admin: {
        description: 'Minimal coupon definition snapshot (WooCommerce coupon_info parity)',
      },
    },
    {
      name: 'food_discount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'delivery_discount',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
    },
    {
      name: 'total_discount',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'food_discount + delivery_discount',
      },
    },
    {
      name: 'funded_by',
      type: 'select',
      required: true,
      defaultValue: 'platform',
      options: [
        { label: 'Platform', value: 'platform' },
        { label: 'Vendor', value: 'vendor' },
        { label: 'Split', value: 'split' },
      ],
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
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Pesos absorbed by the platform',
      },
    },
    {
      name: 'vendor_share',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Pesos absorbed by the vendor (deducted from payout)',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'held',
      options: [
        { label: 'Held', value: 'held' },
        { label: 'Applied', value: 'applied' },
        { label: 'Refunded', value: 'refunded' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        description: 'held = checkout hold, applied = paid, refunded/cancelled = reversed',
      },
    },
    {
      name: 'held_until',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Tentative hold expiry (~15 min). Stale holds are ignored by validation.',
      },
    },
    {
      name: 'hold_key',
      type: 'text',
      admin: {
        description: 'Idempotency key for the hold',
      },
    },
  ],
}
