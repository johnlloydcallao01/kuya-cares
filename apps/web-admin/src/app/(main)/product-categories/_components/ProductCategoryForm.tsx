'use client'

import React, { useState, useEffect } from 'react'
import { Tag, Hash, Sparkles, AlertCircle, RefreshCw, Image as ImageIcon, Layers, Globe, Store, ShieldCheck, FileText } from '@/components/ui/IconWrapper'
import { MediaUploader } from '@/components/cms/MediaUploader'

type Doc = {
  id: number
  name: string
  slug: string
  description: string | null
  parentCategory: { id: number; name: string; slug: string; categoryPath: string | null } | null
  categoryLevel?: number | null
  categoryPath?: string | null
  displayOrder: number
  isActive: boolean
  isFeatured: boolean
  media: { icon: { id: number; url: string | null } | null; bannerImage: { id: number; url: string | null } | null; thumbnailImage: { id: number; url: string | null } | null }
  attributes: { categoryType: string | null; dietaryTags: any; ageRestriction: string | null; requiresPrescription: boolean | null }
  seo: { metaTitle: string | null; metaDescription: string | null; keywords: any; canonicalUrl: string | null }
}

const CATEGORY_TYPES: { value: string; label: string }[] = [
  { value: 'food', label: 'Food' },
  { value: 'beverages', label: 'Beverages' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'personal_care', label: 'Personal Care' },
  { value: 'household', label: 'Household' },
  { value: 'other', label: 'Other' },
]
const AGE_OPTS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: '18_plus', label: '18+' },
  { value: '21_plus', label: '21+' },
]

export function ProductCategoryForm({ initial, onSuccess, onCancel }: { initial?: Doc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [iconId, setIconId] = useState<string | number | undefined>(initial?.media?.icon?.id)
  const [bannerId, setBannerId] = useState<string | number | undefined>(initial?.media?.bannerImage?.id)
  const [thumbId, setThumbId] = useState<string | number | undefined>(initial?.media?.thumbnailImage?.id)

  const [parentOptions, setParentOptions] = useState<{ id: number; name: string; slug: string }[]>([])

  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    description: initial?.description || '',
    parentCategory: initial?.parentCategory ? String(initial.parentCategory.id) : '',
    displayOrder: initial?.displayOrder ?? 0,
    isActive: initial?.isActive ?? true,
    isFeatured: initial?.isFeatured ?? false,
    categoryType: initial?.attributes?.categoryType || '',
    dietaryTags: Array.isArray(initial?.attributes?.dietaryTags) ? (initial?.attributes?.dietaryTags as string[]).join(', ') : typeof initial?.attributes?.dietaryTags === 'string' ? initial?.attributes?.dietaryTags : '',
    ageRestriction: initial?.attributes?.ageRestriction || 'none',
    requiresPrescription: initial?.attributes?.requiresPrescription ?? false,
    metaTitle: initial?.seo?.metaTitle || '',
    metaDescription: initial?.seo?.metaDescription || '',
    keywords: Array.isArray(initial?.seo?.keywords) ? (initial?.seo?.keywords as string[]).join(', ') : typeof initial?.seo?.keywords === 'string' ? initial?.seo?.keywords : '',
    canonicalUrl: initial?.seo?.canonicalUrl || '',
  })
  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      name: initial.name || '',
      slug: initial.slug || '',
      description: initial.description || '',
      parentCategory: initial.parentCategory ? String(initial.parentCategory.id) : '',
      displayOrder: initial.displayOrder ?? 0,
      isActive: initial.isActive ?? true,
      isFeatured: initial.isFeatured ?? false,
      categoryType: initial.attributes?.categoryType || '',
      dietaryTags: Array.isArray(initial.attributes?.dietaryTags) ? (initial.attributes.dietaryTags as string[]).join(', ') : '',
      ageRestriction: initial.attributes?.ageRestriction || 'none',
      requiresPrescription: initial.attributes?.requiresPrescription ?? false,
      metaTitle: initial.seo?.metaTitle || '',
      metaDescription: initial.seo?.metaDescription || '',
      keywords: Array.isArray(initial.seo?.keywords) ? (initial.seo.keywords as string[]).join(', ') : '',
      canonicalUrl: initial.seo?.canonicalUrl || '',
    })
    setIconId(initial.media?.icon?.id)
    setBannerId(initial.media?.bannerImage?.id)
    setThumbId(initial.media?.thumbnailImage?.id)
    setError(null)
  }, [initial])

  useEffect(() => {
    let cancelled = false
    async function loadParents() {
      try {
        const res = await fetch('/api/product-categories?limit=100', { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) return
        const docs = (j.docs as any[]) || []
        if (!cancelled) setParentOptions(docs.map((d: any) => ({ id: d.id, name: d.name, slug: d.slug })))
      } catch {}
    }
    void loadParents()
    return () => { cancelled = true }
  }, [])

  // auto-slug from name if empty (mirrors BFF hook)
  useEffect(() => {
    if (!isEdit && form.name && !form.slug) {
      const s = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      setForm((p) => ({ ...p, slug: s }))
    }
  }, [form.name, isEdit])

  const submit = async () => {
    setError(null)
    if (!form.name.trim() || form.name.trim().length < 2) return setError('Name is required (min 2 chars)')
    if (form.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim().toLowerCase())) return setError('Slug must be lowercase alphanumeric with hyphens')
    if (String(form.displayOrder).trim() !== '' && Number.isNaN(Number(form.displayOrder))) return setError('Display order must be numeric')
    if (form.canonicalUrl && form.canonicalUrl.trim()) {
      try { new URL(form.canonicalUrl.trim()) } catch { return setError('Canonical URL must be a valid URL') }
    }
    if (form.parentCategory && form.parentCategory === String(initial?.id)) return setError('Parent category cannot be itself')

    setSaving(true)
    try {
      const payload: any = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || undefined,
        description: form.description.trim() || null,
        displayOrder: Number(form.displayOrder) || 0,
        isActive: !!form.isActive,
        isFeatured: !!form.isFeatured,
        parentCategory: form.parentCategory ? Number(form.parentCategory) : null,
        media: {
          icon: iconId ? Number(iconId) : null,
          bannerImage: bannerId ? Number(bannerId) : null,
          thumbnailImage: thumbId ? Number(thumbId) : null,
        },
        attributes: {
          categoryType: form.categoryType || null,
          dietaryTags: form.dietaryTags.trim() ? form.dietaryTags.split(',').map((s) => s.trim()).filter(Boolean) : null,
          ageRestriction: form.ageRestriction || 'none',
          requiresPrescription: !!form.requiresPrescription,
        },
        seo: {
          metaTitle: form.metaTitle.trim() || null,
          metaDescription: form.metaDescription.trim() || null,
          keywords: form.keywords.trim() ? form.keywords.split(',').map((s) => s.trim()).filter(Boolean) : null,
          canonicalUrl: form.canonicalUrl.trim() || null,
        },
      }
      // clean empty media/attributes/seo to avoid sending empty groups
      if (!payload.media.icon && !payload.media.bannerImage && !payload.media.thumbnailImage) delete payload.media
      const url = isEdit ? `/api/product-categories/${(initial as any).id}` : '/api/product-categories'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed')
      onSuccess()
    } catch (e: any) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
  const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-7">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-[#eba236]" /> Basic Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Name *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Main Dishes, Beverages, Pharmacy…" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Slug * <span className="text-gray-400 font-normal">(auto from name, unique)</span></label><input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="main-dishes" className={`${inputCls} font-mono`} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Description</label><textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Category description for customers…" className={inputCls} /></div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-sky-600" /> Hierarchy</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Parent category</label>
              <select value={form.parentCategory} onChange={(e) => set('parentCategory', e.target.value)} className={inputCls}>
                <option value="">— Top-level (no parent) —</option>
                {parentOptions.filter((o) => String(o.id) !== String(initial?.id)).map((o) => <option key={o.id} value={String(o.id)}>{o.name} — {o.slug}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Materialized path <span className="font-mono">categoryPath</span> and level auto-generated from parent.</p>
            </div>
            {initial?.categoryPath && <div className="sm:col-span-2"><p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Path: <span className="font-mono text-gray-900 dark:text-white">{initial.categoryPath}</span> • Level {initial.categoryLevel ?? 1}</p></div>}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600" /> Display & Status</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}><Hash className="w-3.5 h-3.5 inline mr-1" />Display order</label><input type="number" value={form.displayOrder} onChange={(e) => set('displayOrder', e.target.value)} placeholder="0" className={inputCls} /></div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Active</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Featured</span></label>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-[#eba236]" /> Visual</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><label className={labelCls}>Icon (SVG)</label><MediaUploader value={iconId} onChange={(id) => setIconId(id)} accept="image/*" className="mt-1" /></div>
            <div><label className={labelCls}>Banner image</label><MediaUploader value={bannerId} onChange={(id) => setBannerId(id)} accept="image/*" className="mt-1" /></div>
            <div><label className={labelCls}>Thumbnail</label><MediaUploader value={thumbId} onChange={(id) => setThumbId(id)} accept="image/*" className="mt-1" /></div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Store className="w-4 h-4 text-[#eba236]" /> Attributes</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Category type</label><select value={form.categoryType} onChange={(e) => set('categoryType', e.target.value)} className={inputCls}><option value="">— Select —</option>{CATEGORY_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Age restriction</label><select value={form.ageRestriction} onChange={(e) => set('ageRestriction', e.target.value)} className={inputCls}>{AGE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="sm:col-span-2"><label className={labelCls}>Dietary tags <span className="text-gray-400 font-normal">(comma-separated)</span></label><input value={form.dietaryTags} onChange={(e) => set('dietaryTags', e.target.value)} placeholder="vegan, gluten-free, halal" className={inputCls} /></div>
            <div className="sm:col-span-2 flex items-center gap-2 pt-2"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.requiresPrescription} onChange={(e) => set('requiresPrescription', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white flex items-center gap-1"><ShieldCheck className="w-4 h-4 text-amber-600" /> Requires prescription</span></label></div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Globe className="w-4 h-4 text-sky-600" /> SEO</h4>
          <div className="grid grid-cols-1 gap-3">
            <div><label className={labelCls}>Meta title</label><input value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder="Best Main Dishes — Tap2Go" className={inputCls} /></div>
            <div><label className={labelCls}>Meta description</label><textarea value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} rows={2} placeholder="Discover our main dishes…" className={inputCls} /></div>
            <div><label className={labelCls}>Keywords <span className="text-gray-400 font-normal">(comma-separated)</span></label><input value={form.keywords} onChange={(e) => set('keywords', e.target.value)} placeholder="food, delivery, manila" className={inputCls} /></div>
            <div><label className={labelCls}><FileText className="w-3 h-3 inline mr-1" />Canonical URL</label><input value={form.canonicalUrl} onChange={(e) => set('canonicalUrl', e.target.value)} placeholder="https://example.com/category/main-dishes" className={inputCls} /></div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create category'}
        </button>
      </div>
    </div>
  )
}
