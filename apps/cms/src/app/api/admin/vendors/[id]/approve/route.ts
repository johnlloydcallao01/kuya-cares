/**
 * @file apps/cms/src/app/api/admin/vendors/[id]/approve/route.ts
 * @description POST approve vendor. Gate: active|trialing subscription OR waivedUntil>now,
 * else 402 SUBSCRIPTION_REQUIRED. Body { approve, reason?, waive?:{until, reason} }.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { audit, paywalled } from '@/utils/membershipApi'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    const { id } = await params
    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const approve = body.approve === true
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

    let vendor: any
    try {
      vendor = await payload.findByID({ collection: 'vendors', id: id as any, depth: 0, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    if (approve) {
      // Gate: resolveActiveSubscription in (active|trialing) OR waivedUntil > now
      let gated = false
      let subscriptionStatus: string | null = 'none'
      try {
        const subs = await payload.find({
          collection: 'vendor-subscriptions' as any,
          where: { vendor: { equals: id } },
          limit: 5, sort: '-createdAt', depth: 0, overrideAccess: true,
        })
        const now = Date.now()
        for (const s of ((subs as any).docs ?? []) as any[]) {
          subscriptionStatus = String(s.status ?? 'none')
          if (['active', 'trialing'].includes(subscriptionStatus)) {
            const end = s.current_period_end ?? s.currentPeriodEnd
            if (!end || new Date(String(end)).getTime() > now) {
              gated = true
              break
            }
          }
          const waived = s.waivedUntil ?? s.waived_until
          if (waived && new Date(String(waived)).getTime() > now) {
            gated = true
            break
          }
        }
        // vendor-level waiver fallback
        const vWaived = (vendor as any).waivedUntil
        if (!gated && vWaived && new Date(String(vWaived)).getTime() > now) gated = true
        // manual waive inline in this request
        if (!gated && body.waive?.until) {
          const wReason = String(body.waive?.reason || '').trim()
          if (wReason.length < 10) {
            return NextResponse.json({ error: 'waive.reason is required (min 10 chars)' }, { status: 400 })
          }
          const untilIso = new Date(String(body.waive.until))
          if (Number.isNaN(untilIso.getTime()) || untilIso.getTime() <= now) {
            return NextResponse.json({ error: 'waive.until must be a future date' }, { status: 400 })
          }
          gated = true
          subscriptionStatus = 'waived'
          try {
            await payload.update({
              collection: 'vendors', id: id as any,
              data: { waivedUntil: untilIso.toISOString(), waiveReason: wReason } as any,
              overrideAccess: true,
            })
          } catch {
            // best-effort
          }
        }
      } catch {
        gated = false
      }
      if (!gated) {
        return paywalled({
          vendorId: id,
          subscriptionStatus,
          requiredPlan: 'Basic',
          code: 'SUBSCRIPTION_REQUIRED',
          message: 'Subscription required before approval',
        })
      }
    } else if (!reason) {
      return NextResponse.json({ error: 'reason is required when rejecting' }, { status: 400 })
    }

    const updated = await payload.update({
      collection: 'vendors',
      id: id as any,
      data: {
        verificationStatus: approve ? 'verified' : 'rejected',
        isActive: approve,
      } as any,
      overrideAccess: true,
    })

    await audit(payload, {
      vendor: id, action: 'admin_approve',
      reason: reason || (approve ? 'approved' : 'rejected'),
      actor: admin.id, metadata: { approve },
    })

    return NextResponse.json(
      { doc: { id: (updated as any).id, verificationStatus: (updated as any).verificationStatus, isActive: (updated as any).isActive } },
      { status: 200 },
    )
  } catch (err: any) {
    console.error('[admin/vendors/[id]/approve] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
