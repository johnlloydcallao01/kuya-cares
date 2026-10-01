import { GlobalConfig } from 'payload'

export const SystemSettings: GlobalConfig = {
  slug: 'system-settings',
  label: 'System Settings',
  access: {
    read: () => true,
    update: ({ req: { user } }) => {
      return Boolean(user?.role === 'admin')
    },
  },
  fields: [
    {
      name: 'maintenanceMode',
      label: 'Maintenance Mode',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Toggle maintenance mode for the public website. When enabled, all non-admin users will be redirected to the maintenance page.',
      },
    },
    {
      name: 'couponsEnabled',
      label: 'Coupons Enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Global kill-switch for coupon codes (WooCommerce wc_coupons_enabled parity). When off, no coupon can be validated or applied.',
      },
    },
    {
      name: 'pointsEnabled',
      label: 'Loyalty Points Enabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Global kill-switch for loyalty earn/redeem. When off, no points move.',
      },
    },
    {
      name: 'pointsExpiryDays',
      label: 'Points Expiry (days)',
      type: 'number',
      defaultValue: 365,
      min: 0,
      admin: {
        description: 'Earned lots expire after this many days (0 = never). Swept by POST /api/points/sweep.',
      },
    },
    {
      name: 'membership',
      label: 'Membership',
      type: 'group',
      admin: {
        description: 'Vendor membership kill-switch + billing defaults (Phase 0)',
      },
      fields: [
        {
          name: 'membershipEnabled',
          label: 'Membership Enabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'membershipEnforced',
          label: 'Membership Enforced',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'grandfatherBasicEnabled',
          label: 'Grandfather Basic Enabled',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'trialDaysDefault',
          label: 'Trial Days Default',
          type: 'number',
          defaultValue: 7,
          min: 0,
        },
        {
          name: 'graceDaysDefault',
          label: 'Grace Days Default',
          type: 'number',
          defaultValue: 7,
          min: 0,
        },
        {
          name: 'dunningMaxRetries',
          label: 'Dunning Max Retries',
          type: 'number',
          defaultValue: 8,
          min: 0,
        },
        {
          name: 'dunningSchedule',
          label: 'Dunning Schedule',
          type: 'json',
          defaultValue: ['1h', '4h', '12h', '1d', '2d', '3d', '5d', '7d'],
        },
        {
          name: 'fallbackBasicPlanSlug',
          label: 'Fallback Basic Plan Slug',
          type: 'text',
          defaultValue: 'basic',
        },
        {
          name: 'commissionDefaultPct',
          label: 'Commission Default %',
          type: 'number',
          defaultValue: 8,
          min: 0,
          max: 30,
        },
        {
          name: 'payProviderDefault',
          label: 'Pay Provider Default',
          type: 'select',
          defaultValue: 'paymongo',
          options: [
            { label: 'PayMongo', value: 'paymongo' },
            { label: 'Stripe', value: 'stripe' },
            { label: 'Manual', value: 'manual' },
          ],
        },
        {
          name: 'paymongoMembershipDisabled',
          label: 'PayMongo Membership Alias Disabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'When on, the Next alias POST /api/webhooks/paymongo-membership returns 410 so all traffic uses the canonical Payload endpoint /api/paymongo-membership/webhook.',
          },
        },
      ],
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Delivery',
          fields: [
            {
              name: 'deliveryProvider',
              label: 'Active Delivery Provider',
              type: 'select',
              options: [
                { label: 'Lalamove', value: 'lalamove' },
                { label: 'Native', value: 'native' },
              ],
              defaultValue: 'lalamove',
              required: true,
              admin: {
                description: 'Select which delivery provider to use for order bookings.',
              },
            },
            {
              name: 'lalamove',
              label: 'Lalamove Configuration',
              type: 'group',
              admin: {
                condition: (_, siblingData) => siblingData?.deliveryProvider === 'lalamove',
              },
              fields: [
                {
                  name: 'apiKey',
                  label: 'API Key',
                  type: 'text',
                  admin: {
                    description: 'Lalamove API key (pk_test_xxx or pk_prod_xxx)',
                  },
                },
                {
                  name: 'apiSecret',
                  label: 'API Secret',
                  type: 'text',
                  admin: {
                    description: 'Lalamove API secret (sk_test_xxx or sk_prod_xxx)',
                  },
                },
                {
                  name: 'market',
                  label: 'Market Code',
                  type: 'text',
                  defaultValue: 'PH',
                  admin: {
                    description: 'Lalamove market code (e.g. PH for Philippines)',
                  },
                },
                {
                  name: 'sandbox',
                  label: 'Sandbox Mode',
                  type: 'checkbox',
                  defaultValue: true,
                  admin: {
                    description: 'Use Lalamove sandbox environment for testing.',
                  },
                },
              ],
            },
            {
              name: 'native',
              label: 'Native Delivery Configuration',
              type: 'group',
              admin: {
                condition: (_, siblingData) => siblingData?.deliveryProvider === 'native',
              },
              fields: [
                {
                  name: 'riderAppUrl',
                  label: 'Rider App URL',
                  type: 'text',
                  admin: {
                    description: 'Base URL for the native rider application.',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
