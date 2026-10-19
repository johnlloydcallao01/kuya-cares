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
    description: 'Immutable commission accrual, refund reversal, and manually audited adjustment ledger.',
  },
  access: {
    read: ({ req: { user } }) => isAdmin(user),
    create: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    { name: 'vendor', type: 'relationship', relationTo: 'vendors', required: true, index: true },
    { name: 'order', type: 'relationship', relationTo: 'orders', index: true },
    { name: 'transaction', type: 'relationship', relationTo: 'transactions' },
    {
      name: 'entry_type',
      type: 'select',
      required: true,
      options: [
        { label: 'Commission accrued', value: 'accrual' },
        { label: 'Refund reversal', value: 'reversal' },
        { label: 'Manual adjustment', value: 'adjustment' },
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
      admin: { description: 'Signed merchandise base after all product discounts; excludes delivery and other non-product charges. Pre-discount commission rules retain their gross item basis in the product breakdown.' },
    },
    { name: 'commission_vendor_discount', type: 'number', required: true, admin: { description: 'Signed total vendor-funded discount amount, including delivery discount share.' } },
    { name: 'commission_amount', type: 'number', required: true, admin: { description: 'Signed platform commission.' } },
    { name: 'commission_transaction_fee', type: 'number', required: true, admin: { description: 'Signed fixed fee charged once per paid order.' } },
    { name: 'commission_vendor_net', type: 'number', required: true, admin: { description: 'Signed amount payable to vendor.' } },
    { name: 'seller_shipping_proceeds', type: 'number', required: true, defaultValue: 0, admin: { description: 'Signed seller-owned shipping proceeds; excluded from merchandise commission bases.' } },
    {
      name: 'commission_source',
      type: 'select',
      required: true,
      options: [
        { label: 'Product', value: 'product' },
        { label: 'Product Category', value: 'product_category' },
        { label: 'Vendor', value: 'vendor' },
        { label: 'Merchant Category', value: 'category' },
        { label: 'Plan', value: 'plan' },
        { label: 'Vendor Volume Tier', value: 'volume_tier' },
        { label: 'Global', value: 'global' },
      ],
    },
    { name: 'commission_rule', type: 'relationship', relationTo: 'commission-rules' },
    {
      name: 'commission_volume_tier_snapshot',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Payment-time rolling 30-day net sales and the selected volume tier.',
      },
    },
    {
      name: 'commission_product_breakdown',
      type: 'json',
      admin: {
        description: 'Per-product method/rate, discounted and pre-discount bases, product discount allocation, quantity, commission, fee, and volume-tier snapshot when rates differ.',
      },
    },
    { name: 'adjustment_reason', type: 'textarea', admin: { description: 'Required explanation for an immutable manual adjustment.' } },
    { name: 'adjustment_actor', type: 'relationship', relationTo: 'users', admin: { description: 'Administrator who posted the adjustment.' } },
    { name: 'effective_at', type: 'date', required: true },
  ],
  hooks: {
    beforeValidate: [
      ({ data, operation }) => {
        if (operation !== 'create' || !data) return data
        if (data.entry_type === 'adjustment') {
          if (typeof data.adjustment_reason !== 'string' || !data.adjustment_reason.trim()) {
            throw new Error('A reason is required for manual commission adjustments.')
          }
          if (!data.adjustment_actor) {
            throw new Error('The administrator posting a commission adjustment must be recorded.')
          }
          const deltas = [
            Number(data.commission_amount),
            Number(data.commission_transaction_fee),
            Number(data.commission_vendor_net),
          ]
          if (deltas.some((amount) => !Number.isFinite(amount)) || !deltas.some((amount) => amount !== 0)) {
            throw new Error('A manual adjustment must contain at least one valid non-zero financial amount.')
          }
        } else if (!data.order || !data.transaction) {
          throw new Error('Accrual and refund reversal entries must reference an order and transaction.')
        }
        return data
      },
    ],
  },
  indexes: [
    { fields: ['vendor', 'effective_at'] },
    { fields: ['order', 'entry_type'] },
  ],
}
