/**
 * @file apps/cms/src/app/api/admin/subscriptions/retry-due/route.ts
 * @description POST dunning sweep: retry past_due invoices, flip past_due -> grace -> expired.
 * Admin authed. Shared with cron (BILLING_CRON_SECRET accepted as Bearer alternative).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { audit, loadOptionalBillingService } from '@/utils/membershipApi'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    // Admin JWT OR cron secret (shared sweep logic)
    const cronSecret = process.env.BILLING_CRON_SECRET || ''
    const authHeader = request.headers.get('Authorization') || ''
    const cronOk = cronSecret && authHeader === `Bearer ${cronSecret}`
    let admin: any = null
    if (!cronOk) {
      admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    }

    // Prefer BillingService.retryDue when present (parallel Phase 1)
    try {
      const svc = await loadOptionalBillingService()
      const fn = svc?.retryDue || svc?.retry_due || svc?.default?.retryDue
      if (typeof fn === 'function') {
        const out = await fn.call(svc, payload)
        return NextResponse.json({ success: true, via: 'BillingService', result: out ?? null }, { status: 200 })
      }
    } catch {
      // fall through to inline sweep
    }

    const now = Date.now()
    let retried = 0
    let toGrace = 0
    let toExpired = 0

    // 1. Retry past_due subscriptions within dunning window (bump retryCount/lastRetryAt)
    try {
      const due = await payload.find({
        collection: 'vendor-subscriptions' as any,
        where: { status: { equals: 'past_due' } },
        limit: 100, depth: 0, overrideAccess: true,
      })
      for (const sub of ((due as any).docs ?? []) as any[]) {
        const count = Number(sub.retryCount ?? sub.retry_count ?? 0)
        if (count >= 8) continue
        await payload.update({
          collection: 'vendor-subscriptions' as any,
          id: sub.id,
          data: { retryCount: count + 1, lastRetryAt: new Date().toISOString() } as any,
          overrideAccess: true,
        })
        retried += 1
      }
    } catch {
      // best-effort
    }

    // 2. past_due with grace_ends_at passed -> grace; grace passed -> expired/cancelled
    try {
      const subs = await payload.find({
        collection: 'vendor-subscriptions' as any,
        where: { status: { in: ['past_due', 'grace'] } },
        limit: 100, depth: 0, overrideAccess: true,
      })
      for (const sub of ((subs as any).docs ?? []) as any[]) {
        const graceEnd = sub.grace_ends_at ?? sub.graceEndsAt
        if (sub.status === 'past_due' && (!graceEnd || new Date(String(graceEnd)).getTime() <= now)) {
          const graceDays = 7
          await payload.update({
            collection: 'vendor-subscriptions' as any,
            id: sub.id,
            data: { status: 'grace', grace_ends_at: new Date(now + graceDays * 86400000).toISOString() } as any,
            overrideAccess: true,
          })
          toGrace += 1
        } else if (sub.status === 'grace' && graceEnd && new Date(String(graceEnd)).getTime() <= now) {
          await payload.update({
            collection: 'vendor-subscriptions' as any,
            id: sub.id,
            data: { status: 'expired' } as any,
            overrideAccess: true,
          })
          toExpired += 1
        }
      }
    } catch {
      // best-effort
    }

    await audit(payload, {
      action: 'sync', reason: `retry-due sweep retried=${retried} toGrace=${toGrace} toExpired=${toExpired}`,
      actor: admin?.id ?? null, metadata: { retried, toGrace, toExpired },
    })

    return NextResponse.json({ success: true, retried, toGrace, toExpired }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/subscriptions/retry-due] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
