'use client'

import React, { useState, useEffect } from 'react'
import {
  Building, AlertCircle, RefreshCw, Layers, Coins, ToggleLeft, Hash
} from '@/components/ui/IconWrapper'

type VariationModifierOptionDoc = {
  id: number
  variation_modifier_group_id: { id: number; name: string } | number | null
  name: string
  price_adjustment: number
  is_default: boolean
  is_available: boolean
  sort_order: number
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function VariationModifierOptionForm({ initial, onSuccess, onCancel }: { initial?: VariationModifierOptionDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [groupChoices, setGroupChoices] = useState<{ id: number; name: string }[]>([])

  const initialGroupId = initial?.variation_modifier_group_id != null ? (typeof initial.variation_modifier_group_id === 'number' ? String(initial.variation_modifier_group_id) : String((initial.variation_modifier_group_id as any).id)) : ''

  const [form, setForm] = useState({
    variation_modifier_group_id: initialGroupId,
    name: initial?.name || '',
    price_adjustment: initial?.price_adjustment ?? 0,
    is_default: initial?.is_default ?? false,
    is_available: initial?.is_available ?? true,
    sort_order: initial?.sort_order ?? 0,
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    fetch('/api/catalog/variation-modifier-groups?limit=100', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const docsArr: any[] = j.docs || []
        setGroupChoices(docsArr.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}` })))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!initial) return
    const gid = initial?.variation_modifier_group_id != null ? (typeof initial.variation_modifier_group_id === 'number' ? String(initial.variation_modifier_group_id) : String((initial.variation_modifier_group_id as any).id)) : ''
    setForm({
      variation_modifier_group_id: gid,
      name: initial?.name || '',
      price_adjustment: initial?.price_adjustment ?? 0,
      is_default: initial?.is_default ?? false,
      is_available: initial?.is_available ?? true,
      sort_order: initial?.sort_order ?? 0,
    })
    setError(null)
  }, [initial])

  const submit = async () => {
    setError(null)
    if (!form.variation_modifier_group_id.trim()) return setError('variation_modifier_group_id is required (numeric group id)')
    if (Number.isNaN(Number(form.variation_modifier_group_id.trim()))) return setError('variation_modifier_group_id must be numeric')
    if (!form.name.trim() || form.name.trim().length < 2) return setError('Name is required (min 2 chars)')
    if (form.name.trim().length > 255) return setError('Name must be at most 255 characters')
    if (!Number.isFinite(Number(form.price_adjustment))) return setError('Price adjustment must be finite numeric')

    setSaving(true)
    try {
      const payload: any = {
        variation_modifier_group_id: Number(form.variation_modifier_group_id.trim()),
        name: form.name.trim(),
        price_adjustment: Number(form.price_adjustment),
        is_default: !!form.is_default,
        is_available: !!form.is_available,
        sort_order: Math.trunc(Number(form.sort_order) || 0),
      }
      const url = isEdit ? `/api/catalog/variation-modifier-options/${(initial as any).id}` : '/api/catalog/variation-modifier-options'
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
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Option Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Variation Modifier Group *</label>
              <select value={form.variation_modifier_group_id} onChange={(e)=>set('variation_modifier_group_id', e.target.value)} className={inputCls}>
                <option value="">Select group</option>
                {groupChoices.map((g) => (
                  <option key={g.id} value={String(g.id)}>{g.name} (#{g.id})</option>
                ))}
              </select>
            </div>
            <div><label className={labelCls}>Sort Order</label><input type="number" value={form.sort_order} onChange={(e)=>set('sort_order', e.target.value)} className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Option Name *</label><input value={form.name} onChange={(e)=>set('name', e.target.value)} placeholder="Extra Cheese, Large Size" className={inputCls} /></div>
            <div><label className={labelCls}>Price Adjustment <span className="text-gray-400 font-normal">(₱, step 0.01)</span></label><input type="number" step={0.01} value={form.price_adjustment} onChange={(e)=>set('price_adjustment', e.target.value)} className={inputCls} /></div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_default} onChange={(e)=>set('is_default', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Is Default</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_available} onChange={(e)=>set('is_available', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Is Available</span></label>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create option'}
        </button>
      </div>
    </div>
  )
}
