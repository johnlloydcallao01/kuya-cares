/**
 * @file apps/cms/src/app/api/vendor/subscription/route.ts
 * @description GET current vendor subscription + plan + entitlements + usage.
 * 200 when active/trialing; 402 {code:PAYWALLED,...} when paywalled.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { authenticateVendor } from '@/utils/mediaLibrary'
import {
  sanitizeInvoice,
  sanitizePlan,
  sanitizeSubscription,
  paywalled,
  resolveOwnVendorId,
  safeFind,
} from '@/utils/membershipApi'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const vendorUser = await authenticateVendor(payload, request)
    if (!vendorUser) return NextResponse.json({ error: 'Unauthorized: vendor authentication required' }, { status: 401 })
    const vendorId = await resolveOwnVendorId(payload, vendorUser.id)
    if (!vendorId) return NextResponse.json({ error: 'Vendor profile not found' }, { status: 404 })

    const subs = await safeFind(payload, 'vendor-subscriptions', {
      where: { vendor: { equals: vendorId } },
      limit: 1, sort: '-createdAt', depth: 1, overrideAccess: true,
    })
    const current = subs.docs[0] as any
    if (!current) {
      return paywalled({ vendorId, subscriptionStatus: 'none', code: 'SUBSCRIPTION_REQUIRED' })
    }

    const status = String(current.status ?? 'pending')
    const planRaw = current.plan && typeof current.plan === 'object' ? current.plan : null
    const plan = planRaw ? sanitizePlan(planRaw) : null
    const subscription = sanitizeSubscription(current)

    // Entitlements snapshot (gating reads this, never the plan directly)
    let entitlements: Record<string, any> | null = null
    try {
      const ent = await safeFind(payload, 'vendor-entitlements', {
        where: { vendor: { equals: vendorId } },
        limit: 1, depth: 0, overrideAccess: true,
      })
      const e = ent.docs[0] as any
      if (e) {
        entitlements = {
          canPublishOutlet: ['trialing', 'active'].includes(status),
          canCreateCoupon: Boolean(e.capabilities?.promos ?? planRaw?.capabilities?.promos ?? false),
          maxOutlets: e.limits_snapshot?.max_merchants ?? planRaw?.limits?.max_merchants ?? 1,
          capabilities: e.capabilities ?? null,
          limits: e.limits_snapshot ?? null,
        }
      }
    } catch {
      entitlements = null
    }
    if (!entitlements) {
      const caps = planRaw?.capabilities ?? current.plan_snapshot?.capabilities ?? {}
      const limits = planRaw?.limits ?? current.plan_snapshot?.limits ?? {}
      entitlements = {
        canPublishOutlet: ['trialing', 'active'].includes(status),
        canCreateCoupon: Boolean(caps?.promos ?? false),
        maxOutlets: limits?.max_merchants ?? limits?.maxOutlets ?? 1,
        capabilities: caps,
        limits,
      }
    }

    // Last 5 invoices
    const invRes = await safeFind(payload, 'subscription-invoices', {
      where: { vendor: { equals: vendorId } },
      limit: 5, sort: '-createdAt', depth: 0, overrideAccess: true,
    })
    const invoices = invRes.docs.map(sanitizeInvoice)

    const now = Date.now()
    const trialEndsAt = current.trial_ends_at ?? current.trialEndsAt ?? null
    const graceEndsAt = current.grace_ends_at ?? current.graceEndsAt ?? null
    const trialActive = status === 'trialing' && trialEndsAt ? new Date(String(trialEndsAt)).getTime() > now : status === 'trialing'
    const graceActive = ['past_due', 'grace'].includes(status)
    const daysLeft = graceEndsAt ? Math.max(0, Math.ceil((new Date(String(graceEndsAt)).getTime() - now) / 86400000)) : 0

    const usage = current.usage ?? { outlets: 0, products: 0, ordersThisCycle: 0 }

    const body = {
      subscription,
      plan,
      entitlements,
      usage,
      invoices,
      trial: { active: trialActive, endsAt: trialEndsAt },
      grace: { active: graceActive, daysLeft },
    }

    if (!['trialing', 'active'].includes(status)) {
      return NextResponse.json(
        {
          ...body,
          error: 'Active membership required to sell',
          code: 'PAYWALLED',
          vendorId,
          subscriptionStatus: status,
          requiredPlan: plan?.name ?? 'Basic',
          status: 402,
        },
        { status: 402 },
      )
    }

    return NextResponse.json(body, { status: 200 })
  } catch (err: any) {
    console.error('[vendor/subscription] GET error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
