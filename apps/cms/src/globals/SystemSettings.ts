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
