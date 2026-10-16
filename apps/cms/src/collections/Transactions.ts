import { APIError, type CollectionConfig } from 'payload'
import { createAdminNotificationFanout, createMerchantNotificationFanout } from '../utils/notificationFanout'
import {
  accruePaidOrderCommission,
  recordOrderCommissionRefund,
} from '../services/CommissionService'

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
      name: 'payment_id',
      type: 'text',
      index: true,
      admin: { readOnly: true, description: 'PayMongo payment resource ID used to match refund events.' },
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
        { label: 'Partially refunded', value: 'partially_refunded' },
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
    {
      name: 'refunded_amount',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: { readOnly: true, description: 'Cumulative successful refunds in the transaction currency.' },
    },
    {
      name: 'last_refund_id',
      type: 'text',
      admin: { readOnly: true, description: 'Most recently processed PayMongo refund ID.' },
    },
    {
      name: 'refund_event_amount',
      type: 'number',
      min: 0,
      admin: { readOnly: true, description: 'Amount of the most recently processed refund.' },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, req }) => {
        if (
          req.context?.paymongoWebhook !== true &&
          (
            data?.status === 'partially_refunded' ||
            data?.status === 'refunded' ||
            data?.payment_id !== undefined ||
            (Number(data?.refunded_amount) || 0) > 0 ||
            !!data?.last_refund_id ||
            (Number(data?.refund_event_amount) || 0) > 0
          )
        ) {
          throw new APIError('PayMongo payment and refund fields can only be set by a verified webhook.', 403)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const statusChanged = operation === 'create' || previousDoc?.status !== doc.status
        const refundChanged = !!doc.last_refund_id &&
          (operation === 'update' || previousDoc?.last_refund_id !== doc.last_refund_id)
        const orderId = typeof doc.order === 'object' ? doc.order.id : doc.order
        if (
          (statusChanged || operation === 'update') &&
          orderId != null &&
          ['paid', 'partially_refunded', 'refunded'].includes(String(doc.status))
        ) {
          await accruePaidOrderCommission(
            req.payload,
            orderId,
            doc.id,
            doc.paid_at ? new Date(doc.paid_at) : new Date(),
            req,
          )
        }
        if (refundChanged && orderId != null) {
          await recordOrderCommissionRefund(
            req.payload,
            orderId,
            doc.id,
            String(doc.last_refund_id),
            Number(doc.refund_event_amount) || 0,
            Number(doc.refunded_amount) || 0,
            Number(doc.amount) || 0,
            new Date(),
            req,
          )
        }

        if (operation === 'create' || (operation === 'update' && previousDoc?.status !== doc.status)) {
          const status = doc.status || 'pending'
          await createAdminNotificationFanout(req.payload, {
            typeKey: `payment.${status}`,
            domain: 'order',
            title: `Payment ${status}`,
            body: `A payment for order #${orderId} is ${status}.`,
            sourceEntityType: 'transaction',
            sourceEntityId: doc.id,
            priority: status === 'failed' ? 'critical' : status === 'refunded' || status === 'partially_refunded' ? 'warning' : 'info',
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
            priority: status === 'failed' ? 'critical' : status === 'refunded' || status === 'partially_refunded' ? 'warning' : 'info',
            metadata: { transactionId: doc.id, orderId, status, amount: doc.amount, currency: doc.currency },
          })
        }
        return doc
      },
    ],
  },
  indexes: [
    { fields: ['status', 'paid_at'] },
  ],
}
