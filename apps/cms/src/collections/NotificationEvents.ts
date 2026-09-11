import type { CollectionConfig } from 'payload'

export const NotificationEvents: CollectionConfig = {
  slug: 'notification-events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['typeKey', 'domain', 'title', 'origin', 'triggeredBy'],
  },
  fields: [
    {
      name: 'typeKey',
      type: 'text',
      required: true,
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
      name: 'sourceEntityType',
      type: 'text',
    },
    {
      name: 'sourceEntityId',
      type: 'text',
    },
    {
      name: 'template',
      type: 'relationship',
      relationTo: 'notification-templates',
    },
    {
      name: 'origin',
      type: 'select',
      required: true,
      defaultValue: 'automatic',
      options: [
        {
          label: 'Automatic',
          value: 'automatic',
        },
        {
          label: 'Manual',
          value: 'manual',
        },
      ],
    },
    {
      name: 'triggeredBy',
      type: 'relationship',
      relationTo: 'users',
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
    },
    {
      name: 'metadata',
      type: 'json',
    },
    {
      name: 'priority',
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
      name: 'scheduledAt',
      type: 'date',
    },
  ],
}

