/**
 * @file apps/cms/src/app/api/vendor/subscriptions/cancel/route.ts
 * @description Cancel subscription (immediate or at period end).
 * POST { cancelAtPeriodEnd?, reason? } -> 200 {status, effectiveAt}
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import {
  audit,
  checkRateLimit,
  isMissingCollection,
  resolveOwnVendorId,
  resolveOwnedVendorId,
  forbidCrossVendor,
} from '@/utils/membershipApi'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const vendorUser = await authenticateVendorOrMember(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: seller authentication required' }, { status: 401 })
    const requestedVendorId = new URL(request.url).searchParams.get('vendorId')
    if (vendorUser.role === 'member' && !requestedVendorId) {
      return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    }
    const vendorId = requestedVendorId
      ? await resolveOwnedVendorId(payload, vendorUser.id, requestedVendorId)
      : await resolveOwnVendorId(payload, vendorUser.id)
    if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found or not owned by account' }, { status: requestedVendorId ? 403 : 404 })
    const limited = checkRateLimit('vendor-sub-mutate', `vendor:${vendorId}`, 20, 60 * 60 * 1000)
    if (limited) return limited

    let body: Record<string, any> = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const cross = forbidCrossVendor(vendorId, body.vendorId ?? body.vendor)
    if (cross) return cross
    const cancelAtPeriodEnd = body.cancelAtPeriodEnd !== false
    const reason = typeof body.reason === 'string' ? body.reason : null

    let current: any = null
    try {
      const subs = await payload.find({
        collection: 'vendor-subscriptions' as any,
        where: { and: [{ vendor: { equals: vendorId } }, { status: { in: ['trialing', 'active', 'past_due', 'grace'] } }] },
        limit: 1, sort: '-createdAt', depth: 0, overrideAccess: true,
      })
      current = subs?.docs?.[0] ?? null
    } catch (err: any) {
      if (isMissingCollection(err)) return NextResponse.json({ error: 'Membership collections not installed', code: 'COLLECTION_MISSING' }, { status: 500 })
      throw err
    }
    if (!current) return NextResponse.json({ error: 'No active subscription', code: 'SUBSCRIPTION_REQUIRED' }, { status: 402 })

    // Retry-safety: an already-cancelled state returns current state instead of
    // writing duplicate audit rows (cancel has no idempotencyKey field by design).
    const currentStatus = String(current.status ?? '')
    if (cancelAtPeriodEnd && (current.cancelAtPeriodEnd === true || currentStatus === 'cancelled')) {
      return NextResponse.json(
        {
          status: currentStatus,
          effectiveAt: current.cancel_at ?? current.cancelAt ?? null,
          deduplicated: true,
        },
        { status: 200 },
      )
    }
    if (!cancelAtPeriodEnd && currentStatus === 'cancelled') {
      return NextResponse.json(
        {
          status: currentStatus,
          effectiveAt: current.cancelled_at ?? current.cancelledAt ?? null,
          deduplicated: true,
        },
        { status: 200 },
      )
    }

    const periodEnd = String(current.current_period_end ?? current.currentPeriodEnd ?? new Date().toISOString())
    let patch: Record<string, any>
    let effectiveAt: string
    if (cancelAtPeriodEnd) {
      patch = { cancelAtPeriodEnd: true, cancel_at: periodEnd }
      effectiveAt = periodEnd
    } else {
      patch = { status: 'cancelled', cancelled_at: new Date().toISOString(), cancelAtPeriodEnd: false, auto_renew: false }
      effectiveAt = new Date().toISOString()
    }

    const updated = await payload.update({
      collection: 'vendor-subscriptions' as any,
      id: current.id,
      data: patch as any,
      overrideAccess: true,
    })

    await audit(payload, {
      vendor: vendorId, subscription: current.id, action: 'cancel',
      reason: reason || (cancelAtPeriodEnd ? 'cancel at period end' : 'immediate cancel'),
      actor: vendorUser.id, metadata: { cancelAtPeriodEnd, effectiveAt },
    })

    return NextResponse.json(
      { status: (updated as any).status, effectiveAt },
      { status: 200 },
    )
  } catch (err: any) {
    console.error('[vendor/subscriptions/cancel] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
