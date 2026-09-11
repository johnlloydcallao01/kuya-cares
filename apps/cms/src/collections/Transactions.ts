import type { CollectionConfig } from 'payload'
import { createAdminNotificationFanout, createMerchantNotificationFanout } from '../utils/notificationFanout'

export const Transactions: CollectionConfig = {
  slug: 'transactions',
  admin: {
    useAsTitle: 'payment_intent_id',
    defaultColumns: ['order', 'payment_intent_id', 'amount', 'status', 'paid_at'],
    group: 'Ordering System',
    description: 'Records the financial exchange',
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
      name: 'payment_intent_id',
      type: 'text',
      admin: {
        description: 'External ID (e.g., PayMongo pi_...)',
      },
    },
    {
      name: 'payment_method',
      type: 'text',
      admin: {
        description: 'e.g., card, gcash, grab_pay',
      },
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: {
        description: 'Amount charged',
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
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Refunded', value: 'refunded' },
      ],
      required: true,
      defaultValue: 'pending',
    },
    {
      name: 'paid_at',
      type: 'date',
      admin: {
        description: 'Timestamp of successful payment',
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'create' || (operation === 'update' && previousDoc?.status !== doc.status)) {
          const status = doc.status || 'pending'
          const orderId = typeof doc.order === 'object' ? doc.order.id : doc.order
          await createAdminNotificationFanout(req.payload, {
            typeKey: `payment.${status}`,
            domain: 'order',
            title: `Payment ${status}`,
            body: `A payment for order #${orderId} is ${status}.`,
            sourceEntityType: 'transaction',
            sourceEntityId: doc.id,
            priority: status === 'failed' ? 'critical' : status === 'refunded' ? 'warning' : 'info',
            metadata: { transactionId: doc.id, orderId: doc.order, status, amount: doc.amount, currency: doc.currency },
          })
          const order = await req.payload.findByID({
            collection: 'orders',
            id: orderId,
            depth: 0,
            overrideAccess: true,
          })
          const merchantId = typeof order.merchant === 'object' ? order.merchant.id : order.merchant
          await createMerchantNotificationFanout(req.payload, merchantId, {
            typeKey: `payment.${status}`,
            domain: 'order',
            title: `Payment ${status}`,
            body: `A payment for order #${orderId} is ${status}.`,
            sourceEntityType: 'transaction',
            sourceEntityId: doc.id,
            priority: status === 'failed' ? 'critical' : status === 'refunded' ? 'warning' : 'info',
            metadata: { transactionId: doc.id, orderId, status, amount: doc.amount, currency: doc.currency },
          })
        }
        return doc
      },
    ],
  },
}
