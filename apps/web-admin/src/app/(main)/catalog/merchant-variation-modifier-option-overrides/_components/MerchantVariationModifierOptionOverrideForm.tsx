'use client'

import React, { useEffect, useState } from 'react'
import { Building, AlertCircle, RefreshCw, Layers, Package } from '@/components/ui/IconWrapper'

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
const TARGET_SOURCES = [
  { value: 'product_base', label: 'Product Base' },
  { value: 'variation_added', label: 'Variation Added' },
]

type Doc = {
  id: number
  merchant_product_id: { id: number; display_title: string | null } | number | null
  variation_id: { id: number; name: string | null; sku: string } | number | null
  target_option_source: string
  base_modifier_option_id: { id: number; name: string } | number | null
  variation_modifier_option_id: { id: number; name: string } | number | null
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

export function MerchantVariationModifierOptionOverrideForm({ initial, onSuccess, onCancel }: { initial?: Doc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [merchantProductChoices, setMerchantProductChoices] = useState<{ id: number; display_title: string; productId: number | null }[]>([])
  const [variationChoices, setVariationChoices] = useState<{ id: number; name: string; productId: number | null }[]>([])
  const [baseOptionChoices, setBaseOptionChoices] = useState<{ id: number; name: string }[]>([])
  const [variationOptionChoices, setVariationOptionChoices] = useState<{ id: number; name: string }[]>([])
  const [loadingVariations, setLoadingVariations] = useState(false)
  const [loadingOptions, setLoadingOptions] = useState(false)

  const initialMerchantProductId = initial?.merchant_product_id != null ? (typeof initial.merchant_product_id === 'number' ? String(initial.merchant_product_id) : String((initial.merchant_product_id as any).id)) : ''
  const initialVariationId = initial?.variation_id != null ? (typeof initial.variation_id === 'number' ? String(initial.variation_id) : String((initial.variation_id as any).id)) : ''
  const initialBaseOptionId = initial?.base_modifier_option_id != null ? (typeof initial.base_modifier_option_id === 'number' ? String(initial.base_modifier_option_id) : String((initial.base_modifier_option_id as any).id)) : ''
  const initialVarOptionId = initial?.variation_modifier_option_id != null ? (typeof initial.variation_modifier_option_id === 'number' ? String(initial.variation_modifier_option_id) : String((initial.variation_modifier_option_id as any).id)) : ''

  const [form, setForm] = useState({
    merchant_product_id: initialMerchantProductId,
    variation_id: initialVariationId,
    target_option_source: initial?.target_option_source || 'product_base',
    base_modifier_option_id: initialBaseOptionId,
    variation_modifier_option_id: initialVarOptionId,
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
      setVariationChoices([])
      return
    }
    const chosen = merchantProductChoices.find((v) => String(v.id) === mpId)
    let productId = chosen?.productId ?? null
    const doFetch = async (pid: number) => {
      setLoadingVariations(true)
      try {
        const res = await fetch('/api/catalog/variations?limit=100', { cache: 'no-store' })
        const j = await res.json()
        const arr: any[] = j.docs || []
        const filtered = arr.filter((d: any) => {
          const prod = d.product_id ?? d.product
          const nid = prod != null ? (typeof prod === 'number' ? prod : Number(prod?.id ?? null)) : null
          return nid === pid
        })
        if (filtered.length) setVariationChoices(filtered.map((d: any) => ({ id: d.id, name: d.name || d.sku || `#${d.id}`, productId: pid })))
        else {
          // try productId query
          const rr = await fetch(`/api/catalog/variations?productId=${pid}&limit=100`, { cache: 'no-store' })
          const jj = await rr.json()
          const a: any[] = jj.docs || []
          setVariationChoices(a.map((d: any) => ({ id: d.id, name: d.name || d.sku || `#${d.id}`, productId: pid })))
        }
      } catch { setVariationChoices([]) } finally { setLoadingVariations(false) }
    }
    if (productId != null && Number.isFinite(productId)) void doFetch(productId)
    else {
      fetch(`/api/merchant-products/${mpId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          const doc = j.doc || j.data || j
          const prod = doc?.product_id ?? doc?.product
          const pid = prod != null ? (typeof prod === 'number' ? prod : Number(prod?.id ?? null)) : null
          if (pid != null && Number.isFinite(pid)) {
            setMerchantProductChoices((prev) => prev.map((v) => (String(v.id) === mpId ? { ...v, productId: pid } : v)))
            void doFetch(pid)
          } else setVariationChoices([])
        })
        .catch(() => setVariationChoices([]))
    }
  }, [form.merchant_product_id, merchantProductChoices])

  // base option filtered by product's modifier groups
  useEffect(() => {
    if (form.target_option_source !== 'product_base') {
      setBaseOptionChoices([])
      return
    }
    const mpId = form.merchant_product_id.trim()
    if (!mpId) {
      setBaseOptionChoices([])
      return
    }
    const chosen = merchantProductChoices.find((v) => String(v.id) === mpId)
    let productId = chosen?.productId ?? null
    const fetchOptions = async (pid: number) => {
      setLoadingOptions(true)
      try {
        // first get groupIds for product, then fetch options
        const gRes = await fetch(`/api/catalog/modifier-groups?productId=${pid}&limit=100`, { cache: 'no-store' })
        const gJson = await gRes.json()
        const groups: any[] = gJson.docs || []
        const groupIds = groups.map((g) => g.id)
        if (!groupIds.length) { setBaseOptionChoices([]); return }
        // fetch all options and filter by modifier_group_id client side (since BFF may not support in)
        const oRes = await fetch(`/api/catalog/modifier-options?limit=100`, { cache: 'no-store' })
        const oJson = await oRes.json()
        const opts: any[] = oJson.docs || []
        const filtered = opts.filter((o) => {
          const gid = o.modifier_group_id != null ? (typeof o.modifier_group_id === 'number' ? o.modifier_group_id : Number(o.modifier_group_id?.id ?? null)) : null
          return gid != null && groupIds.includes(gid)
        })
        // if filtered empty, try fetching per group
        if (filtered.length) setBaseOptionChoices(filtered.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}` })))
        else {
          // fallback: fetch options via productId if API supports? else keep empty
          setBaseOptionChoices([])
        }
      } catch { setBaseOptionChoices([]) } finally { setLoadingOptions(false) }
    }
    if (productId != null && Number.isFinite(productId)) void fetchOptions(productId)
    else {
      fetch(`/api/merchant-products/${mpId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((j) => {
          const doc = j.doc || j.data || j
          const prod = doc?.product_id ?? doc?.product
          const pid = prod != null ? (typeof prod === 'number' ? prod : Number(prod?.id ?? null)) : null
          if (pid != null && Number.isFinite(pid)) {
            setMerchantProductChoices((prev) => prev.map((v) => (String(v.id) === mpId ? { ...v, productId: pid } : v)))
            void fetchOptions(pid)
          } else setBaseOptionChoices([])
        })
        .catch(() => setBaseOptionChoices([]))
    }
  }, [form.merchant_product_id, form.target_option_source, merchantProductChoices])

  // variation option filtered by variation_id via variation-modifier-groups -> variation-modifier-options
  useEffect(() => {
    if (form.target_option_source !== 'variation_added') {
      setVariationOptionChoices([])
      return
    }
    const vid = form.variation_id.trim()
    if (!vid) {
      setVariationOptionChoices([])
      return
    }
    setLoadingOptions(true)
    // fetch variation modifier groups for variation, then fetch options for those groups
    fetch(`/api/catalog/variation-modifier-groups?variationId=${vid}&limit=100`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(async (j) => {
        const groups: any[] = j.docs || []
        const activeGroups = groups.filter((g: any) => g.is_active !== false)
        const groupIds = activeGroups.map((g) => g.id)
        if (!groupIds.length) { setVariationOptionChoices([]); return }
        const oRes = await fetch(`/api/catalog/variation-modifier-options?limit=100`, { cache: 'no-store' })
        const oJson = await oRes.json()
        const opts: any[] = oJson.docs || []
        const filtered = opts.filter((o: any) => {
          const gid = o.variation_modifier_group_id != null ? (typeof o.variation_modifier_group_id === 'number' ? o.variation_modifier_group_id : Number(o.variation_modifier_group_id?.id ?? null)) : null
          return gid != null && groupIds.includes(gid)
        })
        if (filtered.length) setVariationOptionChoices(filtered.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}` })))
        else {
          // fallback try per group fetch
          const all: any[] = []
          for (const gid of groupIds.slice(0, 5)) {
            try {
              const rr = await fetch(`/api/catalog/variation-modifier-options?variationModifierGroupId=${gid}&limit=100`, { cache: 'no-store' })
              const jj = await rr.json()
              const arr: any[] = jj.docs || []
              all.push(...arr)
            } catch {}
          }
          setVariationOptionChoices(all.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}` })))
        }
      })
      .catch(() => setVariationOptionChoices([]))
      .finally(() => setLoadingOptions(false))
  }, [form.variation_id, form.target_option_source])

  useEffect(() => {
    if (!initial) return
    const mpId = initial?.merchant_product_id != null ? (typeof initial.merchant_product_id === 'number' ? String(initial.merchant_product_id) : String((initial.merchant_product_id as any).id)) : ''
    const vid = initial?.variation_id != null ? (typeof initial.variation_id === 'number' ? String(initial.variation_id) : String((initial.variation_id as any).id)) : ''
    const bid = initial?.base_modifier_option_id != null ? (typeof initial.base_modifier_option_id === 'number' ? String(initial.base_modifier_option_id) : String((initial.base_modifier_option_id as any).id)) : ''
    const vg = initial?.variation_modifier_option_id != null ? (typeof initial.variation_modifier_option_id === 'number' ? String(initial.variation_modifier_option_id) : String((initial.variation_modifier_option_id as any).id)) : ''
    setForm({
      merchant_product_id: mpId,
      variation_id: vid,
      target_option_source: initial?.target_option_source || 'product_base',
      base_modifier_option_id: bid,
      variation_modifier_option_id: vg,
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

  const handleTargetToggle = (v: string) => {
    setForm((prev) => ({
      ...prev,
      target_option_source: v,
      base_modifier_option_id: v === 'product_base' ? prev.base_modifier_option_id : '',
      variation_modifier_option_id: v === 'variation_added' ? prev.variation_modifier_option_id : '',
    }))
  }

  const submit = async () => {
    setError(null)
    if (!form.merchant_product_id.trim()) return setError('merchant_product_id is required (select merchant product)')
    if (Number.isNaN(Number(form.merchant_product_id.trim()))) return setError('merchant_product_id must be numeric')
    if (!form.variation_id.trim()) return setError('variation_id is required (select variation)')
    if (Number.isNaN(Number(form.variation_id.trim()))) return setError('variation_id must be numeric')
    if (!TARGET_SOURCES.some((o) => o.value === form.target_option_source)) return setError('target_option_source must be product_base or variation_added')
    if (form.target_option_source === 'product_base') {
      if (!form.base_modifier_option_id.trim()) return setError('base_modifier_option_id is required when Product Base is selected')
      if (Number.isNaN(Number(form.base_modifier_option_id.trim()))) return setError('base_modifier_option_id must be numeric')
    } else {
      if (!form.variation_modifier_option_id.trim()) return setError('variation_modifier_option_id is required when Variation Added is selected')
      if (Number.isNaN(Number(form.variation_modifier_option_id.trim()))) return setError('variation_modifier_option_id must be numeric')
    }
    if (!MODES.some((o) => o.value === form.mode)) return setError('mode must be inherit, hide or override')
    if (!DEFAULT_BEHAVIORS.some((o) => o.value === form.default_behavior)) return setError('default_behavior must be inherit, default or not_default')
    if (!AVAILABILITY_BEHAVIORS.some((o) => o.value === form.availability_behavior)) return setError('availability_behavior must be inherit, available or unavailable')
    if (form.price_adjustment_override !== '' && !Number.isFinite(Number(form.price_adjustment_override))) return setError('price_adjustment_override must be numeric')
    if (form.sort_order_override !== '' && !Number.isFinite(Number(form.sort_order_override))) return setError('sort_order_override must be numeric')

    setSaving(true)
    try {
      const payload: any = {
        merchant_product_id: Number(form.merchant_product_id.trim()),
        variation_id: Number(form.variation_id.trim()),
        target_option_source: form.target_option_source,
        mode: form.mode,
        name_override: form.name_override.trim() || null,
        price_adjustment_override: form.price_adjustment_override === '' ? null : Number(form.price_adjustment_override),
        default_behavior: form.default_behavior,
        availability_behavior: form.availability_behavior,
        sort_order_override: form.sort_order_override === '' ? null : Math.trunc(Number(form.sort_order_override)),
        is_active: !!form.is_active,
      }
      if (form.target_option_source === 'product_base') {
        payload.base_modifier_option_id = Number(form.base_modifier_option_id.trim())
        payload.variation_modifier_option_id = null
      } else {
        payload.variation_modifier_option_id = Number(form.variation_modifier_option_id.trim())
        payload.base_modifier_option_id = null
      }
      const url = isEdit ? `/api/catalog/merchant-variation-modifier-option-overrides/${(initial as any).id}` : '/api/catalog/merchant-variation-modifier-option-overrides'
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
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Merchant Product & Variation</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Merchant Product *</label>
              <select value={form.merchant_product_id} onChange={(e) => { set('merchant_product_id', e.target.value); set('variation_id', ''); set('base_modifier_option_id', ''); set('variation_modifier_option_id', '') }} className={inputCls}>
                <option value="">Select merchant product</option>
                {merchantProductChoices.map((v) => (
                  <option key={v.id} value={String(v.id)}>{v.display_title} (#{v.id})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Variation * {loadingVariations && <span className="text-gray-400 font-normal">(loading...)</span>}</label>
              <select value={form.variation_id} onChange={(e) => { set('variation_id', e.target.value); set('base_modifier_option_id', ''); set('variation_modifier_option_id', '') }} className={inputCls} disabled={!form.merchant_product_id.trim()}>
                <option value="">{!form.merchant_product_id.trim() ? 'Select merchant product first' : variationChoices.length ? 'Select variation' : 'No variations for this product'}</option>
                {variationChoices.map((v) => (
                  <option key={v.id} value={String(v.id)}>{v.name} (#{v.id})</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-[#eba236]" /> Target Option Source</h4>
          <div className="flex gap-2">
            {TARGET_SOURCES.map((opt) => (
              <label key={opt.value} className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer ${form.target_option_source === opt.value ? 'border-[#eba236] bg-[#eba236]/10' : 'border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a]'}`}>
                <input type="radio" name="target_option_source" value={opt.value} checked={form.target_option_source === opt.value} onChange={() => handleTargetToggle(opt.value)} className="h-4 w-4 text-[#eba236]" />
                <span className="text-sm font-medium">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-[#eba236]" /> {form.target_option_source === 'product_base' ? 'Base Product Modifier Option' : 'Variation Modifier Option'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {form.target_option_source === 'product_base' ? (
              <div className="sm:col-span-2">
                <label className={labelCls}>Base Modifier Option * {loadingOptions && <span className="text-gray-400 font-normal">(loading...)</span>}</label>
                <select value={form.base_modifier_option_id} onChange={(e) => set('base_modifier_option_id', e.target.value)} className={inputCls} disabled={!form.merchant_product_id.trim()}>
                  <option value="">{!form.merchant_product_id.trim() ? 'Select merchant product first' : baseOptionChoices.length ? 'Select base option' : 'No base options for this product'}</option>
                  {baseOptionChoices.map((g) => (
                    <option key={g.id} value={String(g.id)}>{g.name} (#{g.id})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Only product-level options from the selected merchant product catalog item (via modifier-groups).</p>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className={labelCls}>Variation Modifier Option * {loadingOptions && <span className="text-gray-400 font-normal">(loading...)</span>}</label>
                <select value={form.variation_modifier_option_id} onChange={(e) => set('variation_modifier_option_id', e.target.value)} className={inputCls} disabled={!form.variation_id.trim()}>
                  <option value="">{!form.variation_id.trim() ? 'Select variation first' : variationOptionChoices.length ? 'Select variation option' : 'No active variation options for this variation'}</option>
                  {variationOptionChoices.map((g) => (
                    <option key={g.id} value={String(g.id)}>{g.name} (#{g.id})</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">Only variation-owned options for groups with is_active != false for the selected variation.</p>
              </div>
            )}
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

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Override Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Name Override</label><input value={form.name_override} onChange={(e) => set('name_override', e.target.value)} placeholder="Override name" className={inputCls} /></div>
            <div><label className={labelCls}>Price Adjustment Override (step 0.01)</label><input type="number" step="0.01" value={form.price_adjustment_override as any} onChange={(e) => set('price_adjustment_override', e.target.value)} className={inputCls} placeholder="0.00" /></div>
            <div><label className={labelCls}>Default Behavior</label><select value={form.default_behavior} onChange={(e) => set('default_behavior', e.target.value)} className={inputCls}>{DEFAULT_BEHAVIORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Availability Behavior</label><select value={form.availability_behavior} onChange={(e) => set('availability_behavior', e.target.value)} className={inputCls}>{AVAILABILITY_BEHAVIORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Sort Order Override</label><input type="number" value={form.sort_order_override as any} onChange={(e) => set('sort_order_override', e.target.value)} className={inputCls} /></div>
          </div>
        </div>
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
