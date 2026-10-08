/**
 * @file apps/cms/src/app/api/vendor/subscription/trial/route.ts
 * @description Start a once-only trial. POST { planSlug } -> 200/201 else 422 TRIAL_ALREADY_USED.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import crypto from 'crypto'
import { authenticateVendorOrMember } from '@/utils/mediaLibrary'
import {
  audit,
  checkRateLimit,
  isMissingCollection,
  periodEndFor,
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
    const limited = checkRateLimit('vendor-trial', `vendor:${vendorId}`, 5, 60 * 60 * 1000)
    if (limited) return limited

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const cross = forbidCrossVendor(vendorId, body.vendorId ?? body.vendor)
    if (cross) return cross
    const planSlug = typeof body.planSlug === 'string' ? body.planSlug.trim() : ''
    if (!planSlug) return NextResponse.json({ error: 'planSlug is required' }, { status: 400 })

    // Once-only guard: vendor.trialEndsAt null + no prior trialing event
    try {
      const vendorDoc = await payload.findByID({ collection: 'vendors', id: vendorId as any, depth: 0, overrideAccess: true }) as any
      if (vendorDoc?.trialEndsAt || vendorDoc?.trial_ends_at) {
        return NextResponse.json({ error: 'Trial already used', code: 'TRIAL_ALREADY_USED' }, { status: 422 })
      }
    } catch {
      // best-effort
    }
    try {
      const priorTrial = await payload.find({
        collection: 'vendor-subscriptions' as any,
        where: { and: [{ vendor: { equals: vendorId } }, { status: { equals: 'trialing' } }] },
        limit: 1, depth: 0, overrideAccess: true,
      })
      if ((priorTrial?.docs?.length ?? 0) > 0) {
        return NextResponse.json({ error: 'Trial already used', code: 'TRIAL_ALREADY_USED' }, { status: 422 })
      }
      const auditPrior = await payload.find({
        collection: 'membership-audit-log' as any,
        where: { and: [{ vendor: { equals: vendorId } }, { action: { equals: 'trial_started' } }] },
        limit: 1, depth: 0, overrideAccess: true,
      }).catch(() => ({ docs: [] }))
      if (((auditPrior as any)?.docs?.length ?? 0) > 0) {
        return NextResponse.json({ error: 'Trial already used', code: 'TRIAL_ALREADY_USED' }, { status: 422 })
      }
    } catch (err: any) {
      if (isMissingCollection(err)) return NextResponse.json({ error: 'Membership collections not installed', code: 'COLLECTION_MISSING' }, { status: 500 })
      throw err
    }

    const plans = await payload.find({ collection: 'membership-plans' as any, where: { slug: { equals: planSlug } }, limit: 1, depth: 0, overrideAccess: true })
    const plan = plans?.docs?.[0] as any
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    const planStatus = String(plan.status ?? 'active')
    if (!['active', 'hidden'].includes(planStatus)) {
      return NextResponse.json({ error: 'Plan is not available', code: 'PLAN_UNAVAILABLE' }, { status: 422 })
    }
    const trialDays = Number(plan.trial_days ?? plan.trialDays ?? 0) || 0
    if (trialDays <= 0) {
      return NextResponse.json({ error: 'Plan has no trial', code: 'NO_TRIAL' }, { status: 422 })
    }

    const trialEndsAt = new Date(Date.now() + trialDays * 86400000).toISOString()
    const billingInterval = String(plan.billing_interval ?? plan.billingInterval ?? 'month')
    const sub = await payload.create({
      collection: 'vendor-subscriptions' as any,
      data: {
        vendor: vendorId,
        plan: plan.id,
        plan_version: plan.version ?? 1,
        plan_snapshot: {
          name: plan.name, price: plan.price, billing_interval: billingInterval,
          commission_percent: plan.commission_percent ?? 0, transaction_fee: plan.transaction_fee ?? 0,
          limits: plan.limits ?? null, capabilities: plan.capabilities ?? null,
        },
        status: 'trialing',
        billing_interval: billingInterval,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEndFor(billingInterval),
        trial_ends_at: trialEndsAt,
        auto_renew: true,
        payment_provider: 'paymongo',
        idempotencyKey: `trial:${vendorId}:${crypto.randomUUID()}`,
      } as any,
      overrideAccess: true,
    })

    await audit(payload, {
      vendor: vendorId, subscription: (sub as any).id, action: 'trial_started',
      reason: `trial plan=${planSlug} days=${trialDays}`, actor: vendorUser.id,
      metadata: { planSlug, trialEndsAt },
    })

    return NextResponse.json({ subscriptionId: (sub as any).id, trialEndsAt }, { status: 201 })
  } catch (err: any) {
    console.error('[vendor/subscription/trial] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
