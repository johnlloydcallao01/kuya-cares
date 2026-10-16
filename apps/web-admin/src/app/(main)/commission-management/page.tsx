'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Check, Coins, Plus, RefreshCw, Save, X } from '@/components/ui/IconWrapper'

type Option = { id: string; label: string }
type VolumeTier = {
  id?: string
  name: string
  minimumNetSales: string
  commissionPercent: string
}
type CommissionMethod =
  | 'percentage_of_discounted_subtotal'
  | 'percentage_of_pre_discount_subtotal'
  | 'fixed_amount_per_unit'
  | 'percentage_of_vendor_cost'
type Rule = {
  id: number | string
  name: string
  scope: 'global' | 'plan' | 'category' | 'vendor' | 'product' | 'product_category'
  priority: number
  plan?: Option | string | null
  category?: Option | string | null
  vendor?: Option | string | null
  product?: Option | string | null
  product_category?: Option | string | null
  commission_method?: CommissionMethod | null
  commission_value?: number | null
  commission_percent: number
  transaction_fee: number
  effective_from?: string | null
  effective_to?: string | null
  is_active: boolean
}
type LedgerEntry = {
  id: number | string
  vendor?: Option | string
  order?: { id?: number | string } | number | string
  transaction?: { id?: number | string } | number | string
  entry_type: 'accrual' | 'reversal' | 'adjustment'
  commission_percent: number
  commission_base_amount: number
  commission_amount: number
  commission_transaction_fee: number
  commission_vendor_net: number
  commission_volume_tier_snapshot?: {
    name: string
    minimumNetSales: number
    commissionPercent: number
    netSales: number
    windowDays: number
  } | null
  commission_product_breakdown?: Array<{
    product: string | number
    order_items?: Array<string | number>
    commission_base_amount: number
    commission_percent: number
    commission_method?: CommissionMethod
    commission_value?: number
    commission_pre_discount_base_amount?: number
    commission_quantity?: number
    commission_volume_tier_snapshot?: {
      name: string
      minimumNetSales: number
      commissionPercent: number
      netSales: number
      windowDays: number
    } | null
    commission_amount: number
    commission_transaction_fee: number
    commission_source: string
    commission_rule?: string | number | null
  }> | null
  provider_refund_id?: string
  adjustment_reason?: string
  adjustment_actor?: { id?: number | string; email?: string; firstName?: string; lastName?: string } | number | string
  effective_at: string
  currency?: string
}
type RuleAuditEntry = {
  id: number | string
  createdAt: string
  reason?: string
  actor?: { id?: number | string; email?: string; firstName?: string; lastName?: string } | number | string
  metadata?: Record<string, unknown>
}
type RuleForm = {
  name: string
  scope: Rule['scope']
  targetId: string
  priority: string
  commission_method: CommissionMethod
  commission_value: string
  transaction_fee: string
  effective_from: string
  effective_to: string
  is_active: boolean
}

function commissionMethodLabel(method: CommissionMethod | null | undefined) {
  switch (method ?? 'percentage_of_discounted_subtotal') {
    case 'percentage_of_pre_discount_subtotal': return 'pre-discount item price'
    case 'fixed_amount_per_unit': return 'PHP per unit'
    case 'percentage_of_vendor_cost': return 'vendor cost'
    default: return 'discounted sale'
  }
}

function commissionValueLabel(
  method: CommissionMethod | null | undefined,
  value: unknown,
) {
  const selectedMethod = method ?? 'percentage_of_discounted_subtotal'
  const amount = Number(value ?? 0)
  if (selectedMethod === 'fixed_amount_per_unit') return `${money(amount)} per unit`
  return `${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}% of ${commissionMethodLabel(selectedMethod)}`
}

const emptyForm: RuleForm = {
  name: '',
  scope: 'global',
  targetId: '',
  priority: '0',
  commission_method: 'percentage_of_discounted_subtotal',
  commission_value: '8',
  transaction_fee: '0',
  effective_from: '',
  effective_to: '',
  is_active: true,
}

function idOf(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id)
  return value == null ? '' : String(value)
}

function money(value: unknown, currency = 'PHP') {
  const amount = Number(value)
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)
}

function dateLabel(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
}

function ruleStatus(rule: Rule, now = Date.now()): 'Disabled' | 'Scheduled' | 'Expired' | 'Active' | 'Invalid dates' {
  if (!rule.is_active) return 'Disabled'
  const from = rule.effective_from ? Date.parse(rule.effective_from) : null
  const to = rule.effective_to ? Date.parse(rule.effective_to) : null
  if ((from !== null && !Number.isFinite(from)) || (to !== null && !Number.isFinite(to))) return 'Invalid dates'
  if (from !== null && to !== null && to <= from) return 'Invalid dates'
  if (from !== null && from > now) return 'Scheduled'
  if (to !== null && to < now) return 'Expired'
  return 'Active'
}

function ruleStatusClass(status: ReturnType<typeof ruleStatus>) {
  if (status === 'Active') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (status === 'Scheduled') return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
  if (status === 'Expired' || status === 'Invalid dates') return 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
  return 'bg-gray-100 text-gray-600 dark:bg-[#262626]'
}

type AuditSnapshot = {
  name?: string
  vendorId?: string | number
  scope?: string
  targetId?: string | number | null
  priority?: number
  commission_method?: CommissionMethod
  commission_value?: number
  commission_percent?: number
  transaction_fee?: number
  effective_from?: string | null
  effective_to?: string | null
  is_active?: boolean
  commissionVolumeTiers?: Array<{
    name: string
    minimumNetSales: number
    commissionPercent: number
  }>
}

function auditSnapshotLabel(snapshot: AuditSnapshot | null, fallbackName: string, kind: string, emptyLabel: string) {
  if (!snapshot) return emptyLabel
  if (kind === 'commission-volume-tiers') {
    const tiers = snapshot.commissionVolumeTiers ?? []
    return tiers.length === 0
      ? 'No rolling 30-day vendor sales tiers'
      : tiers
        .map((tier) => `${tier.name}: ${money(tier.minimumNetSales)}+ net sales → ${Number(tier.commissionPercent).toFixed(2)}%`)
        .join('; ')
  }
  if (kind === 'commission-override') {
    return `${fallbackName} · ${Number(snapshot.commission_percent ?? 0).toFixed(2)}% + ${money(snapshot.transaction_fee)} per paid order`
  }
  const target = snapshot.targetId == null ? 'All vendors' : `#${snapshot.targetId}`
  const enabled = snapshot.is_active ? 'enabled' : 'disabled'
  const start = snapshot.effective_from ? dateLabel(snapshot.effective_from) : 'immediately'
  const end = snapshot.effective_to ? dateLabel(snapshot.effective_to) : 'no end date'
  const value = snapshot.commission_value ?? snapshot.commission_percent ?? 0
  return `${snapshot.name ?? fallbackName} · ${snapshot.scope ?? 'global'} (${target}) · ${commissionValueLabel(snapshot.commission_method, value)} + ${money(snapshot.transaction_fee)} per paid order · priority ${snapshot.priority ?? 0} · ${enabled} · ${start} to ${end}`
}

async function readResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  let data: Record<string, unknown> = {}
  try {
    data = text ? JSON.parse(text) as Record<string, unknown> : {}
  } catch {
    throw new Error(text || 'CMS returned an invalid response')
  }
  if (!response.ok) throw new Error(String(data.errors && Array.isArray(data.errors) ? (data.errors[0] as { message?: string }).message : data.error || `Request failed (${response.status})`))
  return data as T
}

export default function CommissionManagementPage() {
  const [tab, setTab] = useState<'rules' | 'volume' | 'ledger' | 'audit'>('rules')
  const [rules, setRules] = useState<Rule[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [auditEntries, setAuditEntries] = useState<RuleAuditEntry[]>([])
  const [vendors, setVendors] = useState<Option[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [plans, setPlans] = useState<Option[]>([])
  const [products, setProducts] = useState<Option[]>([])
  const [productCategories, setProductCategories] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleForm>(emptyForm)
  const [search, setSearch] = useState('')
  const [adjustmentVendorId, setAdjustmentVendorId] = useState('')
  const [commissionAdjustment, setCommissionAdjustment] = useState('0')
  const [feeAdjustment, setFeeAdjustment] = useState('0')
  const [vendorBalanceAdjustment, setVendorBalanceAdjustment] = useState('0')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [savingAdjustment, setSavingAdjustment] = useState(false)
  const [volumeTiers, setVolumeTiers] = useState<VolumeTier[]>([])
  const [savingVolumeTiers, setSavingVolumeTiers] = useState(false)
  const queryClient = useQueryClient()

  const loadRules = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ruleResponse, optionResponse] = await Promise.all([
        fetch('/api/commission-rules', { cache: 'no-store' }).then((response) => readResponse<{ docs?: Rule[] }>(response)),
        fetch('/api/commission-options', { cache: 'no-store' }).then((response) => readResponse<{ vendors: Option[]; categories: Option[]; plans: Option[]; products: Option[]; productCategories: Option[] }>(response)),
      ])
      setRules(ruleResponse.docs ?? [])
      setVendors(optionResponse.vendors)
      setCategories(optionResponse.categories)
      setPlans(optionResponse.plans)
      setProducts(optionResponse.products)
      setProductCategories(optionResponse.productCategories)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load commission configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLedger = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [entryResponse, optionResponse] = await Promise.all([
        fetch('/api/commission-entries', { cache: 'no-store' }),
        fetch('/api/commission-options', { cache: 'no-store' }),
      ])
      const [data, options] = await Promise.all([
        readResponse<{ docs?: LedgerEntry[] }>(entryResponse),
        readResponse<{ vendors: Option[] }>(optionResponse),
      ])
      setEntries(data.docs ?? [])
      setVendors(options.vendors)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load commission ledger')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadAudit = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/commission-rule-audit', { cache: 'no-store' })
      const data = await readResponse<{ docs?: RuleAuditEntry[] }>(response)
      setAuditEntries(data.docs ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load commission rule audit history')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadVolumeTiers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/commission-volume-tiers', { cache: 'no-store' })
      const settings = await readResponse<{ commissionVolumeTiers?: Array<{ id?: string; name?: string; minimumNetSales?: number; commissionPercent?: number }> }>(response)
      setVolumeTiers((settings.commissionVolumeTiers ?? []).map((tier) => ({
        id: tier.id,
        name: tier.name ?? '',
        minimumNetSales: String(tier.minimumNetSales ?? ''),
        commissionPercent: String(tier.commissionPercent ?? ''),
      })))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to load vendor commission volume tiers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'ledger') void loadLedger()
    else if (tab === 'audit') void loadAudit()
    else if (tab === 'volume') void loadVolumeTiers()
    else void loadRules()
  }, [tab, loadAudit, loadLedger, loadRules, loadVolumeTiers])

  const saveVolumeTiers = async (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = volumeTiers.map((tier) => ({
      ...(tier.id ? { id: tier.id } : {}),
      name: tier.name.trim(),
      minimumNetSales: Number(tier.minimumNetSales),
      commissionPercent: Number(tier.commissionPercent),
    }))
    const thresholds = normalized.map((tier) => tier.minimumNetSales)
    if (normalized.some((tier) => !tier.name || !Number.isFinite(tier.minimumNetSales) || tier.minimumNetSales < 0 || Math.abs(tier.minimumNetSales * 100 - Math.round(tier.minimumNetSales * 100)) > 0.000001 || !Number.isFinite(tier.commissionPercent) || tier.commissionPercent < 0 || tier.commissionPercent > 100)) {
      setError('Each tier needs a name, a non-negative PHP threshold with at most two decimal places, and a commission rate from 0–100%.')
      return
    }
    if (new Set(thresholds).size !== thresholds.length) {
      setError('Each volume tier must have a unique minimum-sales threshold.')
      return
    }

    setSavingVolumeTiers(true)
    setError('')
    setSuccess('')
    try {
      await readResponse(await fetch('/api/commission-volume-tiers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commissionVolumeTiers: normalized }),
      }))
      setSuccess('Vendor commission volume tiers saved. They apply to newly paid orders only.')
      await loadVolumeTiers()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save vendor commission volume tiers')
    } finally {
      setSavingVolumeTiers(false)
    }
  }

  const targetOptions = form.scope === 'product_category' ? productCategories : form.scope === 'product' ? products : form.scope === 'vendor' ? vendors : form.scope === 'category' ? categories : form.scope === 'plan' ? plans : []

  const visibleRules = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rules.filter((rule) => !term || `${rule.name} ${rule.scope} ${rule.commission_percent}`.toLowerCase().includes(term))
  }, [rules, search])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setError('')
    setSuccess('')
  }

  const beginEdit = (rule: Rule) => {
    setEditingId(String(rule.id))
    setForm({
      name: rule.name,
      scope: rule.scope,
      targetId: idOf(rule[rule.scope]),
      priority: String(rule.priority ?? 0),
      commission_method: rule.commission_method ?? 'percentage_of_discounted_subtotal',
      commission_value: String(
        rule.commission_value ?? rule.commission_percent ?? 0,
      ),
      transaction_fee: String(rule.transaction_fee ?? 0),
      effective_from: rule.effective_from ? new Date(rule.effective_from).toISOString().slice(0, 16) : '',
      effective_to: rule.effective_to ? new Date(rule.effective_to).toISOString().slice(0, 16) : '',
      is_active: Boolean(rule.is_active),
    })
    setSuccess('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveRule = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    const commissionValue = Number(form.commission_value)
    const fee = Number(form.transaction_fee)
    const priority = Number(form.priority)
    const percentageMethod = form.commission_method !== 'fixed_amount_per_unit'
    if (!form.name.trim()) {
      setError('Enter a name for the commission rule.')
      setSaving(false)
      return
    }
    if (
      form.commission_value.trim() === '' ||
      !Number.isFinite(commissionValue) ||
      commissionValue < 0 ||
      (percentageMethod && commissionValue > 100) ||
      (!percentageMethod &&
        Math.abs(commissionValue * 100 - Math.round(commissionValue * 100)) > 0.000001) ||
      !Number.isFinite(fee) ||
      fee < 0 ||
      !Number.isFinite(priority)
    ) {
      setError(percentageMethod
        ? 'Enter a commission rate from 0–100%, a non-negative transaction fee, and a valid priority.'
        : 'Enter a non-negative PHP amount per unit with at most two decimal places, a non-negative transaction fee, and a valid priority.')
      setSaving(false)
      return
    }
    if (form.scope !== 'global' && !form.targetId) {
      setError(`Select a ${form.scope} for this rule.`)
      setSaving(false)
      return
    }
    const targetId = form.scope === 'global' ? null : Number(form.targetId)
    if (targetId !== null && (!Number.isSafeInteger(targetId) || targetId <= 0)) {
      setError(`The selected ${form.scope} has an invalid ID. Reload the options and select it again.`)
      setSaving(false)
      return
    }
    if (form.effective_from && form.effective_to && new Date(form.effective_to) <= new Date(form.effective_from)) {
      setError('The end date must be after the start date.')
      setSaving(false)
      return
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      scope: form.scope,
      priority,
      commission_method: form.commission_method,
      commission_value: commissionValue,
      commission_percent: percentageMethod ? commissionValue : 0,
      transaction_fee: fee,
      effective_from: form.effective_from ? new Date(form.effective_from).toISOString() : null,
      effective_to: form.effective_to ? new Date(form.effective_to).toISOString() : null,
      is_active: form.is_active,
      plan: form.scope === 'plan' ? targetId : null,
      category: form.scope === 'category' ? targetId : null,
      vendor: form.scope === 'vendor' ? targetId : null,
      product: form.scope === 'product' ? targetId : null,
      product_category: form.scope === 'product_category' ? targetId : null,
    }
    try {
      const response = await fetch(editingId ? `/api/commission-rules/${encodeURIComponent(editingId)}` : '/api/commission-rules', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      await readResponse(response)
      const savedMessage = editingId ? 'Commission rule updated.' : 'Commission rule created.'
      resetForm()
      setSuccess(savedMessage)
      await loadRules()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save commission rule')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (rule: Rule) => {
    setError('')
    setSuccess('')
    try {
      await readResponse(await fetch(`/api/commission-rules/${encodeURIComponent(String(rule.id))}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !rule.is_active }),
      }))
      setSuccess(`Rule ${rule.is_active ? 'deactivated' : 'activated'}. Existing paid orders keep their saved commission.`)
      await loadRules()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to change rule status')
    }
  }

  const postAdjustment = async (event: React.FormEvent) => {
    event.preventDefault()
    const amounts = {
      commissionAmount: Number(commissionAdjustment),
      transactionFeeAmount: Number(feeAdjustment),
      vendorBalanceAmount: Number(vendorBalanceAdjustment),
    }
    if (!adjustmentVendorId) {
      setError('Select the vendor for this adjustment.')
      return
    }
    if (Object.values(amounts).some((amount) => !Number.isFinite(amount) || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001)) {
      setError('Adjustment amounts must be valid values with no more than two decimal places.')
      return
    }
    if (Object.values(amounts).every((amount) => amount === 0)) {
      setError('Enter at least one non-zero adjustment amount.')
      return
    }
    if (!adjustmentReason.trim()) {
      setError('A reason is required for the immutable adjustment record.')
      return
    }

    setSavingAdjustment(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch('/api/commission-adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId: adjustmentVendorId, ...amounts, reason: adjustmentReason.trim() }),
      })
      await readResponse(response)
      setSuccess('Manual adjustment recorded in the immutable ledger and included in vendor payout balances.')
      setCommissionAdjustment('0')
      setFeeAdjustment('0')
      setVendorBalanceAdjustment('0')
      setAdjustmentReason('')
      await Promise.all([
        loadLedger(),
        queryClient.invalidateQueries({ queryKey: ['admin', 'vendors', 'payouts'] }),
      ])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to post the manual adjustment')
    } finally {
      setSavingAdjustment(false)
    }
  }

  const targetLabel = (rule: Rule) => {
    if (rule.scope === 'global') return 'All vendors'
    const selected = targetOptionsForRule(rule, vendors, categories, plans, products, productCategories)
    return selected.find((option) => option.id === idOf(rule[rule.scope]))?.label ?? `#${idOf(rule[rule.scope])}`
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white"><Coins className="h-6 w-6 text-[#239459]" /> Manage Commissions</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Configure future commission rules and review immutable accrual, refund, and adjustment ledger entries.</p>
        </div>
        <button onClick={() => (tab === 'rules' ? void loadRules() : tab === 'volume' ? void loadVolumeTiers() : tab === 'ledger' ? void loadLedger() : void loadAudit())} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#171717]"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </header>

      <div className="flex gap-2 border-b border-gray-200 dark:border-[#262626]">
        <button onClick={() => setTab('rules')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'rules' ? 'border-[#239459] text-[#239459]' : 'border-transparent text-gray-500'}`}>Commission rules</button>
        <button onClick={() => setTab('volume')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'volume' ? 'border-[#239459] text-[#239459]' : 'border-transparent text-gray-500'}`}>Vendor volume tiers</button>
        <button onClick={() => setTab('ledger')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'ledger' ? 'border-[#239459] text-[#239459]' : 'border-transparent text-gray-500'}`}>Accrual, refund & adjustment ledger</button>
        <button onClick={() => setTab('audit')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'audit' ? 'border-[#239459] text-[#239459]' : 'border-transparent text-gray-500'}`}>Rule change audit</button>
      </div>

      {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {success && <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"><Check className="mt-0.5 h-4 w-4 shrink-0" />{success}</div>}

      {tab === 'rules' ? (
        <>
          <form onSubmit={saveRule} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#262626] dark:bg-[#171717]">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="font-semibold text-gray-900 dark:text-white">{editingId ? 'Edit commission rule' : 'Create commission rule'}</h2><p className="text-xs text-gray-500">Rules affect newly paid orders only; existing commission snapshots do not change.</p></div>
              {editingId && <button type="button" onClick={resetForm} className="inline-flex items-center gap-1 text-sm text-gray-500"><X className="h-4 w-4" /> Cancel edit</button>}
            </div>
            <div className="space-y-1 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <p><strong>Calculation methods:</strong> discounted percentage uses merchandise after all product discounts; pre-discount percentage uses the recorded customer item subtotal before order discounts (including options/modifiers); fixed-per-unit is PHP for each paid product unit. Delivery and other non-product charges are excluded.</p>
              <p><strong>Fixed order fee:</strong> remains a PHP fee charged once per paid order and reversed proportionally on refunds. It is capped at the applicable commission base.</p>
              <p><strong>Vendor volume fallback:</strong> CMS System Settings tiers use each vendor’s rolling 30-day net paid product sales after product discounts and successful refunds; delivery and cancelled orders are excluded. The current paid order’s eligible product subtotal is included. A matching product/category/vendor/merchant-category/plan rule wins before the tier; the tier is selected before a global rule.</p>
              <p><strong>Rule matching:</strong> among rules in the same matching level, highest priority wins, followed by product, product category, vendor, merchant category, plan, then global specificity; remaining ties use latest start date, then lower rule ID.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Rule name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} maxLength={120} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Applies to<select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as Rule['scope'], targetId: '' })} className={inputClass}><option value="global">All vendors (global)</option><option value="plan">Membership plan</option><option value="category">Merchant category</option><option value="vendor">Specific vendor</option><option value="product_category">Product category</option><option value="product">Specific product</option></select></label>
              {form.scope !== 'global' && <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">{form.scope === 'product_category' ? 'Product category' : form.scope === 'product' ? 'Product' : form.scope === 'vendor' ? 'Vendor' : form.scope === 'category' ? 'Merchant category' : 'Membership plan'}<select required value={form.targetId} onChange={(event) => setForm({ ...form, targetId: event.target.value })} className={inputClass}><option value="">Select…</option>{targetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Priority (higher wins)<input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Commission method<select value={form.commission_method} onChange={(event) => setForm({ ...form, commission_method: event.target.value as CommissionMethod })} className={inputClass}><option value="percentage_of_discounted_subtotal">Percentage of discounted sale</option><option value="percentage_of_pre_discount_subtotal">Percentage of pre-discount item price</option><option value="fixed_amount_per_unit">Fixed PHP per product unit</option><option value="percentage_of_vendor_cost">Percentage of recorded vendor cost</option></select></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">{form.commission_method === 'fixed_amount_per_unit' ? 'Commission per unit (PHP)' : 'Commission rate (%)'}<input required type="number" min="0" max={form.commission_method === 'fixed_amount_per_unit' ? undefined : 100} step="0.01" value={form.commission_value} onChange={(event) => setForm({ ...form, commission_value: event.target.value })} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Fixed fee per paid order (PHP)<input required type="number" min="0" step="0.01" value={form.transaction_fee} onChange={(event) => setForm({ ...form, transaction_fee: event.target.value })} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Effective from<input type="datetime-local" value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Effective until<input type="datetime-local" value={form.effective_to} onChange={(event) => setForm({ ...form, effective_to: event.target.value })} className={inputClass} /></label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700 dark:text-[#a1a1aa]"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Enabled (effective dates also apply)</label>
            </div>
            <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create rule'}</button></div>
          </form>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-[#262626] sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold text-gray-900 dark:text-white">Configured rules</h2><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rules" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#0a0a0a]" /></div>
            {loading ? <Loading /> : visibleRules.length === 0 ? <Empty message="No commission rules found. Create a rule above." /> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3">Rule</th><th className="px-4 py-3">Scope / target</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Fee / paid order</th><th className="px-4 py-3">Effective window</th><th className="px-4 py-3">Effective status</th><th className="px-4 py-3">Actions</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{visibleRules.map((rule) => (
                  <tr key={rule.id}><td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{rule.name}</td><td className="px-4 py-3 capitalize text-gray-600 dark:text-[#a1a1aa]">{rule.scope}<div className="text-xs text-gray-400">{targetLabel(rule)}</div></td><td className="px-4 py-3">{rule.priority}</td><td className="px-4 py-3">{commissionValueLabel(rule.commission_method, rule.commission_value ?? rule.commission_percent)}</td><td className="px-4 py-3">{money(rule.transaction_fee)}</td><td className="px-4 py-3 text-xs text-gray-500">{rule.effective_from ? dateLabel(rule.effective_from) : 'Now'}<div>to {rule.effective_to ? dateLabel(rule.effective_to) : 'No end date'}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${ruleStatusClass(ruleStatus(rule))}`}>{ruleStatus(rule)}</span></td><td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => beginEdit(rule)} className="font-medium text-[#239459] hover:underline">Edit</button><button onClick={() => void toggleActive(rule)} className="font-medium text-gray-600 hover:underline dark:text-[#a1a1aa]">{rule.is_active ? 'Deactivate' : 'Activate'}</button></div></td></tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
        </>
      ) : tab === 'volume' ? (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
          <div className="border-b border-gray-100 p-4 dark:border-[#262626]">
            <h2 className="font-semibold text-gray-900 dark:text-white">Rolling 30-day vendor sales tiers</h2>
            <p className="mt-1 max-w-4xl text-xs text-gray-500 dark:text-[#a1a1aa]">Tier qualification uses net paid merchandise sales in the inclusive 30-day window ending when an order is paid. Product discounts and successful refunds reduce sales; delivery, cancelled orders, and other non-product charges are excluded. The order being accrued is included. The highest qualifying threshold wins. Matching product, product-category, vendor, merchant-category, and plan rules take precedence; a tier is used before the global fallback.</p>
          </div>
          <form onSubmit={saveVolumeTiers} className="space-y-4 p-4">
            {loading ? <Loading /> : volumeTiers.length === 0 ? <Empty message="No vendor volume tiers configured. Add a tier to enable sales-volume commission rates." /> : (
              <div className="space-y-3">
                {volumeTiers.map((tier, index) => (
                  <div key={tier.id ?? `tier-${index}`} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-gray-100 p-3 dark:border-[#262626] md:grid-cols-[2fr_1fr_1fr_auto]">
                    <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Tier name<input required maxLength={80} value={tier.name} onChange={(event) => setVolumeTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} className={inputClass} /></label>
                    <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Minimum net sales (PHP)<input required type="number" min="0" step="0.01" value={tier.minimumNetSales} onChange={(event) => setVolumeTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, minimumNetSales: event.target.value } : item))} className={inputClass} /></label>
                    <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Commission rate (%)<input required type="number" min="0" max="100" step="0.01" value={tier.commissionPercent} onChange={(event) => setVolumeTiers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, commissionPercent: event.target.value } : item))} className={inputClass} /></label>
                    <button type="button" onClick={() => setVolumeTiers((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-red-600 dark:border-[#262626]">Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap justify-between gap-2">
              <button type="button" onClick={() => setVolumeTiers((current) => [...current, { name: '', minimumNetSales: '', commissionPercent: '' }])} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-[#262626]"><Plus className="h-4 w-4" /> Add tier</button>
              <button disabled={savingVolumeTiers || loading} className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{savingVolumeTiers ? 'Saving…' : 'Save volume tiers'}</button>
            </div>
          </form>
        </section>
      ) : tab === 'ledger' ? (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
          <div className="border-b border-gray-100 p-4 dark:border-[#262626]"><h2 className="font-semibold text-gray-900 dark:text-white">Commission ledger</h2><p className="mt-1 text-xs text-gray-500">Accruals, refund reversals, and adjustments are immutable. This ledger is reporting only; it does not execute vendor transfers.</p></div>
          <form onSubmit={postAdjustment} className="m-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Post a manual adjustment</h3>
              <p className="mt-1 text-xs text-gray-600 dark:text-[#a1a1aa]">Entries are immutable. Positive vendor-balance amounts increase the payable balance; negative amounts reduce it. Positive commission/fee amounts increase marketplace income, while negative amounts reduce it. Include a reason for the audit record.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Vendor<select required value={adjustmentVendorId} onChange={(event) => setAdjustmentVendorId(event.target.value)} className={inputClass}><option value="">Select vendor…</option>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.label}</option>)}</select></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Commission adjustment (PHP)<input type="number" step="0.01" value={commissionAdjustment} onChange={(event) => setCommissionAdjustment(event.target.value)} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Fixed-fee adjustment (PHP)<input type="number" step="0.01" value={feeAdjustment} onChange={(event) => setFeeAdjustment(event.target.value)} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Vendor balance adjustment (PHP)<input type="number" step="0.01" value={vendorBalanceAdjustment} onChange={(event) => setVendorBalanceAdjustment(event.target.value)} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Reason (required)<input required maxLength={500} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} className={inputClass} placeholder="Describe the correction" /></label>
            </div>
            <div className="flex justify-end"><button disabled={savingAdjustment} className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Plus className="h-4 w-4" />{savingAdjustment ? 'Posting…' : 'Post adjustment'}</button></div>
          </form>
          {loading ? <Loading /> : entries.length === 0 ? <Empty message="No commission ledger entries yet." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Order / transaction</th><th className="px-4 py-3">Entry</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Commission base</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Fee impact</th><th className="px-4 py-3">Vendor net impact</th><th className="px-4 py-3">Product breakdown</th><th className="px-4 py-3">Refund / adjustment details</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{entries.map((entry) => (
                <tr key={entry.id}><td className="px-4 py-3 text-xs text-gray-500">{dateLabel(entry.effective_at)}</td><td className="px-4 py-3">{typeof entry.vendor === 'object' ? (entry.vendor as unknown as Record<string, unknown>).businessName ?? idOf(entry.vendor) : idOf(entry.vendor)}</td><td className="px-4 py-3">{idOf(entry.order) ? `#${idOf(entry.order)}` : 'Manual'}<div className="text-xs text-gray-400">{idOf(entry.transaction) ? `tx #${idOf(entry.transaction)}` : '—'}</div></td><td className="px-4 py-3 capitalize">{entry.entry_type}</td><td className="px-4 py-3">{Number(entry.commission_percent).toFixed(2)}%{entry.commission_volume_tier_snapshot && <div className="text-xs text-gray-500">{entry.commission_volume_tier_snapshot.name || 'Volume tier'} · {money(entry.commission_volume_tier_snapshot.netSales, entry.currency)} / {entry.commission_volume_tier_snapshot.windowDays}d</div>}</td><td className="px-4 py-3">{money(entry.commission_base_amount, entry.currency)}</td><td className="px-4 py-3">{money(entry.commission_amount, entry.currency)}</td><td className="px-4 py-3">{money(entry.commission_transaction_fee, entry.currency)}</td><td className="px-4 py-3 font-semibold">{money(entry.commission_vendor_net, entry.currency)}</td><td className="px-4 py-3 text-xs">{entry.commission_product_breakdown?.length ? <details><summary className="cursor-pointer text-[#239459]">View {entry.commission_product_breakdown.length} product(s)</summary><ul className="mt-2 min-w-56 space-y-2">{entry.commission_product_breakdown.map((product) => <li key={String(product.product)} className="border-t border-gray-100 pt-2 dark:border-[#262626]"><strong>Product #{product.product}</strong><div>{commissionValueLabel(product.commission_method, product.commission_value ?? product.commission_percent)} · base {money(product.commission_base_amount, entry.currency)} · commission {money(product.commission_amount, entry.currency)}</div>{product.commission_pre_discount_base_amount ? <div>Recorded pre-discount item base {money(product.commission_pre_discount_base_amount, entry.currency)}</div> : null}<div>Fee {money(product.commission_transaction_fee, entry.currency)} · {product.commission_source}{product.commission_volume_tier_snapshot ? ` · ${product.commission_volume_tier_snapshot.name} tier` : ''}{product.commission_rule ? ` · rule #${product.commission_rule}` : ''}</div>{product.order_items?.length ? <div className="text-gray-400">Order item(s): {product.order_items.map((id) => `#${id}`).join(', ')}</div> : null}</li>)}</ul></details> : '—'}</td><td className="px-4 py-3 text-xs">{entry.provider_refund_id || '—'}{entry.adjustment_reason && <div className="mt-1 max-w-xs text-gray-500">{entry.adjustment_reason}<div>By {entry.adjustment_actor && typeof entry.adjustment_actor === 'object' ? `${entry.adjustment_actor.firstName ?? ''} ${entry.adjustment_actor.lastName ?? ''}`.trim() || entry.adjustment_actor.email || `#${entry.adjustment_actor.id}` : idOf(entry.adjustment_actor) || 'Admin'}</div></div>}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
          <div className="border-b border-gray-100 p-4 dark:border-[#262626]"><h2 className="font-semibold text-gray-900 dark:text-white">Commission change audit history</h2><p className="mt-1 text-xs text-gray-500">Rule changes and vendor overrides include the acting administrator, timestamp, action, reason, and before/after values.</p></div>
          {loading ? <Loading /> : auditEntries.length === 0 ? <Empty message="No commission rule changes recorded yet." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Administrator</th><th className="px-4 py-3">Change</th><th className="px-4 py-3">Commission setting</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Before / after</th><th className="px-4 py-3">Reason</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{auditEntries.map((entry) => {
                const actor = entry.actor && typeof entry.actor === 'object' ? `${entry.actor.firstName ?? ''} ${entry.actor.lastName ?? ''}`.trim() || entry.actor.email || `#${entry.actor.id}` : idOf(entry.actor)
                const metadata = entry.metadata ?? {}
                const before = (metadata.before ?? metadata.previous ?? null) as AuditSnapshot | null
                const after = (metadata.after ?? null) as AuditSnapshot | null
                const kind = String(metadata.kind ?? 'commission-rule')
                const operation = String(metadata.operation ?? 'update')
                const fallbackName = kind === 'commission-override'
                  ? `Vendor override #${String(metadata.vendorId ?? '')}`
                  : kind === 'commission-volume-tiers'
                    ? 'Vendor volume tiers'
                  : String(metadata.name ?? `Rule #${String(metadata.ruleId ?? '')}`)
                const method = metadata.commission_method as CommissionMethod | undefined
                const rate = metadata.commission_value ?? metadata.commission_percent ?? metadata.pct
                const beforeEmptyLabel = operation === 'create'
                  ? 'Rule did not exist'
                  : kind === 'commission-override'
                    ? 'No vendor override'
                    : 'No prior rule snapshot'
                const afterEmptyLabel = operation === 'delete'
                  ? 'Rule deleted'
                  : kind === 'commission-override'
                    ? 'No vendor override (inherits matching rules)'
                    : 'No rule after change'
                return <tr key={entry.id}><td className="px-4 py-3 text-xs text-gray-500">{dateLabel(entry.createdAt)}</td><td className="px-4 py-3">{actor || 'System'}</td><td className="px-4 py-3 capitalize">{operation}</td><td className="px-4 py-3">{fallbackName}</td><td className="px-4 py-3">{rate == null ? '—' : kind === 'commission-override' ? `${Number(rate).toFixed(2)}%` : commissionValueLabel(method, rate)}</td><td className="px-4 py-3 text-xs text-gray-500"><details><summary className="cursor-pointer text-[#239459]">View</summary><div className="mt-2 min-w-72 space-y-1"><p><strong>Before:</strong> {auditSnapshotLabel(before, fallbackName, kind, beforeEmptyLabel)}</p><p><strong>After:</strong> {auditSnapshotLabel(after, fallbackName, kind, afterEmptyLabel)}</p></div></details></td><td className="px-4 py-3 text-xs text-gray-500">{entry.reason || '—'}</td></tr>
              })}</tbody>
            </table></div>
          )}
        </section>
      )}
    </div>
  )
}

function targetOptionsForRule(rule: Rule, vendors: Option[], categories: Option[], plans: Option[], products: Option[], productCategories: Option[]) {
  return rule.scope === 'product_category' ? productCategories : rule.scope === 'product' ? products : rule.scope === 'vendor' ? vendors : rule.scope === 'category' ? categories : plans
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white'

function Loading() {
  return <div className="p-8 text-center text-sm text-gray-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading commission data…</div>
}

function Empty({ message }: { message: string }) {
  return <div className="p-10 text-center text-sm text-gray-500">{message}</div>
}
