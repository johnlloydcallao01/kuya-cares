'use client'

import React, { useState, useEffect } from 'react'
import { Tag, Hash, Sparkles, AlertCircle, RefreshCw, Image as ImageIcon, Layers } from '@/components/ui/IconWrapper'
import { MediaUploader } from '@/components/cms/MediaUploader'

type Doc = {
  id: number
  name: string
  slug: string
  description: string | null
  displayOrder: number
  isActive: boolean
  isFeatured: boolean
  icon: { id: number; url: string | null } | null
}

export function MerchantCategoryForm({ initial, onSuccess, onCancel }: { initial?: Doc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [iconId, setIconId] = useState<string | number | undefined>(initial?.icon?.id)

  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    description: initial?.description || '',
    displayOrder: initial?.displayOrder ?? 0,
    isActive: initial?.isActive ?? true,
    isFeatured: initial?.isFeatured ?? false,
  })
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      name: initial.name || '',
      slug: initial.slug || '',
      description: initial.description || '',
      displayOrder: initial.displayOrder ?? 0,
      isActive: initial.isActive ?? true,
      isFeatured: initial.isFeatured ?? false,
    })
    setIconId(initial.icon?.id)
    setError(null)
  }, [initial])

  // auto-slug from name if empty (mirrors BFF hook)
  useEffect(() => {
    if (!isEdit && form.name && !form.slug) {
      const s = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      setForm(p => ({ ...p, slug: s }))
    }
  }, [form.name, isEdit])

  const submit = async () => {
    setError(null)
    if (!form.name.trim() || form.name.trim().length < 2) return setError('Name is required (min 2 chars)')
    if (String(form.displayOrder).trim() !== '' && Number.isNaN(Number(form.displayOrder))) return setError('Display order must be numeric')
    setSaving(true)
    try {
      const payload: any = {
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || undefined,
        description: form.description.trim() || null,
        displayOrder: Number(form.displayOrder) || 0,
        isActive: !!form.isActive,
        isFeatured: !!form.isFeatured,
      }
      if (iconId) payload.icon = Number(iconId)
      else if (isEdit) payload.icon = null
      const url = isEdit ? `/api/merchant-categories/${(initial as any).id}` : '/api/merchant-categories'
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
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-[#eba236]" /> Basic Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Name *</label><input value={form.name} onChange={e=>set('name', e.target.value)} placeholder="Fast Food, Grocery, Coffee Shop…" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Slug * <span className="text-gray-400 font-normal">(auto from name, unique)</span></label><input value={form.slug} onChange={e=>set('slug', e.target.value)} placeholder="fast-food" className={`${inputCls} font-mono`} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Description</label><textarea value={form.description} onChange={e=>set('description', e.target.value)} rows={3} placeholder="Category description for admin reference…" className={inputCls} /></div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600" /> Display & Status</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><label className={labelCls}><Hash className="w-3.5 h-3.5 inline mr-1" />Display order</label><input type="number" value={form.displayOrder} onChange={e=>set('displayOrder', e.target.value)} placeholder="0" className={inputCls} /></div>
            <div className="flex items-center gap-4 pt-6">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={e=>set('isActive', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Active</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isFeatured} onChange={e=>set('isFeatured', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Featured</span></label>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-[#eba236]" /> Icon</h4>
          <div>
            <label className={labelCls}>Category icon</label>
            <MediaUploader value={iconId} onChange={id=>setIconId(id)} accept="image/*" className="mt-1" />
            <p className="text-xs text-gray-400 mt-1">SVG preferred, square • will be shown in merchant listings</p>
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
