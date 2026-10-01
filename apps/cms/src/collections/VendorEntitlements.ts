import type { CollectionConfig } from 'payload'

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

export const VendorEntitlements: CollectionConfig = {
  slug: 'vendor-entitlements',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['vendor', 'plan', 'expires_at'],
    group: 'Membership',
    description: 'Materialized entitlement snapshot (one doc per vendor; gating reads this)',
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
    { name: 'vendor', type: 'relationship', relationTo: 'vendors', required: true, unique: true },
    { name: 'subscription', type: 'relationship', relationTo: 'vendor-subscriptions' },
    { name: 'plan', type: 'relationship', relationTo: 'membership-plans' },
    {
      name: 'capabilities',
      type: 'group',
      fields: [
        { name: 'microstore', type: 'checkbox', defaultValue: false },
        { name: 'ads', type: 'checkbox', defaultValue: false },
        { name: 'analytics', type: 'checkbox', defaultValue: false },
        { name: 'api_access', type: 'checkbox', defaultValue: false },
        { name: 'promos', type: 'checkbox', defaultValue: false },
        { name: 'custom_shipping', type: 'checkbox', defaultValue: false },
        { name: 'multi_user', type: 'checkbox', defaultValue: false },
        { name: 'visibility_boost', type: 'number', min: 0, max: 100, defaultValue: 0 },
        {
          name: 'support_sla',
          type: 'select',
          defaultValue: 'email',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Email', value: 'email' },
            { label: 'Priority', value: 'priority' },
            { label: 'Dedicated', value: 'dedicated' },
          ],
        },
      ],
    },
    { name: 'limits_snapshot', type: 'json' },
    { name: 'granted_at', type: 'date' },
    { name: 'expires_at', type: 'date' },
    { name: 'reason', type: 'text' },
  ],
  indexes: [{ fields: ['vendor'], unique: true }],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data) return data
        if (!data.granted_at) data.granted_at = new Date().toISOString()
        return data
      },
    ],
  },
}
