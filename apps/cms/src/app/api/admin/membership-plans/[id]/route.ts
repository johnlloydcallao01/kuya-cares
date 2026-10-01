/**
 * @file apps/cms/src/app/api/admin/membership-plans/[id]/route.ts
 * @description GET/PATCH/DELETE single plan. DELETE blocked 409 HAS_ACTIVE_SUBSCRIPTIONS
 * unless ?force=true (then soft-disable status=disabled instead of hard delete when in use).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { sanitizePlan, isMissingCollection } from '@/utils/membershipApi'

const PATCH_WHITELIST = new Set([
  'name', 'description', 'price', 'currency', 'billing_interval',
  'trial_days', 'grace_days', 'commission_percent', 'transaction_fee',
  'limits', 'allowed_categories', 'allowed_business_types', 'capabilities',
  'status', 'display_order', 'is_fallback_basic',
  'stripe_product_id', 'stripe_price_id', 'paymongo_plan_ref', 'version',
])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    const { id } = await params
    let doc: any
    try {
      doc = await payload.findByID({ collection: 'membership-plans' as any, id: id as any, depth: 0, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }
    return NextResponse.json({ doc: sanitizePlan(doc) }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/membership-plans/[id]] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function PATCH(
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
    const patch: Record<string, any> = {}
    for (const [k, v] of Object.entries(body)) {
      if (PATCH_WHITELIST.has(k)) patch[k] = v
    }
    if (patch.currency) patch.currency = 'PHP'
    if (patch.price !== undefined && (!Number.isFinite(Number(patch.price)) || Number(patch.price) < 0)) {
      return NextResponse.json({ error: 'price must be >= 0' }, { status: 400 })
    }
    if (patch.commission_percent !== undefined) {
      const pct = Number(patch.commission_percent)
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return NextResponse.json({ error: 'commission_percent must be 0-100' }, { status: 400 })
      }
    }
    let updated: any
    try {
      updated = await payload.update({ collection: 'membership-plans' as any, id: id as any, data: patch as any, overrideAccess: true })
    } catch (err: any) {
      if (isMissingCollection(err)) return NextResponse.json({ error: 'Membership collections not installed' }, { status: 500 })
      return NextResponse.json({ error: err?.message || 'Failed to update plan' }, { status: 400 })
    }
    return NextResponse.json({ doc: sanitizePlan(updated) }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/membership-plans/[id]] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Count active subscribers
    let activeCount = 0
    try {
      const subs = await payload.find({
        collection: 'vendor-subscriptions' as any,
        where: { and: [{ plan: { equals: id } }, { status: { in: ['trialing', 'active', 'past_due', 'grace'] } }] },
        limit: 1, depth: 0, overrideAccess: true,
      })
      activeCount = typeof (subs as any).totalDocs === 'number' ? (subs as any).totalDocs : (subs?.docs?.length ?? 0)
    } catch {
      activeCount = 0
    }

    if (activeCount > 0 && !force) {
      return NextResponse.json(
        { error: 'Plan has active subscribers', code: 'HAS_ACTIVE_SUBSCRIPTIONS', activeCount },
        { status: 409 },
      )
    }
    if (activeCount > 0 && force) {
      // Soft-disable instead of hard delete when in use
      const updated = await payload.update({
        collection: 'membership-plans' as any,
        id: id as any,
        data: { status: 'disabled' } as any,
        overrideAccess: true,
      })
      return NextResponse.json({ doc: sanitizePlan(updated as any), softDisabled: true }, { status: 200 })
    }

    try {
      await payload.delete({ collection: 'membership-plans' as any, id: id as any, overrideAccess: true })
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to delete plan' }, { status: 400 })
    }
    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/membership-plans/[id]] DELETE error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
