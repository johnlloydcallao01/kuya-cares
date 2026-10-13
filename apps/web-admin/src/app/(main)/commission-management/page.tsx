'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Coins, Plus, RefreshCw, Save, X } from '@/components/ui/IconWrapper'

type Option = { id: string; label: string }
type Rule = {
  id: number | string
  name: string
  scope: 'global' | 'plan' | 'category' | 'vendor'
  priority: number
  plan?: Option | string | null
  category?: Option | string | null
  vendor?: Option | string | null
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
  entry_type: 'accrual' | 'reversal'
  commission_percent: number
  commission_base_amount: number
  commission_amount: number
  commission_transaction_fee: number
  commission_vendor_net: number
  provider_refund_id?: string
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
  commission_percent: string
  transaction_fee: string
  effective_from: string
  effective_to: string
  is_active: boolean
}

const emptyForm: RuleForm = {
  name: '',
  scope: 'global',
  targetId: '',
  priority: '0',
  commission_percent: '8',
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
  const [tab, setTab] = useState<'rules' | 'ledger' | 'audit'>('rules')
  const [rules, setRules] = useState<Rule[]>([])
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [auditEntries, setAuditEntries] = useState<RuleAuditEntry[]>([])
  const [vendors, setVendors] = useState<Option[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [plans, setPlans] = useState<Option[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RuleForm>(emptyForm)
  const [search, setSearch] = useState('')

  const loadRules = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [ruleResponse, optionResponse] = await Promise.all([
        fetch('/api/commission-rules', { cache: 'no-store' }).then((response) => readResponse<{ docs?: Rule[] }>(response)),
        fetch('/api/commission-options', { cache: 'no-store' }).then((response) => readResponse<{ vendors: Option[]; categories: Option[]; plans: Option[] }>(response)),
      ])
      setRules(ruleResponse.docs ?? [])
      setVendors(optionResponse.vendors)
      setCategories(optionResponse.categories)
      setPlans(optionResponse.plans)
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
      const response = await fetch('/api/commission-entries', { cache: 'no-store' })
      const data = await readResponse<{ docs?: LedgerEntry[] }>(response)
      setEntries(data.docs ?? [])
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

  useEffect(() => {
    if (tab === 'ledger') void loadLedger()
    else if (tab === 'audit') void loadAudit()
    else void loadRules()
  }, [tab, loadAudit, loadLedger, loadRules])

  const targetOptions = form.scope === 'vendor' ? vendors : form.scope === 'category' ? categories : form.scope === 'plan' ? plans : []

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
      commission_percent: String(rule.commission_percent ?? 0),
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
    const pct = Number(form.commission_percent)
    const fee = Number(form.transaction_fee)
    const priority = Number(form.priority)
    if (!form.name.trim()) {
      setError('Enter a name for the commission rule.')
      setSaving(false)
      return
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100 || !Number.isFinite(fee) || fee < 0 || !Number.isFinite(priority)) {
      setError('Enter a commission rate from 0–100%, a non-negative transaction fee, and a valid priority.')
      setSaving(false)
      return
    }
    if (form.scope !== 'global' && !form.targetId) {
      setError(`Select a ${form.scope} for this rule.`)
      setSaving(false)
      return
    }
    if (form.effective_from && form.effective_to && new Date(form.effective_to) < new Date(form.effective_from)) {
      setError('The end date must be on or after the start date.')
      setSaving(false)
      return
    }
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      scope: form.scope,
      priority,
      commission_percent: pct,
      transaction_fee: fee,
      effective_from: form.effective_from ? new Date(form.effective_from).toISOString() : null,
      effective_to: form.effective_to ? new Date(form.effective_to).toISOString() : null,
      is_active: form.is_active,
      plan: form.scope === 'plan' ? form.targetId : null,
      category: form.scope === 'category' ? form.targetId : null,
      vendor: form.scope === 'vendor' ? form.targetId : null,
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

  const targetLabel = (rule: Rule) => {
    if (rule.scope === 'global') return 'All vendors'
    const selected = targetOptionsForRule(rule, vendors, categories, plans)
    return selected.find((option) => option.id === idOf(rule[rule.scope]))?.label ?? `#${idOf(rule[rule.scope])}`
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white"><Coins className="h-6 w-6 text-[#239459]" /> Manage Commissions</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Configure future commission rules and review immutable commission/refund ledger entries.</p>
        </div>
        <button onClick={() => (tab === 'rules' ? void loadRules() : tab === 'ledger' ? void loadLedger() : void loadAudit())} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#171717]"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </header>

      <div className="flex gap-2 border-b border-gray-200 dark:border-[#262626]">
        <button onClick={() => setTab('rules')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'rules' ? 'border-[#239459] text-[#239459]' : 'border-transparent text-gray-500'}`}>Commission rules</button>
        <button onClick={() => setTab('ledger')} className={`border-b-2 px-3 py-2 text-sm font-semibold ${tab === 'ledger' ? 'border-[#239459] text-[#239459]' : 'border-transparent text-gray-500'}`}>Accrual & refund ledger</button>
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Rule name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} maxLength={120} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Applies to<select value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value as Rule['scope'], targetId: '' })} className={inputClass}><option value="global">All vendors (global)</option><option value="plan">Membership plan</option><option value="category">Merchant category</option><option value="vendor">Specific vendor</option></select></label>
              {form.scope !== 'global' && <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">{form.scope === 'vendor' ? 'Vendor' : form.scope === 'category' ? 'Merchant category' : 'Membership plan'}<select required value={form.targetId} onChange={(event) => setForm({ ...form, targetId: event.target.value })} className={inputClass}><option value="">Select…</option>{targetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Priority (higher wins)<input type="number" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Commission rate (%)<input required type="number" min="0" max="100" step="0.01" value={form.commission_percent} onChange={(event) => setForm({ ...form, commission_percent: event.target.value })} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Fixed transaction fee (PHP)<input required type="number" min="0" step="0.01" value={form.transaction_fee} onChange={(event) => setForm({ ...form, transaction_fee: event.target.value })} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Effective from<input type="datetime-local" value={form.effective_from} onChange={(event) => setForm({ ...form, effective_from: event.target.value })} className={inputClass} /></label>
              <label className="text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">Effective until<input type="datetime-local" value={form.effective_to} onChange={(event) => setForm({ ...form, effective_to: event.target.value })} className={inputClass} /></label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-gray-700 dark:text-[#a1a1aa]"><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} /> Active</label>
            </div>
            <div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" />{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create rule'}</button></div>
          </form>

          <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-[#262626] sm:flex-row sm:items-center sm:justify-between"><h2 className="font-semibold text-gray-900 dark:text-white">Configured rules</h2><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rules" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-[#262626] dark:bg-[#0a0a0a]" /></div>
            {loading ? <Loading /> : visibleRules.length === 0 ? <Empty message="No commission rules found. Create a rule above." /> : (
              <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3">Rule</th><th className="px-4 py-3">Scope / target</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Fixed fee</th><th className="px-4 py-3">Effective window</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{visibleRules.map((rule) => (
                  <tr key={rule.id}><td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{rule.name}</td><td className="px-4 py-3 capitalize text-gray-600 dark:text-[#a1a1aa]">{rule.scope}<div className="text-xs text-gray-400">{targetLabel(rule)}</div></td><td className="px-4 py-3">{rule.priority}</td><td className="px-4 py-3">{Number(rule.commission_percent).toFixed(2)}%</td><td className="px-4 py-3">{money(rule.transaction_fee)}</td><td className="px-4 py-3 text-xs text-gray-500">{rule.effective_from ? dateLabel(rule.effective_from) : 'Now'}<div>to {rule.effective_to ? dateLabel(rule.effective_to) : 'No end date'}</div></td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${rule.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-[#262626]'}`}>{rule.is_active ? 'Active' : 'Inactive'}</span></td><td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => beginEdit(rule)} className="font-medium text-[#239459] hover:underline">Edit</button><button onClick={() => void toggleActive(rule)} className="font-medium text-gray-600 hover:underline dark:text-[#a1a1aa]">{rule.is_active ? 'Deactivate' : 'Activate'}</button></div></td></tr>
                ))}</tbody>
              </table></div>
            )}
          </section>
        </>
      ) : tab === 'ledger' ? (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
          <div className="border-b border-gray-100 p-4 dark:border-[#262626]"><h2 className="font-semibold text-gray-900 dark:text-white">Commission ledger</h2><p className="mt-1 text-xs text-gray-500">Read-only accrual and refund entries. This ledger is reporting only; it does not execute vendor transfers.</p></div>
          {loading ? <Loading /> : entries.length === 0 ? <Empty message="No commission ledger entries yet." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Vendor</th><th className="px-4 py-3">Order / transaction</th><th className="px-4 py-3">Entry</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Commission</th><th className="px-4 py-3">Fixed fee</th><th className="px-4 py-3">Vendor net impact</th><th className="px-4 py-3">Refund ID</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{entries.map((entry) => (
                <tr key={entry.id}><td className="px-4 py-3 text-xs text-gray-500">{dateLabel(entry.effective_at)}</td><td className="px-4 py-3">{typeof entry.vendor === 'object' ? (entry.vendor as unknown as Record<string, unknown>).businessName ?? idOf(entry.vendor) : idOf(entry.vendor)}</td><td className="px-4 py-3">#{idOf(entry.order)}<div className="text-xs text-gray-400">tx #{idOf(entry.transaction)}</div></td><td className="px-4 py-3 capitalize">{entry.entry_type}</td><td className="px-4 py-3">{Number(entry.commission_percent).toFixed(2)}%</td><td className="px-4 py-3">{money(entry.commission_amount, entry.currency)}</td><td className="px-4 py-3">{money(entry.commission_transaction_fee, entry.currency)}</td><td className="px-4 py-3 font-semibold">{money(entry.commission_vendor_net, entry.currency)}</td><td className="px-4 py-3 text-xs">{entry.provider_refund_id || '—'}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      ) : (
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
          <div className="border-b border-gray-100 p-4 dark:border-[#262626]"><h2 className="font-semibold text-gray-900 dark:text-white">Commission rule audit history</h2><p className="mt-1 text-xs text-gray-500">Rule creation, edits, activation changes, and deletion are recorded with the acting administrator.</p></div>
          {loading ? <Loading /> : auditEntries.length === 0 ? <Empty message="No commission rule changes recorded yet." /> : (
            <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Administrator</th><th className="px-4 py-3">Change</th><th className="px-4 py-3">Rule</th><th className="px-4 py-3">Rate</th><th className="px-4 py-3">Reason</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{auditEntries.map((entry) => {
                const actor = entry.actor && typeof entry.actor === 'object' ? `${entry.actor.firstName ?? ''} ${entry.actor.lastName ?? ''}`.trim() || entry.actor.email || `#${entry.actor.id}` : idOf(entry.actor)
                const metadata = entry.metadata ?? {}
                return <tr key={entry.id}><td className="px-4 py-3 text-xs text-gray-500">{dateLabel(entry.createdAt)}</td><td className="px-4 py-3">{actor || 'System'}</td><td className="px-4 py-3 capitalize">{String(metadata.operation ?? 'update')}</td><td className="px-4 py-3">{String(metadata.name ?? `Rule #${String(metadata.ruleId ?? '')}`)}</td><td className="px-4 py-3">{metadata.commission_percent == null ? '—' : `${Number(metadata.commission_percent).toFixed(2)}%`}</td><td className="px-4 py-3 text-xs text-gray-500">{entry.reason || '—'}</td></tr>
              })}</tbody>
            </table></div>
          )}
        </section>
      )}
    </div>
  )
}

function targetOptionsForRule(rule: Rule, vendors: Option[], categories: Option[], plans: Option[]) {
  return rule.scope === 'vendor' ? vendors : rule.scope === 'category' ? categories : plans
}

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white'

function Loading() {
  return <div className="p-8 text-center text-sm text-gray-500"><RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading commission data…</div>
}

function Empty({ message }: { message: string }) {
  return <div className="p-10 text-center text-sm text-gray-500">{message}</div>
}
