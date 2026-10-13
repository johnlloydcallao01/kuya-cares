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
  const targetField = scope === 'vendor' || scope === 'category' || scope === 'plan' ? scope : null
  return {
    name: doc.name,
    scope: doc.scope,
    targetId: targetField ? relationshipId(doc[targetField]) : null,
    priority: doc.priority,
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
    defaultColumns: ['name', 'scope', 'priority', 'commission_percent', 'is_active'],
    group: 'Finance',
    description: 'Vendor commission rules. Higher priority wins; ties prefer the most specific scope.',
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
        { label: 'Category', value: 'category' },
        { label: 'Vendor', value: 'vendor' },
      ],
    },
    {
      name: 'priority',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'Higher wins. Equal priorities prefer vendor, category, plan, then global.' },
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
      admin: { description: "Only when scope === 'category'" },
    },
    {
      name: 'vendor',
      type: 'relationship',
      relationTo: 'vendors',
      admin: { description: "Only when scope === 'vendor'" },
    },
    { name: 'commission_percent', type: 'number', required: true, min: 0, max: 100 },
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
  indexes: [{ fields: ['scope', 'is_active'] }, { fields: ['priority'] }],
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
        }
        const targetScope = Object.entries(targets).find(([, value]) => value != null)?.[0]
        if (scope === 'global' && targetScope) {
          throw new Error('Global commission rules must not target a plan, category, or vendor.')
        }
        if (scope && scope !== 'global' && !rule[scope]) {
          throw new Error(`${scope} commission rules require a matching ${scope} target.`)
        }
        for (const [target, value] of Object.entries(targets)) {
          if (target !== scope && value != null) {
            throw new Error(`${scope} commission rules cannot target ${target}.`)
          }
        }
        const pct = Number(rule.commission_percent)
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
          throw new Error('Commission percentage must be between 0 and 100.')
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
