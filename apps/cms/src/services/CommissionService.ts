import type { Payload, PayloadRequest } from 'payload'
import { roundMoney } from '../utils/membershipShared'

export type CommissionSource = 'vendor' | 'category' | 'plan' | 'global'
export type CommissionStatus = 'pending' | 'accrued' | 'partially_refunded' | 'reversed' | 'legacy'

export interface CommissionResolution {
  pct: number
  transactionFee: number
  source: CommissionSource
  ruleId: string | number | null
}

type Doc = Record<string, any>

function finiteMoney(value: unknown, fallback = 0): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? roundMoney(amount) : fallback
}

function idOf(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return ''
}

function clampPct(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const pct = Number(value)
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null
  return pct
}

function activeAt(rule: Doc, at: Date): boolean {
  if (!rule.is_active) return false
  if (rule.effective_from) {
    const from = new Date(rule.effective_from).getTime()
    if (!Number.isFinite(from) || from > at.getTime()) return false
  }
  if (rule.effective_to) {
    const to = new Date(rule.effective_to).getTime()
    if (!Number.isFinite(to) || at.getTime() > to) return false
  }
  return true
}

function compareRules(a: Doc, b: Doc): number {
  const aPriority = Number(a.priority)
  const bPriority = Number(b.priority)
  const priority = (Number.isFinite(bPriority) ? bPriority : 0) - (Number.isFinite(aPriority) ? aPriority : 0)
  if (priority) return priority
  const scopeRank: Record<string, number> = { vendor: 4, category: 3, plan: 2, global: 1 }
  const scope = (scopeRank[String(b.scope)] ?? 0) - (scopeRank[String(a.scope)] ?? 0)
  if (scope) return scope
  const effectiveFrom = new Date(b.effective_from ?? 0).getTime() - new Date(a.effective_from ?? 0).getTime()
  if (effectiveFrom) return effectiveFrom
  return String(a.id ?? '').localeCompare(String(b.id ?? ''), 'en', { numeric: true })
}

function resolutionFromRule(rule: Doc): CommissionResolution | null {
  const pct = clampPct(rule.commission_percent)
  if (pct === null) return null
  return {
    pct,
    transactionFee: Math.max(0, finiteMoney(rule.transaction_fee)),
    source: rule.scope as CommissionSource,
    ruleId: rule.id,
  }
}

export function selectApplicableCommissionRule(
  rules: Doc[],
  vendorId: string | number,
  planId: string,
  categoryIds: Set<string>,
  at = new Date(),
): Doc | null {
  const matching = rules
    .filter((rule) => activeAt(rule, at))
    .filter((rule) => {
      if (rule.scope === 'global') return true
      if (rule.scope === 'vendor') return idOf(rule.vendor) === String(vendorId)
      if (rule.scope === 'plan') return !!planId && idOf(rule.plan) === planId
      if (rule.scope === 'category') return categoryIds.has(idOf(rule.category))
      return false
    })
    .sort(compareRules)
  return matching[0] ?? null
}

/**
 * Resolves the highest-priority effective rule for an order. Legacy inline
 * overrides and plan snapshots remain supported as a migration-safe fallback.
 */
export async function resolveCommission(
  payload: Payload,
  vendorId: string | number,
  merchantId: string | number,
  at = new Date(),
  req?: PayloadRequest,
): Promise<CommissionResolution> {
  const [vendor, merchant, subscriptions, ruleResult, settings] = await Promise.all([
    payload.findByID({
      collection: 'vendors',
      id: vendorId as never,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    payload.findByID({
      collection: 'merchants',
      id: merchantId as never,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'vendor-subscriptions',
      where: {
        and: [
          { vendor: { equals: String(vendorId) } },
          { status: { in: ['active', 'trialing'] } },
        ],
      },
      limit: 1,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
      req,
    }),
    payload.find({
      collection: 'commission-rules',
      where: { is_active: { equals: true } },
      limit: 1000,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    payload.findGlobal({ slug: 'system-settings', overrideAccess: true, req }),
  ])

  const vendorDoc = vendor as unknown as Doc
  const merchantDoc = merchant as unknown as Doc
  const subscription = (subscriptions.docs[0] as unknown as Doc | undefined) ?? null
  const planSnapshot = subscription?.plan_snapshot ?? subscription?.planSnapshot ?? {}
  const planId = idOf(subscription?.plan)
  const categories = Array.isArray(merchantDoc.merchant_categories)
    ? new Set(merchantDoc.merchant_categories.map(idOf).filter(Boolean))
    : new Set<string>()

  const selectedRule = selectApplicableCommissionRule(
    ruleResult.docs as unknown as Doc[],
    vendorId,
    planId,
    categories,
    at,
  )
  if (selectedRule) {
    const resolution = resolutionFromRule(selectedRule)
    if (resolution) return resolution
  }

  const override = vendorDoc.commissionOverride ?? vendorDoc.commission_override
  const vendorPct = clampPct(override?.commission_percent ?? override?.commissionPercent)
  if (vendorPct !== null) {
    return {
      pct: vendorPct,
      transactionFee: Math.max(0, finiteMoney(override?.transaction_fee)),
      source: 'vendor',
      ruleId: idOf(override?.rule) || null,
    }
  }

  for (const categoryId of categories) {
    const category = await payload.findByID({
      collection: 'merchant-categories',
      id: categoryId as never,
      depth: 0,
      overrideAccess: true,
      req,
    }) as unknown as Doc
    const categoryPct = clampPct(category.commissionOverridePct ?? category.commission_override_pct)
    if (categoryPct !== null) {
      return { pct: categoryPct, transactionFee: 0, source: 'category', ruleId: null }
    }
  }

  const planPct = clampPct(planSnapshot.commission_percent ?? planSnapshot.commissionPercent)
  if (planPct !== null) {
    return {
      pct: planPct,
      transactionFee: Math.max(0, finiteMoney(planSnapshot.transaction_fee ?? planSnapshot.transactionFee)),
      source: 'plan',
      ruleId: null,
    }
  }

  const membershipSettings = (settings as unknown as Doc)?.membership
  const defaultPct = clampPct(
    membershipSettings?.commissionDefaultPct ??
      (settings as unknown as Doc)?.commissionDefaultPct,
  )
  return { pct: defaultPct ?? 8, transactionFee: 0, source: 'global', ruleId: null }
}

export interface CommissionAmounts {
  baseAmount: number
  vendorDiscount: number
  commissionAmount: number
  transactionFee: number
  vendorNet: number
}

export function getCommissionDiscountAmounts(discounts: Array<Record<string, unknown>>): {
  vendorDiscount: number
  productDiscount: number
} {
  const vendorDiscount = roundMoney(
    discounts.reduce((sum, discount) => sum + Math.max(0, finiteMoney(discount.vendor_share)), 0),
  )
  const productDiscount = roundMoney(
    discounts.reduce((sum, discount) => {
      const foodDiscount = Math.max(0, finiteMoney(discount.food_discount))
      const totalDiscount = Math.max(0, finiteMoney(discount.total_discount ?? discount.amount_off))
      return sum + (totalDiscount > 0 ? Math.min(foodDiscount, totalDiscount) : foodDiscount)
    }, 0),
  )
  return { vendorDiscount, productDiscount }
}

const commissionLedgerAmountFields = [
  'commission_base_amount',
  'commission_vendor_discount',
  'commission_amount',
  'commission_transaction_fee',
  'commission_vendor_net',
] as const

export function calculateRefundReversalDelta(
  accrual: Record<string, unknown>,
  postedReversals: Array<Record<string, unknown>>,
  cumulativeRefundedAmount: number,
  transactionAmount: number,
): Record<(typeof commissionLedgerAmountFields)[number], number> {
  const ratio = transactionAmount > 0
    ? Math.min(1, Math.max(0, cumulativeRefundedAmount / transactionAmount))
    : 0
  const result: Record<(typeof commissionLedgerAmountFields)[number], number> = {
    commission_base_amount: 0,
    commission_vendor_discount: 0,
    commission_amount: 0,
    commission_transaction_fee: 0,
    commission_vendor_net: 0,
  }
  for (const field of commissionLedgerAmountFields) {
    const target = -roundMoney(finiteMoney(accrual[field]) * ratio)
    const posted = postedReversals.reduce((sum, entry) => sum + finiteMoney(entry[field]), 0)
    result[field] = roundMoney(target - posted)
  }
  return result
}

/** Commission is assessed on merchandise less all product discounts. */
export function calculateCommissionAmounts(
  subtotal: number,
  vendorDiscount: number,
  resolution: CommissionResolution,
  commissionBaseDiscount: number,
): CommissionAmounts {
  const subtotalAmount = Math.max(0, finiteMoney(subtotal))
  const vendorDiscountAmount = Math.max(0, finiteMoney(vendorDiscount))
  const baseAmount = roundMoney(Math.max(0, subtotalAmount - Math.max(0, finiteMoney(commissionBaseDiscount))))
  const commissionAmount = roundMoney(baseAmount * resolution.pct / 100)
  const transactionFee = Math.min(baseAmount, Math.max(0, finiteMoney(resolution.transactionFee)))
  return {
    baseAmount,
    vendorDiscount: vendorDiscountAmount,
    commissionAmount,
    transactionFee,
    vendorNet: roundMoney(Math.max(0, subtotalAmount - vendorDiscountAmount - commissionAmount - transactionFee)),
  }
}

async function readOrder(payload: Payload, orderId: string | number, req?: PayloadRequest): Promise<Doc> {
  return await payload.findByID({
    collection: 'orders',
    id: orderId as never,
    depth: 0,
    overrideAccess: true,
    req,
  }) as unknown as Doc
}

function entryDataFromOrder(accrual: Doc, reversals: Doc[], fullyRefunded: boolean, refundedAt: string) {
  const remaining = (field: string) =>
    roundMoney(Math.max(0, finiteMoney(accrual[field]) + reversals.reduce((sum, entry) => sum + finiteMoney(entry[field]), 0)))
  return {
    commission_percent: accrual.commission_percent,
    commission_base_amount: fullyRefunded ? 0 : remaining('commission_base_amount'),
    commission_vendor_discount: fullyRefunded ? 0 : remaining('commission_vendor_discount'),
    commission_amount: fullyRefunded ? 0 : remaining('commission_amount'),
    commission_transaction_fee: fullyRefunded ? 0 : remaining('commission_transaction_fee'),
    commission_vendor_net: fullyRefunded ? 0 : remaining('commission_vendor_net'),
    commission_source: accrual.commission_source,
    commission_rule: idOf(accrual.commission_rule) || null,
    commission_status: fullyRefunded ? 'reversed' : reversals.length ? 'partially_refunded' : 'accrued',
    commission_calculated_at: refundedAt || accrual.effective_at,
  }
}

async function syncOrderSnapshot(
  payload: Payload,
  orderId: string | number,
  accrual: Doc,
  refundedAmount: number,
  transactionAmount: number,
  req?: PayloadRequest,
): Promise<void> {
  const reversalsResult = await payload.find({
    collection: 'vendor-commission-entries',
    where: {
      and: [
        { order: { equals: String(orderId) } },
        { entry_type: { equals: 'reversal' } },
      ],
    },
    limit: 10000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const reversals = reversalsResult.docs as unknown as Doc[]
  const fullyRefunded = transactionAmount > 0 && refundedAmount >= transactionAmount - 0.01
  const latestRefund = reversals.reduce((latest, entry) => {
    const time = String(entry.effective_at ?? '')
    return time > latest ? time : latest
  }, '')
  await payload.update({
    collection: 'orders',
    id: orderId as never,
    data: entryDataFromOrder(accrual, reversals, fullyRefunded, latestRefund) as never,
    overrideAccess: true,
    context: { commissionSnapshot: true },
    req,
  })
}

async function existingEntry(
  payload: Payload,
  idempotencyKey: string,
  req?: PayloadRequest,
): Promise<Doc | null> {
  const found = await payload.find({
    collection: 'vendor-commission-entries',
    where: { idempotency_key: { equals: idempotencyKey } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return (found.docs[0] as unknown as Doc | undefined) ?? null
}

/**
 * Posts the immutable commission snapshot on successful payment. The unique
 * idempotency key makes webhook retries safe.
 */
export async function accruePaidOrderCommission(
  payload: Payload,
  orderId: string | number,
  transactionId: string | number,
  paidAt = new Date(),
  req?: PayloadRequest,
): Promise<void> {
  const order = await readOrder(payload, orderId, req)
  const key = `commission:order:${String(orderId)}:accrual`
  const previous = await existingEntry(payload, key, req)
  if (previous) {
    if (order.commission_status === 'pending' || !order.commission_status) {
      await syncOrderSnapshot(payload, orderId, previous, 0, 0, req)
    }
    return
  }

  const merchantId = idOf(order.merchant)
  if (!merchantId) throw new Error(`Order ${String(orderId)} is missing its merchant`)
  const merchant = await payload.findByID({
    collection: 'merchants',
    id: merchantId as never,
    depth: 0,
    overrideAccess: true,
    req,
  }) as unknown as Doc
  const vendorId = idOf(merchant.vendor)
  if (!vendorId) throw new Error(`Merchant ${merchantId} is missing its vendor`)

  const discounts = await payload.find({
    collection: 'order-discounts',
    where: { order: { equals: String(orderId) } },
    limit: 100,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const { vendorDiscount, productDiscount } = getCommissionDiscountAmounts(
    discounts.docs as unknown as Array<Record<string, unknown>>,
  )
  const resolution = await resolveCommission(payload, vendorId, merchantId, paidAt, req)
  const amounts = calculateCommissionAmounts(finiteMoney(order.subtotal), vendorDiscount, resolution, productDiscount)
  const currency = typeof order.currency === 'string' ? order.currency : 'PHP'

  const entry = await payload.create({
    collection: 'vendor-commission-entries',
    data: {
      vendor: vendorId,
      order: orderId,
      transaction: transactionId,
      entry_type: 'accrual',
      idempotency_key: key,
      currency,
      commission_percent: resolution.pct,
      commission_base_amount: amounts.baseAmount,
      commission_vendor_discount: amounts.vendorDiscount,
      commission_amount: amounts.commissionAmount,
      commission_transaction_fee: amounts.transactionFee,
      commission_vendor_net: amounts.vendorNet,
      commission_source: resolution.source,
      commission_rule: resolution.ruleId,
      effective_at: paidAt.toISOString(),
    } as never,
    overrideAccess: true,
    req,
  }) as unknown as Doc

  await syncOrderSnapshot(payload, orderId, entry, 0, 0, req)
}

/** Reverses the proportional commission for each successful PayMongo refund. */
export async function recordOrderCommissionRefund(
  payload: Payload,
  orderId: string | number,
  transactionId: string | number,
  providerRefundId: string,
  refundedAmount: number,
  cumulativeRefundedAmount: number,
  transactionAmount: number,
  refundedAt = new Date(),
  req?: PayloadRequest,
): Promise<void> {
  const accrualKey = `commission:order:${String(orderId)}:accrual`
  const accrual = await existingEntry(payload, accrualKey, req)
  if (!accrual) return

  const reversalKey = `commission:order:${String(orderId)}:refund:${providerRefundId}`
  const previousReversal = await existingEntry(payload, reversalKey, req)
  if (previousReversal) {
    await syncOrderSnapshot(
      payload,
      orderId,
      accrual,
      cumulativeRefundedAmount,
      transactionAmount,
      req,
    )
    return
  }

  const priorReversals = await payload.find({
    collection: 'vendor-commission-entries',
    where: {
      and: [
        { order: { equals: String(orderId) } },
        { entry_type: { equals: 'reversal' } },
      ],
    },
    limit: 10000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const reversedSoFar = priorReversals.docs as unknown as Doc[]
  const reversal = calculateRefundReversalDelta(
    accrual,
    reversedSoFar,
    cumulativeRefundedAmount,
    transactionAmount,
  )

  await payload.create({
    collection: 'vendor-commission-entries',
    data: {
      vendor: idOf(accrual.vendor),
      order: orderId,
      transaction: transactionId,
      entry_type: 'reversal',
      idempotency_key: reversalKey,
      provider_refund_id: providerRefundId,
      refund_amount: roundMoney(refundedAmount),
      currency: accrual.currency,
      commission_percent: accrual.commission_percent,
      commission_base_amount: reversal.commission_base_amount,
      commission_vendor_discount: reversal.commission_vendor_discount,
      commission_amount: reversal.commission_amount,
      commission_transaction_fee: reversal.commission_transaction_fee,
      commission_vendor_net: reversal.commission_vendor_net,
      commission_source: accrual.commission_source,
      commission_rule: idOf(accrual.commission_rule) || null,
      effective_at: refundedAt.toISOString(),
    } as never,
    overrideAccess: true,
    req,
  })

  await syncOrderSnapshot(
    payload,
    orderId,
    accrual,
    cumulativeRefundedAmount,
    transactionAmount,
    req,
  )
}
