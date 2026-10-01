import type { CollectionConfig } from 'payload'

const isServiceOrAdmin = (user: { role?: string } | null | undefined) =>
  user?.role === 'service' || user?.role === 'admin'

export const CommissionRules: CollectionConfig = {
  slug: 'commission-rules',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'scope', 'priority', 'commission_percent', 'is_active'],
    group: 'Membership',
    description: 'Vendor debit resolution (never mutates order total)',
  },
  access: {
    read: ({ req: { user } }) => {
      if (isServiceOrAdmin(user)) return true
      return false
    },
    create: ({ req: { user } }) => isServiceOrAdmin(user),
    update: ({ req: { user } }) => isServiceOrAdmin(user),
    delete: ({ req: { user } }) => isServiceOrAdmin(user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'scope',
      type: 'select',
      required: true,
      options: [
        { label: 'Global', value: 'global' },
        { label: 'Plan', value: 'plan' },
        { label: 'Category', value: 'category' },
        { label: 'Vendor', value: 'vendor' },
      ],
    },
    {
      name: 'priority',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'Higher wins (vendor 100 > category 50 > plan 10 > global 0)' },
    },
    {
      name: 'plan',
      type: 'relationship',
      relationTo: 'membership-plans',
      admin: { description: "Only when scope === 'plan'" },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'product-categories',
      admin: { description: "Only when scope === 'category'" },
    },
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'vendors',
      admin: { description: "Only when scope === 'vendor'" },
    },
    { name: 'commission_percent', type: 'number', required: true, min: 0, max: 100 },
    { name: 'transaction_fee', type: 'number', min: 0, defaultValue: 0 },
    { name: 'effective_from', type: 'date' },
    { name: 'effective_to', type: 'date' },
    { name: 'is_active', type: 'checkbox', defaultValue: true },
  ],
  indexes: [{ fields: ['scope', 'is_active'] }, { fields: ['priority'] }],
}
