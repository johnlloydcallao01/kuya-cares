/**
 * @file apps/cms/src/services/MembershipService.ts
 * @description Subscription lifecycle: pure proration/dunning math plus
 * Payload helpers (resolve/canSell/trial/activate/schedule). Dependencies
 * are minimal on purpose: only membershipShared. Audit rows are written via
 * direct payload.create calls (never import BillingService here) so there
 * are no service import cycles.
 */

import type { Payload } from 'payload'
import { prorateDelta, relId, roundMoney } from '../utils/membershipShared'

function docId(value: unknown): string {
  return relId(value)
}

function endMsOf(sub: Record<string, any>): number {
  const raw = sub?.current_period_end ?? sub?.currentPeriodEnd ?? sub?.current_period_end_at
  if (raw == null || raw === '') return NaN
  return new Date(raw as string).getTime()
}

function addPeriod(from: Date, interval: string): Date {
  const next = new Date(from.getTime())
  if (interval === 'year') {
    next.setFullYear(next.getFullYear() + 1)
  } else if (interval === 'one_time') {
    next.setFullYear(next.getFullYear() + 100)
  } else {
    next.setMonth(next.getMonth() + 1)
  }
  return next
}

/** Pure mid-cycle switch math. Positive delta = charge now; negative = credit. */
export function prorateSwitch(args: {
  oldPrice: number
  newPrice: number
  periodEnd: Date | string | number
  now?: Date | string | number
}): { delta: number; remainingDays: number; effectiveImmediately: boolean } {
  const delta = prorateDelta({
    oldPrice: args.oldPrice,
    newPrice: args.newPrice,
    periodEnd: args.periodEnd,
    now: args.now,
  })
  const remainingMs = new Date(args.periodEnd).getTime() - new Date(args.now ?? new Date()).getTime()
  const remainingDays = Number.isFinite(remainingMs) && remainingMs > 0 ? Math.ceil(remainingMs / 86400000) : 0
  return { delta, remainingDays, effectiveImmediately: delta > 0 }
}

export type DunningEvent = 'payment.failed' | 'payment.paid' | 'grace_expired' | 'trial_ended'

export interface DunningTransition {
  status: string
  retryCount: number
  graceEndsAt?: string
}

/** Pure dunning state machine (no I/O, unit-testable). */
export function transitionDunning(
  sub: { status: string; retryCount?: number; graceDays?: number },
  event: DunningEvent,
): DunningTransition {
  const retryCount = Number(sub?.retryCount ?? 0) || 0
  const status = String(sub?.status ?? 'pending')
  switch (event) {
    case 'payment.paid':
      return { status: 'active', retryCount: 0 }
    case 'payment.failed': {
      if (status === 'past_due' || status === 'grace') {
        const days = Number(sub?.graceDays ?? 7) || 7
        return {
          status: 'grace',
          retryCount: retryCount + 1,
          graceEndsAt: new Date(Date.now() + days * 86400000).toISOString(),
        }
      }
      return { status: 'past_due', retryCount: retryCount + 1 }
    }
    case 'grace_expired':
      return { status: 'expired', retryCount }
    case 'trial_ended':
      return { status: 'pending', retryCount }
    default:
      return { status, retryCount }
  }
}

/** Latest in-period active|trialing subscription for a vendor, or null. */
export async function resolveActiveSubscription(payload: any, vendorId: string | number): Promise<any | null> {
  try {
    const res = await (payload as Payload).find({
      collection: 'vendor-subscriptions',
      where: { and: [{ vendor: { equals: String(vendorId) } }, { status: { in: ['active', 'trialing'] } }] },
      limit: 5,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    } as any)
    const docs = (((res as any)?.docs ?? []) as any[])
    for (const sub of docs) {
      const end = endMsOf(sub)
      if (Number.isFinite(end) && end > Date.now()) return sub
    }
    return null
  } catch {
    return null
  }
}

/** Alias of resolveActiveSubscription. */
export const getActiveSubscription = resolveActiveSubscription

/** Sellable when an in-period sub exists, a waiver is active, or Basic fallback applies. */
export async function canSell(payload: any, vendorId: string | number): Promise<boolean> {
  try {
    const sub = await resolveActiveSubscription(payload, vendorId)
    if (sub) return true
    const vendor = await (payload as Payload).findByID({
      collection: 'vendors',
      id: String(vendorId) as never,
      depth: 0,
      overrideAccess: true,
    } as any)
    const waivedRaw = (vendor as any)?.waivedUntil ?? (vendor as any)?.waived_until
    if (waivedRaw && new Date(waivedRaw).getTime() > Date.now()) return true
    if (
      process.env.BILLING_GRANDFATHER_BASIC !== 'false' &&
      ((vendor as any)?.grandfatheredBasic === true || (vendor as any)?.grandfathered_basic === true)
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Start a once-only trial for a plan with trial_days > 0. */
export async function startTrial(
  payload: any,
  args: { vendorId: string | number; planSlug: string },
): Promise<any> {
  const p = payload as any
  const plans = await p.find({
    collection: 'membership-plans',
    where: { slug: { equals: args.planSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const plan = plans?.docs?.[0]
  if (!plan) throw new Error(`PLAN_NOT_FOUND (slug=${args.planSlug})`)
  if ((Number(plan.trial_days ?? plan.trialDays ?? 0) || 0) <= 0) {
    throw new Error('PLAN_HAS_NO_TRIAL')
  }

  const existing = await resolveActiveSubscription(payload, args.vendorId)
  if (existing) return existing

  try {
    const vendor = await p.findByID({
      collection: 'vendors',
      id: String(args.vendorId),
      depth: 0,
      overrideAccess: true,
    })
    if (vendor?.trialEndsAt || vendor?.trial_ends_at) {
      throw new Error('TRIAL_ALREADY_USED')
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'TRIAL_ALREADY_USED') throw e
  }

  const trialDays = Number(plan.trial_days ?? plan.trialDays ?? 0) || 0
  const now = new Date()
  const trialEndsAt = new Date(now.getTime() + trialDays * 86400000)
  const idempotencyKey = `trial:${String(args.vendorId)}:${String(args.planSlug)}`
  try {
    const dup = await p.find({
      collection: 'vendor-subscriptions',
      where: { idempotencyKey: { equals: idempotencyKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (dup?.docs?.[0]) return dup.docs[0]
  } catch {
    // Idempotency lookup is best effort.
  }

  const snapshot = {
    name: plan.name,
    price: roundMoney(Number(plan.price) || 0),
    billing_interval: plan.billing_interval ?? plan.billingInterval ?? 'month',
    commission_percent: Number(plan.commission_percent ?? 0) || 0,
    transaction_fee: Number(plan.transaction_fee ?? 0) || 0,
    limits: plan.limits ?? {},
    capabilities: plan.capabilities ?? {},
  }
  const created = await p.create({
    collection: 'vendor-subscriptions',
    data: {
      vendor: args.vendorId,
      plan: plan.id,
      plan_version: plan.version ?? 1,
      plan_snapshot: snapshot,
      status: 'trialing',
      billing_interval: snapshot.billing_interval,
      current_period_start: now.toISOString(),
      current_period_end: trialEndsAt.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      idempotencyKey,
      payment_provider: 'manual',
    },
    overrideAccess: true,
  })

  try {
    await p.create({
      collection: 'membership-audit-log',
      data: {
        vendor: args.vendorId,
        subscription: created?.id,
        action: 'grant',
        plan_version: plan.version ?? 1,
        reason: `trial started (${trialDays}d, plan=${args.planSlug})`,
      },
      overrideAccess: true,
    })
  } catch (e) {
    console.warn('[membership] startTrial audit failed:', e)
  }
  return created
}

/**
 * Activate (or confirm) a subscription from an invoice. Idempotent: an
 * already-paid invoice returns { deduplicated: true } without side effects.
 */
export async function activateFromInvoice(
  payload: any,
  invoiceId: string | number,
  eventId: string,
): Promise<{ invoice: any; subscription: any | null; deduplicated: boolean }> {
  const p = payload as any
  const invoice = await p.findByID({
    collection: 'subscription-invoices',
    id: invoiceId,
    depth: 0,
    overrideAccess: true,
  })
  if (!invoice) throw new Error(`INVOICE_NOT_FOUND (id=${String(invoiceId)})`)
  if (invoice.status === 'paid') {
    return { invoice, subscription: null, deduplicated: true }
  }

  const now = new Date()
  const paidInvoice = await p.update({
    collection: 'subscription-invoices',
    id: invoice.id,
    data: { status: 'paid', paid_at: now.toISOString() },
    overrideAccess: true,
  })

  let subscription: any = null
  const subId = docId(invoice.subscription)
  if (subId) {
    try {
      const sub = await p.findByID({
        collection: 'vendor-subscriptions',
        id: subId,
        depth: 0,
        overrideAccess: true,
      })
      const interval = String(sub?.billing_interval ?? sub?.billingInterval ?? 'month')
      const end = addPeriod(now, interval)
      subscription = await p.update({
        collection: 'vendor-subscriptions',
        id: sub.id,
        data: {
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
          retryCount: 0,
        },
        overrideAccess: true,
      })
    } catch (e) {
      console.warn('[membership] activateFromInvoice subscription update failed:', e)
    }
  }

  try {
    await p.create({
      collection: 'membership-audit-log',
      data: {
        vendor: docId(invoice.vendor) || undefined,
        subscription: subId || undefined,
        invoice: invoice.id,
        action: 'grant',
        reason: 'activated from invoice',
        eventId,
      },
      overrideAccess: true,
    })
  } catch (e) {
    console.warn('[membership] activateFromInvoice audit failed:', e)
  }
  return { invoice: paidInvoice, subscription, deduplicated: false }
}

/** Schedule a plan change effective at the current period end (downgrade path). */
export async function scheduleChange(
  payload: any,
  subscriptionId: string | number,
  toPlanId: string | number,
): Promise<any> {
  const p = payload as any
  const sub = await p.findByID({
    collection: 'vendor-subscriptions',
    id: subscriptionId,
    depth: 0,
    overrideAccess: true,
  })
  if (!sub) throw new Error(`SUBSCRIPTION_NOT_FOUND (id=${String(subscriptionId)})`)
  const effectiveAt = sub.current_period_end ?? sub.currentPeriodEnd ?? null
  const updated = await p.update({
    collection: 'vendor-subscriptions',
    id: sub.id,
    data: { scheduledPlan: toPlanId, scheduledEffectiveAt: effectiveAt },
    overrideAccess: true,
  })
  try {
    await p.create({
      collection: 'membership-audit-log',
      data: {
        vendor: docId(sub.vendor) || undefined,
        subscription: sub.id,
        action: 'downgrade',
        reason: `scheduled change to plan ${String(toPlanId)} at period end`,
      },
      overrideAccess: true,
    })
  } catch (e) {
    console.warn('[membership] scheduleChange audit failed:', e)
  }
  return updated
}
