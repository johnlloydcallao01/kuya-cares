import type { CollectionConfig } from 'payload'

const isAdmin = (user: { role?: string } | null | undefined) => user?.role === 'admin'

export const VendorWithdrawalRequests: CollectionConfig = {
  slug: 'vendor-withdrawal-requests',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['vendor', 'amount', 'status', 'requested_at', 'paid_at'],
    group: 'Finance',
    description: 'Vendor payout requests and their audited lifecycle.',
  },
  access: {
    read: ({ req: { user } }) => isAdmin(user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'vendor', type: 'relationship', relationTo: 'vendors', required: true, index: true },
    { name: 'amount', type: 'number', required: true, min: 1 },
    { name: 'currency', type: 'text', required: true, defaultValue: 'PHP' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Paid', value: 'paid' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      index: true,
    },
    { name: 'payout_destination', type: 'text', required: true },
    { name: 'payment_reference', type: 'text' },
    { name: 'reason', type: 'textarea' },
    { name: 'idempotency_key', type: 'text' },
    { name: 'requested_by', type: 'relationship', relationTo: 'users', required: true },
    { name: 'requested_at', type: 'date', required: true },
    { name: 'decided_by', type: 'relationship', relationTo: 'users' },
    { name: 'decided_at', type: 'date' },
    { name: 'paid_by', type: 'relationship', relationTo: 'users' },
    { name: 'paid_at', type: 'date' },
    { name: 'cancelled_by', type: 'relationship', relationTo: 'users' },
    { name: 'cancelled_at', type: 'date' },
  ],
  indexes: [
    { fields: ['vendor', 'createdAt'] },
    { fields: ['vendor', 'idempotency_key'], unique: true },
    { fields: ['status', 'createdAt'] },
  ],
}
