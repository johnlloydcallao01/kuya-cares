'use client'

import React, { useEffect, useState } from 'react'
import { Building, Palette, ToggleLeft, AlertCircle, RefreshCw } from '@/components/ui/IconWrapper'

export type TagGroupDoc = {
  id: number
  name: string
  slug: string
  description: string | null
  color: string | null
  icon: string | null
  is_filterable: boolean
  is_searchable: boolean
  display_order: number
  is_active: boolean
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function TagGroupForm({ initial, onSuccess, onCancel }: { initial?: TagGroupDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    description: initial?.description || '',
    color: initial?.color || '',
    icon: initial?.icon || '',
    is_filterable: initial?.is_filterable ?? true,
    is_searchable: initial?.is_searchable ?? true,
    display_order: initial?.display_order !== undefined && initial?.display_order !== null ? String(initial.display_order) : '0',
    is_active: initial?.is_active ?? true,
  })
  const [slugTouched, setSlugTouched] = useState(!!initial?.slug)

  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      name: initial.name || '',
      slug: initial.slug || '',
      description: initial.description || '',
      color: initial.color || '',
      icon: initial.icon || '',
      is_filterable: initial.is_filterable ?? true,
      is_searchable: initial.is_searchable ?? true,
      display_order: initial.display_order !== undefined && initial.display_order !== null ? String(initial.display_order) : '0',
      is_active: initial.is_active ?? true,
    })
    setSlugTouched(true)
    setError(null)
  }, [initial])

  useEffect(() => {
    if (slugTouched) return
    const auto = form.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setForm((prev) => ({ ...prev, slug: auto }))
  }, [form.name, slugTouched])

  const submit = async () => {
    setError(null)
    const name = form.name.trim()
    if (!name || name.length < 2) return setError('Name is required (min 2 chars)')
    if (name.length > 100) return setError('Name must be at most 100 chars')
    const rawSlug = form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    let slugToSend: string | undefined = undefined
    if (form.slug.trim()) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug)) return setError('Slug must be lowercase alphanumeric with hyphens (e.g. my-group)')
      if (rawSlug.length > 100) return setError('Slug must be at most 100 chars')
      slugToSend = rawSlug
    }
    if (form.color.trim()) {
      if (!/^#([0-9a-fA-F]{6})$/.test(form.color.trim())) return setError('Color must be hex #RRGGBB (e.g. #eba236)')
      if (form.color.trim().length > 7) return setError('Color must be at most 7 chars')
    }
    if (form.icon.trim() && form.icon.trim().length > 50) return setError('Icon must be at most 50 chars')
    const displayNum = form.display_order.trim() === '' ? 0 : Number(form.display_order)
    if (Number.isNaN(displayNum)) return setError('Display order must be numeric')

    const payload: any = {
      name,
      slug: slugToSend,
      description: form.description.trim() || null,
      color: form.color.trim() || null,
      icon: form.icon.trim() || null,
      is_filterable: form.is_filterable,
      is_searchable: form.is_searchable,
      display_order: displayNum,
      is_active: form.is_active,
    }
    if (payload.slug === undefined) delete payload.slug

    setSaving(true)
    try {
      const url = isEdit ? `/api/catalog/tag-groups/${(initial as any).id}` : '/api/catalog/tag-groups'
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

        {/* Basic */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Building className="w-4 h-4 text-[#eba236]" /> Basic Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Group name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Spicy Favorites" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Slug * <span className="text-gray-400 font-normal">(auto from name, lowercase hyphen)</span></label>
              <input
                value={form.slug}
                onChange={(e) => { set('slug', e.target.value); setSlugTouched(true) }}
                placeholder="spicy-favorites"
                className={`${inputCls} font-mono`}
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank to auto-generate. Must match ^[a-z0-9]+(-[a-z0-9]+)*$</p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Short description for this tag group…" className={inputCls} />
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#eba236]" /> Appearance
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Color <span className="text-gray-400 font-normal">(hex #RRGGBB, optional)</span></label>
              <div className="flex items-center gap-2">
                <input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="#eba236" className={`${inputCls} font-mono flex-1`} maxLength={7} />
                <div className="h-10 w-10 rounded-lg border border-gray-200 dark:border-[#262626] shrink-0" style={{ backgroundColor: /^#([0-9a-fA-F]{6})$/.test(form.color) ? form.color : 'transparent' }} title={form.color || 'no color'} />
                <input type="color" value={/^#([0-9a-fA-F]{6})$/.test(form.color) ? form.color : '#eba236'} onChange={(e) => set('color', e.target.value)} className="h-10 w-10 rounded-lg border border-gray-200 dark:border-[#262626] p-1 bg-white dark:bg-[#0a0a0a]" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Used as swatch/dot — must be valid hex if provided.</p>
            </div>
            <div>
              <label className={labelCls}>Icon <span className="text-gray-400 font-normal">(text, max 50, optional)</span></label>
              <input value={form.icon} onChange={(e) => set('icon', e.target.value)} placeholder="fire / star / leaf" className={inputCls} maxLength={50} />
              <p className="text-xs text-gray-400 mt-1">Icon class or name for group display.</p>
            </div>
            <div className="sm:col-span-2">
              <div className="w-full rounded-xl border border-gray-200 dark:border-[#262626] p-3 bg-gray-50 dark:bg-[#0a0a0a]">
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mb-2">Preview</p>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border bg-white dark:bg-[#171717] border-gray-200 dark:border-[#262626]">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: /^#([0-9a-fA-F]{6})$/.test(form.color) ? form.color : '#eba236' }} />
                  {form.icon && <span className="text-gray-500 font-mono">{form.icon}</span>}
                  {form.name || 'Group preview'} <span className="text-gray-400 font-mono">/{form.slug || 'slug'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ToggleLeft className="w-4 h-4 text-[#eba236]" /> Settings
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-gray-200 dark:border-[#262626] px-4 py-3 bg-gray-50 dark:bg-[#0a0a0a]">
              <input type="checkbox" checked={form.is_filterable} onChange={(e) => set('is_filterable', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">Filterable</span>
              <span className="text-xs text-gray-400">Show in filter UI</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-gray-200 dark:border-[#262626] px-4 py-3 bg-gray-50 dark:bg-[#0a0a0a]">
              <input type="checkbox" checked={form.is_searchable} onChange={(e) => set('is_searchable', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">Searchable</span>
              <span className="text-xs text-gray-400">Include in search</span>
            </label>
            <div>
              <label className={labelCls}>Display order</label>
              <input type="number" value={form.display_order} onChange={(e) => set('display_order', e.target.value)} placeholder="0" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-gray-200 dark:border-[#262626] px-4 py-3 bg-gray-50 dark:bg-[#0a0a0a] h-fit mt-6">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">Active</span>
              <span className="text-xs text-gray-400">Visible to search & filters</span>
            </label>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create tag group'}
        </button>
      </div>
    </div>
  )
}
