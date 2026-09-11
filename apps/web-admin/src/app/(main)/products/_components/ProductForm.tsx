'use client'

import React, { useEffect, useState } from 'react'
import { Package, Tag, DollarSign, Image as ImageIcon, Layers, AlertCircle, RefreshCw, Building, Eye, EyeOff } from '@/components/ui/IconWrapper'
import { MediaUploader } from '@/components/cms/MediaUploader'

const PRODUCT_TYPES = [
  { value: 'simple', label: 'Simple Product' },
  { value: 'variable', label: 'Variable Product' },
  { value: 'grouped', label: 'Grouped Product' },
]
const VISIBILITY_OPTS = [
  { value: 'visible', label: 'Visible (Shop + Search)' },
  { value: 'catalog', label: 'Catalog Only' },
  { value: 'search', label: 'Search Only' },
  { value: 'hidden', label: 'Hidden' },
]

type ProductDoc = {
  id: number
  name: string
  slug: string
  sku: string | null
  productType: string
  basePrice: number | null
  compareAtPrice: number | null
  isActive: boolean
  catalogVisibility: string
  categories: { id: number; name: string; slug: string }[]
  shortDescription: string | null
  description: any
  primaryImage: { id: number; url: string | null } | null
  vendor: { id: number; businessName: string } | null
  assign_to_all_vendor_merchants: boolean
}

export function ProductForm({ initial, onSuccess, onCancel }: { initial?: ProductDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vendors, setVendors] = useState<{ id: number; businessName: string }[]>([])
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [primaryImageId, setPrimaryImageId] = useState<string | number | undefined>(initial?.primaryImage?.id)

  const [form, setForm] = useState({
    vendor: initial?.vendor ? String(initial.vendor.id) : '',
    name: initial?.name || '',
    slug: initial?.slug || '',
    sku: initial?.sku || '',
    productType: initial?.productType || 'simple',
    basePrice: initial?.basePrice != null ? String(initial.basePrice) : '',
    compareAtPrice: initial?.compareAtPrice != null ? String(initial.compareAtPrice) : '',
    categories: initial?.categories?.map(c => String(c.id)) || [],
    shortDescription: initial?.shortDescription || '',
    isActive: initial?.isActive ?? true,
    catalogVisibility: initial?.catalogVisibility || 'visible',
    assign_to_all_vendor_merchants: initial?.assign_to_all_vendor_merchants ?? true,
  })
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    fetch('/api/vendors?limit=100', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => setVendors((j.docs || []).map((d: any) => ({ id: d.id, businessName: d.businessName || `Vendor #${d.id}` }))))
      .catch(() => {})
    // try fetch product-categories via CMS directly (fallback empty if no proxy)
    fetch('/api/product-categories?limit=100', { cache: 'no-store' })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (ok && j.docs) setCategories(j.docs.map((d: any) => ({ id: d.id, name: d.name || `Category #${d.id}` })))
        else {
          // fallback to BFF via products categories? try CMS direct
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api'}/product-categories?limit=100`, { cache: 'no-store' } as any)
            .then(r => r.json()).then(j2 => {
              const docs = j2.docs || j2.data || []
              if (Array.isArray(docs)) setCategories(docs.map((d: any) => ({ id: d.id || d._id, name: d.name || d.title || `Category #${d.id}` })))
            }).catch(()=>{})
        }
      })
      .catch(()=>{})
  }, [])

  useEffect(() => {
    if (!initial) return
    setForm({
      vendor: initial.vendor ? String(initial.vendor.id) : '',
      name: initial.name || '',
      slug: initial.slug || '',
      sku: initial.sku || '',
      productType: initial.productType || 'simple',
      basePrice: initial.basePrice != null ? String(initial.basePrice) : '',
      compareAtPrice: initial.compareAtPrice != null ? String(initial.compareAtPrice) : '',
      categories: initial.categories?.map(c => String(c.id)) || [],
      shortDescription: initial.shortDescription || '',
      isActive: initial.isActive ?? true,
      catalogVisibility: initial.catalogVisibility || 'visible',
      assign_to_all_vendor_merchants: initial.assign_to_all_vendor_merchants ?? true,
    })
    setPrimaryImageId(initial.primaryImage?.id)
    setError(null)
  }, [initial])

  useEffect(() => {
    if (!isEdit && form.name && !form.slug) {
      const s = form.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      setForm(p => ({ ...p, slug: s }))
    }
  }, [form.name, isEdit])

  const toggleCategory = (id: string) => {
    setForm(p => ({ ...p, categories: p.categories.includes(id) ? p.categories.filter(x => x !== id) : [...p.categories, id] }))
  }

  const submit = async () => {
    setError(null)
    if (!form.name.trim() || form.name.trim().length < 2) return setError('Name is required (min 2 chars)')
    if (!form.vendor) return setError('Vendor is required — product must belong to a vendor')
    if (form.productType === 'simple' && (!form.basePrice || Number.isNaN(Number(form.basePrice)) || Number(form.basePrice) < 0)) return setError('Base price is required for simple products and must be >= 0')
    if (form.compareAtPrice && (Number.isNaN(Number(form.compareAtPrice)) || Number(form.compareAtPrice) < 0)) return setError('Compare at price must be >= 0')
    if (form.sku && form.sku.trim().length < 2) return setError('SKU must be at least 2 characters if provided')

    setSaving(true)
    try {
      const payload: any = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || undefined,
        sku: form.sku.trim() ? form.sku.trim().toUpperCase() : null,
        productType: form.productType,
        catalogVisibility: form.catalogVisibility,
        isActive: !!form.isActive,
        shortDescription: form.shortDescription.trim() || null,
        categories: form.categories.length ? form.categories.map(v => Number(v)) : null,
        basePrice: form.basePrice !== '' ? Number(form.basePrice) : null,
        compareAtPrice: form.compareAtPrice !== '' ? Number(form.compareAtPrice) : null,
        assign_to_all_vendor_merchants: !!form.assign_to_all_vendor_merchants,
        createdByVendor: Number(form.vendor),
      }
      if (primaryImageId) payload.primaryImage = Number(primaryImageId)
      else if (isEdit) payload.primaryImage = null

      const url = isEdit ? `/api/products/${(initial as any).id}` : '/api/products'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed')
      onSuccess()
    } catch (e:any) { setError(e.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
  const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Ownership</h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelCls}>Vendor *</label>
              <select value={form.vendor} onChange={e=>set('vendor', e.target.value)} className={inputCls}>
                <option value="">Select vendor</option>
                {vendors.map(v=> <option key={v.id} value={String(v.id)}>{v.businessName} (#{v.id})</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Master catalog product belongs to a vendor — required</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Package className="w-4 h-4 text-[#eba236]" /> Basic Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Product name *</label><input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="Chicken Joy Bucket" className={inputCls} /></div>
            <div><label className={labelCls}>Slug *</label><input value={form.slug} onChange={e=>set('slug', e.target.value)} placeholder="chicken-joy-bucket" className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>SKU <span className="text-gray-400 font-normal">(unique, auto-uppercased)</span></label><input value={form.sku} onChange={e=>set('sku', e.target.value)} placeholder="CJ-BUCKET-001" className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Product type *</label><select value={form.productType} onChange={e=>set('productType', e.target.value)} className={inputCls}>{PRODUCT_TYPES.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Catalog visibility *</label><select value={form.catalogVisibility} onChange={e=>set('catalogVisibility', e.target.value)} className={inputCls}>{VISIBILITY_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="sm:col-span-2"><label className={labelCls}>Short description <span className="text-gray-400 font-normal">(max 500)</span></label><textarea value={form.shortDescription} onChange={e=>set('shortDescription', e.target.value)} rows={2} maxLength={500} placeholder="Brief product description…" className={inputCls} /></div>
            <div className="flex items-center gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={e=>set('isActive', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Active</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.assign_to_all_vendor_merchants} onChange={e=>set('assign_to_all_vendor_merchants', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Assign to all vendor merchants</span></label>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-600" /> Pricing</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Base price {form.productType==='simple' ? '*' : ''}</label><input type="number" min={0} step={0.01} value={form.basePrice} onChange={e=>set('basePrice', e.target.value)} placeholder="199.00" className={inputCls} /></div>
            <div><label className={labelCls}>Compare at price</label><input type="number" min={0} step={0.01} value={form.compareAtPrice} onChange={e=>set('compareAtPrice', e.target.value)} placeholder="249.00" className={inputCls} /></div>
          </div>
          {form.productType!=='simple' && <p className="text-xs text-gray-400 mt-2">Base price is only required for simple products — variable/grouped use variations.</p>}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-emerald-600" /> Categories</h4>
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] p-3">
            {categories.length ? (
              <div className="flex flex-wrap gap-2">
                {categories.map(c=>(
                  <button key={c.id} type="button" onClick={()=>toggleCategory(String(c.id))} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${form.categories.includes(String(c.id)) ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{c.name}</button>
                ))}
              </div>
            ) : <p className="text-sm text-gray-500">No categories found — create product categories first.</p>}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-[#eba236]" /> Media</h4>
          <div>
            <label className={labelCls}>Primary image</label>
            <MediaUploader value={primaryImageId} onChange={id=>setPrimaryImageId(id)} accept="image/*" className="mt-1" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create product'}
        </button>
      </div>
    </div>
  )
}
