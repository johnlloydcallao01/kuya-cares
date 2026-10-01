/**
 * @file apps/cms/src/app/api/cron/membership-sweep/route.ts
 * @description Cron sweep: past_due -> grace -> expired, cancelAtPeriodEnd at period end
 * -> cancelled, usage counters reset each period. Guarded by BILLING_CRON_SECRET.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { audit } from '@/utils/membershipApi'

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.BILLING_CRON_SECRET || ''
    if (!secret) {
      return NextResponse.json({ error: 'Cron secret not configured' }, { status: 500 })
    }
    const auth = request.headers.get('Authorization') || ''
    const headerSecret = request.headers.get('x-cron-secret') || ''
    if (auth !== `Bearer ${secret}` && headerSecret !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config: configPromise })
    const now = Date.now()
    // DB-first: System Settings membership.graceDaysDefault (admin-editable);
    // explicit BILLING_GRACE_DAYS env wins when set (emergency override).
    let graceDays = 7
    try {
      const settings = await payload.findGlobal({ slug: 'system-settings' })
      const dbGrace = Number((settings as any)?.membership?.graceDaysDefault)
      if (Number.isFinite(dbGrace) && dbGrace >= 0) graceDays = dbGrace
    } catch {
      // Best effort; fall back below.
    }
    const envGrace = Number(process.env.BILLING_GRACE_DAYS)
    if (Number.isFinite(envGrace) && envGrace >= 0 && process.env.BILLING_GRACE_DAYS) graceDays = envGrace
    let toGrace = 0
    let toExpired = 0
    let toCancelled = 0
    let usageReset = 0

    const subs = await payload.find({
      collection: 'vendor-subscriptions' as any,
      where: { status: { in: ['past_due', 'grace', 'active', 'trialing'] } },
      limit: 500, depth: 0, overrideAccess: true,
    }).catch(() => ({ docs: [] }))

    for (const sub of (((subs as any).docs ?? []) as any[])) {
      try {
        const status = String(sub.status)
        const periodEnd = sub.current_period_end ?? sub.currentPeriodEnd
        const periodEndMs = periodEnd ? new Date(String(periodEnd)).getTime() : NaN
        const graceEnd = sub.grace_ends_at ?? sub.graceEndsAt
        const graceEndMs = graceEnd ? new Date(String(graceEnd)).getTime() : NaN

        // cancelAtPeriodEnd scheduled -> cancelled at period end
        if (sub.cancelAtPeriodEnd && Number.isFinite(periodEndMs) && periodEndMs <= now && ['active', 'trialing'].includes(status)) {
          await payload.update({
            collection: 'vendor-subscriptions' as any, id: sub.id,
            data: { status: 'cancelled', cancelled_at: new Date().toISOString() } as any,
            overrideAccess: true,
          })
          toCancelled += 1
          continue
        }
        // past_due -> grace
        if (status === 'past_due' && (!Number.isFinite(graceEndMs) || graceEndMs <= now)) {
          await payload.update({
            collection: 'vendor-subscriptions' as any, id: sub.id,
            data: { status: 'grace', grace_ends_at: new Date(now + graceDays * 86400000).toISOString() } as any,
            overrideAccess: true,
          })
          toGrace += 1
          continue
        }
        // grace past end -> expired
        if (status === 'grace' && Number.isFinite(graceEndMs) && graceEndMs <= now) {
          await payload.update({
            collection: 'vendor-subscriptions' as any, id: sub.id,
            data: { status: 'expired' } as any,
            overrideAccess: true,
          })
          toExpired += 1
          continue
        }
        // usage reset each period: last_reset_at older than period start
        const usage = sub.usage as any
        if (usage && ['active', 'trialing'].includes(status)) {
          const lastReset = usage.last_reset_at ? new Date(String(usage.last_reset_at)).getTime() : 0
          const periodStart = sub.current_period_start ?? sub.currentPeriodStart
          const periodStartMs = periodStart ? new Date(String(periodStart)).getTime() : 0
          if (lastReset < periodStartMs) {
            await payload.update({
              collection: 'vendor-subscriptions' as any, id: sub.id,
              data: {
                usage: {
                  products_used: 0, merchants_used: 0, storage_mb_used: 0,
                  gmv_current_period: 0, orders_current_period: 0,
                  last_reset_at: new Date().toISOString(),
                },
              } as any,
              overrideAccess: true,
            })
            usageReset += 1
          }
        }
      } catch {
        // per-doc best-effort
      }
    }

    await audit(payload, {
      action: 'sync',
      reason: `membership sweep toGrace=${toGrace} toExpired=${toExpired} toCancelled=${toCancelled} usageReset=${usageReset}`,
      metadata: { toGrace, toExpired, toCancelled, usageReset },
    })

    return NextResponse.json({ success: true, toGrace, toExpired, toCancelled, usageReset }, { status: 200 })
  } catch (err: any) {
    console.error('[cron/membership-sweep] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
