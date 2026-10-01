/**
 * @file apps/cms/src/utils/membershipApi.ts
 * @description Shared defensive helpers for membership BFF routes + webhook endpoints.
 * All payload collection access is wrapped so routes survive when the membership
 * collections/services (created in parallel per membership.md Phase 0-1) are missing:
 * prefer `@/services/*` / `@/utils/*` when present, fall back to inline logic.
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Optional parallel-created modules (loaded at runtime only, never bundled)
// ---------------------------------------------------------------------------

/** Runtime-only dynamic import that never breaks the bundler if target is absent. */
export async function loadOptionalModule(specifier: string): Promise<any | null> {
  try {
    const loader = new Function('s', 'return import(s)') as (s: string) => Promise<any>
    const mod = await loader(specifier)
    return mod ?? null
  } catch {
    return null
  }
}

export async function loadOptionalBillingService(): Promise<any | null> {
  const m = await loadOptionalModule('@/services/BillingService')
  return m?.BillingService ?? m?.default ?? m ?? null
}

export async function loadOptionalMembershipService(): Promise<any | null> {
  const m = await loadOptionalModule('@/services/MembershipService')
  return m?.MembershipService ?? m?.default ?? m ?? null
}

export async function loadOptionalGuard(): Promise<any | null> {
  const m = await loadOptionalModule('@/utils/membershipGuard')
  return m ?? null
}

export async function loadOptionalSchemas(): Promise<any | null> {
  const m = await loadOptionalModule('@/utils/membershipSchemas')
  return m ?? null
}

// ---------------------------------------------------------------------------
// Rate limiting (in-memory, mirrors payload.config.ts pattern)
// ---------------------------------------------------------------------------

type RateEntry = { count: number; resetAt: number }
const globalMaps = globalThis as unknown & {
  __membershipRateMaps?: Map<string, Map<string, RateEntry>>
}

function mapFor(name: string): Map<string, RateEntry> {
  if (!globalMaps.__membershipRateMaps) globalMaps.__membershipRateMaps = new Map()
  let m = globalMaps.__membershipRateMaps.get(name)
  if (!m) {
    m = new Map()
    globalMaps.__membershipRateMaps.set(name, m)
  }
  return m
}

/** Returns null when allowed, or a 429 NextResponse when limited. */
export function checkRateLimit(
  mapName: string,
  key: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const now = Date.now()
  const map = mapFor(mapName)
  const entry = map.get(key)
  if (!entry || now > entry.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  if (entry.count >= limit) {
    return NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED' },
      { status: 429 },
    )
  }
  entry.count += 1
  return null
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

export function getIdempotencyKey(request: NextRequest, body?: Record<string, any>): string | null {
  const header =
    request.headers.get('Idempotency-Key') || request.headers.get('idempotency-key')
  if (header && header.trim()) return header.trim()
  const b = body?.idempotencyKey
  if (typeof b === 'string' && b.trim()) return b.trim()
  return null
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** Lookup prior doc by idempotencyKey; null when collection missing or no match. */
export async function findByIdempotencyKey(
  payload: any,
  collection: string,
  key: string,
): Promise<Record<string, any> | null> {
  try {
    const res = await payload.find({
      collection: collection as any,
      where: { idempotencyKey: { equals: key } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return (res?.docs?.[0] as Record<string, any>) ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Sanitizers (strip raw provider blobs)
// ---------------------------------------------------------------------------

const PROVIDER_BLOB_KEYS = new Set([
  'raw',
  'rawPayload',
  'rawResponse',
  'providerRaw',
  'provider_payload',
  'providerResponse',
  'secret',
  'clientSecret',
  'webhookSecret',
])

export function stripProviderBlobs<T>(doc: T): T {
  if (!doc || typeof doc !== 'object') return doc
  if (Array.isArray(doc)) return doc.map(stripProviderBlobs) as unknown as T
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(doc as Record<string, any>)) {
    if (PROVIDER_BLOB_KEYS.has(k)) continue
    if (k === 'meta' && v && typeof v === 'object') {
      const meta = { ...(v as Record<string, any>) }
      for (const b of PROVIDER_BLOB_KEYS) delete meta[b]
      out[k] = meta
      continue
    }
    if (k === 'metadata' && v && typeof v === 'object') {
      const md = { ...(v as Record<string, any>) }
      for (const b of PROVIDER_BLOB_KEYS) delete md[b]
      out[k] = md
      continue
    }
    out[k] = v && typeof v === 'object' ? stripProviderBlobs(v) : v
  }
  return out as T
}

function relId(v: unknown): string | number | null {
  if (v == null) return null
  if (typeof v === 'object') return (v as any).id ?? null
  return v as string | number
}

export function sanitizePlan(raw: Record<string, any>): Record<string, any> {
  if (!raw) return raw
  const d = stripProviderBlobs<Record<string, any>>(raw)
  return {
    id: d.id,
    name: d.name ?? null,
    slug: d.slug ?? null,
    description: d.description ?? null,
    price: typeof d.price === 'number' ? d.price : Number(d.price ?? 0),
    currency: d.currency ?? 'PHP',
    billing_interval: d.billing_interval ?? d.billingInterval ?? 'month',
    trial_days: d.trial_days ?? d.trialDays ?? 0,
    grace_days: d.grace_days ?? d.graceDays ?? 7,
    commission_percent: d.commission_percent ?? d.commissionPercent ?? 0,
    transaction_fee: d.transaction_fee ?? d.transactionFee ?? 0,
    limits: d.limits ?? null,
    capabilities: d.capabilities ?? null,
    status: d.status ?? 'active',
    display_order: d.display_order ?? d.displayOrder ?? 0,
    version: d.version ?? 1,
    createdAt: d.createdAt ?? null,
    updatedAt: d.updatedAt ?? null,
  }
}

export function sanitizeSubscription(raw: Record<string, any>): Record<string, any> {
  if (!raw) return raw
  const d = stripProviderBlobs<Record<string, any>>(raw)
  return {
    id: d.id,
    vendor: relId(d.vendor),
    plan: relId(d.plan),
    plan_version: d.plan_version ?? d.planVersion ?? 1,
    plan_snapshot: d.plan_snapshot ?? d.planSnapshot ?? null,
    status: d.status ?? 'pending',
    billing_interval: d.billing_interval ?? d.billingInterval ?? null,
    current_period_start: d.current_period_start ?? d.currentPeriodStart ?? null,
    current_period_end: d.current_period_end ?? d.currentPeriodEnd ?? null,
    trial_ends_at: d.trial_ends_at ?? d.trialEndsAt ?? null,
    grace_ends_at: d.grace_ends_at ?? d.graceEndsAt ?? null,
    cancel_at: d.cancel_at ?? d.cancelAt ?? null,
    cancelled_at: d.cancelled_at ?? d.cancelledAt ?? null,
    cancelAtPeriodEnd: d.cancelAtPeriodEnd ?? false,
    scheduledPlan: relId(d.scheduledPlan ?? d.scheduled_plan),
    scheduledEffectiveAt: d.scheduledEffectiveAt ?? d.scheduled_effective_at ?? null,
    auto_renew: d.auto_renew ?? d.autoRenew ?? true,
    payment_provider: d.payment_provider ?? d.paymentProvider ?? 'paymongo',
    waivedUntil: d.waivedUntil ?? d.waived_until ?? null,
    retryCount: d.retryCount ?? d.retry_count ?? 0,
    usage: d.usage ?? null,
    grandfathered: d.grandfathered ?? false,
    createdAt: d.createdAt ?? null,
    updatedAt: d.updatedAt ?? null,
  }
}

export function sanitizeInvoice(raw: Record<string, any>): Record<string, any> {
  if (!raw) return raw
  const d = stripProviderBlobs<Record<string, any>>(raw)
  return {
    id: d.id,
    invoice_number: d.invoice_number ?? d.invoiceNumber ?? null,
    subscription: relId(d.subscription),
    vendor: relId(d.vendor),
    plan: relId(d.plan),
    amount: typeof d.amount === 'number' ? d.amount : Number(d.amount ?? 0),
    currency: d.currency ?? 'PHP',
    commission_due: d.commission_due ?? d.commissionDue ?? 0,
    status: d.status ?? 'pending',
    billingReason: d.billingReason ?? d.billing_reason ?? null,
    prorationDelta: d.prorationDelta ?? d.proration_delta ?? 0,
    discount_amount: d.discount_amount ?? d.discountAmount ?? 0,
    couponCode: d.couponCode ?? d.coupon_code ?? null,
    payment_provider: d.payment_provider ?? d.paymentProvider ?? 'paymongo',
    payment_link_url: d.payment_link_url ?? d.paymentLinkUrl ?? d.checkoutUrl ?? null,
    checkoutUrl: d.checkoutUrl ?? d.payment_link_url ?? d.paymentLinkUrl ?? null,
    period_start: d.period_start ?? d.periodStart ?? null,
    period_end: d.period_end ?? d.periodEnd ?? null,
    due_at: d.due_at ?? d.dueAt ?? null,
    paid_at: d.paid_at ?? d.paidAt ?? null,
    retry_count: d.retry_count ?? d.retryCount ?? 0,
    failure_reason: d.failure_reason ?? d.failureReason ?? null,
    createdAt: d.createdAt ?? null,
    updatedAt: d.updatedAt ?? null,
  }
}

// ---------------------------------------------------------------------------
// 402 helper (exact shape per membership.md §4.3)
// ---------------------------------------------------------------------------

export type PaywallCode = 'MEMBERSHIP_REQUIRED' | 'SUBSCRIPTION_REQUIRED' | 'PAYWALLED'

export function paywalled(
  opts: {
    vendorId?: string | number | null
    subscriptionStatus?: string | null
    requiredPlan?: string | null
    code?: PaywallCode
    message?: string
  } = {},
): NextResponse {
  return NextResponse.json(
    {
      error: opts.message || 'Active membership required to sell',
      code: opts.code || 'MEMBERSHIP_REQUIRED',
      vendorId: opts.vendorId ?? null,
      subscriptionStatus: opts.subscriptionStatus ?? null,
      requiredPlan: opts.requiredPlan ?? 'Basic',
      status: 402,
    },
    { status: 402 },
  )
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: message, details }, { status: 400 })
}

export function clampLimit(raw: string | null, fallback = 20): number {
  const n = parseInt(raw || String(fallback), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(100, n)
}

// ---------------------------------------------------------------------------
// Vendor scoping
// ---------------------------------------------------------------------------

/** Resolve the vendor doc id owned by a vendor user. Null when none/missing. */
export async function resolveOwnVendorId(
  payload: any,
  vendorUserId: string | number,
): Promise<string | null> {
  try {
    const res = await payload.find({
      collection: 'vendors',
      where: { user: { equals: vendorUserId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id = res?.docs?.[0]?.id
    return id == null ? null : String(id)
  } catch {
    return null
  }
}

/**
 * Guard against cross-vendor access: when the caller supplies an explicit
 * vendor id (body.vendorId / query vendor), it must equal the owned vendor.
 * Returns 403 response when violated, else null.
 */
export function forbidCrossVendor(
  ownedVendorId: string,
  claimed: unknown,
): NextResponse | null {
  if (claimed == null || claimed === '') return null
  if (String(claimed) !== String(ownedVendorId)) {
    return NextResponse.json({ error: 'Forbidden: cross-vendor access denied' }, { status: 403 })
  }
  return null
}

// ---------------------------------------------------------------------------
// Safe collection wrappers (missing-collection tolerant)
// ---------------------------------------------------------------------------

export async function safeFind(
  payload: any,
  collection: string,
  args: Record<string, any>,
): Promise<{ docs: Record<string, any>[]; totalDocs?: number; [k: string]: any }> {
  try {
    const res = await payload.find({ collection: collection as any, ...args })
    return res as any
  } catch (err: any) {
    const msg = String(err?.message || '')
    if (/Unknown collection|Cannot find|not found/i.test(msg)) {
      return { docs: [], totalDocs: 0 }
    }
    throw err
  }
}

export function isMissingCollection(err: any): boolean {
  return /Unknown collection|Cannot find|not found/i.test(String(err?.message || ''))
}

export function collectionMissing(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: 'COLLECTION_MISSING' },
    { status: 500 },
  )
}

// ---------------------------------------------------------------------------
// Money / proration helpers (mirror membership.md §3)
// ---------------------------------------------------------------------------

export function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

export function toCentavos(pesos: number): number {
  return Math.round(Number(pesos) * 100)
}

export function daysInCycle(billingInterval: string): number {
  if (billingInterval === 'year') return 365
  if (billingInterval === 'one_time') return 36500
  return 30
}

/** Proration delta for a mid-cycle switch. Positive = amount due now. */
export function prorateDelta(
  oldPrice: number,
  newPrice: number,
  billingInterval: string,
  periodEndIso: string | null,
  nowMs = Date.now(),
): { delta: number; remainingDays: number } {
  const days = daysInCycle(billingInterval)
  const dailyOld = Number(oldPrice) / days
  const dailyNew = Number(newPrice) / days
  let remainingDays = days
  if (periodEndIso) {
    const end = new Date(periodEndIso).getTime()
    if (Number.isFinite(end) && end > nowMs) {
      remainingDays = Math.max(0, Math.ceil((end - nowMs) / 86400000))
    } else {
      remainingDays = 0
    }
  }
  const delta = roundMoney((dailyNew - dailyOld) * remainingDays)
  return { delta, remainingDays }
}

export function periodEndFor(
  billingInterval: string,
  startMs = Date.now(),
): string {
  const d = new Date(startMs)
  if (billingInterval === 'year') d.setFullYear(d.getFullYear() + 1)
  else if (billingInterval === 'one_time') d.setFullYear(d.getFullYear() + 100)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

export function invoiceNumber(): string {
  const year = new Date().getFullYear()
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)
  return `INV-${year}-${rand}`
}

// ---------------------------------------------------------------------------
// Audit (best-effort; never throws)
// ---------------------------------------------------------------------------

export async function audit(
  payload: any,
  entry: {
    vendor?: string | number | null
    subscription?: string | number | null
    invoice?: string | number | null
    action: string
    plan_version?: number | null
    reason?: string | null
    actor?: string | number | null
    metadata?: Record<string, any> | null
    eventId?: string | null
  },
): Promise<void> {
  try {
    const data: Record<string, any> = {
      action: entry.action,
      reason: entry.reason ?? null,
      metadata: entry.metadata ?? null,
    }
    if (entry.vendor != null && entry.vendor !== '') data.vendor = entry.vendor
    if (entry.subscription != null && entry.subscription !== '') data.subscription = entry.subscription
    if (entry.invoice != null && entry.invoice !== '') data.invoice = entry.invoice
    if (entry.plan_version != null) data.plan_version = entry.plan_version
    if (entry.actor != null && entry.actor !== '') data.actor = entry.actor
    if (entry.eventId != null) data.eventId = entry.eventId
    await payload.create({
      collection: 'membership-audit-log' as any,
      data: data as any,
      overrideAccess: true,
    })
  } catch {
    // audit is best-effort
  }
}

/** Replay guard: true when eventId already logged. Creates nothing. */
export async function isDuplicateEvent(
  payload: any,
  eventId: string,
): Promise<boolean> {
  try {
    const res = await payload.find({
      collection: 'membership-audit-log' as any,
      where: { eventId: { equals: eventId } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return (res?.docs?.length ?? 0) > 0
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Membership status helpers (inline fallback when guard service missing)
// ---------------------------------------------------------------------------

export const ACTIVE_LIKE = new Set(['trialing', 'active'])
export const BLOCKED_LIKE = new Set(['past_due', 'grace', 'suspended', 'expired', 'cancelled'])

export async function resolveActiveSubscription(
  payload: any,
  vendorId: string,
): Promise<Record<string, any> | null> {
  // Prefer parallel-created MembershipService when available.
  try {
    const svc = await loadOptionalMembershipService()
    const fn =
      svc?.resolveActiveSubscription || svc?.getActiveSubscription || svc?.resolveActive
    if (typeof fn === 'function') {
      const sub = await fn(payload, vendorId)
      if (sub) return sub as Record<string, any>
    }
  } catch {
    // fall through to inline
  }
  try {
    const nowIso = new Date().toISOString()
    const res = await payload.find({
      collection: 'vendor-subscriptions' as any,
      where: {
        and: [
          { vendor: { equals: vendorId } },
          { status: { in: ['trialing', 'active'] } },
        ],
      },
      limit: 1,
      depth: 1,
      sort: '-createdAt',
      overrideAccess: true,
    })
    const sub = res?.docs?.[0] as Record<string, any> | undefined
    if (!sub) return null
    const end = sub.current_period_end ?? sub.currentPeriodEnd
    if (end && new Date(String(end)).toISOString() < nowIso && !sub.cancelAtPeriodEnd) {
      // still return it; callers decide paywall messaging
    }
    void nowIso
    return sub ?? null
  } catch {
    return null
  }
}

export function verifyPaymongoMembershipSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false
  const parts = signatureHeader.split(',')
  const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1]
  const liveSig = parts.find((p) => p.startsWith('li='))?.split('=')[1]
  const testSig = parts.find((p) => p.startsWith('te='))?.split('=')[1]
  const sig = liveSig || testSig
  if (!timestamp || !sig) return false
  const computed = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  try {
    const a = Buffer.from(computed)
    const b = Buffer.from(sig)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return computed === sig
  }
}
