/**
 * @file apps/cms/src/app/api/admin/subscriptions/[id]/cancel/route.ts
 * @description POST cancel: { immediate } -> immediate cancelled else cancelAtPeriodEnd=true.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { audit, sanitizeSubscription } from '@/utils/membershipApi'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    const { id } = await params
    let body: Record<string, any> = {}
    try {
      body = await request.json()
    } catch {
      body = {}
    }
    const immediate = body.immediate === true

    let current: any
    try {
      current = await payload.findByID({ collection: 'vendor-subscriptions' as any, id: id as any, depth: 0, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const periodEnd = String(current.current_period_end ?? current.currentPeriodEnd ?? new Date().toISOString())
    const patch = immediate
      ? { status: 'cancelled', cancelled_at: new Date().toISOString(), cancelAtPeriodEnd: false, auto_renew: false }
      : { cancelAtPeriodEnd: true, cancel_at: periodEnd }

    const updated = await payload.update({
      collection: 'vendor-subscriptions' as any,
      id: id as any,
      data: patch as any,
      overrideAccess: true,
    })

    const vendorId = current.vendor && typeof current.vendor === 'object' ? String(current.vendor.id) : String(current.vendor)
    await audit(payload, {
      vendor: vendorId, subscription: id, action: 'cancel',
      reason: immediate ? 'admin immediate cancel' : 'admin cancel at period end',
      actor: admin.id, metadata: { immediate, effectiveAt: immediate ? new Date().toISOString() : periodEnd },
    })

    return NextResponse.json(
      { doc: sanitizeSubscription(updated as any), effectiveAt: immediate ? new Date().toISOString() : periodEnd },
      { status: 200 },
    )
  } catch (err: any) {
    console.error('[admin/subscriptions/[id]/cancel] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
