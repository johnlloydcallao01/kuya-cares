import type { CollectionConfig } from 'payload'

const isAdmin = (user: { role?: string } | null | undefined) =>
  user?.role === 'admin' || user?.role === 'service'

export const VendorCommissionEntries: CollectionConfig = {
  slug: 'vendor-commission-entries',
  admin: {
    useAsTitle: 'idempotency_key',
    defaultColumns: [
      'vendor',
      'order',
      'entry_type',
      'commission_amount',
      'commission_vendor_net',
      'effective_at',
    ],
    group: 'Finance',
    description: 'Immutable order commission and refund accounting ledger.',
  },
  access: {
    read: ({ req: { user } }) => isAdmin(user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'vendor', type: 'relationship', relationTo: 'vendors', required: true, index: true },
    { name: 'order', type: 'relationship', relationTo: 'orders', required: true, index: true },
    { name: 'transaction', type: 'relationship', relationTo: 'transactions', required: true },
    {
      name: 'entry_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Commission accrued', value: 'accrual' },
        { label: 'Refund reversal', value: 'reversal' },
      ],
    },
    { name: 'idempotency_key', type: 'text', required: true, unique: true },
    { name: 'provider_refund_id', type: 'text', index: true },
    { name: 'refund_amount', type: 'number', min: 0 },
    { name: 'currency', type: 'text', required: true, defaultValue: 'PHP' },
    { name: 'commission_percent', type: 'number', required: true, min: 0, max: 100 },
    {
      name: 'commission_base_amount',
      type: 'number',
      required: true,
      admin: { description: 'Signed seller merchandise base after vendor-funded discounts.' },
    },
    { name: 'commission_vendor_discount', type: 'number', required: true },
    { name: 'commission_amount', type: 'number', required: true, admin: { description: 'Signed platform commission.' } },
    { name: 'commission_transaction_fee', type: 'number', required: true },
    { name: 'commission_vendor_net', type: 'number', required: true, admin: { description: 'Signed amount payable to vendor.' } },
    {
      name: 'commission_source',
      type: 'select',
      required: true,
      options: [
        { label: 'Vendor', value: 'vendor' },
        { label: 'Category', value: 'category' },
        { label: 'Plan', value: 'plan' },
        { label: 'Global', value: 'global' },
      ],
    },
    { name: 'commission_rule', type: 'relationship', relationTo: 'commission-rules' },
    { name: 'effective_at', type: 'date', required: true },
  ],
  indexes: [
    { fields: ['vendor', 'effective_at'] },
    { fields: ['order', 'entry_type'] },
  ],
}
