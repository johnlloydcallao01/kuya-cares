import type { CollectionConfig } from 'payload'

export const CouponClaims: CollectionConfig = {
  slug: 'coupon-claims',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['coupon', 'customer', 'status', 'claimed_at'],
    group: 'Marketing',
    description: 'Customer voucher wallet — 1-tap claims before checkout (never burns usage)',
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
    { fields: ['coupon', 'customer'], unique: true },
    { fields: ['customer', 'status'] },
    { fields: ['coupon'] },
    { fields: ['status'] },
  ],
  fields: [
    {
      name: 'coupon',
      type: 'relationship',
      relationTo: 'coupons',
      required: true,
      admin: {
        description: 'Claimed coupon',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      admin: {
        description: 'Claiming customer (one claim per coupon)',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'claimed',
      options: [
        { label: 'Claimed', value: 'claimed' },
        { label: 'Used', value: 'used' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        description: 'claimed = saved; used = paid redemption finalized; expiry is computed, not stored',
      },
    },
    {
      name: 'claimed_at',
      type: 'date',
      admin: {
        description: 'When the customer claimed the voucher',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || typeof data !== 'object') return data
        if ((data as any).claimed_at === undefined && (data as any).status !== 'cancelled') {
          ;(data as any).claimed_at = new Date().toISOString()
        }
        return data
      },
    ],
  },
}
