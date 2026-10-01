/**
 * @file apps/cms/src/app/api/admin/subscriptions/route.ts
 * @description GET list with stats byStatus (+ withAdminRequestSlot) / POST assign.
 * POST { vendorId, planSlug, billingInterval, waivedUntil?, waiveReason? } -> 201.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import crypto from 'crypto'
import { authenticateAdmin } from '@/utils/mediaLibrary'
import { withAdminRequestSlot } from '@/utils/adminRequestGate'
import {
  audit,
  sanitizeSubscription,
  clampLimit,
  getIdempotencyKey,
  findByIdempotencyKey,
  newIdempotencyKey,
  periodEndFor,
} from '@/utils/membershipApi'

export async function GET(request: NextRequest) {
  return withAdminRequestSlot(async () => {
    try {
      const payload = await getPayload({ config: configPromise })
      const admin = await authenticateAdmin(payload, request)
      if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

      const { searchParams } = new URL(request.url)
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
      const limit = clampLimit(searchParams.get('limit'))
      const status = searchParams.get('status')?.trim() || ''
      const plan = searchParams.get('plan')?.trim() || ''
      const vendor = searchParams.get('vendor')?.trim() || ''
      const search = searchParams.get('search')?.trim() || ''

      const and: any[] = []
      if (status) and.push({ status: { equals: status } })
      if (plan) and.push({ plan: { equals: plan } })
      if (vendor) and.push({ vendor: { equals: vendor } })
      if (search) and.push({ 'plan_snapshot.name': { contains: search } })
      const where = and.length ? { and } : undefined

      const res = await payload.find({
        collection: 'vendor-subscriptions' as any,
        where: where as any,
        page, limit, sort: '-createdAt', depth: 1, overrideAccess: true,
      })

      // stats.byStatus across bounded full set
      const byStatus: Record<string, number> = {}
      try {
        const all = await payload.find({
          collection: 'vendor-subscriptions' as any,
          limit: 2000, depth: 0, overrideAccess: true, pagination: false,
        } as any)
        for (const d of ((all as any).docs ?? []) as any[]) {
          const s = String(d.status || 'pending')
          byStatus[s] = (byStatus[s] || 0) + 1
        }
      } catch {
        for (const d of (res.docs as any[])) {
          const s = String((d as any).status || 'pending')
          byStatus[s] = (byStatus[s] || 0) + 1
        }
      }

      return NextResponse.json(
        {
          docs: (res.docs as any[]).map(sanitizeSubscription),
          pagination: {
            page: (res as any).page, limit: (res as any).limit,
            totalDocs: (res as any).totalDocs, totalPages: (res as any).totalPages,
            hasNextPage: (res as any).hasNextPage, hasPrevPage: (res as any).hasPrevPage,
          },
          stats: { byStatus },
        },
        { status: 200 },
      )
    } catch (err: any) {
      console.error('[admin/subscriptions] GET error:', err)
      return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
    }
  })
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const admin = await authenticateAdmin(payload, request)
    if (!admin) return NextResponse.json({ error: 'Unauthorized: admin authentication required' }, { status: 401 })

    let body: Record<string, any>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const vendorId = body.vendorId ? String(body.vendorId) : ''
    const planSlug = typeof body.planSlug === 'string' ? body.planSlug.trim() : ''
    if (!vendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    if (!planSlug) return NextResponse.json({ error: 'planSlug is required' }, { status: 400 })
    const billingInterval = body.billingInterval || 'month'
    const idemKey = getIdempotencyKey(request, body) || newIdempotencyKey()

    const prior = await findByIdempotencyKey(payload, 'vendor-subscriptions', idemKey)
    if (prior) {
      return NextResponse.json({ doc: sanitizeSubscription(prior), deduplicated: true }, { status: 200 })
    }

    const vendorDoc = await payload.findByID({ collection: 'vendors', id: vendorId as any, depth: 0, overrideAccess: true }).catch(() => null)
    if (!vendorDoc) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const plans = await payload.find({ collection: 'membership-plans' as any, where: { slug: { equals: planSlug } }, limit: 1, depth: 0, overrideAccess: true })
    const plan = plans?.docs?.[0] as any
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    const waivedUntil = body.waivedUntil ? new Date(String(body.waivedUntil)).toISOString() : null
    if (waivedUntil && Number.isNaN(new Date(waivedUntil).getTime())) {
      return NextResponse.json({ error: 'waivedUntil must be a valid date' }, { status: 400 })
    }

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
        status: waivedUntil ? 'active' : 'active',
        billing_interval: billingInterval,
        current_period_start: new Date().toISOString(),
        current_period_end: periodEndFor(billingInterval),
        waivedUntil,
        waiveReason: body.waiveReason ?? null,
        auto_renew: true,
        payment_provider: 'manual',
        idempotencyKey: idemKey,
        meta: { assignedBy: admin.id, manual: true },
      } as any,
      overrideAccess: true,
    })

    await audit(payload, {
      vendor: vendorId, subscription: (sub as any).id, action: 'grant',
      reason: body.waiveReason || `admin assign plan=${planSlug}`, actor: admin.id,
      metadata: { planSlug, billingInterval, waivedUntil, manual: true, keySuffix: crypto.randomUUID().slice(0, 8) },
    })

    return NextResponse.json({ doc: sanitizeSubscription(sub as any) }, { status: 201 })
  } catch (err: any) {
    console.error('[admin/subscriptions] POST error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
