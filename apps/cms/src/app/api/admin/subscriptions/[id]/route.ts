/**
 * @file apps/cms/src/app/api/admin/subscriptions/[id]/route.ts
 * @description GET/PATCH subscription. PATCH { planSlug?, status?, suspendReason?, unsuspend?, extendPeriodEnd? }.
 * Suspend flips vendors isActive=false; unsuspend restores per subscription status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { audit, sanitizeSubscription } from '@/utils/membershipApi'

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
      doc = await payload.findByID({ collection: 'vendor-subscriptions' as any, id: id as any, depth: 1, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }
    return NextResponse.json({ doc: sanitizeSubscription(doc) }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/subscriptions/[id]] GET error:', err)
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

    let current: any
    try {
      current = await payload.findByID({ collection: 'vendor-subscriptions' as any, id: id as any, depth: 0, overrideAccess: true })
    } catch {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const patch: Record<string, any> = {}
    const vendorId = current.vendor && typeof current.vendor === 'object' ? String(current.vendor.id) : String(current.vendor)

    // Plan swap
    if (body.planSlug) {
      const plans = await payload.find({ collection: 'membership-plans' as any, where: { slug: { equals: String(body.planSlug) } }, limit: 1, depth: 0, overrideAccess: true })
      const plan = plans?.docs?.[0] as any
      if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
      patch.plan = plan.id
      patch.plan_version = plan.version ?? 1
      patch.plan_snapshot = {
        name: plan.name, price: plan.price, billing_interval: plan.billing_interval ?? 'month',
        commission_percent: plan.commission_percent ?? 0, transaction_fee: plan.transaction_fee ?? 0,
        limits: plan.limits ?? null, capabilities: plan.capabilities ?? null,
      }
    }
    // Direct status set (validated enum)
    const allowed = new Set(['pending', 'trialing', 'active', 'past_due', 'grace', 'suspended', 'cancelled', 'expired'])
    if (body.status && allowed.has(String(body.status))) patch.status = body.status
    // Suspend / unsuspend
    if (body.suspendReason || body.status === 'suspended') {
      patch.status = 'suspended'
      patch.suspendReason = body.suspendReason || current.suspendReason || 'admin suspend'
    }
    if (body.unsuspend) {
      patch.status = 'active'
      patch.suspendReason = null
    }
    if (body.extendPeriodEnd) {
      const d = new Date(String(body.extendPeriodEnd))
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'extendPeriodEnd must be a valid date' }, { status: 400 })
      patch.current_period_end = d.toISOString()
    }

    const updated = await payload.update({
      collection: 'vendor-subscriptions' as any,
      id: id as any,
      data: patch as any,
      overrideAccess: true,
    })

    // Mirror suspend state onto vendor record
    try {
      const nextStatus = String((updated as any).status)
      if (nextStatus === 'suspended') {
        await payload.update({
          collection: 'vendors', id: vendorId as any,
          data: { isActive: false, suspendedReason: patch.suspendReason ?? 'suspended' } as any,
          overrideAccess: true,
        })
      } else if (body.unsuspend) {
        const restoreActive = ['trialing', 'active'].includes(nextStatus)
        await payload.update({
          collection: 'vendors', id: vendorId as any,
          data: { isActive: restoreActive, suspendedReason: null } as any,
          overrideAccess: true,
        })
      }
    } catch {
      // best-effort mirror
    }

    await audit(payload, {
      vendor: vendorId, subscription: id, action: 'sync',
      reason: `admin patch ${Object.keys(patch).join(',')}`, actor: admin.id,
      metadata: { patch },
    })

    return NextResponse.json({ doc: sanitizeSubscription(updated as any) }, { status: 200 })
  } catch (err: any) {
    console.error('[admin/subscriptions/[id]] PATCH error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
