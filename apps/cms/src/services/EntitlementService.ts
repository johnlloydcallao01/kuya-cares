/**
 * @file apps/cms/src/services/EntitlementService.ts
 * @description Centralized can(action, vendor) evaluator. Gating reads the
 * materialized vendor-entitlements doc plus subscription status and
 * waivedUntil — never the plan directly. No Next imports (payload-only).
 */

import type { Payload } from 'payload'

export type MembershipAction =
  | 'publish_outlet'
  | 'create_product'
  | 'create_coupon'
  | 'view_analytics'
  | 'accept_orders'

export type EntitlementCode = 'PAYWALLED' | 'QUOTA_EXCEEDED' | 'SUSPENDED'

export interface EntitlementDecision {
  allowed: boolean
  code?: EntitlementCode
  plan?: string
}

const WRITE_ACTIONS: MembershipAction[] = ['publish_outlet', 'create_product', 'create_coupon', 'accept_orders']

const READ_ONLY_STATUSES = new Set(['past_due', 'grace', 'suspended'])

/** Capability flag required per action (null = no flag needed beyond active). */
function requiredCapability(action: MembershipAction): string | null {
  switch (action) {
    case 'create_coupon':
      return 'promos'
    case 'view_analytics':
      return 'analytics'
    default:
      return null
  }
}

async function loadVendor(payload: any, vendorId: string): Promise<any | null> {
  try {
    return await (payload as Payload).findByID({
      collection: 'vendors',
      id: vendorId as never,
      depth: 0,
      overrideAccess: true,
    } as any)
  } catch {
    return null
  }
}

async function loadActiveSubscription(payload: any, vendorId: string): Promise<any | null> {
  try {
    const res = await (payload as Payload).find({
      collection: 'vendor-subscriptions',
      where: { and: [{ vendor: { equals: vendorId } }, { status: { in: ['active', 'trialing'] } }] },
      limit: 5,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    } as any)
    const docs = (((res as any)?.docs ?? []) as any[])
    for (const sub of docs) {
      const raw = sub?.current_period_end ?? sub?.currentPeriodEnd
      if (raw && new Date(raw).getTime() > Date.now()) return sub
    }
    return null
  } catch {
    return null
  }
}

async function loadEntitlements(payload: any, vendorId: string): Promise<any | null> {
  try {
    const res = await (payload as Payload).find({
      collection: 'vendor-entitlements',
      where: { vendor: { equals: vendorId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    } as any)
    return ((res as any)?.docs?.[0] as any) ?? null
  } catch {
    return null
  }
}

function planNameOf(sub: any, entitlements: any): string | undefined {
  const snap = sub?.plan_snapshot ?? sub?.planSnapshot
  if (snap && typeof snap.name === 'string' && snap.name) return snap.name
  const plan = sub?.plan
  if (plan && typeof plan === 'object' && typeof plan.name === 'string') return plan.name
  const entPlan = entitlements?.plan
  if (entPlan && typeof entPlan === 'object' && typeof entPlan.name === 'string') return entPlan.name
  return undefined
}

/**
 * Evaluate whether a vendor may perform an action.
 * Waived vendors are always allowed; grace/suspended vendors keep reads
 * (view_analytics) but lose writes; vendors without a subscription are
 * paywalled. Missing entitlement docs fail open for active subs.
 */
export async function can(
  payload: any,
  action: MembershipAction,
  vendorId: string | number,
): Promise<EntitlementDecision> {
  const id = String(vendorId ?? '')
  if (!id) return { allowed: false, code: 'PAYWALLED' }

  const vendor = await loadVendor(payload, id)
  const waivedRaw = vendor?.waivedUntil ?? vendor?.waived_until
  if (waivedRaw && new Date(waivedRaw).getTime() > Date.now()) {
    return { allowed: true }
  }

  const subscription = await loadActiveSubscription(payload, id)
  const entitlements = await loadEntitlements(payload, id)
  const plan = planNameOf(subscription, entitlements)

  if (!subscription) {
    if (
      process.env.BILLING_GRANDFATHER_BASIC !== 'false' &&
      (vendor?.grandfatheredBasic === true || vendor?.grandfathered_basic === true)
    ) {
      return { allowed: action !== 'create_coupon', code: action === 'create_coupon' ? 'PAYWALLED' : undefined, plan: plan ?? 'Basic' }
    }
    return { allowed: false, code: 'PAYWALLED', plan }
  }

  const status = String(subscription.status ?? 'active')
  if (READ_ONLY_STATUSES.has(status) && (WRITE_ACTIONS as string[]).includes(action)) {
    return { allowed: false, code: 'SUSPENDED', plan }
  }

  const flag = requiredCapability(action)
  if (flag && entitlements?.capabilities && typeof entitlements.capabilities === 'object') {
    if (entitlements.capabilities[flag] === false) {
      return { allowed: false, code: 'PAYWALLED', plan }
    }
  }

  return { allowed: true, plan }
}

export class EntitlementService {
  constructor(private readonly payload: Payload) {}

  can(action: MembershipAction, vendorId: string | number): Promise<EntitlementDecision> {
    return can(this.payload, action, vendorId)
  }
}
