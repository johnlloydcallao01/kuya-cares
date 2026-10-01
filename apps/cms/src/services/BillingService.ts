/**
 * @file apps/cms/src/services/BillingService.ts
 * @description Membership invoices + dunning machine. Pure Payload I/O over
 * subscription-invoices / vendor-subscriptions / vendors /
 * vendor-entitlements / membership-audit-log.
 *
 * NOTE: this module intentionally never calls the network. Membership
 * provider types are imported type-only (see MembershipProviders alias);
 * checkout routes call getMembershipProvider().createMembershipIntent and
 * persist the returned paymentRef here via createInvoice/update paths.
 */

import type { Payload } from 'payload'
import type * as MembershipProviders from './membershipProviders'
import { roundMoney } from '../utils/membershipShared'
import { log as auditLog } from './MembershipAuditService'

// Type-only reference: proves the provider contract without runtime import.
type _BillingProviderContract = MembershipProviders.BillingProvider

export type BillingReason = 'initial' | 'upgrade' | 'downgrade' | 'renewal' | 'proration' | 'manual'

export interface CreateInvoiceArgs {
  vendorId: string | number
  planId: string | number
  billingReason: BillingReason
  idempotencyKey: string
  couponCode?: string | null
  payment_provider?: 'paymongo' | 'stripe' | 'manual'
  prorationDelta?: number
}

function docId(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).id)
  }
  return ''
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

async function bestEffortCouponDiscount(payload: any, couponCode: string, price: number): Promise<number> {
  try {
    const found = await (payload as Payload).find({
      collection: 'coupons',
      where: {
        and: [{ code: { equals: couponCode.toUpperCase().trim() } }, { status: { equals: 'published' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    } as any)
    const coupon = (found as any)?.docs?.[0]
    if (!coupon) return 0
    const amount = Number(coupon.amount) || 0
    const dtype = String(coupon.discount_type ?? coupon.discountType ?? 'fixed')
    if (dtype === 'percent') {
      return roundMoney((price * Math.min(100, Math.max(0, amount))) / 100)
    }
    return roundMoney(Math.min(price, Math.max(0, amount)))
  } catch {
    return 0
  }
}

/**
 * Create a pending invoice (idempotent on idempotencyKey) and ensure a
 * pending vendor-subscription row exists for the vendor+plan pair.
 */
export async function createInvoice(
  payload: any,
  args: CreateInvoiceArgs,
): Promise<{ invoice: any; subscription: any | null; deduplicated: boolean }> {
  const p = payload as any
  try {
    const dup = await (p as Payload).find({
      collection: 'subscription-invoices',
      where: { idempotencyKey: { equals: args.idempotencyKey } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    } as any)
    if ((dup as any)?.docs?.[0]) {
      return { invoice: (dup as any).docs[0], subscription: null, deduplicated: true }
    }
  } catch {
    // Idempotency lookup is best effort.
  }

  const plan = await p.findByID({
    collection: 'membership-plans',
    id: args.planId,
    depth: 0,
    overrideAccess: true,
  })
  if (!plan) throw new Error(`PLAN_NOT_FOUND (id=${String(args.planId)})`)
  const vendor = await p.findByID({
    collection: 'vendors',
    id: args.vendorId,
    depth: 0,
    overrideAccess: true,
  })
  if (!vendor) throw new Error(`VENDOR_NOT_FOUND (id=${String(args.vendorId)})`)

  const price = roundMoney(Number(plan.price) || 0)
  const discount = args.couponCode
    ? await bestEffortCouponDiscount(payload, String(args.couponCode), price)
    : 0
  const proration = roundMoney(Number(args.prorationDelta) || 0)
  const amount = Math.max(0, roundMoney(price - discount + proration))

  let subscription: any = null
  try {
    const existing = await (p as Payload).find({
      collection: 'vendor-subscriptions',
      where: {
        and: [
          { vendor: { equals: String(args.vendorId) } },
          { plan: { equals: String(args.planId) } },
          { status: { equals: 'pending' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    } as any)
    subscription = (existing as any)?.docs?.[0] ?? null
  } catch {
    subscription = null
  }
  if (!subscription) {
    try {
      subscription = await p.create({
        collection: 'vendor-subscriptions',
        data: {
          vendor: args.vendorId,
          plan: args.planId,
          status: 'pending',
          idempotencyKey: `sub:${args.idempotencyKey}`,
          payment_provider: args.payment_provider ?? 'paymongo',
        },
        overrideAccess: true,
      })
    } catch {
      subscription = null
    }
  }

  const now = new Date()
  const invoiceNumber = `INV-${now.getUTCFullYear()}-${Math.random()
    .toString(36)
    .slice(2, 8)
    .toUpperCase()
    .padStart(6, '0')}`
  const interval = String(plan.billing_interval ?? plan.billingInterval ?? 'month')
  const invoice = await p.create({
    collection: 'subscription-invoices',
    data: {
      subscription: subscription?.id ?? undefined,
      vendor: args.vendorId,
      plan: args.planId,
      invoice_number: invoiceNumber,
      amount,
      currency: 'PHP',
      status: 'pending',
      billingReason: args.billingReason,
      prorationDelta: proration,
      discount_amount: discount,
      couponCode: args.couponCode ?? undefined,
      payment_provider: args.payment_provider ?? 'paymongo',
      period_start: now.toISOString(),
      period_end: addPeriod(now, interval).toISOString(),
      due_at: now.toISOString(),
      idempotencyKey: args.idempotencyKey,
    },
    overrideAccess: true,
  })

  await auditLog(payload, {
    vendor: args.vendorId,
    subscription: subscription?.id ?? null,
    invoice: invoice?.id ?? null,
    action: 'sync',
    reason: `invoice created (${args.billingReason}, amount=${amount})`,
    metadata: { idempotencyKey: args.idempotencyKey },
  })
  return { invoice, subscription, deduplicated: false }
}

/** Mark an invoice paid by provider payment ref (webhook path, replay-safe). */
export async function handlePaid(
  payload: any,
  paymentRef: string,
  eventId: string,
): Promise<{ invoice: any; subscription: any | null; deduplicated: boolean }> {
  const p = payload as any
  try {
    const seen = await (p as Payload).find({
      collection: 'membership-audit-log',
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    } as any)
    if ((seen as any)?.docs?.[0]) {
      return { invoice: null, subscription: null, deduplicated: true }
    }
  } catch {
    // Replay guard is best effort.
  }

  const found = await (p as Payload).find({
    collection: 'subscription-invoices',
    where: { provider_payment_intent: { equals: paymentRef } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  const invoice = (found as any)?.docs?.[0]
  if (!invoice) throw new Error(`INVOICE_NOT_FOUND (paymentRef=${paymentRef})`)
  if (invoice.status === 'paid') {
    await auditLog(payload, {
      vendor: docId(invoice.vendor) || paymentRef,
      subscription: docId(invoice.subscription) || null,
      invoice: invoice.id,
      action: 'webhook_paid',
      reason: 'duplicate paid event',
      eventId,
    })
    return { invoice, subscription: null, deduplicated: true }
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const paidInvoice = await p.update({
    collection: 'subscription-invoices',
    id: invoice.id,
    data: { status: 'paid', paid_at: nowIso },
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
          current_period_start: nowIso,
          current_period_end: end.toISOString(),
          retryCount: 0,
        },
        overrideAccess: true,
      })
      const vendorId = docId(sub.vendor) || docId(invoice.vendor)
      if (vendorId) {
        try {
          await p.update({
            collection: 'vendors',
            id: vendorId,
            data: {
              currentSubscription: sub.id,
              subscriptionStatus: 'active',
              subscriptionExpiresAt: end.toISOString(),
            },
            overrideAccess: true,
          })
        } catch (e) {
          console.warn('[billing] handlePaid vendor denormalize failed:', e)
        }
        try {
          const existing = await (p as Payload).find({
            collection: 'vendor-entitlements',
            where: { vendor: { equals: vendorId } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          } as any)
          const row = (existing as any)?.docs?.[0]
          const entData = {
            vendor: vendorId,
            subscription: sub.id,
            plan: docId(sub.plan) || undefined,
            expires_at: end.toISOString(),
            reason: 'webhook_paid',
          }
          if (row) {
            await p.update({ collection: 'vendor-entitlements', id: row.id, data: entData, overrideAccess: true })
          } else {
            await p.create({ collection: 'vendor-entitlements', data: entData, overrideAccess: true })
          }
        } catch (e) {
          console.warn('[billing] handlePaid entitlement upsert failed:', e)
        }
      }
    } catch (e) {
      console.warn('[billing] handlePaid subscription activation failed:', e)
    }
  }

  await auditLog(payload, {
    vendor: docId(invoice.vendor) || paymentRef,
    subscription: subId || null,
    invoice: invoice.id,
    action: 'webhook_paid',
    reason: `invoice paid (ref=${paymentRef})`,
    eventId,
  })
  return { invoice: paidInvoice, subscription, deduplicated: false }
}

/** Record a failed payment: invoice to past_due/failed, subscription to past_due. */
export async function handleFailed(
  payload: any,
  paymentRef: string,
  eventId: string,
): Promise<{ invoice: any; deduplicated: boolean }> {
  const p = payload as any
  try {
    const seen = await (p as Payload).find({
      collection: 'membership-audit-log',
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    } as any)
    if ((seen as any)?.docs?.[0]) {
      return { invoice: null, deduplicated: true }
    }
  } catch {
    // Replay guard is best effort.
  }

  const found = await (p as Payload).find({
    collection: 'subscription-invoices',
    where: { provider_payment_intent: { equals: paymentRef } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  } as any)
  const invoice = (found as any)?.docs?.[0]
  if (!invoice) throw new Error(`INVOICE_NOT_FOUND (paymentRef=${paymentRef})`)
  if (invoice.status === 'paid') {
    return { invoice, deduplicated: true }
  }

  const retryCount = (Number(invoice.retry_count ?? invoice.retryCount ?? 0) || 0) + 1
  const updated = await p.update({
    collection: 'subscription-invoices',
    id: invoice.id,
    data: { status: 'past_due', retry_count: retryCount, failure_reason: `payment failed (ref=${paymentRef})` },
    overrideAccess: true,
  })

  const subId = docId(invoice.subscription)
  if (subId) {
    try {
      await p.update({
        collection: 'vendor-subscriptions',
        id: subId,
        data: { status: 'past_due', retryCount },
        overrideAccess: true,
      })
    } catch (e) {
      console.warn('[billing] handleFailed subscription update failed:', e)
    }
  }

  await auditLog(payload, {
    vendor: docId(invoice.vendor) || paymentRef,
    subscription: subId || null,
    invoice: invoice.id,
    action: 'webhook_failed',
    reason: `payment failed (ref=${paymentRef}, retry=${retryCount})`,
    eventId,
  })
  return { invoice: updated, deduplicated: false }
}

/** Admin void (pending|failed|past_due) or refund (paid only) of an invoice. */
export async function refundOrVoid(
  payload: any,
  invoiceId: string | number,
  action: 'refund' | 'void',
  reason: string,
  actorId?: string | number | null,
): Promise<any> {
  const p = payload as any
  const invoice = await p.findByID({
    collection: 'subscription-invoices',
    id: invoiceId,
    depth: 0,
    overrideAccess: true,
  })
  if (!invoice) throw new Error(`INVOICE_NOT_FOUND (id=${String(invoiceId)})`)
  const status = String(invoice.status ?? 'pending')
  if (action === 'void' && !['pending', 'failed', 'past_due'].includes(status)) {
    throw new Error(`INVOICE_NOT_VOIDABLE (status=${status})`)
  }
  if (action === 'refund' && status !== 'paid') {
    throw new Error(`INVOICE_NOT_REFUNDABLE (status=${status})`)
  }
  const updated = await p.update({
    collection: 'subscription-invoices',
    id: invoice.id,
    data: { status: action === 'void' ? 'void' : 'refunded' },
    overrideAccess: true,
  })
  await auditLog(payload, {
    vendor: docId(invoice.vendor) || String(invoiceId),
    subscription: docId(invoice.subscription) || null,
    invoice: invoice.id,
    action: 'override',
    reason: `${action}: ${reason}`,
    actor: actorId ?? null,
  })
  return updated
}

/** Dunning sweep: bump retries on overdue invoices, expire lapsed grace subs. */
export async function retryDue(payload: any): Promise<{ invoicesRetried: number; subscriptionsExpired: number }> {
  const p = payload as any
  let invoicesRetried = 0
  let subscriptionsExpired = 0
  try {
    const overdue = await (p as Payload).find({
      collection: 'subscription-invoices',
      where: {
        and: [{ status: { in: ['pending', 'past_due'] } }, { due_at: { less_than: new Date().toISOString() } }],
      },
      limit: 100,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    } as any)
    for (const inv of (((overdue as any)?.docs ?? []) as any[])) {
      try {
        const retryCount = (Number(inv.retry_count ?? 0) || 0) + 1
        await p.update({
          collection: 'subscription-invoices',
          id: inv.id,
          data: { status: 'past_due', retry_count: retryCount },
          overrideAccess: true,
        })
        invoicesRetried += 1
      } catch {
        // Per-row best effort.
      }
    }
  } catch (e) {
    console.warn('[billing] retryDue invoice sweep failed:', e)
  }
  try {
    const lapsed = await (p as Payload).find({
      collection: 'vendor-subscriptions',
      where: {
        and: [{ status: { in: ['past_due', 'grace'] } }, { current_period_end: { less_than: new Date().toISOString() } }],
      },
      limit: 100,
      depth: 0,
      pagination: false,
      overrideAccess: true,
    } as any)
    for (const sub of (((lapsed as any)?.docs ?? []) as any[])) {
      try {
        await p.update({
          collection: 'vendor-subscriptions',
          id: sub.id,
          data: { status: 'expired' },
          overrideAccess: true,
        })
        subscriptionsExpired += 1
      } catch {
        // Per-row best effort.
      }
    }
  } catch (e) {
    console.warn('[billing] retryDue subscription sweep failed:', e)
  }
  return { invoicesRetried, subscriptionsExpired }
}
