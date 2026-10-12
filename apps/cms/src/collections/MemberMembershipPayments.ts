import type { CollectionConfig } from 'payload'

const isServiceOrAdmin = (user: { role?: string } | null | undefined) =>
  user?.role === 'service' || user?.role === 'admin'

export const MemberMembershipPayments: CollectionConfig = {
  slug: 'member-membership-payments',
  dbName: 'member_membership_payments',
  admin: {
    useAsTitle: 'paymentReference',
    defaultColumns: ['user', 'amount', 'status', 'paidAt', 'createdAt'],
    group: 'Members',
    description: 'One-time lifetime membership fee payments for unified marketplace members',
  },
  access: {
    read: ({ req: { user } }) => {
      if (isServiceOrAdmin(user)) return true
      if (user?.role !== 'member' || user.id == null) return false
      return { user: { equals: user.id } }
    },
    create: ({ req: { user } }) => isServiceOrAdmin(user),
    update: ({ req: { user } }) => isServiceOrAdmin(user),
    delete: ({ req: { user } }) => isServiceOrAdmin(user),
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 1,
      admin: { description: 'Fixed one-time membership fee in PHP' },
    },
    { name: 'currency', type: 'text', required: true, defaultValue: 'PHP' },
    {
      name: 'status',
      type: 'text',
      required: true,
      defaultValue: 'pending',
      admin: { readOnly: true },
    },
    {
      name: 'paymentProvider',
      type: 'text',
      required: true,
      defaultValue: 'paymongo',
      admin: { readOnly: true },
    },
    {
      name: 'paymentReference',
      type: 'text',
      required: true,
      unique: true,
      admin: { readOnly: true },
    },
    {
      name: 'providerReference',
      type: 'text',
      unique: true,
      admin: { readOnly: true },
    },
    { name: 'providerClientKey', type: 'text', admin: { readOnly: true } },
    { name: 'paymentLinkId', type: 'text', admin: { readOnly: true } },
    { name: 'checkoutUrl', type: 'text', admin: { readOnly: true } },
    {
      name: 'memberMembershipIdempotencyKey',
      type: 'text',
      required: true,
      unique: true,
      admin: { readOnly: true },
    },
    { name: 'paidAt', type: 'date', admin: { readOnly: true } },
    { name: 'failureReason', type: 'textarea', admin: { readOnly: true } },
  ],
  indexes: [
    { fields: ['user', 'status'] },
  ],
  timestamps: true,
}
