import type { CollectionConfig } from 'payload'
import {
  createAdminNotificationFanout,
} from '../utils/notificationFanout'

const isServiceOrAdmin = (user: { role?: string } | null | undefined) =>
  user?.role === 'service' || user?.role === 'admin'

async function vendorIdForVendorUser(payload: any, userId: string): Promise<string | null> {
  const res = await payload.find({
    collection: 'vendors',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs?.[0]?.id ? String(res.docs[0].id) : null
}

function invoiceNumber(): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, '0')
  return `INV-${new Date().getFullYear()}-${rand}`
}

export const SubscriptionInvoices: CollectionConfig = {
  slug: 'subscription-invoices',
  admin: {
    useAsTitle: 'invoice_number',
    defaultColumns: ['invoice_number', 'vendor', 'subscription', 'amount', 'status'],
    group: 'Membership',
    description: 'Per-cycle membership invoice + provider ref + idempotency',
  },
  access: {
    read: async ({ req: { user, payload } }) => {
      if (isServiceOrAdmin(user)) return true
      if (user?.role === 'vendor' && user?.id) {
        const vendorId = await vendorIdForVendorUser(payload, String(user.id))
        if (!vendorId) return false
        return { vendor: { equals: vendorId } }
      }
      return false
    },
    create: ({ req: { user } }) => isServiceOrAdmin(user),
    update: ({ req: { user } }) => isServiceOrAdmin(user),
    delete: ({ req: { user } }) => isServiceOrAdmin(user),
  },
  fields: [
    { name: 'subscription', type: 'relationship', relationTo: 'vendor-subscriptions', required: true },
    { name: 'vendor', type: 'relationship', relationTo: 'vendors', required: true },
    { name: 'plan', type: 'relationship', relationTo: 'membership-plans', required: true },
    { name: 'invoice_number', type: 'text', required: true, unique: true },
    { name: 'amount', type: 'number', required: true, min: 0 },
    { name: 'currency', type: 'text', defaultValue: 'PHP' },
    { name: 'commission_due', type: 'number', defaultValue: 0 },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Failed', value: 'failed' },
        { label: 'Past Due', value: 'past_due' },
        { label: 'Void', value: 'void' },
        { label: 'Refunded', value: 'refunded' },
      ],
    },
    {
      name: 'billingReason',
      type: 'select',
      options: [
        { label: 'Initial', value: 'initial' },
        { label: 'Upgrade', value: 'upgrade' },
        { label: 'Downgrade', value: 'downgrade' },
        { label: 'Renewal', value: 'renewal' },
        { label: 'Proration', value: 'proration' },
        { label: 'Manual', value: 'manual' },
      ],
    },
    { name: 'prorationDelta', type: 'number', defaultValue: 0 },
    { name: 'discount_amount', type: 'number', defaultValue: 0 },
    { name: 'couponCode', type: 'text' },
    {
      name: 'payment_provider',
      type: 'select',
      options: [
        { label: 'PayMongo', value: 'paymongo' },
        { label: 'Stripe', value: 'stripe' },
        { label: 'Manual', value: 'manual' },
      ],
    },
    { name: 'provider_payment_intent', type: 'text', index: true },
    { name: 'payment_link_url', type: 'text' },
    { name: 'period_start', type: 'date' },
    { name: 'period_end', type: 'date' },
    { name: 'due_at', type: 'date', required: true },
    { name: 'paid_at', type: 'date' },
    { name: 'receipt', type: 'upload', relationTo: 'media' },
    { name: 'retry_count', type: 'number', defaultValue: 0 },
    { name: 'failure_reason', type: 'textarea' },
    { name: 'idempotencyKey', type: 'text', required: true, unique: true },
    { name: 'metadata', type: 'json' },
  ],
  indexes: [
    { fields: ['invoice_number'], unique: true },
    { fields: ['vendor', 'status'] },
    { fields: ['subscription', 'status'] },
    { fields: ['provider_payment_intent'] },
    { fields: ['idempotencyKey'], unique: true },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        if (!data) return data
        if (!data.invoice_number) data.invoice_number = invoiceNumber()
        if (data.status === 'paid' && !data.paid_at) data.paid_at = new Date().toISOString()
        const prevStatus = (originalDoc as Record<string, unknown> | undefined)?.status
        if (data.status === 'failed' && prevStatus !== 'failed') {
          data.retry_count = Number(data.retry_count ?? 0) + 1
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        try {
          const prevStatus = (previousDoc as Record<string, unknown> | undefined)?.status
          if (
            (operation === 'create' || prevStatus !== doc.status) &&
            (doc.status === 'paid' || doc.status === 'failed')
          ) {
            const vendorId =
              typeof doc.vendor === 'object' && doc.vendor !== null
                ? String((doc.vendor as { id: string | number }).id)
                : String(doc.vendor)
            await createAdminNotificationFanout(req.payload, {
              typeKey: `membership.invoice.${doc.status}`,
              domain: 'system',
              title: `Membership invoice ${doc.status}`,
              body: `Invoice ${doc.invoice_number} is ${doc.status}.`,
              sourceEntityType: 'subscription-invoice',
              sourceEntityId: doc.id,
              priority: doc.status === 'failed' ? 'critical' : 'info',
              metadata: {
                invoiceId: doc.id,
                subscriptionId: doc.subscription,
                vendorId,
                status: doc.status,
                amount: doc.amount,
              },
            })
            await req.payload.create({
              collection: 'membership-audit-log',
              data: {
                vendor: doc.vendor,
                subscription: doc.subscription,
                invoice: doc.id,
                action: doc.status === 'paid' ? 'webhook_paid' : 'webhook_failed',
                reason: `invoice ${doc.invoice_number} ${doc.status}`,
              },
              overrideAccess: true,
            })
          }
        } catch (err) {
          req.payload.logger.error(`subscription-invoices afterChange failed: ${String(err)}`)
        }
        return doc
      },
    ],
  },
}
