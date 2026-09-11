'use client'

import React, { useEffect, useState } from 'react'
import { Building, AlertCircle, RefreshCw, Layers, Package, ToggleLeft, Hash } from '@/components/ui/IconWrapper'

const MODES = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'hide', label: 'Hide' },
  { value: 'override', label: 'Override' },
]
const SELECTION_OPTS = [
  { value: 'single', label: 'Single' },
  { value: 'multiple', label: 'Multiple' },
]
const REQUIRED_BEHAVIORS = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'required', label: 'Required' },
  { value: 'optional', label: 'Optional' },
]

type Doc = {
  id: number
  variation_id: { id: number; name: string | null } | number | null
  base_modifier_group_id: { id: number; name: string } | number | null
  mode: string
  name_override: string | null
  selection_type_override: string | null
  required_behavior: string
  min_selections_override: number | null
  max_selections_override: number | null
  sort_order_override: number | null
  is_active: boolean
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function VariationModifierGroupOverrideForm({ initial, onSuccess, onCancel }: { initial?: Doc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [variationChoices, setVariationChoices] = useState<{ id: number; name: string; productId: number | null }[]>([])
  const [baseGroupChoices, setBaseGroupChoices] = useState<{ id: number; name: string }[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)

  const initialVariationId = initial?.variation_id != null ? (typeof initial.variation_id === 'number' ? String(initial.variation_id) : String((initial.variation_id as any).id)) : ''
  const initialGroupId = initial?.base_modifier_group_id != null ? (typeof initial.base_modifier_group_id === 'number' ? String(initial.base_modifier_group_id) : String((initial.base_modifier_group_id as any).id)) : ''

  const [form, setForm] = useState({
    variation_id: initialVariationId,
    base_modifier_group_id: initialGroupId,
    mode: initial?.mode || 'inherit',
    name_override: initial?.name_override || '',
    selection_type_override: initial?.selection_type_override || '',
    required_behavior: initial?.required_behavior || 'inherit',
    min_selections_override: initial?.min_selections_override ?? '',
    max_selections_override: initial?.max_selections_override ?? '',
    sort_order_override: initial?.sort_order_override ?? '',
    is_active: initial?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  // fetch variations
  useEffect(() => {
    fetch('/api/catalog/variations?limit=100', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const docs: any[] = j.docs || []
        setVariationChoices(
          docs.map((d: any) => ({
            id: d.id,
            name: d.name || d.sku || `#${d.id}`,
            productId: d.product_id != null ? (typeof d.product_id === 'number' ? d.product_id : Number(d.product_id?.id ?? null)) : null,
          }))
        )
      })
      .catch(() => {})
  }, [])

  // filterOptions logic client side via fetching product groups for variation
  useEffect(() => {
    const vid = form.variation_id.trim()
    if (!vid) {
      setBaseGroupChoices([])
      return
    }
    const chosen = variationChoices.find((v) => String(v.id) === vid)
    let productId = chosen?.productId ?? null
    // if productId not in choices (initial load race), fetch variation detail
    const fetchGroups = async (pid: number) => {
      setLoadingGroups(true)
      try {
        const res = await fetch(`/api/catalog/modifier-groups?productId=${pid}&limit=100`, { cache: 'no-store' })
        const j = await res.json()
        const docs: any[] = j.docs || []
        setBaseGroupChoices(docs.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}` })))
      } catch {
        setBaseGroupChoices([])
      } finally {
        setLoadingGroups(false)
      }
    }
    if (productId != null && Number.isFinite(productId)) {
      void fetchGroups(productId)
    } else {
      // fallback fetch variation detail to resolve product
      fetch(`/api/catalog/variations/${vid}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          const prod = j.doc?.product_id ?? j.doc?.product
          const pid = prod != null ? (typeof prod === 'number' ? prod : Number(prod?.id ?? null)) : null
          if (pid != null && Number.isFinite(pid)) {
            setVariationChoices((prev) => prev.map((v) => (String(v.id) === vid ? { ...v, productId: pid } : v)))
            void fetchGroups(pid)
          } else {
            setBaseGroupChoices([])
          }
        })
        .catch(() => setBaseGroupChoices([]))
    }
  }, [form.variation_id, variationChoices])

  useEffect(() => {
    if (!initial) return
    const vid = initial?.variation_id != null ? (typeof initial.variation_id === 'number' ? String(initial.variation_id) : String((initial.variation_id as any).id)) : ''
    const gid = initial?.base_modifier_group_id != null ? (typeof initial.base_modifier_group_id === 'number' ? String(initial.base_modifier_group_id) : String((initial.base_modifier_group_id as any).id)) : ''
    setForm({
      variation_id: vid,
      base_modifier_group_id: gid,
      mode: initial?.mode || 'inherit',
      name_override: initial?.name_override || '',
      selection_type_override: initial?.selection_type_override || '',
      required_behavior: initial?.required_behavior || 'inherit',
      min_selections_override: initial?.min_selections_override ?? '',
      max_selections_override: initial?.max_selections_override ?? '',
      sort_order_override: initial?.sort_order_override ?? '',
      is_active: initial?.is_active ?? true,
    })
    setError(null)
  }, [initial])

  const submit = async () => {
    setError(null)
    if (!form.variation_id.trim()) return setError('variation_id is required (select variation)')
    if (Number.isNaN(Number(form.variation_id.trim()))) return setError('variation_id must be numeric')
    if (!form.base_modifier_group_id.trim()) return setError('base_modifier_group_id is required (select base modifier group)')
    if (Number.isNaN(Number(form.base_modifier_group_id.trim()))) return setError('base_modifier_group_id must be numeric')
    if (!MODES.some((o) => o.value === form.mode)) return setError('mode must be inherit, hide or override')
    if (form.selection_type_override && !SELECTION_OPTS.some((o) => o.value === form.selection_type_override)) return setError('selection_type_override must be single or multiple')
    if (!REQUIRED_BEHAVIORS.some((o) => o.value === form.required_behavior)) return setError('required_behavior must be inherit, required or optional')
    if (form.min_selections_override !== '' && form.min_selections_override !== null && form.min_selections_override !== undefined) {
      const n = Number(form.min_selections_override)
      if (!Number.isFinite(n)) return setError('min_selections_override must be numeric')
    }
    if (form.max_selections_override !== '' && form.max_selections_override !== null && form.max_selections_override !== undefined) {
      const n = Number(form.max_selections_override)
      if (!Number.isFinite(n)) return setError('max_selections_override must be numeric')
    }
    if (form.sort_order_override !== '' && form.sort_order_override !== null && form.sort_order_override !== undefined) {
      const n = Number(form.sort_order_override)
      if (!Number.isFinite(n)) return setError('sort_order_override must be numeric')
    }

    setSaving(true)
    try {
      const payload: any = {
        variation_id: Number(form.variation_id.trim()),
        base_modifier_group_id: Number(form.base_modifier_group_id.trim()),
        mode: form.mode,
        name_override: form.name_override.trim() || null,
        selection_type_override: form.selection_type_override || null,
        required_behavior: form.required_behavior,
        min_selections_override: form.min_selections_override === '' ? null : Math.trunc(Number(form.min_selections_override)),
        max_selections_override: form.max_selections_override === '' ? null : Math.trunc(Number(form.max_selections_override)),
        sort_order_override: form.sort_order_override === '' ? null : Math.trunc(Number(form.sort_order_override)),
        is_active: !!form.is_active,
      }
      // when mode != override, optional override fields are still sent as above (null allowed)
      const url = isEdit ? `/api/catalog/variation-modifier-group-overrides/${(initial as any).id}` : '/api/catalog/variation-modifier-group-overrides'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed')
      onSuccess()
    } catch (e: any) {
      setError(e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Variation & Base Group</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Variation *</label>
              <select value={form.variation_id} onChange={(e) => set('variation_id', e.target.value)} className={inputCls}>
                <option value="">Select variation</option>
                {variationChoices.map((v) => (
                  <option key={v.id} value={String(v.id)}>{v.name} (#{v.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Base Modifier Group * {loadingGroups && <span className="text-gray-400 font-normal">(loading...)</span>}</label>
              <select value={form.base_modifier_group_id} onChange={(e) => set('base_modifier_group_id', e.target.value)} className={inputCls} disabled={!form.variation_id.trim()}>
                <option value="">{!form.variation_id.trim() ? 'Select variation first' : baseGroupChoices.length ? 'Select base group' : 'No groups for this product'}</option>
                {baseGroupChoices.map((g) => (
                  <option key={g.id} value={String(g.id)}>{g.name} (#{g.id})</option>
                ))}
              </select>
              {form.variation_id && baseGroupChoices.length === 0 && !loadingGroups && <p className="text-xs text-gray-400 mt-1">Only product-level modifier groups from the selected variation parent product are allowed.</p>}
            </div>
            <div>
              <label className={labelCls}>Mode *</label>
              <select value={form.mode} onChange={(e) => set('mode', e.target.value)} className={inputCls}>
                {MODES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Is Active</span></label>
            </div>
          </div>
        </div>

        {form.mode === 'override' && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-[#eba236]" /> Override Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className={labelCls}>Name Override</label><input value={form.name_override} onChange={(e) => set('name_override', e.target.value)} placeholder="Override name" className={inputCls} /></div>
              <div><label className={labelCls}>Selection Type Override</label><select value={form.selection_type_override} onChange={(e) => set('selection_type_override', e.target.value)} className={inputCls}><option value="">Inherit (no override)</option>{SELECTION_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className={labelCls}>Required Behavior</label><select value={form.required_behavior} onChange={(e) => set('required_behavior', e.target.value)} className={inputCls}>{REQUIRED_BEHAVIORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className={labelCls}>Min Selections Override</label><input type="number" value={form.min_selections_override as any} onChange={(e) => set('min_selections_override', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Max Selections Override</label><input type="number" value={form.max_selections_override as any} onChange={(e) => set('max_selections_override', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Sort Order Override</label><input type="number" value={form.sort_order_override as any} onChange={(e) => set('sort_order_override', e.target.value)} className={inputCls} /></div>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create override'}
        </button>
      </div>
    </div>
  )
}
