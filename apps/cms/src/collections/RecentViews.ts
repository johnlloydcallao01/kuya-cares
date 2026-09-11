import type { CollectionConfig } from 'payload'

export const RecentViews: CollectionConfig = {
  slug: 'recent-views',
  admin: {
    useAsTitle: 'compositeKey',
    defaultColumns: ['user', 'itemType', 'merchant', 'merchantProduct', 'viewCount', 'lastViewedAt'],
    group: 'History',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if ((user.role as string) === 'service' || (user.role as string) === 'admin') return true
      return { user: { equals: user.id } }
    },
    create: ({ req: { user } }) => {
      return !!user
    },
    update: ({ req: { user } }) => {
      if ((user?.role as string) === 'service' || (user?.role as string) === 'admin') return true
      return { user: { equals: user?.id || '' } }
    },
    delete: ({ req: { user } }) => {
      if ((user?.role as string) === 'service' || (user?.role as string) === 'admin') return true
      return { user: { equals: user?.id || '' } }
    },
  },
  timestamps: true,
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'deviceId',
      type: 'text',
    },
    {
      name: 'itemType',
      type: 'select',
      options: [
        { label: 'Merchant', value: 'merchant' },
        { label: 'Merchant Product', value: 'merchant_product' },
      ],
    },
    {
      name: 'merchant',
      type: 'relationship',
      relationTo: 'merchants',
    },
    {
      name: 'merchantProduct',
      type: 'relationship',
      relationTo: 'merchant-products',
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
    },
    {
      name: 'viewCount',
      type: 'number',
      required: true,
      defaultValue: 1,
    },
    {
      name: 'firstViewedAt',
      type: 'date',
    },
    {
      name: 'lastViewedAt',
      type: 'date',
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'unknown',
      options: [
        { label: 'Web', value: 'web' },
        { label: 'Mobile', value: 'mobile' },
        { label: 'Unknown', value: 'unknown' },
      ],
    },
    {
      name: 'addressText',
      type: 'text',
    },
    {
      name: 'referrer',
      type: 'text',
    },
    {
      name: 'meta',
      type: 'json',
    },
    {
      name: 'compositeKey',
      type: 'text',
      unique: true,
    },
  ],
  indexes: [
    { fields: ['user', 'lastViewedAt'] },
    { fields: ['user', 'itemType', 'lastViewedAt'] },
  ],
  hooks: {
    beforeValidate: [
      ({ data, req }) => {
        type MutableData = {
          user?: string | number | { id?: string | number }
          itemType?: string
          merchant?: string | number | { id?: string | number }
          merchantProduct?: string | number | { id?: string | number }
          compositeKey?: string
        }
        let base: unknown = data
        if (!base && req?.body) {
          base = req.body as unknown
        }
        if (typeof base === 'string') {
          try {
            base = JSON.parse(base) as unknown
          } catch {
            base = {}
          }
        }
        const d = (base || {}) as MutableData
        if (!d.user && req?.user?.id) {
          d.user = req.user.id as number
        }
        if (!d.itemType && d.merchant && !d.merchantProduct) {
          d.itemType = 'merchant'
        }
        let userId = ''
        const u = d.user
        if (typeof u === 'string' || typeof u === 'number') {
          userId = String(u)
        } else if (u && typeof (u as { id?: string | number }).id !== 'undefined') {
          userId = String((u as { id?: string | number }).id)
        }
        let merchantId = ''
        const m = d.merchant
        if (typeof m === 'string' || typeof m === 'number') {
          merchantId = String(m)
        } else if (m && typeof (m as { id?: string | number }).id !== 'undefined') {
          merchantId = String((m as { id?: string | number }).id)
        }
        let merchantProductId = ''
        const mp = d.merchantProduct
        if (typeof mp === 'string' || typeof mp === 'number') {
          merchantProductId = String(mp)
        } else if (mp && typeof (mp as { id?: string | number }).id !== 'undefined') {
          merchantProductId = String((mp as { id?: string | number }).id)
        }
        const itemType = typeof d.itemType === 'string' ? d.itemType : ''
        if (!userId || !itemType) return
        if (itemType === 'merchant') {
          if (!merchantId) return
          d.compositeKey = `${userId}:merchant:${merchantId}`
        } else if (itemType === 'merchant_product') {
          if (!merchantId || !merchantProductId) return
          d.compositeKey = `${userId}:merchant_product:${merchantId}:${merchantProductId}`
        }
        return d
      },
    ],
    beforeChange: [
      ({ data, operation, originalDoc }) => {
        if (!data) return
        type MutableData = {
          viewCount?: number
          firstViewedAt?: string | Date
          lastViewedAt?: string | Date
        }
        type Original = {
          viewCount?: number
          firstViewedAt?: string | Date
        }
        const d = data as MutableData
        const prev = (originalDoc as Original)?.viewCount ?? 0
        const now = new Date()
        if (operation === 'create') {
          if (typeof d.viewCount !== 'number' || d.viewCount <= 0) {
            d.viewCount = 1
          }
          if (!d.firstViewedAt) {
            d.firstViewedAt = now
          }
          if (!d.lastViewedAt) {
            d.lastViewedAt = now
          }
        }
        if (operation === 'update') {
          if (typeof d.viewCount !== 'number') {
            d.viewCount = prev + 1
          }
          d.lastViewedAt = now
          if (!(originalDoc as Original)?.firstViewedAt && !d.firstViewedAt) {
            d.firstViewedAt = now
          }
        }
      },
    ],
  },
}

