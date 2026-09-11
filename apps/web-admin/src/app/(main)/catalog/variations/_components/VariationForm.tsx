'use client'

import React, { useEffect, useState } from 'react'
import { Building, AlertCircle, RefreshCw, Package, DollarSign, Image as ImageIcon, Settings } from '@/components/ui/IconWrapper'
import { MediaUploader } from '@/components/cms/MediaUploader'

export const MODE_OPTS: { value: string; label: string; desc: string }[] = [
  { value: 'inherit_product', label: 'Inherit Product', desc: 'Use only product-level modifiers' },
  { value: 'variation_specific', label: 'Variation Specific', desc: 'Use only variation-owned groups' },
  { value: 'hybrid', label: 'Hybrid', desc: 'Combine product groups with overrides + variation groups' },
]

export type VariationDoc = {
  id: number
  product_id: { id: number; name: string; slug: string; productType: string } | number | null
  modifier_behavior_mode: string
  name: string | null
  short_description: string | null
  image: { id: number; url: string | null; filename: string | null } | null
  sku: string
  base_price: number | null
  compare_at_price: number | null
  stock_quantity: number
  is_used_for_variations: boolean
  is_visible: boolean
  sort_order: number
  modifier_configuration_hint?: string | null
  effective_modifier_preview?: unknown
  createdAt: string
  updatedAt: string
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

function getProductId(doc: VariationDoc | null | undefined): string {
  if (!doc?.product_id) return ''
  if (typeof doc.product_id === 'number') return String(doc.product_id)
  if (typeof doc.product_id === 'object' && 'id' in doc.product_id) return String((doc.product_id as any).id)
  return ''
}

export function VariationForm({ initial, onSuccess, onCancel }: { initial?: VariationDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [products, setProducts] = useState<{ id: number; name: string; slug: string }[]>([])
  const [productsLoading, setProductsLoading] = useState(true)

  const [imageId, setImageId] = useState<string | number | undefined>(
    initial?.image?.id ? String(initial.image.id) : undefined,
  )

  const [form, setForm] = useState({
    product_id: getProductId(initial),
    modifier_behavior_mode: initial?.modifier_behavior_mode || 'inherit_product',
    name: initial?.name || '',
    short_description: initial?.short_description || '',
    base_price: initial?.base_price != null ? String(initial.base_price) : '',
    compare_at_price: initial?.compare_at_price != null ? String(initial.compare_at_price) : '',
    stock_quantity: initial?.stock_quantity != null ? String(initial.stock_quantity) : '0',
    sort_order: initial?.sort_order != null ? String(initial.sort_order) : '0',
    is_used_for_variations: initial?.is_used_for_variations ?? true,
    is_visible: initial?.is_visible ?? true,
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      product_id: getProductId(initial),
      modifier_behavior_mode: initial?.modifier_behavior_mode || 'inherit_product',
      name: initial?.name || '',
      short_description: initial?.short_description || '',
      base_price: initial?.base_price != null ? String(initial.base_price) : '',
      compare_at_price: initial?.compare_at_price != null ? String(initial.compare_at_price) : '',
      stock_quantity: initial?.stock_quantity != null ? String(initial.stock_quantity) : '0',
      sort_order: initial?.sort_order != null ? String(initial.sort_order) : '0',
      is_used_for_variations: initial?.is_used_for_variations ?? true,
      is_visible: initial?.is_visible ?? true,
    })
    setImageId(initial?.image?.id ? String(initial.image.id) : undefined)
    setError(null)
  }, [initial])

  useEffect(() => {
    let cancelled = false
    async function loadProducts() {
      setProductsLoading(true)
      try {
        const res = await fetch('/api/products?limit=100', { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load products')
        const docs: any[] = j.docs || j.data?.docs || []
        // client side filter productType variable
        const variableOnly = docs.filter((d: any) => String(d.productType || '').toLowerCase() === 'variable')
        if (!cancelled) setProducts(variableOnly.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}`, slug: d.slug || '' })))
      } catch {
        // fallback: try cms directly via products endpoint without filter, keep empty
        if (!cancelled) setProducts([])
      } finally {
        if (!cancelled) setProductsLoading(false)
      }
    }
    void loadProducts()
    return () => {
      cancelled = true
    }
  }, [])

  const submit = async () => {
    setError(null)
    if (!form.product_id) return setError('Variable product is required')
    if (!MODE_OPTS.some((o) => o.value === form.modifier_behavior_mode))
      return setError('Modifier behavior mode is required (inherit_product / variation_specific / hybrid)')
    if (form.short_description && form.short_description.length > 500)
      return setError('Short description must be at most 500 characters')
    if (form.base_price !== '' && (Number.isNaN(Number(form.base_price)) || Number(form.base_price) < 0))
      return setError('Base price must be a number >= 0')
    if (form.compare_at_price !== '' && (Number.isNaN(Number(form.compare_at_price)) || Number(form.compare_at_price) < 0))
      return setError('Compare at price must be a number >= 0')
    if (form.stock_quantity !== '' && (Number.isNaN(Number(form.stock_quantity)) || Number(form.stock_quantity) < 0 || !Number.isInteger(Number(form.stock_quantity))))
      return setError('Stock quantity must be an integer >= 0')
    if (form.sort_order !== '' && Number.isNaN(Number(form.sort_order))) return setError('Sort order must be numeric')

    setSaving(true)
    try {
      const payload: any = {
        product_id: Number(form.product_id),
        modifier_behavior_mode: form.modifier_behavior_mode,
        name: form.name.trim() || null,
        short_description: form.short_description.trim() || null,
        image: imageId ? Number(imageId) : null,
        base_price: form.base_price === '' ? null : Number(form.base_price),
        compare_at_price: form.compare_at_price === '' ? null : Number(form.compare_at_price),
        stock_quantity: form.stock_quantity === '' ? 0 : Math.trunc(Number(form.stock_quantity)),
        sort_order: form.sort_order === '' ? 0 : Math.trunc(Number(form.sort_order)),
        is_used_for_variations: !!form.is_used_for_variations,
        is_visible: !!form.is_visible,
      }
      const url = isEdit ? `/api/catalog/variations/${(initial as any).id}` : '/api/catalog/variations'
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
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        {/* 1. Product & Mode */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Building className="w-4 h-4 text-[#eba236]" /> Product &amp; Mode
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Variable product *</label>
              <select value={form.product_id} onChange={(e) => set('product_id', e.target.value)} className={inputCls} disabled={productsLoading}>
                <option value="">{productsLoading ? 'Loading variable products…' : 'Select variable product'}</option>
                {products.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} {p.slug ? `(${p.slug})` : ''} — #{p.id}
                  </option>
                ))}
              </select>
              {!productsLoading && products.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No variable products found. Create a product with productType=variable first.</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Modifier behavior mode *</label>
              <select value={form.modifier_behavior_mode} onChange={(e) => set('modifier_behavior_mode', e.target.value)} className={inputCls}>
                {MODE_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">{MODE_OPTS.find((o) => o.value === form.modifier_behavior_mode)?.desc}</p>
            </div>
          </div>
        </div>

        {/* 2. Details */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" /> Details
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelCls}>Variation name</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Large — Extra Spicy" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Short description <span className="text-gray-400 font-normal">(max 500)</span></label>
              <textarea value={form.short_description} onChange={(e) => set('short_description', e.target.value)} rows={3} maxLength={500} placeholder="Brief description for this variation…" className={inputCls} />
              <p className="text-xs text-gray-400 mt-1 text-right">{form.short_description.length}/500</p>
            </div>
          </div>
        </div>

        {/* 3. Pricing & Inventory */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-600" /> Pricing &amp; Inventory
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Base price</label>
              <input type="number" min={0} step={0.01} value={form.base_price} onChange={(e) => set('base_price', e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Compare at price</label>
              <input type="number" min={0} step={0.01} value={form.compare_at_price} onChange={(e) => set('compare_at_price', e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Stock quantity</label>
              <input type="number" min={0} step={1} value={form.stock_quantity} onChange={(e) => set('stock_quantity', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Sort order</label>
              <input type="number" step={1} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* 4. Media */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#eba236]" /> Media
          </h4>
          <div>
            <label className={labelCls}>Variation image</label>
            <MediaUploader value={imageId} onChange={(id) => setImageId(id as any)} accept="image/*" className="mt-1" />
          </div>
        </div>

        {/* 5. Settings */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Settings className="w-4 h-4 text-zinc-600" /> Settings
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 dark:border-[#262626] p-3">
              <input type="checkbox" checked={!!form.is_used_for_variations} onChange={(e) => set('is_used_for_variations', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">Used for variations</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-gray-200 dark:border-[#262626] p-3">
              <input type="checkbox" checked={!!form.is_visible} onChange={(e) => set('is_visible', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">Visible</span>
            </label>
            <div>
              <label className={labelCls}>Sort order</label>
              <input type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">SKU, modifier_configuration_hint and effective_modifier_preview are auto-managed and read-only.</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create variation'}
        </button>
      </div>
    </div>
  )
}
