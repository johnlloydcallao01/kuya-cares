import type { CollectionConfig } from 'payload'

export const WalletTopups: CollectionConfig = {
  slug: 'wallet-topups',
  admin: {
    useAsTitle: 'payment_intent_id',
    defaultColumns: ['customer', 'wallet', 'amount', 'status', 'paid_at'],
    group: 'Ordering System',
    description: 'Top-up intents bridging any gateway (PayMongo today) to wallet credit',
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
    { fields: ['payment_intent_id'], unique: true },
    { fields: ['customer'] },
    { fields: ['wallet'] },
    { fields: ['status'] },
  ],
  fields: [
    {
      name: 'wallet',
      type: 'relationship',
      relationTo: 'wallets',
      required: true,
      admin: {
        description: 'Wallet to credit on payment success',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      admin: {
        description: 'Owning customer',
      },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 1,
      admin: {
        description: 'Top-up amount in PHP (min PHP 1.00)',
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
      name: 'gateway',
      type: 'text',
      defaultValue: 'paymongo',
      admin: {
        description: 'Gateway rail (paymongo|xendit|manual|...)',
      },
    },
    {
      name: 'payment_intent_id',
      type: 'text',
      admin: {
        description: 'External gateway intent id (e.g., PayMongo pi_...)',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'paid_at',
      type: 'date',
      admin: {
        description: 'Timestamp of successful gateway payment',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || typeof data !== 'object') return data
        const amount = Number((data as any).amount ?? 0)
        if (!Number.isFinite(amount) || amount < 1) {
          throw new Error('Top-up amount must be at least PHP 1.00')
        }
        return data
      },
    ],
  },
}
