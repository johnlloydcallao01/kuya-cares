import type { CollectionConfig } from 'payload'

export const NotificationTemplates: CollectionConfig = {
  slug: 'notification-templates',
  admin: {
    useAsTitle: 'typeKey',
    defaultColumns: ['typeKey', 'domain', 'severity', 'isActive'],
  },
  fields: [
    {
      name: 'typeKey',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'domain',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Order',
          value: 'order',
        },
        {
          label: 'Account',
          value: 'account',
        },
        {
          label: 'System',
          value: 'system',
        },
        {
          label: 'Marketing',
          value: 'marketing',
        },
        {
          label: 'Custom',
          value: 'custom',
        },
      ],
    },
    {
      name: 'titleTemplate',
      type: 'text',
      required: true,
    },
    {
      name: 'bodyTemplate',
      type: 'textarea',
      required: true,
    },
    {
      name: 'defaultChannels',
      type: 'select',
      hasMany: true,
      options: [
        {
          label: 'In App',
          value: 'in_app',
        },
        {
          label: 'Email',
          value: 'email',
        },
        {
          label: 'Push',
          value: 'push',
        },
        {
          label: 'SMS',
          value: 'sms',
        },
      ],
    },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: [
        {
          label: 'Info',
          value: 'info',
        },
        {
          label: 'Warning',
          value: 'warning',
        },
        {
          label: 'Critical',
          value: 'critical',
        },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'updatedBy',
      type: 'relationship',
      relationTo: 'users',
    },
  ],
}

