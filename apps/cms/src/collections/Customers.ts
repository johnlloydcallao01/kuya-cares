import type { CollectionConfig } from 'payload'
import { createAdminNotificationFanout } from '../utils/notificationFanout'

export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'user', 'enrollmentDate', 'currentLevel'],
  },
  hooks: {
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          await createAdminNotificationFanout(req.payload, {
            typeKey: 'customer.created',
            domain: 'account',
            title: 'New customer registered',
            body: `${doc.email || 'A new customer'} joined the platform.`,
            sourceEntityType: 'customer',
            sourceEntityId: doc.id,
            metadata: { customerId: doc.id, userId: doc.user },
          })
        }
        return doc
      },
    ],
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation === 'create' || operation === 'update') {
          if (data.user) {
            try {
              const userId = typeof data.user === 'object' ? data.user.id : data.user
              const user = await req.payload.findByID({
                collection: 'users',
                id: userId,
              })
              if (user) {
                data.email = user.email
              }
            } catch (e) {
              // ignore
            }
          }
        }
        return data
      },
    ],
  },
  access: {
    // PayloadCMS automatically authenticates API keys and populates req.user
    read: ({ req: { user } }) => {
      // If user exists, they've been authenticated (either via API key or login)
      if (user) {
        // Allow service accounts and admins to read all customer data
        if (user.role === 'service' || user.role === 'admin') {
          return true
        }
      }
      
      // Block all unauthenticated requests and other roles
      return false
    },
    create: ({ req: { user } }) => {
      // Allow service accounts and admins to create customer records
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    update: ({ req: { user } }) => {
      // Allow service accounts and admins to update customer records
      return user?.role === 'service' || user?.role === 'admin' || false
    },
    delete: ({ req: { user } }) => {
      // Allow service accounts and admins to delete customer records
      return user?.role === 'service' || user?.role === 'admin' || false
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      unique: true,
      admin: {
        description: 'Link to user account',
      },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        readOnly: true,
        description: 'Cached email from User for display purposes',
      },
    },

    // ROLE-SPECIFIC FIELDS (customer learning data)
    {
      name: 'srn',
      type: 'text',
      unique: true,
      admin: {
        description: 'Student Registration Number (unique identifier) — optional',
      },
    },
    {
      name: 'couponCode',
      type: 'text',
      admin: {
        description: 'Marketing coupon code used during registration',
      },
    },
    {
      name: 'enrollmentDate',
      type: 'date',
      admin: {
        description: 'Date when customer enrolled in the program',
      },
    },
    {
      name: 'currentLevel',
      type: 'select',
      options: [
        {
          label: 'Beginner',
          value: 'beginner',
        },
        {
          label: 'Intermediate',
          value: 'intermediate',
        },
        {
          label: 'Advanced',
          value: 'advanced',
        },
      ],
      defaultValue: 'beginner',
      admin: {
        description: 'Current learning level',
      },
    },
    {
      name: 'activeAddress',
      type: 'relationship',
      relationTo: 'addresses',
      admin: {
        description: 'Currently selected active address for this customer (for food delivery)',
      },
    },

  ],
}
