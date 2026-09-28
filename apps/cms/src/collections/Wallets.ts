import type { CollectionConfig } from 'payload'

export const Wallets: CollectionConfig = {
  slug: 'wallets',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['customer', 'balance', 'currency', 'status'],
    group: 'Ordering System',
    description: 'Stored-value customer wallet (ShopeePay / Lazada Wallet / pandapay parity)',
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
    { fields: ['customer'], unique: true },
    { fields: ['status'] },
  ],
  fields: [
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      unique: true,
      admin: {
        description: 'Owning customer (one wallet per customer)',
      },
    },
    {
      name: 'balance',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Current stored balance in PHP (gateway-agnostic ledger)',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'PHP',
      admin: {
        description: 'Default PHP',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Frozen', value: 'frozen' },
        { label: 'Closed', value: 'closed' },
      ],
      admin: {
        description: 'Frozen blocks debits; closed blocks all movement',
      },
    },
    {
      name: 'total_topped_up',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Lifetime top-up credits (ops counter)',
      },
    },
    {
      name: 'total_spent',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Lifetime wallet payments (ops counter)',
      },
    },
    {
      name: 'total_cashback',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Lifetime cashback/coins credited (ops counter)',
      },
    },
    {
      name: 'total_refunded',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Lifetime refunds credited back to wallet (ops counter)',
      },
    },
    {
      name: 'points_balance',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Loyalty points balance (integer; separate currency from PHP)',
      },
    },
    {
      name: 'points_earned',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Lifetime loyalty points earned (ops counter)',
      },
    },
    {
      name: 'points_redeemed',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: {
        description: 'Lifetime loyalty points burned on rewards (ops counter)',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || typeof data !== 'object') return data
        const balance = Number((data as any).balance ?? 0)
        if (!Number.isFinite(balance) || balance < 0) {
          throw new Error('Wallet balance cannot be negative')
        }
        const points = Number((data as any).points_balance ?? 0)
        if (!Number.isFinite(points) || points < 0) {
          throw new Error('Points balance cannot be negative')
        }
        return data
      },
    ],
  },
}
