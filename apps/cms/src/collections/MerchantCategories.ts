import type { CollectionConfig } from 'payload'

export const MerchantCategories: CollectionConfig = {
  slug: 'merchant-categories',
  dbName: 'merchant_categories',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'isActive', 'isFeatured', 'displayOrder'],
    group: 'Food Delivery',
  },
  access: {
    read: ({ req: { user } }) => {
      if (user) {
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
      }
      return false
    },
    create: ({ req: { user } }) => user?.role === 'service' || user?.role === 'admin' || false,
    update: ({ req: { user } }) => user?.role === 'service' || user?.role === 'admin' || false,
    delete: ({ req: { user } }) => user?.role === 'service' || user?.role === 'admin' || false,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'displayOrder',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'media',
    },
  ],
  indexes: [
    { fields: ['slug'] },
    { fields: ['isActive', 'isFeatured'] },
    { fields: ['displayOrder'] },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data.slug && data.name) {
          data.slug = data.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        }
        return data
      },
    ],
  },
}

