/**
 * @file apps/cms/src/app/api/admin/subscriptions/[id]/waive/route.ts
 * @description POST waive: { until, reason (min 10 chars) } -> audit admin_waive.
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
    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const until = typeof body.until === 'string' ? body.until : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (!until) return NextResponse.json({ error: 'until is required' }, { status: 400 })
    if (!reason || reason.length < 10) {
      return NextResponse.json({ error: 'reason is required (min 10 chars)' }, { status: 400 })
    }
    const untilIso = new Date(until)
    if (Number.isNaN(untilIso.getTime())) return NextResponse.json({ error: 'until must be a valid date' }, { status: 400 })

    let current: any
    try {
      current = await payload.findByID({ collection: 'vendor-subscriptions' as any, id: id as any, depth: 0, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const updated = await payload.update({
      collection: 'vendor-subscriptions' as any,
      id: id as any,
      data: { waivedUntil: untilIso.toISOString(), waiveReason: reason } as any,
      overrideAccess: true,
    })

    const vendorId = current.vendor && typeof current.vendor === 'object' ? String(current.vendor.id) : String(current.vendor)
    try {
      await payload.update({
        collection: 'vendors', id: vendorId as any,
        data: { waivedUntil: untilIso.toISOString(), waiveReason: reason } as any,
        overrideAccess: true,
      })
    } catch {
      // best-effort (fields may not exist yet)
    }

    await audit(payload, {
      vendor: vendorId, subscription: id, action: 'admin_waive',
      reason, actor: admin.id, metadata: { until: untilIso.toISOString() },
    })

    return NextResponse.json({ doc: sanitizeSubscription(updated as any) }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/subscriptions/[id]/waive] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
