import type { CollectionConfig } from 'payload'
import { randomUUID } from 'node:crypto'

const isServiceOrAdmin = (user: { role?: string } | null | undefined) =>
  user?.role === 'service' || user?.role === 'admin'

function relationshipId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function auditSnapshot(doc: Record<string, unknown>) {
  const scope = String(doc.scope ?? '')
  const targetField =
    scope === 'vendor' ||
    scope === 'category' ||
    scope === 'plan' ||
    scope === 'product' ||
    scope === 'product_category'
      ? scope
      : null
  return {
    name: doc.name,
    scope: doc.scope,
    targetId: targetField ? relationshipId(doc[targetField]) : null,
    priority: doc.priority,
    commission_method: doc.commission_method,
    commission_value: doc.commission_value,
    commission_percent: doc.commission_percent,
    transaction_fee: doc.transaction_fee,
    effective_from: doc.effective_from,
    effective_to: doc.effective_to,
    is_active: doc.is_active,
  }
}

export const CommissionRules: CollectionConfig = {
  slug: 'commission-rules',
  admin: {
    useAsTitle: 'name',
    defaultColumns: [
      'name',
      'scope',
      'product',
      'product_category',
      'priority',
      'commission_method',
      'commission_value',
      'commission_percent',
      'is_active',
    ],
    group: 'Finance',
    description:
      'Commission rules. Higher priority wins; equal priorities prefer product, product category, vendor, merchant category, plan, then global.',
  },
  access: {
    read: ({ req: { user } }) => {
      if (isServiceOrAdmin(user)) return true
      return false
    },
    create: ({ req: { user } }) => isServiceOrAdmin(user),
    update: ({ req: { user } }) => isServiceOrAdmin(user),
    delete: ({ req: { user } }) => isServiceOrAdmin(user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'scope',
      type: 'select',
      required: true,
      options: [
        { label: 'Global', value: 'global' },
        { label: 'Plan', value: 'plan' },
        { label: 'Merchant Category', value: 'category' },
        { label: 'Vendor', value: 'vendor' },
        { label: 'Product', value: 'product' },
        { label: 'Product Category', value: 'product_category' },
      ],
    },
    {
      name: 'priority',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description:
          'Higher wins. Equal priorities prefer product, product category, vendor, merchant category, plan, then global.',
      },
    },
    {
      name: 'plan',
      type: 'relationship',
      relationTo: 'membership-plans',
      admin: { description: "Only when scope === 'plan'" },
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'merchant-categories',
      admin: { description: "Only when scope === 'category'; targets a merchant category." },
    },
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'vendors',
      admin: { description: "Only when scope === 'vendor'" },
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      admin: { description: "Only when scope === 'product'; applies to order lines for this product." },
    },
    {
      name: 'product_category',
      type: 'relationship',
      relationTo: 'product-categories',
      admin: {
        description:
          "Only when scope === 'product_category'; applies to order lines whose product belongs to this catalog category.",
      },
    },
    {
      name: 'commission_method',
      type: 'select',
      defaultValue: 'percentage_of_discounted_subtotal',
      options: [
        { label: 'Percentage of discounted subtotal', value: 'percentage_of_discounted_subtotal' },
        { label: 'Percentage of pre-discount item price', value: 'percentage_of_pre_discount_subtotal' },
        { label: 'Fixed amount per unit', value: 'fixed_amount_per_unit' },
        { label: 'Percentage of vendor cost', value: 'percentage_of_vendor_cost' },
      ],
      admin: {
        description:
          'Discounted percentage uses merchandise after product discounts; pre-discount percentage uses the customer item subtotal recorded at checkout (including options, before order discounts); fixed-per-unit is PHP per paid product unit; vendor-cost percentage uses the private cost snapshot.',
      },
    },
    {
      name: 'commission_value',
      type: 'number',
      min: 0,
      admin: {
        description:
          'Rate (%) for percentage methods or PHP per unit for fixed amount per unit. Percentage methods are limited to 0–100%; fixed unit amounts must use at most two decimal places. If omitted, legacy commission_percent is used for percentage rules.',
        step: 0.01,
      },
    },
    {
      name: 'commission_percent',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: {
        description:
          'Legacy percentage value retained for API compatibility. New rules should set commission_method and commission_value.',
      },
    },
    {
      name: 'transaction_fee',
      type: 'number',
      min: 0,
      defaultValue: 0,
      admin: { description: 'Fixed amount charged once per paid order; refund reversals are proportional.' },
    },
    { name: 'effective_from', type: 'date' },
    { name: 'effective_to', type: 'date' },
    { name: 'is_active', type: 'checkbox', defaultValue: true },
  ],
  indexes: [
    { fields: ['scope', 'is_active'] },
    { fields: ['priority'] },
    { fields: ['product_category'] },
  ],
  hooks: {
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (!data) return data
        const rule = { ...originalDoc, ...data }
        const scope = rule.scope
        const targets: Record<string, unknown> = {
          plan: rule.plan,
          category: rule.category,
          vendor: rule.vendor,
          product: rule.product,
          product_category: rule.product_category,
        }
        const targetScope = Object.entries(targets).find(([, value]) => value != null)?.[0]
        if (scope === 'global' && targetScope) {
          throw new Error('Global commission rules must not target another scope relationship.')
        }
        if (scope && scope !== 'global' && !rule[scope]) {
          throw new Error(`${scope} commission rules require a matching ${scope} target.`)
        }
        for (const [target, value] of Object.entries(targets)) {
          if (target !== scope && value != null) {
            throw new Error(`${scope} commission rules cannot target ${target}.`)
          }
        }
        const method = rule.commission_method ?? 'percentage_of_discounted_subtotal'
        const supportedMethods = [
          'percentage_of_discounted_subtotal',
          'percentage_of_pre_discount_subtotal',
          'fixed_amount_per_unit',
          'percentage_of_vendor_cost',
        ]
        if (!supportedMethods.includes(String(method))) {
          throw new Error('Commission method is not supported.')
        }
        if (
          method !== 'percentage_of_discounted_subtotal' &&
          method !== 'percentage_of_pre_discount_subtotal' &&
          (rule.commission_value === undefined || rule.commission_value === null || rule.commission_value === '')
        ) {
          throw new Error('Commission value is required for fixed-per-unit and vendor-cost methods.')
        }
        const value = rule.commission_value ?? rule.commission_percent ?? 0
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue) || numericValue < 0) {
          throw new Error('Commission value must be a non-negative amount or rate.')
        }
        if (
          (method === 'percentage_of_discounted_subtotal' ||
            method === 'percentage_of_pre_discount_subtotal' ||
            method === 'percentage_of_vendor_cost') &&
          numericValue > 100
        ) {
          throw new Error('Commission percentage must be between 0 and 100.')
        }
        if (
          method === 'fixed_amount_per_unit' &&
          Math.abs(numericValue * 100 - Math.round(numericValue * 100)) > 0.000001
        ) {
          throw new Error('Fixed-per-unit commission must use no more than two decimal places.')
        }
        const fee = Number(rule.transaction_fee ?? 0)
        if (!Number.isFinite(fee) || fee < 0) {
          throw new Error('Transaction fee must be a non-negative amount.')
        }
        if (rule.effective_from && rule.effective_to) {
          const from = new Date(rule.effective_from).getTime()
          const to = new Date(rule.effective_to).getTime()
          if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
            throw new Error('Commission rule end date must be after its start date.')
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const before = operation === 'update' && previousDoc
          ? auditSnapshot(previousDoc as Record<string, unknown>)
          : null
        const after = auditSnapshot(doc as Record<string, unknown>)
        await req.payload.create({
          collection: 'membership-audit-log',
          data: {
            action: 'override',
            reason: `Commission rule ${operation === 'create' ? 'created' : 'updated'}: ${doc.name}`,
            actor: req.user?.id ?? undefined,
            eventId: `commission-rule:${String(doc.id)}:${randomUUID()}`,
            metadata: {
              kind: 'commission-rule',
              operation,
              ruleId: doc.id,
              ...after,
              before,
              after,
              previous: before,
            },
          },
          overrideAccess: true,
          req,
        })
        return doc
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        const before = auditSnapshot(doc as Record<string, unknown>)
        await req.payload.create({
          collection: 'membership-audit-log',
          data: {
            action: 'override',
            reason: `Commission rule deleted: ${doc.name}`,
            actor: req.user?.id ?? undefined,
            eventId: `commission-rule:${String(doc.id)}:${randomUUID()}`,
            metadata: {
              kind: 'commission-rule',
              operation: 'delete',
              ruleId: doc.id,
              ...before,
              before,
              after: null,
            },
          },
          overrideAccess: true,
          req,
        })
        return doc
      },
    ],
  },
}
