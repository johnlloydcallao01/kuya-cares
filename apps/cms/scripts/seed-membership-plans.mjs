#!/usr/bin/env node
/**
 * Idempotent seed for membership plans (membership.md §6.1).
 * Run with: node scripts/seed-membership-plans.mjs
 * Uses the Payload local API via ESM import of the CMS config.
 */
const PLANS = [
  { name: 'Free Legacy', slug: 'free-legacy', description: 'Legacy free tier — no selling', price: 0, currency: 'PHP', billing_interval: 'month', trial_days: 0, grace_days: 7, commission_percent: 0, transaction_fee: 0, limits: { max_products: 0, max_merchants: 0, max_images: 0, storage_mb: 0, staff_seats: 1, monthly_gmv_cap: 0, order_cap: 0 }, capabilities: { microstore: false, ads: false, analytics: false, api_access: false, promos: false, custom_shipping: false, multi_user: false, visibility_boost: 0, support_sla: 'none' }, status: 'hidden', display_order: -1, is_fallback_basic: false, version: 1 },
  { name: 'Basic', slug: 'basic', description: 'Default fallback — ₱0, high commission', price: 0, currency: 'PHP', billing_interval: 'month', trial_days: 0, grace_days: 7, commission_percent: 18, transaction_fee: 0, limits: { max_products: 20, max_merchants: 1, max_images: -1, storage_mb: -1, staff_seats: 1, monthly_gmv_cap: -1, order_cap: -1 }, capabilities: { microstore: true, ads: false, analytics: false, api_access: false, promos: false, custom_shipping: false, multi_user: false, visibility_boost: 0, support_sla: 'email' }, status: 'active', display_order: 0, is_fallback_basic: true, version: 1 },
  { name: 'Growth Monthly', slug: 'growth-monthly', description: 'Growth plan, billed monthly', price: 499, currency: 'PHP', billing_interval: 'month', trial_days: 7, grace_days: 7, commission_percent: 8, transaction_fee: 0, limits: { max_products: 500, max_merchants: 5, max_images: -1, storage_mb: -1, staff_seats: 3, monthly_gmv_cap: -1, order_cap: -1 }, capabilities: { microstore: true, ads: true, analytics: true, api_access: false, promos: true, custom_shipping: false, multi_user: true, visibility_boost: 10, support_sla: 'email' }, status: 'active', display_order: 10, is_fallback_basic: false, version: 1 },
  { name: 'Growth Yearly', slug: 'growth-yearly', description: 'Growth plan, billed yearly', price: 4990, currency: 'PHP', billing_interval: 'year', trial_days: 7, grace_days: 7, commission_percent: 8, transaction_fee: 0, limits: { max_products: 500, max_merchants: 5, max_images: -1, storage_mb: -1, staff_seats: 3, monthly_gmv_cap: -1, order_cap: -1 }, capabilities: { microstore: true, ads: true, analytics: true, api_access: false, promos: true, custom_shipping: false, multi_user: true, visibility_boost: 10, support_sla: 'email' }, status: 'active', display_order: 11, is_fallback_basic: false, version: 1 },
  { name: 'Pro Monthly', slug: 'pro-monthly', description: 'Pro plan, billed monthly', price: 1499, currency: 'PHP', billing_interval: 'month', trial_days: 7, grace_days: 7, commission_percent: 5, transaction_fee: 0, limits: { max_products: -1, max_merchants: -1, max_images: -1, storage_mb: -1, staff_seats: 10, monthly_gmv_cap: -1, order_cap: -1 }, capabilities: { microstore: true, ads: true, analytics: true, api_access: true, promos: true, custom_shipping: true, multi_user: true, visibility_boost: 25, support_sla: 'priority' }, status: 'active', display_order: 20, is_fallback_basic: false, version: 1 },
  { name: 'Pro Yearly', slug: 'pro-yearly', description: 'Pro plan, billed yearly', price: 14990, currency: 'PHP', billing_interval: 'year', trial_days: 7, grace_days: 7, commission_percent: 5, transaction_fee: 0, limits: { max_products: -1, max_merchants: -1, max_images: -1, storage_mb: -1, staff_seats: 10, monthly_gmv_cap: -1, order_cap: -1 }, capabilities: { microstore: true, ads: true, analytics: true, api_access: true, promos: true, custom_shipping: true, multi_user: true, visibility_boost: 25, support_sla: 'priority' }, status: 'active', display_order: 21, is_fallback_basic: false, version: 1 },
  { name: 'Enterprise', slug: 'enterprise', description: 'Custom enterprise — admin-assign only', price: 0, currency: 'PHP', billing_interval: 'year', trial_days: 0, grace_days: 7, commission_percent: 0, transaction_fee: 0, limits: { max_products: -1, max_merchants: -1, max_images: -1, storage_mb: -1, staff_seats: -1, monthly_gmv_cap: -1, order_cap: -1 }, capabilities: { microstore: true, ads: true, analytics: true, api_access: true, promos: true, custom_shipping: true, multi_user: true, visibility_boost: 50, support_sla: 'dedicated' }, status: 'hidden', display_order: 100, is_fallback_basic: false, version: 1 },
]

async function main() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config.js')
  const payload = await getPayload({ config })
  let created = 0
  let updated = 0
  for (const plan of PLANS) {
    const existing = await payload.find({
      collection: 'membership-plans',
      where: { slug: { equals: plan.slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs.length > 0) {
      await payload.update({ collection: 'membership-plans', id: existing.docs[0].id, data: plan, overrideAccess: true })
      updated++
      console.log(`updated ${plan.slug}`)
    } else {
      await payload.create({ collection: 'membership-plans', data: plan, overrideAccess: true })
      created++
      console.log(`created ${plan.slug}`)
    }
  }
  console.log(`done: ${created} created, ${updated} updated (idempotent, 0 dupes on re-run)`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
