import type { CollectionConfig } from 'payload'

export const PaymentMethods: CollectionConfig = {
  slug: 'payment-methods',
  admin: {
    useAsTitle: 'nickname',
    defaultColumns: ['user', 'brand', 'last4', 'isDefault'],
    group: 'User Management',
    description: 'Vaulted payment-method references (gateway tokens only — never PAN)',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'service' || user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'service' || user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'service' || user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'service' || user.role === 'admin') return true
      return { user: { equals: user.id } }
    },
  },
  timestamps: true,
  indexes: [{ fields: ['user', 'providerMethodId'], unique: true }, { fields: ['user'] }],
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Owning user',
      },
    },
    {
      name: 'provider',
      type: 'text',
      defaultValue: 'paymongo',
      admin: {
        description: 'Gateway that vaulted the method (paymongo|...)',
      },
    },
    {
      name: 'providerMethodId',
      type: 'text',
      required: true,
      admin: {
        description: 'Gateway method reference (e.g., PayMongo pm_...) — never a card number',
      },
    },
    {
      name: 'brand',
      type: 'text',
      admin: {
        description: 'Card brand or wallet name (visa, gcash, ...)',
      },
    },
    {
      name: 'last4',
      type: 'text',
      admin: {
        description: 'Last 4 digits (cards) or masked account suffix',
      },
    },
    {
      name: 'expMonth',
      type: 'number',
      min: 1,
      max: 12,
    },
    {
      name: 'expYear',
      type: 'number',
      min: 2000,
      max: 2100,
    },
    {
      name: 'nickname',
      type: 'text',
      admin: {
        description: 'User label, e.g. Personal Visa',
      },
    },
    {
      name: 'isDefault',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Default method at checkout (one per user, enforced server-side)',
      },
    },
  ],
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || typeof data !== 'object') return data
        const pmid = String((data as any).providerMethodId || '').trim()
        if (!pmid) throw new Error('providerMethodId is required')
        // Never allow a full card number to be stored.
        if (/^\d{13,19}$/.test(pmid.replace(/[\s-]/g, ''))) {
          throw new Error('Raw card numbers must never be stored — vault via gateway first')
        }
        return data
      },
    ],
  },
}
