#!/usr/bin/env node
/**
 * Backfill grandfathered Basic subscriptions (membership.md §6.1).
 * Usage:
 *   node scripts/backfill-grandfather-basic.mjs --dry-run   # counts only
 *   node scripts/backfill-grandfather-basic.mjs --live      # creates subs + waived invoices
 * No PayMongo calls. Dependency-free beyond payload.
 */
const args = process.argv.slice(2)
const DRY_RUN = !args.includes('--live')

function invoiceNumber() {
  const y = new Date().getFullYear()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase().padStart(6, '0')
  return `INV-${y}-${rand}`
}

async function main() {
  const { getPayload } = await import('payload')
  const { default: config } = await import('../src/payload.config.js')
  const payload = await getPayload({ config })

  const vendors = await payload.find({ collection: 'vendors', limit: 10000, depth: 0, overrideAccess: true })
  const subs = await payload.find({ collection: 'vendor-subscriptions', where: { status: { in: ['trialing', 'active', 'past_due', 'grace'] } }, limit: 10000, depth: 0, overrideAccess: true })
  const withSub = new Set(subs.docs.map((d) => String(d.vendor?.id ?? d.vendor)))
  const candidates = vendors.docs.filter((v) => !withSub.has(String(v.id)))

  console.log(`${DRY_RUN ? '[dry-run]' : '[live]'} vendors=${vendors.docs.length} withActiveSub=${withSub.size} toBackfill=${candidates.length}`)

  if (DRY_RUN) {
    console.log(`Dry-run: would create ${candidates.length} Basic subs + waived invoices. Re-run with --live to apply.`)
    process.exit(0)
  }

  const plans = await payload.find({ collection: 'membership-plans', where: { slug: { equals: 'basic' } }, limit: 1, depth: 0, overrideAccess: true })
  const basic = plans.docs[0]
  if (!basic) {
    console.error('Basic plan not found — run scripts/seed-membership-plans.mjs first')
    process.exit(1)
  }

  const farFuture = new Date()
  farFuture.setFullYear(farFuture.getFullYear() + 10)
  let done = 0
  for (const vendor of candidates) {
    const idem = `grandfather-${vendor.id}-basic-v1`
    const dup = await payload.find({ collection: 'vendor-subscriptions', where: { idempotencyKey: { equals: idem } }, limit: 1, depth: 0, overrideAccess: true })
    if (dup.docs.length > 0) continue
    const sub = await payload.create({
      collection: 'vendor-subscriptions',
      data: {
        vendor: vendor.id,
        plan: basic.id,
        plan_version: basic.version ?? 1,
        plan_snapshot: { name: basic.name, price: basic.price, billing_interval: basic.billing_interval, commission_percent: basic.commission_percent, transaction_fee: basic.transaction_fee, limits: basic.limits, capabilities: basic.capabilities },
        status: 'active',
        billing_interval: basic.billing_interval,
        current_period_start: new Date().toISOString(),
        current_period_end: farFuture.toISOString(),
        auto_renew: false,
        payment_provider: 'manual',
        idempotencyKey: idem,
        grandfathered: true,
        grandfather_notes: 'grandfathered-backfill',
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'subscription-invoices',
      data: {
        subscription: sub.id,
        vendor: vendor.id,
        plan: basic.id,
        invoice_number: invoiceNumber(),
        amount: 0,
        currency: 'PHP',
        status: 'paid',
        billingReason: 'manual',
        payment_provider: 'manual',
        period_start: new Date().toISOString(),
        period_end: farFuture.toISOString(),
        due_at: new Date().toISOString(),
        idempotencyKey: `grandfather-inv-${vendor.id}-basic-v1`,
        metadata: { memo: 'grandfathered-backfill', waived: true },
      },
      overrideAccess: true,
    })
    await payload.update({ collection: 'vendors', id: vendor.id, data: { grandfatheredBasic: true, grandfatheredAt: new Date().toISOString() }, overrideAccess: true })
    done++
  }
  console.log(`[live] backfilled ${done}/${candidates.length} vendors`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
