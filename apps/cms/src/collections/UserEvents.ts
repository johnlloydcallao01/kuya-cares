import type { CollectionConfig } from 'payload'

export const UserEvents: CollectionConfig = {
  slug: 'user-events',
  admin: {
    useAsTitle: 'eventType',
    defaultColumns: ['user', 'eventType', 'timestamp', 'triggeredBy'],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'User this event relates to',
      },
    },
    {
      name: 'eventType',
      type: 'select',
      options: [
        {
          label: 'User Created',
          value: 'USER_CREATED',
        },
        {
          label: 'Role Changed',
          value: 'ROLE_CHANGED',
        },
        {
          label: 'Profile Updated',
          value: 'PROFILE_UPDATED',
        },
        {
          label: 'User Deactivated',
          value: 'USER_DEACTIVATED',
        },
        {
          label: 'User Reactivated',
          value: 'USER_REACTIVATED',
        },
        {
          label: 'Login Success',
          value: 'LOGIN_SUCCESS',
        },
        {
          label: 'Login Failed',
          value: 'LOGIN_FAILED',
        },
        {
          label: 'Password Changed',
          value: 'PASSWORD_CHANGED',
        },
      ],
      required: true,
      admin: {
        description: 'Type of event that occurred',
      },
    },
    {
      name: 'eventData',
      type: 'json',
      required: true,
      admin: {
        description: 'Event-specific data and context',
      },
    },
    {
      name: 'triggeredBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        description: 'User who triggered this event (if applicable)',
      },
    },
    {
      name: 'timestamp',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When this event occurred',
      },
    },
    {
      name: 'ipAddress',
      type: 'text',
      admin: {
        description: 'IP address where event originated',
      },
    },
    {
      name: 'userAgent',
      type: 'text',
      admin: {
        description: 'User agent string from the request',
      },
    },
  ],
}
