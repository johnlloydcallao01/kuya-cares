import type { CollectionConfig } from 'payload'

const isServiceOrAdmin = (user: { role?: string } | null | undefined) =>
  user?.role === 'service' || user?.role === 'admin'

export const MembershipAuditLog: CollectionConfig = {
  slug: 'membership-audit-log',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['vendor', 'action', 'createdAt'],
    group: 'Membership',
    description: 'Immutable membership audit log (no update/delete)',
  },
  access: {
    read: ({ req: { user } }) => isServiceOrAdmin(user),
    create: ({ req: { user } }) => isServiceOrAdmin(user),
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'vendor', type: 'relationship', relationTo: 'vendors' },
    { name: 'subscription', type: 'relationship', relationTo: 'vendor-subscriptions' },
    { name: 'invoice', type: 'relationship', relationTo: 'subscription-invoices' },
    {
      name: 'action',
      type: 'select',
      options: [
        { label: 'Grant', value: 'grant' },
        { label: 'Deny', value: 'deny' },
        { label: 'Upgrade', value: 'upgrade' },
        { label: 'Downgrade', value: 'downgrade' },
        { label: 'Renew', value: 'renew' },
        { label: 'Cancel', value: 'cancel' },
        { label: 'Grace', value: 'grace' },
        { label: 'Override', value: 'override' },
        { label: 'Entitlement Check', value: 'entitlement_check' },
        { label: 'Sync', value: 'sync' },
        { label: 'Vendor Registered', value: 'vendor_registered' },
        { label: 'Admin Approve', value: 'admin_approve' },
        { label: 'Admin Waive', value: 'admin_waive' },
        { label: 'Webhook Paid', value: 'webhook_paid' },
        { label: 'Webhook Failed', value: 'webhook_failed' },
      ],
    },
    { name: 'plan_version', type: 'number' },
    { name: 'previous_plan', type: 'relationship', relationTo: 'membership-plans' },
    { name: 'next_plan', type: 'relationship', relationTo: 'membership-plans' },
    { name: 'reason', type: 'textarea' },
    { name: 'actor', type: 'relationship', relationTo: 'users' },
    { name: 'metadata', type: 'json' },
    { name: 'eventId', type: 'text', unique: true, index: true },
  ],
  indexes: [
    { fields: ['vendor', 'createdAt'] },
    { fields: ['subscription'] },
    { fields: ['eventId'], unique: true },
  ],
}
