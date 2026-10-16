import type { Payload, PayloadRequest } from 'payload'
import { roundMoney } from '../utils/membershipShared'

export type CommissionSource =
  | 'product'
  | 'product_category'
  | 'vendor'
  | 'category'
  | 'plan'
  | 'volume_tier'
  | 'global'
export type CommissionStatus = 'pending' | 'accrued' | 'partially_refunded' | 'reversed' | 'legacy'
export type CommissionMethod =
  | 'percentage_of_discounted_subtotal'
  | 'fixed_amount_per_unit'
  | 'percentage_of_pre_discount_subtotal'
  | 'percentage_of_vendor_cost'

export interface CommissionResolution {
  method?: CommissionMethod
  value?: number
  pct: number
  transactionFee: number
  source: CommissionSource
  ruleId: string | number | null
  volumeTierSnapshot?: {
    name: string
    minimumNetSales: number
    commissionPercent: number
    netSales: number
    windowDays: 30
  }
}

function relationshipIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value]
  return values.map(idOf).filter(Boolean)
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

/**
 * Relationship IDs for numeric-PK collections (vendors, orders, transactions,
 * commission-rules) must stay numbers: Payload's isValidID rejects numeric
 * strings when the DB defaultIDType is 'number', which silently blocks
 * commission accrual with "invalid relationships". Non-numeric IDs pass through.
 */
function numId(value: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'number' && Number.isFinite(id)) return id
    if (typeof id === 'string' && id.trim() !== '' && Number.isFinite(Number(id))) {
      return Number(id)
    }
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return idOf(value)
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
  const scopeRank: Record<string, number> = {
    product: 6,
    product_category: 5,
    vendor: 4,
    category: 3,
    plan: 2,
    global: 1,
  }
  const scope = (scopeRank[String(b.scope)] ?? 0) - (scopeRank[String(a.scope)] ?? 0)
  if (scope) return scope
  const effectiveFrom = new Date(b.effective_from ?? 0).getTime() - new Date(a.effective_from ?? 0).getTime()
  if (effectiveFrom) return effectiveFrom
  return String(a.id ?? '').localeCompare(String(b.id ?? ''), 'en', { numeric: true })
}

function resolutionFromRule(rule: Doc): CommissionResolution | null {
  const method = (rule.commission_method ?? 'percentage_of_discounted_subtotal') as CommissionMethod
  if (
    method !== 'percentage_of_discounted_subtotal' &&
    method !== 'fixed_amount_per_unit' &&
    method !== 'percentage_of_pre_discount_subtotal' &&
    method !== 'percentage_of_vendor_cost'
  ) return null
  const configuredValue = rule.commission_value ?? rule.commission_percent
  const value = Number(configuredValue)
  if (!Number.isFinite(value) || value < 0) return null
  if (
    (method === 'percentage_of_discounted_subtotal' ||
      method === 'percentage_of_pre_discount_subtotal' ||
      method === 'percentage_of_vendor_cost') &&
    value > 100
  ) return null
  return {
    method,
    value,
    pct: method === 'fixed_amount_per_unit' ? 0 : value,
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
  productId?: string | number | null,
  productCategoryIds: Set<string> = new Set(),
): Doc | null {
  const matching = rules
    .filter((rule) => activeAt(rule, at))
    .filter((rule) => {
      if (rule.scope === 'global') return true
      if (rule.scope === 'vendor') return idOf(rule.vendor) === String(vendorId)
      if (rule.scope === 'plan') return !!planId && idOf(rule.plan) === planId
      if (rule.scope === 'category') return categoryIds.has(idOf(rule.category))
      if (rule.scope === 'product') return !!productId && idOf(rule.product) === String(productId)
      if (rule.scope === 'product_category') return productCategoryIds.has(idOf(rule.product_category))
      return false
    })
    .sort(compareRules)
  return matching[0] ?? null
}

/**
 * Resolves the highest-priority effective rule for an order. Legacy inline
 * overrides and plan snapshots remain supported as a migration-safe fallback.
 */
interface CommissionResolverContext {
  vendor: Doc
  merchant: Doc
  subscription: Doc | null
  rules: Doc[]
  settings: Doc
  volumeTier: Doc | null
  rollingSales: number | null
}

export function selectVendorVolumeTier(tiers: unknown[], netSales: number): Doc | null {
  const sales = Math.max(0, finiteMoney(netSales))
  return (Array.isArray(tiers) ? tiers as Doc[] : [])
    .filter((tier) => {
      const threshold = Number(tier.minimumNetSales ?? tier.minimum_net_sales)
      const rate = Number(tier.commissionPercent ?? tier.commission_percent)
      return Number.isFinite(threshold) && threshold >= 0 &&
        Number.isFinite(rate) && rate >= 0 && rate <= 100 &&
        sales >= threshold
    })
    .sort((a, b) => {
      const thresholdDifference =
        Number(b.minimumNetSales ?? b.minimum_net_sales) -
        Number(a.minimumNetSales ?? a.minimum_net_sales)
      if (thresholdDifference) return thresholdDifference
      return String(a.id ?? a.name ?? '').localeCompare(
        String(b.id ?? b.name ?? ''),
        'en',
        { numeric: true },
      )
    })[0] ?? null
}

/**
 * Rolling net paid merchandise is the paid product subtotal less product
 * discounts and successful refund amounts. Delivery and cancelled orders are
 * excluded. The paid order being accrued is included once, even if its
 * transaction is not yet returned by the query.
 */
export async function calculateRollingVendorNetMerchandiseSales(
  payload: Payload,
  vendorId: string | number,
  currentOrder: Doc,
  currentOrderId: string | number,
  paidAt: Date,
  req?: PayloadRequest,
): Promise<number> {
  const windowStart = new Date(paidAt.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const transactionResult = await payload.find({
    collection: 'transactions',
    where: {
      and: [
        { status: { in: ['paid', 'partially_refunded', 'refunded'] } },
        { paid_at: { greater_than_equal: windowStart } },
        { paid_at: { less_than_equal: paidAt.toISOString() } },
      ],
    },
    limit: 10000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const transactionsByOrder = new Map<string, Doc[]>()
  for (const transaction of transactionResult.docs as unknown as Doc[]) {
    const orderId = idOf(transaction.order)
    if (!orderId) continue
    const transactions = transactionsByOrder.get(orderId) ?? []
    transactions.push(transaction)
    transactionsByOrder.set(orderId, transactions)
  }
  const currentKey = String(currentOrderId)
  if (!transactionsByOrder.has(currentKey)) transactionsByOrder.set(currentKey, [])

  let sales = 0
  for (const [orderId, transactions] of transactionsByOrder) {
    const order = orderId === currentKey ? currentOrder : await readOrder(payload, orderId, req)
    const merchantId = idOf(order.merchant)
    if (!merchantId) continue
    const orderStatus = String(order.status ?? '').toLowerCase()
    if (orderStatus === 'cancelled' || orderStatus === 'canceled') continue
    const merchant = await payload.findByID({
      collection: 'merchants',
      id: merchantId as never,
      depth: 0,
      overrideAccess: true,
      req,
    }) as unknown as Doc
    if (idOf(merchant.vendor) !== String(vendorId)) continue

    const discountsResult = await payload.find({
      collection: 'order-discounts',
      where: { order: { equals: orderId } },
      limit: 100,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const productDiscount = getCommissionDiscountAmounts(
      discountsResult.docs as unknown as Array<Record<string, unknown>>,
    ).productDiscount
    const merchandise = Math.max(0, finiteMoney(order.subtotal) - productDiscount)
    const refunded = transactions.reduce((sum, transaction) =>
      sum + Math.max(0, finiteMoney(transaction.refunded_amount)), 0)
    sales += Math.max(0, merchandise - refunded)
  }
  return roundMoney(sales)
}

async function loadCommissionResolverContext(
  payload: Payload,
  vendorId: string | number,
  merchantId: string | number,
  req?: PayloadRequest,
  rollingSales?: number | null,
): Promise<CommissionResolverContext> {
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
  return {
    vendor: vendor as unknown as Doc,
    merchant: merchant as unknown as Doc,
    subscription: (subscriptions.docs[0] as unknown as Doc | undefined) ?? null,
    rules: ruleResult.docs as unknown as Doc[],
    settings: settings as unknown as Doc,
    rollingSales: rollingSales ?? null,
    volumeTier: rollingSales == null || !Array.isArray(settings.commissionVolumeTiers)
      ? null
      : selectVendorVolumeTier(settings.commissionVolumeTiers, rollingSales),
  }
}

async function resolveCommissionFromContext(
  payload: Payload,
  context: CommissionResolverContext,
  vendorId: string | number,
  at: Date,
  req: PayloadRequest | undefined,
  productId?: string | number | null,
  categoryCache = new Map<string, Promise<Doc>>(),
  productCategoryCache = new Map<string, Promise<Set<string>>>(),
): Promise<CommissionResolution> {
  const { vendor: vendorDoc, merchant: merchantDoc, subscription } = context
  const planSnapshot = subscription?.plan_snapshot ?? subscription?.planSnapshot ?? {}
  const planId = idOf(subscription?.plan)
  const categories = Array.isArray(merchantDoc.merchant_categories)
    ? new Set(merchantDoc.merchant_categories.map(idOf).filter(Boolean))
    : new Set<string>()
  let productCategories = new Set<string>()
  if (productId != null) {
    const productKey = String(productId)
    let productCategoryPromise = productCategoryCache.get(productKey)
    if (!productCategoryPromise) {
      productCategoryPromise = payload.findByID({
        collection: 'products',
        id: productId as never,
        depth: 0,
        overrideAccess: true,
        req,
      }).then((product) => new Set(relationshipIds((product as unknown as Doc).categories)))
      productCategoryCache.set(productKey, productCategoryPromise)
    }
    productCategories = await productCategoryPromise
  }

  const applicableRules = context.rules.filter((rule) => rule.scope !== 'global')
  const selectedScopedRule = selectApplicableCommissionRule(
    applicableRules,
    vendorId,
    planId,
    categories,
    at,
    productId,
    productCategories,
  )
  if (selectedScopedRule) {
    const resolution = resolutionFromRule(selectedScopedRule)
    if (resolution) return resolution
  }

  if (context.volumeTier) {
    const pct = clampPct(context.volumeTier.commissionPercent ?? context.volumeTier.commission_percent)
    if (pct !== null) {
      return {
        method: 'percentage_of_discounted_subtotal',
        value: pct,
        pct,
        transactionFee: 0,
        source: 'volume_tier',
        ruleId: null,
        volumeTierSnapshot: {
          name: String(context.volumeTier.name ?? ''),
          minimumNetSales: finiteMoney(
            context.volumeTier.minimumNetSales ?? context.volumeTier.minimum_net_sales,
          ),
          commissionPercent: pct,
          netSales: context.rollingSales ?? 0,
          windowDays: 30,
        },
      }
    }
  }

  const selectedRule = selectApplicableCommissionRule(
    context.rules,
    vendorId,
    planId,
    categories,
    at,
    productId,
    productCategories,
  )
  if (selectedRule) {
    const resolution = resolutionFromRule(selectedRule)
    if (resolution) return resolution
  }

  const override = vendorDoc.commissionOverride ?? vendorDoc.commission_override
  const vendorPct = clampPct(override?.commission_percent ?? override?.commissionPercent)
  if (vendorPct !== null) {
    return {
      method: 'percentage_of_discounted_subtotal',
      value: vendorPct,
      pct: vendorPct,
      transactionFee: Math.max(0, finiteMoney(override?.transaction_fee)),
      source: 'vendor',
      ruleId: idOf(override?.rule) || null,
    }
  }

  for (const categoryId of categories) {
    let categoryPromise = categoryCache.get(categoryId)
    if (!categoryPromise) {
      categoryPromise = payload.findByID({
        collection: 'merchant-categories',
        id: categoryId as never,
        depth: 0,
        overrideAccess: true,
        req,
      }).then((category) => category as unknown as Doc)
      categoryCache.set(categoryId, categoryPromise)
    }
    const category = await categoryPromise
    const categoryPct = clampPct(category.commissionOverridePct ?? category.commission_override_pct)
    if (categoryPct !== null) {
      return {
        method: 'percentage_of_discounted_subtotal',
        value: categoryPct,
        pct: categoryPct,
        transactionFee: 0,
        source: 'category',
        ruleId: null,
      }
    }
  }

  const planPct = clampPct(planSnapshot.commission_percent ?? planSnapshot.commissionPercent)
  if (planPct !== null) {
    return {
      method: 'percentage_of_discounted_subtotal',
      value: planPct,
      pct: planPct,
      transactionFee: Math.max(0, finiteMoney(planSnapshot.transaction_fee ?? planSnapshot.transactionFee)),
      source: 'plan',
      ruleId: null,
    }
  }

  const membershipSettings = context.settings?.membership
  const defaultPct = clampPct(
    membershipSettings?.commissionDefaultPct ??
      context.settings?.commissionDefaultPct,
  )
  return {
    method: 'percentage_of_discounted_subtotal',
    value: defaultPct ?? 8,
    pct: defaultPct ?? 8,
    transactionFee: 0,
    source: 'global',
    ruleId: null,
  }
}

export async function resolveCommission(
  payload: Payload,
  vendorId: string | number,
  merchantId: string | number,
  at = new Date(),
  req?: PayloadRequest,
  productId?: string | number | null,
  rollingSales?: number | null,
): Promise<CommissionResolution> {
  const context = await loadCommissionResolverContext(payload, vendorId, merchantId, req, rollingSales)
  return resolveCommissionFromContext(
    payload,
    context,
    vendorId,
    at,
    req,
    productId,
  )
}

async function resolveCommissionsForProducts(
  payload: Payload,
  vendorId: string | number,
  merchantId: string | number,
  productIds: Array<string | null>,
  at: Date,
  req?: PayloadRequest,
  rollingSales?: number | null,
): Promise<CommissionResolution[]> {
  const context = await loadCommissionResolverContext(payload, vendorId, merchantId, req, rollingSales)
  const categoryCache = new Map<string, Promise<Doc>>()
  const productCategoryCache = new Map<string, Promise<Set<string>>>()
  return Promise.all(productIds.map((productId) =>
    resolveCommissionFromContext(
      payload,
      context,
      vendorId,
      at,
      req,
      productId,
      categoryCache,
      productCategoryCache,
    ),
  ))
}

export interface CommissionAmounts {
  baseAmount: number
  vendorDiscount: number
  commissionAmount: number
  transactionFee: number
  vendorNet: number
}

export interface ProductCommissionInput {
  productId: string | null
  itemIds: string[]
  subtotal: number
  quantity?: number
  costBaseAmount?: number
  costSnapshotComplete?: boolean
  resolution: CommissionResolution
}

export interface ProductCommissionAmounts {
  amounts: CommissionAmounts
  effectivePercent: number
  source: CommissionSource
  ruleId: string | number | null
  breakdown: Array<{
    product: string | null
    order_items: string[]
    subtotal: number
    product_discount: number
    commission_base_amount: number
    commission_percent: number
    commission_method: CommissionMethod
    commission_value: number
    commission_pre_discount_base_amount: number
    commission_cost_base_amount: number
    commission_quantity: number
    commission_amount: number
    commission_transaction_fee: number
    commission_source: CommissionSource
    commission_rule: string | number | null
    commission_volume_tier_snapshot: CommissionResolution['volumeTierSnapshot'] | null
  }>
}

function allocateMoneyProRata(total: number, weights: number[]): number[] {
  const totalCents = Math.max(0, Math.round(Math.max(0, finiteMoney(total)) * 100))
  const safeWeights = weights.map((weight) => Math.max(0, weight))
  const weightTotal = safeWeights.reduce((sum, weight) => sum + weight, 0)
  if (totalCents === 0 || weightTotal <= 0) return weights.map(() => 0)
  const exactCents = safeWeights.map((weight) => totalCents * weight / weightTotal)
  const cents = exactCents.map(Math.floor)
  let remainingCents = totalCents - cents.reduce((sum, amount) => sum + amount, 0)
  const order = exactCents
    .map((amount, index) => ({ index, fraction: amount - Math.floor(amount) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
  for (let i = 0; i < remainingCents; i += 1) cents[order[i % order.length].index] += 1
  return cents.map((amount) => roundMoney(amount / 100))
}

/**
 * Applies each product's resolved method to its paid order-item snapshot.
 * total_price records the customer item subtotal at checkout, before order
 * discounts. Food discounts are allocated pro rata by line subtotal; vendor-funded
 * discounts (including delivery discounts) remain an order-level payout cost.
 * Fixed fees are weighted over merchandise and charged once per order.
 */
export function calculateProductCommissionAmounts(
  subtotal: number,
  vendorDiscount: number,
  productDiscount: number,
  products: ProductCommissionInput[],
): ProductCommissionAmounts {
  const orderSubtotal = Math.max(0, finiteMoney(subtotal))
  const totalLineSubtotal = products.reduce((sum, product) => sum + Math.max(0, finiteMoney(product.subtotal)), 0)
  if (products.length === 0 || totalLineSubtotal <= 0) {
    throw new Error('Product commission calculation requires order items with a positive subtotal.')
  }

  const lineWeights = products.map((product) => Math.max(0, finiteMoney(product.subtotal)))
  const grossShares = allocateMoneyProRata(orderSubtotal, lineWeights)
  const discountShares = allocateMoneyProRata(productDiscount, lineWeights)
  const lines = products.map((product, index) => {
    const gross = grossShares[index]
    const discount = discountShares[index]
    const discountedBase = roundMoney(Math.max(0, gross - discount))
    const quantity = Math.max(0, finiteMoney(product.quantity, 1))
    const costBaseAmount = Math.max(0, finiteMoney(product.costBaseAmount))
    const method = product.resolution.method ?? 'percentage_of_discounted_subtotal'
    const value = product.resolution.value ?? product.resolution.pct
    let commissionAmount: number
    if (method === 'fixed_amount_per_unit') {
      if (quantity <= 0) throw new Error('Fixed-per-unit commissions require a positive paid order-item quantity.')
      commissionAmount = roundMoney(quantity * value)
    } else if (method === 'percentage_of_vendor_cost') {
      if (!product.costSnapshotComplete) {
        throw new Error('Vendor-cost commissions require a recorded vendor-cost snapshot for every order item.')
      }
      commissionAmount = roundMoney(costBaseAmount * value / 100)
    } else if (method === 'percentage_of_pre_discount_subtotal') {
      commissionAmount = roundMoney(gross * value / 100)
    } else {
      commissionAmount = roundMoney(discountedBase * value / 100)
    }
    return {
      product,
      gross,
      base: discountedBase,
      discount,
      quantity,
      costBaseAmount,
      method,
      value,
      commissionAmount,
      rawFee: Math.max(0, finiteMoney(product.resolution.transactionFee)) *
        Math.max(0, finiteMoney(product.subtotal)) / totalLineSubtotal,
    }
  })
  const baseAmount = roundMoney(lines.reduce((sum, line) => sum + line.base, 0))
  const commissionAmount = roundMoney(lines.reduce((sum, line) => sum + line.commissionAmount, 0))
  const transactionFee = Math.min(
    baseAmount,
    roundMoney(lines.reduce((sum, line) => sum + line.rawFee, 0)),
  )
  const totalRawFee = lines.reduce((sum, line) => sum + line.rawFee, 0)
  const feeShares = allocateMoneyProRata(
    transactionFee,
    lines.map((line) => line.rawFee),
  )
  const breakdown = lines.map((line, index) => {
    const fee = totalRawFee > 0 ? feeShares[index] : 0
    return {
      product: line.product.productId,
      order_items: line.product.itemIds,
      subtotal: line.gross,
      product_discount: line.discount,
      commission_base_amount: line.base,
      commission_pre_discount_base_amount:
        line.method === 'percentage_of_pre_discount_subtotal' ? line.gross : 0,
      commission_percent:
        line.method === 'percentage_of_pre_discount_subtotal' ||
        line.method === 'percentage_of_discounted_subtotal'
          ? line.value
          : line.base > 0
            ? Math.round(line.commissionAmount / line.base * 100 * 1_000_000) / 1_000_000
            : 0,
      commission_method: line.method,
      commission_value: line.value,
      commission_cost_base_amount: line.costBaseAmount,
      commission_quantity: line.quantity,
      commission_amount: line.commissionAmount,
      commission_transaction_fee: fee,
      commission_source: line.product.resolution.source,
      commission_rule: line.product.resolution.ruleId,
      commission_volume_tier_snapshot:
        line.product.resolution.volumeTierSnapshot ?? null,
    }
  })
  const effectivePercent = baseAmount > 0
    ? Math.round(commissionAmount / baseAmount * 100 * 1_000_000) / 1_000_000
    : 0
  const uniqueSources = new Set(lines.map((line) => line.product.resolution.source))
  const uniqueRuleIds = new Set(lines.map((line) => line.product.resolution.ruleId == null ? '' : String(line.product.resolution.ruleId)))
  return {
    amounts: {
      baseAmount,
      vendorDiscount: Math.max(0, finiteMoney(vendorDiscount)),
      commissionAmount,
      transactionFee,
      vendorNet: roundMoney(Math.max(0, orderSubtotal - Math.max(0, finiteMoney(vendorDiscount)) - commissionAmount - transactionFee)),
    },
    effectivePercent,
    source: uniqueSources.size === 1 ? lines[0].product.resolution.source : 'product',
    ruleId: uniqueRuleIds.size === 1 ? lines[0].product.resolution.ruleId : null,
    breakdown,
  }
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

/** Calculates a single-rate commission on discounted or recorded gross merchandise. */
export function calculateCommissionAmounts(
  subtotal: number,
  vendorDiscount: number,
  resolution: CommissionResolution,
  commissionBaseDiscount: number,
): CommissionAmounts {
  const subtotalAmount = Math.max(0, finiteMoney(subtotal))
  const vendorDiscountAmount = Math.max(0, finiteMoney(vendorDiscount))
  const discountedBaseAmount = roundMoney(
    Math.max(0, subtotalAmount - Math.max(0, finiteMoney(commissionBaseDiscount))),
  )
  const method = resolution.method ?? 'percentage_of_discounted_subtotal'
  const baseAmount = discountedBaseAmount
  const commissionCalculationBase = method === 'percentage_of_pre_discount_subtotal'
    ? subtotalAmount
    : discountedBaseAmount
  const commissionAmount = roundMoney(commissionCalculationBase * resolution.pct / 100)
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
    commission_rule: numId(accrual.commission_rule) || null,
    commission_volume_tier_snapshot: accrual.commission_volume_tier_snapshot ?? null,
    commission_product_breakdown: accrual.commission_product_breakdown ?? null,
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
  const orderItems = await payload.find({
    collection: 'order-items',
    where: { order: { equals: String(orderId) } },
    limit: 1000,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const groupedItems = new Map<string, {
    productId: string | null
    itemIds: string[]
    subtotal: number
    quantity: number
    costBaseAmount: number
    costSnapshotComplete: boolean
  }>()
  for (const item of orderItems.docs as unknown as Doc[]) {
    const productId = idOf(item.product) || null
    const groupKey = productId ?? `unlinked:${String(item.id)}`
    const group = groupedItems.get(groupKey) ?? {
      productId,
      itemIds: [],
      subtotal: 0,
      quantity: 0,
      costBaseAmount: 0,
      costSnapshotComplete: true,
    }
    const quantity = Math.max(0, finiteMoney(item.quantity))
    group.itemIds.push(String(item.id))
    group.subtotal = roundMoney(group.subtotal + Math.max(0, finiteMoney(item.total_price)))
    group.quantity = roundMoney(group.quantity + quantity)
    const costAtPurchase = Number(item.vendor_cost_at_purchase)
    if (Number.isFinite(costAtPurchase) && costAtPurchase >= 0) {
      group.costBaseAmount = roundMoney(group.costBaseAmount + costAtPurchase * quantity)
    } else {
      group.costSnapshotComplete = false
    }
    groupedItems.set(groupKey, group)
  }
  const rawOrderItems = orderItems.docs as unknown as Doc[]
  const itemProducts = [...groupedItems.values()]
  const canUseProductItemRates = rawOrderItems.length > 0 &&
    itemProducts.length > 0 &&
    itemProducts.some((item) => item.subtotal > 0)
  const commissionSettings = await payload.findGlobal({
    slug: 'system-settings',
    overrideAccess: true,
    req,
  })
  const volumeTiers = commissionSettings.commissionVolumeTiers
  const rollingSales = Array.isArray(volumeTiers) && volumeTiers.length > 0
    ? await calculateRollingVendorNetMerchandiseSales(
        payload,
        vendorId,
        order,
        orderId,
        paidAt,
        req,
      )
    : null
  const productRates = canUseProductItemRates
    ? await resolveCommissionsForProducts(
        payload,
        vendorId,
        merchantId,
        itemProducts.map((item) => item.productId),
        paidAt,
        req,
        rollingSales,
      )
    : []
  const productResolutions = itemProducts.map((item, index) => ({
    ...item,
    resolution: productRates[index]!,
  }))
  const productSpecific = rawOrderItems.length > 0 &&
    canUseProductItemRates &&
    productResolutions.some((item) =>
      item.resolution.source === 'product' ||
      item.resolution.source === 'product_category' ||
      (item.resolution.method ?? 'percentage_of_discounted_subtotal') !==
        'percentage_of_discounted_subtotal',
    )
  let resolution: CommissionResolution
  let amounts: CommissionAmounts
  let productBreakdown: ProductCommissionAmounts['breakdown'] | undefined
  if (productSpecific) {
    const calculated = calculateProductCommissionAmounts(
      finiteMoney(order.subtotal),
      vendorDiscount,
      productDiscount,
      productResolutions,
    )
    resolution = {
      method: 'percentage_of_discounted_subtotal',
      value: calculated.effectivePercent,
      pct: calculated.effectivePercent,
      transactionFee: calculated.amounts.transactionFee,
      source: calculated.source,
      ruleId: calculated.ruleId,
      volumeTierSnapshot: productResolutions.find(
        (item) => item.resolution.source === 'volume_tier',
      )?.resolution.volumeTierSnapshot,
    }
    amounts = calculated.amounts
    productBreakdown = calculated.breakdown
  } else {
    resolution = canUseProductItemRates && productResolutions.length > 0
      ? productResolutions[0].resolution
      : await resolveCommission(payload, vendorId, merchantId, paidAt, req, undefined, rollingSales)
    if (
      resolution.method &&
      resolution.method !== 'percentage_of_discounted_subtotal'
    ) {
      throw new Error(
        'Non-percentage commissions require paid order-item quantity and vendor-cost snapshots.',
      )
    }
    amounts = calculateCommissionAmounts(finiteMoney(order.subtotal), vendorDiscount, resolution, productDiscount)
  }
  const currency = typeof order.currency === 'string' ? order.currency : 'PHP'

  const entry = await payload.create({
    collection: 'vendor-commission-entries',
    data: {
      vendor: numId(vendorId),
      order: numId(orderId),
      transaction: numId(transactionId),
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
      commission_rule: resolution.ruleId == null ? null : numId(resolution.ruleId),
      commission_volume_tier_snapshot: resolution.volumeTierSnapshot ?? null,
      commission_product_breakdown: productBreakdown,
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
      vendor: numId(accrual.vendor),
      order: numId(orderId),
      transaction: numId(transactionId),
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
      commission_rule: numId(accrual.commission_rule) || null,
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
