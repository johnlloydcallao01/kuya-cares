import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

const isServiceOrAdmin = (user: { role?: string } | null | undefined) =>
  user?.role === 'service' || user?.role === 'admin'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const MembershipPlans: CollectionConfig = {
  slug: 'membership-plans',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'price', 'billing_interval', 'status', 'display_order'],
    group: 'Membership',
    description: 'Vendor membership plan catalog (admin CRUD, public reads active only)',
  },
  access: {
    // Price data is public (pricing page, signup plan picker): anyone — including
    // anonymous visitors — may read ACTIVE plans only. Hidden/disabled/archived
    // stay invisible. Writes remain service/admin-only.
    read: ({ req: { user } }) => {
      if (isServiceOrAdmin(user)) return true
      return { status: { equals: 'active' } }
    },
    create: ({ req: { user } }) => isServiceOrAdmin(user),
    update: ({ req: { user } }) => isServiceOrAdmin(user),
    delete: ({ req: { user } }) => isServiceOrAdmin(user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true },
    { name: 'description', type: 'textarea' },
    { name: 'price', type: 'number', required: true, min: 0 },
    { name: 'currency', type: 'text', required: true, defaultValue: 'PHP' },
    {
      name: 'billing_interval',
      type: 'select',
      required: true,
      defaultValue: 'month',
      options: [
        { label: 'Month', value: 'month' },
        { label: 'Year', value: 'year' },
        { label: 'One Time', value: 'one_time' },
      ],
    },
    { name: 'trial_days', type: 'number', min: 0, defaultValue: 0 },
    { name: 'grace_days', type: 'number', min: 0, defaultValue: 7 },
    { name: 'commission_percent', type: 'number', min: 0, max: 100, defaultValue: 0 },
    { name: 'transaction_fee', type: 'number', min: 0, defaultValue: 0 },
    {
      name: 'limits',
      type: 'group',
      fields: [
        { name: 'max_products', type: 'number', defaultValue: -1 },
        { name: 'max_merchants', type: 'number', defaultValue: 1 },
        { name: 'max_images', type: 'number', defaultValue: -1 },
        { name: 'storage_mb', type: 'number', defaultValue: -1 },
        { name: 'staff_seats', type: 'number', defaultValue: 1 },
        { name: 'monthly_gmv_cap', type: 'number', defaultValue: -1 },
        { name: 'order_cap', type: 'number', defaultValue: -1 },
      ],
    },
    {
      name: 'allowed_categories',
      type: 'relationship',
      relationTo: 'product-categories',
      hasMany: true,
      admin: { description: 'Empty = all categories' },
    },
    {
      name: 'allowed_business_types',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Restaurant', value: 'restaurant' },
        { label: 'Fast Food', value: 'fast_food' },
        { label: 'Grocery', value: 'grocery' },
        { label: 'Pharmacy', value: 'pharmacy' },
        { label: 'Convenience', value: 'convenience' },
        { label: 'Bakery', value: 'bakery' },
        { label: 'Coffee Shop', value: 'coffee_shop' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'capabilities',
      type: 'group',
      fields: [
        { name: 'microstore', type: 'checkbox', defaultValue: false },
        { name: 'ads', type: 'checkbox', defaultValue: false },
        { name: 'analytics', type: 'checkbox', defaultValue: false },
        { name: 'api_access', type: 'checkbox', defaultValue: false },
        { name: 'promos', type: 'checkbox', defaultValue: false },
        { name: 'custom_shipping', type: 'checkbox', defaultValue: false },
        { name: 'multi_user', type: 'checkbox', defaultValue: false },
        { name: 'visibility_boost', type: 'number', min: 0, max: 100, defaultValue: 0 },
        {
          name: 'support_sla',
          type: 'select',
          defaultValue: 'email',
          options: [
            { label: 'None', value: 'none' },
            { label: 'Email', value: 'email' },
            { label: 'Priority', value: 'priority' },
            { label: 'Dedicated', value: 'dedicated' },
          ],
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Hidden', value: 'hidden' },
        { label: 'Disabled', value: 'disabled' },
        { label: 'Archived', value: 'archived' },
      ],
      admin: { description: 'hidden = assign-only (Enterprise)' },
    },
    { name: 'display_order', type: 'number', defaultValue: 0 },
    { name: 'is_fallback_basic', type: 'checkbox', defaultValue: false },
    { name: 'stripe_product_id', type: 'text' },
    { name: 'stripe_price_id', type: 'text' },
    {
      name: 'paymongo_plan_ref',
      type: 'text',
      admin: { description: 'Local ref (PayMongo has no product object)' },
    },
    { name: 'version', type: 'number', required: true, defaultValue: 1 },
  ],
  indexes: [{ fields: ['slug'], unique: true }, { fields: ['status', 'display_order'] }],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (!data) return data
        if (!data.slug && data.name) data.slug = slugify(String(data.name))
        data.currency = 'PHP'
        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        try {
          if (doc?.is_fallback_basic === true) {
            const others = await req.payload.find({
              collection: 'membership-plans',
              where: {
                and: [{ id: { not_equals: doc.id } }, { is_fallback_basic: { equals: true } }],
              },
              limit: 100,
              depth: 0,
              overrideAccess: true,
            })
            for (const other of others.docs ?? []) {
              await req.payload.update({
                collection: 'membership-plans',
                id: other.id,
                data: { is_fallback_basic: false },
                overrideAccess: true,
              })
            }
          }
        } catch (err) {
          req.payload.logger.error(`membership-plans afterChange fallback sync failed: ${String(err)}`)
        }
        return doc
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const count = await req.payload.count({
          collection: 'vendor-subscriptions',
          where: {
            and: [
              { plan: { equals: id } },
              { status: { in: ['trialing', 'active', 'past_due', 'grace'] } },
            ],
          },
          overrideAccess: true,
        })
        const total = typeof count === 'number' ? count : count.totalDocs
        if (total > 0) throw new APIError('Plan has active subscribers', 409)
      },
    ],
  },
}
