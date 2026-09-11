'use client'

import React, { useState, useEffect } from 'react'
import { Package, Layers, Hash, AlertCircle, RefreshCw, ShoppingBag } from '@/components/ui/IconWrapper'

export type GroupedItemDoc = {
  id: number
  parent_product_id: number | { id: number; name: string; slug: string; productType: string } | null
  parent_product?: { id: number; name: string; slug: string; productType: string } | null
  child_product_id: number | { id: number; name: string; slug: string; productType: string } | null
  child_product?: { id: number; name: string; slug: string; productType: string } | null
  default_quantity: number | null
  sort_order: number | null
  createdAt: string
  updatedAt: string
}

type ProductOption = { id: number; name: string; slug: string; productType: string }

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

function getProductId(v: GroupedItemDoc['parent_product_id'] | null | undefined): string {
  if (v == null) return ''
  if (typeof v === 'number') return String(v)
  if (typeof v === 'object' && 'id' in v) return String((v as any).id)
  return ''
}

export function GroupedItemForm({ initial, onSuccess, onCancel }: { initial?: GroupedItemDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [parents, setParents] = useState<ProductOption[]>([])
  const [children, setChildren] = useState<ProductOption[]>([])
  const [productsLoading, setProductsLoading] = useState(true)

  const [form, setForm] = useState({
    parent_product_id: getProductId(initial?.parent_product_id) || getProductId((initial as any)?.parent_product),
    child_product_id: getProductId(initial?.child_product_id) || getProductId((initial as any)?.child_product),
    default_quantity: initial?.default_quantity != null ? String(initial.default_quantity) : '1',
    sort_order: initial?.sort_order != null ? String(initial.sort_order) : '0',
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      parent_product_id: getProductId(initial.parent_product_id) || getProductId((initial as any).parent_product),
      child_product_id: getProductId(initial.child_product_id) || getProductId((initial as any).child_product),
      default_quantity: initial.default_quantity != null ? String(initial.default_quantity) : '1',
      sort_order: initial.sort_order != null ? String(initial.sort_order) : '0',
    })
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
        const all: ProductOption[] = docs.map((d: any) => ({ id: d.id, name: d.name || `#${d.id}`, slug: d.slug || '', productType: String(d.productType || '') }))
        if (!cancelled) {
          setParents(all.filter((p) => p.productType.toLowerCase() === 'grouped'))
          setChildren(all.filter((p) => p.productType.toLowerCase() !== 'grouped'))
          // fallback: if no grouped/simple split, show all
          if (all.filter((p) => p.productType.toLowerCase() === 'grouped').length === 0) setParents(all)
          if (all.filter((p) => p.productType.toLowerCase() !== 'grouped').length === 0) setChildren(all)
        }
      } catch {
        if (!cancelled) { setParents([]); setChildren([]) }
      } finally {
        if (!cancelled) setProductsLoading(false)
      }
    }
    void loadProducts()
    return () => { cancelled = true }
  }, [])

  const submit = async () => {
    setError(null)
    if (!form.parent_product_id) return setError('Parent product is required (must be a grouped product)')
    if (!form.child_product_id) return setError('Child product is required')
    if (form.parent_product_id === form.child_product_id) return setError('Parent and child cannot be the same product')
    const qty = form.default_quantity.trim() === '' ? 1 : Number(form.default_quantity)
    if (Number.isNaN(qty) || qty < 0) return setError('Default quantity must be a number >= 0')
    if (!Number.isInteger(qty) && qty !== Math.trunc(qty)) return setError('Default quantity must be an integer')
    const sort = form.sort_order.trim() === '' ? 0 : Number(form.sort_order)
    if (Number.isNaN(sort)) return setError('Sort order must be numeric')

    setSaving(true)
    try {
      const payload: any = {
        parent_product_id: Number(form.parent_product_id),
        child_product_id: Number(form.child_product_id),
        default_quantity: qty,
        sort_order: Math.trunc(sort),
      }
      const url = isEdit ? `/api/catalog/grouped-items/${(initial as any).id}` : '/api/catalog/grouped-items'
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
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-[#eba236]" /> Bundle Composition</h4>
          <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mb-3">Grouped items let you sell multiple stand-alone products together as one bundle. Choose a <span className="font-medium">grouped</span> parent and a child product to include. The bundle price is summed from children.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Parent product * <span className="text-gray-400 font-normal">(grouped only)</span></label>
              <select value={form.parent_product_id} onChange={(e) => set('parent_product_id', e.target.value)} className={inputCls} disabled={productsLoading}>
                <option value="">{productsLoading ? 'Loading grouped products…' : 'Select grouped product'}</option>
                {parents.map((p) => <option key={p.id} value={String(p.id)}>{p.name} ({p.slug}) — #{p.id}</option>)}
              </select>
              {!productsLoading && parents.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No grouped products found. Create a product with productType=grouped first.</p>}
            </div>
            <div>
              <label className={labelCls}>Child product *</label>
              <select value={form.child_product_id} onChange={(e) => set('child_product_id', e.target.value)} className={inputCls} disabled={productsLoading}>
                <option value="">{productsLoading ? 'Loading products…' : 'Select child product'}</option>
                {children.map((p) => <option key={p.id} value={String(p.id)}>{p.name} ({p.slug}) — #{p.id} [{p.productType || 'simple'}]</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Cannot be a grouped product (no nested grouping).</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-sky-600" /> Quantity & Ordering</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Default quantity</label>
              <input type="number" min={0} step={1} value={form.default_quantity} onChange={(e) => set('default_quantity', e.target.value)} placeholder="1" className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Default units included when bundle is added to cart. 0 allowed for optional add-ons.</p>
            </div>
            <div>
              <label className={labelCls}><Hash className="w-3 h-3 inline mr-1" />Sort order</label>
              <input type="number" step={1} value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} placeholder="0" className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Lower numbers appear first (used in ORDER BY sort_order).</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] p-4">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-white flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-[#eba236]" /> How it works</h4>
          <ul className="text-xs text-gray-600 dark:text-[#a1a1aa] mt-2 list-disc list-inside space-y-1">
            <li>Example: Parent <span className="font-mono">Family Bundle (grouped)</span> → Child <span className="font-mono">Fried Chicken ×1</span>, Child <span className="font-mono">Rice ×2</span>, Child <span className="font-mono">Coke ×1</span>.</li>
            <li>Deleting the parent or child product auto-deletes its grouped rows (Products.beforeDelete).</li>
            <li>Duplicate (same parent + child) is blocked with 409. Parent ≠ child.</li>
          </ul>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create grouped item'}
        </button>
      </div>
    </div>
  )
}
