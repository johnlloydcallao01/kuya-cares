import type { CollectionConfig } from 'payload'

export const Admins: CollectionConfig = {
  slug: 'admins',
  admin: {
    useAsTitle: 'user',
    defaultColumns: ['user', 'adminLevel', 'systemPermissions'],
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

    // ROLE-SPECIFIC FIELDS (enterprise-grade admin management)
    {
      name: 'adminLevel',
      type: 'select',
      options: [
        {
          label: 'System Admin',
          value: 'system',
        },
        {
          label: 'Department Admin',
          value: 'department',
        },
        {
          label: 'Content Admin',
          value: 'content',
        },
      ],
      defaultValue: 'content',
      required: true,
      admin: {
        description: 'Administrative access level',
      },
    },
    {
      name: 'systemPermissions',
      type: 'json',
      admin: {
        description: 'System-level permissions and capabilities',
      },
    },
  ],
}
