'use client'

import React, { useEffect, useState } from 'react'
import { Building, AlertCircle, RefreshCw, Layers, Coins } from '@/components/ui/IconWrapper'

const MODES = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'hide', label: 'Hide' },
  { value: 'override', label: 'Override' },
]
const DEFAULT_BEHAVIORS = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'default', label: 'Default' },
  { value: 'not_default', label: 'Not Default' },
]
const AVAILABILITY_BEHAVIORS = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
]

type Doc = {
  id: number
  merchant_product_id: { id: number; display_title: string | null } | number | null
  base_modifier_option_id: { id: number; name: string } | number | null
  mode: string
  name_override: string | null
  price_adjustment_override: number | null
  default_behavior: string
  availability_behavior: string
  sort_order_override: number | null
  is_active: boolean
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function MerchantProductModifierOptionOverrideForm({ initial, onSuccess, onCancel }: { initial?: Doc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [merchantProductChoices, setMerchantProductChoices] = useState<{ id: number; display_title: string; productId: number | null }[]>([])
  const [baseOptionChoices, setBaseOptionChoices] = useState<{ id: number; name: string }[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  const initialMerchantProductId = initial?.merchant_product_id != null ? (typeof initial.merchant_product_id === 'number' ? String(initial.merchant_product_id) : String((initial.merchant_product_id as any).id)) : ''
  const initialOptionId = initial?.base_modifier_option_id != null ? (typeof initial.base_modifier_option_id === 'number' ? String(initial.base_modifier_option_id) : String((initial.base_modifier_option_id as any).id)) : ''

  const [form, setForm] = useState({
    merchant_product_id: initialMerchantProductId,
    base_modifier_option_id: initialOptionId,
    mode: initial?.mode || 'inherit',
    name_override: initial?.name_override || '',
    price_adjustment_override: initial?.price_adjustment_override ?? '',
    default_behavior: initial?.default_behavior || 'inherit',
    availability_behavior: initial?.availability_behavior || 'inherit',
    sort_order_override: initial?.sort_order_override ?? '',
    is_active: initial?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    fetch('/api/merchant-products?limit=100', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const docs: any[] = j.docs || j.data?.docs || []
        setMerchantProductChoices(
          docs.map((d: any) => ({
            id: d.id,
            display_title: d.display_title || d.displayTitle || `#${d.id}`,
            productId: d.product_id != null ? (typeof d.product_id === 'number' ? d.product_id : Number(d.product_id?.id ?? null)) : (d.product != null ? (typeof d.product === 'number' ? d.product : Number(d.product?.id ?? null)) : null),
          }))
        )
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const mpId = form.merchant_product_id.trim()
    if (!mpId) {
      setBaseOptionChoices([])
      return
    }
    const chosen = merchantProductChoices.find((v) => String(v.id) === mpId)
    let productId = chosen?.productId ?? null

    const fetchForProduct = async (pid: number) => {
      setLoadingOptions(true)
      try {
        const gRes = await fetch(`/api/catalog/modifier-groups?productId=${pid}&limit=100`, { cache: 'no-store' })
        const gJson = await gRes.json()
        const groups: any[] = gJson.docs || []
        const groupIds: number[] = groups.map((g: any) => Number(g.id)).filter((n) => Number.isFinite(n))
        if (groupIds.length === 0) {
          setBaseOptionChoices([])
          return
        }
        const oRes = await fetch(`/api/catalog/modifier-options?limit=500`, { cache: 'no-store' })
        const oJson = await oRes.json()
        const opts: any[] = oJson.docs || []
        const filtered = opts.filter((o: any) => {
          const gid = o.modifier_group_id != null ? (typeof o.modifier_group_id === 'number' ? o.modifier_group_id : Number(o.modifier_group_id?.id ?? NaN)) : NaN
          return Number.isFinite(gid) && groupIds.includes(gid)
        })
        setBaseOptionChoices(filtered.map((o: any) => ({ id: o.id, name: o.name || `#${o.id}` })))
      } catch {
        setBaseOptionChoices([])
      } finally {
        setLoadingOptions(false)
      }
    }

    if (productId != null && Number.isFinite(productId)) {
      void fetchForProduct(productId)
    } else {
      fetch(`/api/merchant-products/${mpId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          const doc = j.doc || j.data || j
          const prod = doc?.product_id ?? doc?.product
          const pid = prod != null ? (typeof prod === 'number' ? prod : Number(prod?.id ?? null)) : null
          if (pid != null && Number.isFinite(pid)) {
            setMerchantProductChoices((prev) => prev.map((v) => (String(v.id) === mpId ? { ...v, productId: pid } : v)))
            void fetchForProduct(pid)
          } else setBaseOptionChoices([])
        })
        .catch(() => setBaseOptionChoices([]))
    }
  }, [form.merchant_product_id, merchantProductChoices])

  useEffect(() => {
    if (!initial) return
    const mpId = initial?.merchant_product_id != null ? (typeof initial.merchant_product_id === 'number' ? String(initial.merchant_product_id) : String((initial.merchant_product_id as any).id)) : ''
    const oid = initial?.base_modifier_option_id != null ? (typeof initial.base_modifier_option_id === 'number' ? String(initial.base_modifier_option_id) : String((initial.base_modifier_option_id as any).id)) : ''
    setForm({
      merchant_product_id: mpId,
      base_modifier_option_id: oid,
      mode: initial?.mode || 'inherit',
      name_override: initial?.name_override || '',
      price_adjustment_override: initial?.price_adjustment_override ?? '',
      default_behavior: initial?.default_behavior || 'inherit',
      availability_behavior: initial?.availability_behavior || 'inherit',
      sort_order_override: initial?.sort_order_override ?? '',
      is_active: initial?.is_active ?? true,
    })
    setError(null)
  }, [initial])

  const submit = async () => {
    setError(null)
    if (!form.merchant_product_id.trim()) return setError('merchant_product_id is required (select merchant product)')
    if (Number.isNaN(Number(form.merchant_product_id.trim()))) return setError('merchant_product_id must be numeric')
    if (!form.base_modifier_option_id.trim()) return setError('base_modifier_option_id is required (select base modifier option)')
    if (Number.isNaN(Number(form.base_modifier_option_id.trim()))) return setError('base_modifier_option_id must be numeric')
    if (!MODES.some((o) => o.value === form.mode)) return setError('mode must be inherit, hide or override')
    if (!DEFAULT_BEHAVIORS.some((o) => o.value === form.default_behavior)) return setError('default_behavior must be inherit, default or not_default')
    if (!AVAILABILITY_BEHAVIORS.some((o) => o.value === form.availability_behavior)) return setError('availability_behavior must be inherit, available or unavailable')
    if (form.price_adjustment_override !== '' && form.price_adjustment_override !== null && form.price_adjustment_override !== undefined) {
      const n = Number(form.price_adjustment_override)
      if (!Number.isFinite(n)) return setError('price_adjustment_override must be numeric')
    }
    if (form.sort_order_override !== '' && form.sort_order_override !== null && form.sort_order_override !== undefined) {
      const n = Number(form.sort_order_override)
      if (!Number.isFinite(n)) return setError('sort_order_override must be numeric')
    }

    setSaving(true)
    try {
      const payload: any = {
        merchant_product_id: Number(form.merchant_product_id.trim()),
        base_modifier_option_id: Number(form.base_modifier_option_id.trim()),
        mode: form.mode,
        name_override: form.name_override.trim() || null,
        price_adjustment_override: form.price_adjustment_override === '' ? null : Number(form.price_adjustment_override),
        default_behavior: form.default_behavior,
        availability_behavior: form.availability_behavior,
        sort_order_override: form.sort_order_override === '' ? null : Math.trunc(Number(form.sort_order_override)),
        is_active: !!form.is_active,
      }
      const url = isEdit ? `/api/catalog/merchant-product-modifier-option-overrides/${(initial as any).id}` : '/api/catalog/merchant-product-modifier-option-overrides'
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
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Merchant Product & Base Option</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Merchant Product *</label>
              <select value={form.merchant_product_id} onChange={(e) => set('merchant_product_id', e.target.value)} className={inputCls}>
                <option value="">Select merchant product</option>
                {merchantProductChoices.map((v) => (
                  <option key={v.id} value={String(v.id)}>{v.display_title} (#{v.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Base Modifier Option * {loadingOptions && <span className="text-gray-400 font-normal">(loading...)</span>}</label>
              <select value={form.base_modifier_option_id} onChange={(e) => set('base_modifier_option_id', e.target.value)} className={inputCls} disabled={!form.merchant_product_id.trim()}>
                <option value="">{!form.merchant_product_id.trim() ? 'Select merchant product first' : baseOptionChoices.length ? 'Select base option' : 'No options for this product'}</option>
                {baseOptionChoices.map((o) => (
                  <option key={o.id} value={String(o.id)}>{o.name} (#{o.id})</option>
                ))}
              </select>
              {form.merchant_product_id && baseOptionChoices.length === 0 && !loadingOptions && <p className="text-xs text-gray-400 mt-1">Only options from product-level modifier groups of the selected merchant product catalog item are allowed.</p>}
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
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Coins className="w-4 h-4 text-[#eba236]" /> Override Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><label className={labelCls}>Name Override</label><input value={form.name_override} onChange={(e) => set('name_override', e.target.value)} placeholder="Override name" className={inputCls} /></div>
              <div><label className={labelCls}>Price Adjustment Override <span className="text-gray-400 font-normal">(step 0.01)</span></label><input type="number" step={0.01} value={form.price_adjustment_override as any} onChange={(e) => set('price_adjustment_override', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Sort Order Override</label><input type="number" value={form.sort_order_override as any} onChange={(e) => set('sort_order_override', e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Default Behavior</label><select value={form.default_behavior} onChange={(e) => set('default_behavior', e.target.value)} className={inputCls}>{DEFAULT_BEHAVIORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className={labelCls}>Availability Behavior</label><select value={form.availability_behavior} onChange={(e) => set('availability_behavior', e.target.value)} className={inputCls}>{AVAILABILITY_BEHAVIORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
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
