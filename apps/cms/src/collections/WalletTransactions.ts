import type { CollectionConfig } from 'payload'
import { createAdminNotificationFanout } from '../utils/notificationFanout'

function resolveId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && value !== null && 'id' in (value as any)) {
    return String((value as any).id)
  }
  return null
}

export const WalletTransactions: CollectionConfig = {
  slug: 'wallet-transactions',
  admin: {
    useAsTitle: 'idempotency_key',
    defaultColumns: ['wallet', 'customer', 'type', 'amount', 'balance_after', 'status'],
    group: 'Ordering System',
    description: 'Immutable wallet ledger — one row per debit/credit (gateway-agnostic)',
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
    { fields: ['idempotency_key'], unique: true },
    { fields: ['wallet'] },
    { fields: ['customer'] },
    { fields: ['customer', 'type'] },
    { fields: ['order'] },
    { fields: ['status'] },
    { fields: ['expires_at'] },
  ],
  fields: [
    {
      name: 'wallet',
      type: 'relationship',
      relationTo: 'wallets',
      required: true,
      admin: {
        description: 'Wallet debited/credited',
      },
    },
    {
      name: 'customer',
      type: 'relationship',
      relationTo: 'customers',
      required: true,
      admin: {
        description: 'Owning customer (denormalized for query without join)',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Top-up', value: 'topup' },
        { label: 'Payment', value: 'payment' },
        { label: 'Refund', value: 'refund' },
        { label: 'Cashback', value: 'cashback' },
        { label: 'Withdrawal', value: 'withdrawal' },
        { label: 'Adjustment', value: 'adjustment' },
        { label: 'Expiry', value: 'expiry' },
      ],
      admin: {
        description: 'Ledger entry kind (gateway-agnostic)',
      },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: {
        description: 'Signed amount in PHP (+ credit, - debit)',
      },
    },
    {
      name: 'balance_after',
      type: 'number',
      required: true,
      min: 0,
      admin: {
        description: 'Wallet balance immediately after posting (audit)',
      },
    },
    {
      name: 'order',
      type: 'relationship',
      relationTo: 'orders',
      admin: {
        description: 'Linked order for payment/refund/cashback entries',
      },
    },
    {
      name: 'payment_intent_id',
      type: 'text',
      admin: {
        description: 'External gateway intent (e.g., PayMongo pi_...) for top-ups',
      },
    },
    {
      name: 'gateway',
      type: 'text',
      defaultValue: 'paymongo',
      admin: {
        description: 'Gateway rail used (paymongo|xendit|manual|...) — ledger stays agnostic',
      },
    },
    {
      name: 'idempotency_key',
      type: 'text',
      required: true,
      admin: {
        description: 'Unique key per business operation — retries return existing row',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'posted',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Posted', value: 'posted' },
        { label: 'Failed', value: 'failed' },
        { label: 'Reversed', value: 'reversed' },
      ],
      admin: {
        description: 'posted = final; pending = awaiting gateway webhook',
      },
    },
    {
      name: 'expires_at',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Cashback/coins expiry — swept by cron into type=expiry entries',
      },
    },
    {
      name: 'meta',
      type: 'json',
      admin: {
        description: 'Gateway-agnostic metadata (provider raw ids, reason, actor)',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || typeof data !== 'object') return data
        const amount = Number((data as any).amount)
        if (!Number.isFinite(amount) || amount === 0) {
          throw new Error('Wallet transaction amount must be a non-zero number')
        }
        if (!((data as any).idempotency_key && String((data as any).idempotency_key).trim())) {
          throw new Error('idempotency_key is required')
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        try {
          if (operation === 'create') {
            const customerId = resolveId((doc as any).customer)
            await createAdminNotificationFanout(req.payload, {
              typeKey: `wallet.${(doc as any).type || 'adjustment'}`,
              domain: 'order',
              title: `Wallet ${(doc as any).type || 'update'}`,
              body: `Wallet entry ${(doc as any).amount} PHP posted (customer #${customerId}).`,
              sourceEntityType: 'wallet-transaction',
              sourceEntityId: doc.id,
              priority: 'info',
              metadata: {
                walletTransactionId: doc.id,
                walletId: resolveId((doc as any).wallet),
                customerId,
                type: (doc as any).type,
                amount: (doc as any).amount,
              },
            })
          }
        } catch (error) {
          console.error('[wallet-transactions] afterChange notification error:', error)
        }
        return doc
      },
    ],
  },
}
