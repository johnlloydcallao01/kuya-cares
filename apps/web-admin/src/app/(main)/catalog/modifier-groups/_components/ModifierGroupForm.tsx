'use client'

import React, { useState, useEffect } from 'react'
import {
  Building, AlertCircle, RefreshCw, Layers, Package, ToggleLeft, Hash, Settings
} from '@/components/ui/IconWrapper'

const SELECTION_OPTS = [
  { value: 'single', label: 'Single' },
  { value: 'multiple', label: 'Multiple' },
]

type ModifierGroupDoc = {
  id: number
  product_id: { id: number; name: string } | number | null
  name: string
  selection_type: string
  is_required: boolean
  min_selections: number
  max_selections: number | null
  sort_order: number
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function ModifierGroupForm({ initial, onSuccess, onCancel }: { initial?: ModifierGroupDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initialProductId = initial?.product_id != null ? (typeof initial.product_id === 'number' ? String(initial.product_id) : String((initial.product_id as any).id)) : ''

  const [form, setForm] = useState({
    product_id: initialProductId,
    name: initial?.name || '',
    selection_type: initial?.selection_type || 'single',
    is_required: initial?.is_required ?? false,
    min_selections: initial?.min_selections ?? 0,
    max_selections: initial?.max_selections ?? '',
    sort_order: initial?.sort_order ?? 0,
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!initial) return
    const pid = initial?.product_id != null ? (typeof initial.product_id === 'number' ? String(initial.product_id) : String((initial.product_id as any).id)) : ''
    setForm({
      product_id: pid,
      name: initial?.name || '',
      selection_type: initial?.selection_type || 'single',
      is_required: initial?.is_required ?? false,
      min_selections: initial?.min_selections ?? 0,
      max_selections: initial?.max_selections ?? '',
      sort_order: initial?.sort_order ?? 0,
    })
    setError(null)
  }, [initial])

  const submit = async () => {
    setError(null)
    if (!form.product_id.trim()) return setError('product_id is required (numeric product id)')
    if (Number.isNaN(Number(form.product_id.trim()))) return setError('product_id must be numeric')
    if (!form.name.trim() || form.name.trim().length < 2) return setError('Name is required (min 2 chars)')
    if (form.name.trim().length > 255) return setError('Name must be at most 255 characters')
    if (!SELECTION_OPTS.some((o) => o.value === form.selection_type)) return setError('Selection type must be single or multiple')
    const minVal = Number(form.min_selections)
    if (!Number.isFinite(minVal) || minVal < 0) return setError('Minimum selections cannot be negative')
    const maxRaw = form.max_selections
    let maxVal: number | null = null
    if (maxRaw !== '' && maxRaw !== null && maxRaw !== undefined) {
      const n = Number(maxRaw)
      if (!Number.isFinite(n) || n < 1) return setError('Maximum selections must be at least 1 when provided')
      maxVal = Math.trunc(n)
      if (maxVal < minVal) return setError('Maximum selections cannot be lower than minimum selections')
    }
    if (form.selection_type === 'single' && maxVal !== null && maxVal > 1) return setError('Single-selection groups cannot allow more than 1 selection')

    setSaving(true)
    try {
      const payload: any = {
        product_id: Number(form.product_id.trim()),
        name: form.name.trim(),
        selection_type: form.selection_type,
        is_required: !!form.is_required,
        min_selections: form.is_required ? Math.trunc(minVal) : 0,
        max_selections: maxVal,
        sort_order: Math.trunc(Number(form.sort_order) || 0),
      }
      const url = isEdit ? `/api/catalog/modifier-groups/${(initial as any).id}` : '/api/catalog/modifier-groups'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed')
      onSuccess()
    } catch (e:any) { setError(e?.message || 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Group Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Product ID *</label><input value={form.product_id} onChange={(e)=>set('product_id', e.target.value)} placeholder="e.g. 12" className={inputCls} /></div>
            <div><label className={labelCls}>Sort Order</label><input type="number" value={form.sort_order} onChange={(e)=>set('sort_order', e.target.value)} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Group Name *</label><input value={form.name} onChange={(e)=>set('name', e.target.value)} placeholder="Size, Extras, Toppings" className={inputCls} /></div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600" /> Selection Rules</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Selection Type *</label><select value={form.selection_type} onChange={(e)=>set('selection_type', e.target.value)} className={inputCls}>{SELECTION_OPTS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="flex items-center gap-3 pt-6"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_required} onChange={(e)=>set('is_required', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Is Required</span></label></div>
            <div><label className={labelCls}>Min Selections <span className="text-gray-400 font-normal">{form.is_required ? '' : '(auto 0 when not required)'}</span></label><input type="number" min={0} value={form.min_selections} onChange={(e)=>set('min_selections', e.target.value)} disabled={!form.is_required} className={`${inputCls} ${!form.is_required ? 'opacity-50 cursor-not-allowed' : ''}`} /></div>
            <div><label className={labelCls}>Max Selections <span className="text-gray-400 font-normal">(blank = unlimited)</span></label><input type="number" min={1} value={form.max_selections as any} onChange={(e)=>set('max_selections', e.target.value)} placeholder="leave empty for unlimited" className={inputCls} /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Single type max ≤1. Max must be ≥ min. Min normalized to 0 when not required.</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create group'}
        </button>
      </div>
    </div>
  )
}
