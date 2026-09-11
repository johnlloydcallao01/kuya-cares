'use client'

import React, { useEffect, useState } from 'react'
import { Tag, Building, Palette, Layers, ToggleLeft, AlertCircle, RefreshCw } from '@/components/ui/IconWrapper'

export const TAG_TYPE_OPTS: { value: string; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'dietary', label: 'Dietary' },
  { value: 'cuisine', label: 'Cuisine' },
  { value: 'promotion', label: 'Promotion' },
  { value: 'feature', label: 'Feature' },
  { value: 'allergen', label: 'Allergen' },
  { value: 'spice_level', label: 'Spice Level' },
  { value: 'temperature', label: 'Temperature' },
  { value: 'size_category', label: 'Size Category' },
]

type TagDoc = {
  id: number
  name: string
  slug: string
  description: string | null
  color: string | null
  tag_type: string
  parent_tag_id: { id: number; name: string; slug: string } | null
  is_active: boolean
  is_featured: boolean
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function TagForm({ initial, onSuccess, onCancel }: { initial?: TagDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parentOpts, setParentOpts] = useState<{ id: number; name: string; slug: string }[]>([])

  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    description: initial?.description || '',
    color: initial?.color || '',
    tag_type: initial?.tag_type || 'general',
    parent_tag_id: initial?.parent_tag_id ? String(initial.parent_tag_id.id) : '',
    is_active: initial?.is_active ?? true,
    is_featured: initial?.is_featured ?? false,
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
      tag_type: initial.tag_type || 'general',
      parent_tag_id: initial.parent_tag_id ? String(initial.parent_tag_id.id) : '',
      is_active: initial.is_active ?? true,
      is_featured: initial.is_featured ?? false,
    })
    setSlugTouched(true)
    setError(null)
  }, [initial])

  // auto-slug from name when not touched
  useEffect(() => {
    if (slugTouched) return
    const auto = form.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setForm((prev) => ({ ...prev, slug: auto }))
  }, [form.name, slugTouched])

  // fetch parent opts
  useEffect(() => {
    let cancelled = false
    async function loadParents() {
      try {
        const res = await fetch('/api/catalog/tags?limit=100&_t=' + Date.now(), { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) return
        const docs = (j.docs || []) as any[]
        const opts = docs
          .filter((d) => !initial || String(d.id) !== String(initial.id))
          .map((d) => ({ id: d.id, name: d.name, slug: d.slug }))
        if (!cancelled) setParentOpts(opts)
      } catch {}
    }
    void loadParents()
    return () => { cancelled = true }
  }, [initial])

  const submit = async () => {
    setError(null)
    const name = form.name.trim()
    if (!name || name.length < 2) return setError('Name is required (min 2 chars)')
    if (name.length > 100) return setError('Name must be at most 100 chars')
    const rawSlug = form.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    // slug can be empty -> auto from name; but validate if provided
    let slugToSend: string | undefined = undefined
    if (form.slug.trim()) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawSlug)) return setError('Slug must be lowercase alphanumeric with hyphens (e.g. my-tag)')
      if (rawSlug.length > 100) return setError('Slug must be at most 100 chars')
      slugToSend = rawSlug
    }
    if (form.color.trim()) {
      if (!/^#([0-9a-fA-F]{6})$/.test(form.color.trim())) return setError('Color must be hex #RRGGBB (e.g. #eba236)')
      if (form.color.trim().length > 7) return setError('Color must be at most 7 chars')
    }
    if (form.parent_tag_id && initial && form.parent_tag_id === String(initial.id)) return setError('Parent tag cannot be itself')
    if (!TAG_TYPE_OPTS.some((o) => o.value === form.tag_type)) return setError('Invalid tag type')

    const payload: any = {
      name,
      slug: slugToSend,
      description: form.description.trim() || null,
      color: form.color.trim() || null,
      tag_type: form.tag_type,
      parent_tag_id: form.parent_tag_id ? Number(form.parent_tag_id) : null,
      is_active: form.is_active,
      is_featured: form.is_featured,
    }
    // for create: allow undefined slug to auto; for edit: send slug if present else omit? spec says send lower hyphen or undefined auto
    if (payload.slug === undefined) delete payload.slug

    setSaving(true)
    try {
      const url = isEdit ? `/api/catalog/tags/${(initial as any).id}` : '/api/catalog/tags'
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
              <label className={labelCls}>Tag name *</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Spicy" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Slug * <span className="text-gray-400 font-normal">(auto from name, lowercase hyphen)</span></label>
              <input
                value={form.slug}
                onChange={(e) => { set('slug', e.target.value); setSlugTouched(true) }}
                placeholder="spicy"
                className={`${inputCls} font-mono`}
              />
              <p className="text-xs text-gray-400 mt-1">Leave blank to auto-generate. Must match ^[a-z0-9]+(-[a-z0-9]+)*$</p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="Short description for this tag…" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tag type *</label>
              <select value={form.tag_type} onChange={(e) => set('tag_type', e.target.value)} className={inputCls}>
                {TAG_TYPE_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Color & Appearance */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#eba236]" /> Color & Appearance
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Color <span className="text-gray-400 font-normal">(hex #RRGGBB, optional)</span></label>
              <div className="flex items-center gap-2">
                <input value={form.color} onChange={(e) => set('color', e.target.value)} placeholder="#eba236" className={`${inputCls} font-mono flex-1`} maxLength={7} />
                <div className="h-10 w-10 rounded-lg border border-gray-200 dark:border-[#262626] shrink-0" style={{ backgroundColor: /^#([0-9a-fA-F]{6})$/.test(form.color) ? form.color : 'transparent' }} title={form.color || 'no color'} />
                <input type="color" value={/^#([0-9a-fA-F]{6})$/.test(form.color) ? form.color : '#eba236'} onChange={(e) => set('color', e.target.value)} className="h-10 w-10 rounded-lg border border-gray-200 dark:border-[#262626] p-1 bg-white dark:bg-[#0a0a0a]" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Used as pill/dot — must be valid hex if provided.</p>
            </div>
            <div className="flex items-end">
              <div className="w-full rounded-xl border border-gray-200 dark:border-[#262626] p-3 bg-gray-50 dark:bg-[#0a0a0a]">
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mb-2">Preview</p>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border bg-white dark:bg-[#171717] border-gray-200 dark:border-[#262626]">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: /^#([0-9a-fA-F]{6})$/.test(form.color) ? form.color : '#eba236' }} />
                  {form.name || 'Tag preview'} <span className="text-gray-400 font-mono">/{form.slug || 'slug'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Hierarchy */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#eba236]" /> Hierarchy
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Parent tag <span className="text-gray-400 font-normal">(optional, top-level if blank)</span></label>
              <select value={form.parent_tag_id} onChange={(e) => set('parent_tag_id', e.target.value)} className={inputCls}>
                <option value="">— Top-level (no parent) —</option>
                {parentOpts.map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name} /{p.slug}</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Child tags inherit for grouping. Circular self-reference blocked.</p>
            </div>
          </div>
        </div>

        {/* Status */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <ToggleLeft className="w-4 h-4 text-[#eba236]" /> Status
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-gray-200 dark:border-[#262626] px-4 py-3 bg-gray-50 dark:bg-[#0a0a0a]">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">Active</span>
              <span className="text-xs text-gray-400">Visible to search & filters</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-gray-200 dark:border-[#262626] px-4 py-3 bg-gray-50 dark:bg-[#0a0a0a]">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => set('is_featured', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
              <span className="text-sm font-medium text-gray-700 dark:text-white">Featured</span>
              <span className="text-xs text-gray-400">Highlight in UI</span>
            </label>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create tag'}
        </button>
      </div>
    </div>
  )
}
