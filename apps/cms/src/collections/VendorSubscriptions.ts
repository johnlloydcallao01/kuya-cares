import type { CollectionConfig } from 'payload'

const isServiceOrAdmin = (user: { role?: string } | null | undefined) =>
  user?.role === 'service' || user?.role === 'admin'

async function vendorIdForVendorUser(payload: any, userId: string): Promise<string | null> {
  const res = await payload.find({
    collection: 'vendors',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs?.[0]?.id ? String(res.docs[0].id) : null
}

function relId(rel: unknown): string | null {
  if (!rel) return null
  if (typeof rel === 'string' || typeof rel === 'number') return String(rel)
  if (typeof rel === 'object' && rel !== null && 'id' in rel)
    return String((rel as { id: string | number }).id)
  return null
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}

export const VendorSubscriptions: CollectionConfig = {
  slug: 'vendor-subscriptions',
  admin: {
    useAsTitle: 'id',
    defaultColumns: ['vendor', 'plan', 'status', 'current_period_end'],
    group: 'Membership',
    description: 'One active + full history per vendor (writes service/admin only)',
  },
  access: {
    read: async ({ req: { user, payload } }) => {
      if (isServiceOrAdmin(user)) return true
      if (user?.role === 'vendor' && user?.id) {
        const vendorId = await vendorIdForVendorUser(payload, String(user.id))
        if (!vendorId) return false
        return { vendor: { equals: vendorId } }
      }
      return false
    },
    create: ({ req: { user } }) => isServiceOrAdmin(user),
    update: ({ req: { user } }) => isServiceOrAdmin(user),
    delete: ({ req: { user } }) => isServiceOrAdmin(user),
  },
  fields: [
    { name: 'vendor', type: 'relationship', relationTo: 'vendors', required: true, index: true },
    { name: 'plan', type: 'relationship', relationTo: 'membership-plans', required: true },
    { name: 'plan_version', type: 'number', required: true, defaultValue: 1 },
    { name: 'plan_snapshot', type: 'json', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Trialing', value: 'trialing' },
        { label: 'Active', value: 'active' },
        { label: 'Past Due', value: 'past_due' },
        { label: 'Grace', value: 'grace' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Expired', value: 'expired' },
      ],
    },
    {
      name: 'billing_interval',
      type: 'select',
      options: [
        { label: 'Month', value: 'month' },
        { label: 'Year', value: 'year' },
        { label: 'One Time', value: 'one_time' },
      ],
    },
    { name: 'current_period_start', type: 'date' },
    { name: 'current_period_end', type: 'date' },
    { name: 'trial_ends_at', type: 'date' },
    { name: 'grace_ends_at', type: 'date' },
    { name: 'cancel_at', type: 'date' },
    { name: 'cancelled_at', type: 'date' },
    { name: 'cancelAtPeriodEnd', type: 'checkbox', defaultValue: false },
    { name: 'scheduledPlan', type: 'relationship', relationTo: 'membership-plans' },
    { name: 'scheduledEffectiveAt', type: 'date' },
    { name: 'auto_renew', type: 'checkbox', defaultValue: true },
    {
      name: 'payment_provider',
      type: 'select',
      defaultValue: 'paymongo',
      options: [
        { label: 'PayMongo', value: 'paymongo' },
        { label: 'Stripe', value: 'stripe' },
        { label: 'Manual', value: 'manual' },
      ],
    },
    { name: 'provider_customer_id', type: 'text' },
    { name: 'provider_subscription_id', type: 'text', index: true },
    { name: 'idempotencyKey', type: 'text', required: true, unique: true },
    { name: 'retryCount', type: 'number', defaultValue: 0 },
    { name: 'lastRetryAt', type: 'date' },
    { name: 'waivedUntil', type: 'date' },
    { name: 'waiveReason', type: 'textarea' },
    { name: 'suspendReason', type: 'text' },
    {
      name: 'usage',
      type: 'group',
      fields: [
        { name: 'products_used', type: 'number', defaultValue: 0 },
        { name: 'merchants_used', type: 'number', defaultValue: 0 },
        { name: 'storage_mb_used', type: 'number', defaultValue: 0 },
        { name: 'gmv_current_period', type: 'number', defaultValue: 0 },
        { name: 'orders_current_period', type: 'number', defaultValue: 0 },
        { name: 'last_reset_at', type: 'date' },
      ],
    },
    { name: 'grandfathered', type: 'checkbox', defaultValue: false },
    { name: 'grandfather_notes', type: 'textarea' },
    { name: 'meta', type: 'json' },
  ],
  indexes: [
    { fields: ['vendor', 'status'] },
    { fields: ['plan', 'status'] },
    { fields: ['provider_subscription_id'], unique: true },
    { fields: ['current_period_end'] },
    { fields: ['idempotencyKey'], unique: true },
  ],
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (!data) return data
        const planId = relId(data.plan)
        const shouldSync = operation === 'create' || Boolean(planId && data.plan)
        if (planId && shouldSync) {
          try {
            const plan = await req.payload.findByID({
              collection: 'membership-plans',
              id: planId,
              depth: 0,
              overrideAccess: true,
            })
            if (plan) {
              const p = plan as Record<string, any>
              if (data.plan_version === undefined || operation === 'create')
                data.plan_version = p.version ?? 1
              if (data.plan_snapshot === undefined || operation === 'create') {
                data.plan_snapshot = {
                  name: p.name,
                  price: p.price,
                  billing_interval: p.billing_interval,
                  commission_percent: p.commission_percent,
                  transaction_fee: p.transaction_fee,
                  limits: p.limits,
                  capabilities: p.capabilities,
                }
              }
              if (!data.billing_interval && p.billing_interval)
                data.billing_interval = p.billing_interval
              const now = new Date()
              if (operation === 'create') {
                if (!data.current_period_start) data.current_period_start = now.toISOString()
                if (!data.current_period_end) {
                  const start = new Date(data.current_period_start)
                  const interval = data.billing_interval ?? p.billing_interval
                  const end =
                    interval === 'year'
                      ? addYears(start, 1)
                      : interval === 'one_time'
                        ? addYears(start, 100)
                        : addMonths(start, 1)
                  data.current_period_end = end.toISOString()
                }
                if (
                  data.status === 'trialing' &&
                  typeof p.trial_days === 'number' &&
                  p.trial_days > 0 &&
                  !data.trial_ends_at
                ) {
                  const trialEnd = new Date(now)
                  trialEnd.setDate(trialEnd.getDate() + p.trial_days)
                  data.trial_ends_at = trialEnd.toISOString()
                }
              }
            }
          } catch (err) {
            req.payload.logger.error(`vendor-subscriptions plan sync failed: ${String(err)}`)
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, req }) => {
        try {
          const vendorId = relId(doc.vendor)
          if (vendorId) {
            await req.payload.update({
              collection: 'vendors',
              id: vendorId,
              data: {
                currentSubscription: doc.id,
                subscriptionStatus: doc.status,
                subscriptionExpiresAt: doc.current_period_end ?? null,
                graceEndsAt: doc.grace_ends_at ?? null,
                lastEntitlementSync: new Date().toISOString(),
              },
              overrideAccess: true,
            })
            const existing = await req.payload.find({
              collection: 'vendor-entitlements',
              where: { vendor: { equals: vendorId } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            const snapshot =
              (doc.plan_snapshot as Record<string, unknown> | undefined) ?? {}
            const caps =
              (snapshot.capabilities as Record<string, unknown> | undefined) ?? {}
            const entitlementData: Record<string, any> = {
              vendor: doc.vendor,
              subscription: doc.id,
              plan: doc.plan ?? null,
              capabilities: caps,
              limits_snapshot: (snapshot.limits as Record<string, unknown>) ?? {},
              expires_at: doc.current_period_end ?? null,
              reason: `subscription ${doc.status}`,
            }
            if (existing.docs?.[0]) {
              await req.payload.update({
                collection: 'vendor-entitlements',
                id: existing.docs[0].id,
                data: entitlementData,
                overrideAccess: true,
              })
            } else {
              await req.payload.create({
                collection: 'vendor-entitlements',
                // Snapshot shape mirrors plan capabilities; `as any` matches existing style (cf. Merchants.ts business-zones)
                data: entitlementData as any,
                overrideAccess: true,
              })
            }
            await req.payload.create({
              collection: 'membership-audit-log',
              data: {
                vendor: doc.vendor,
                subscription: doc.id,
                action: 'sync',
                plan_version: doc.plan_version ?? 1,
                reason: `subscription ${doc.status}`,
              },
              overrideAccess: true,
            })
          }
        } catch (err) {
          req.payload.logger.error(`vendor-subscriptions afterChange failed: ${String(err)}`)
        }
        return doc
      },
    ],
  },
}
