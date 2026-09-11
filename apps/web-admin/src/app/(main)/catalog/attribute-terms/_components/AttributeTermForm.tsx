'use client'

import React, { useState, useEffect } from 'react'
import { Building, Palette, Tag, AlertCircle, RefreshCw, Hash, ToggleLeft } from '@/components/ui/IconWrapper'

export type AttributeOption = {
  id: number
  name: string
  slug: string
  type: string
}

export type AttributeTermDoc = {
  id: number
  attribute_id: number | null
  attribute?: { id: number; name: string; slug: string; type: string } | null
  name: string
  slug: string
  value: string | null
  sort_order: number
  is_active: boolean
  createdAt: string
  updatedAt: string
}

const inputCls =
  'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/[\s-]+/g, '-')
}

export function AttributeTermForm({
  initial,
  onSuccess,
  onCancel,
}: {
  initial?: AttributeTermDoc | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attributes, setAttributes] = useState<AttributeOption[]>([])
  const [attributesLoading, setAttributesLoading] = useState(true)
  const [attributesError, setAttributesError] = useState<string | null>(null)

  const [form, setForm] = useState({
    attribute_id: initial?.attribute_id ? String(initial.attribute_id) : '',
    name: initial?.name || '',
    slug: initial?.slug || '',
    value: initial?.value || '',
    sort_order: initial?.sort_order ?? 0,
    is_active: initial?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      attribute_id: initial?.attribute_id ? String(initial.attribute_id) : '',
      name: initial?.name || '',
      slug: initial?.slug || '',
      value: initial?.value || '',
      sort_order: initial?.sort_order ?? 0,
      is_active: initial?.is_active ?? true,
    })
    setError(null)
  }, [initial])

  // fetch attributes dropdown
  useEffect(() => {
    let cancelled = false
    async function loadAttrs() {
      setAttributesLoading(true)
      setAttributesError(null)
      try {
        const res = await fetch(`/api/catalog/attributes?limit=100&_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) {
          const txt = await res.text()
          try {
            const j = JSON.parse(txt)
            throw new Error(j.error || 'Failed to load attributes')
          } catch {
            throw new Error(txt || 'Failed to load attributes')
          }
        }
        const j = await res.json()
        const docs = (j.docs || []) as AttributeOption[]
        if (!cancelled) setAttributes(docs)
      } catch (e: any) {
        if (!cancelled) setAttributesError(e?.message || 'Failed to load attributes')
      } finally {
        if (!cancelled) setAttributesLoading(false)
      }
    }
    void loadAttrs()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedAttribute = attributes.find((a) => String(a.id) === String(form.attribute_id))
  const isColor = selectedAttribute?.type?.toLowerCase() === 'color'
  const slugPreview = form.slug.trim() ? form.slug.trim().toLowerCase() : slugify(form.name)

  const submit = async () => {
    setError(null)
    if (!form.attribute_id || Number.isNaN(Number(form.attribute_id))) return setError('Product attribute is required')
    const name = form.name.trim()
    if (!name || name.length < 2) return setError('Name is required (min 2 chars)')
    if (name.length > 100) return setError('Name must be at most 100 characters')
    const slugVal = form.slug.trim().toLowerCase()
    if (slugVal) {
      if (slugVal.length > 100) return setError('Slug must be at most 100 characters')
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugVal)) return setError('Slug must be lowercase alphanumeric with hyphens (e.g. red-color)')
    }
    if (form.value && form.value.trim() && form.value.trim().length > 100) return setError('Value must be at most 100 characters')
    if (isColor && form.value.trim()) {
      const v = form.value.trim()
      if (v && v.startsWith('#') && !/^#[0-9A-Fa-f]{6}$/.test(v)) {
        return setError('Value for color attribute must be a valid hex color like #RRGGBB (e.g. #FF5733)')
      }
    }
    const sortNum = Number(form.sort_order)
    if (Number.isNaN(sortNum)) return setError('Sort order must be a number')

    setSaving(true)
    try {
      const payload: any = {
        attribute_id: Number(form.attribute_id),
        name,
        sort_order: Math.trunc(sortNum),
        is_active: form.is_active,
      }
      if (slugVal) payload.slug = slugVal
      // value: send null if empty to clear, else string trimmed
      const valTrim = form.value.trim()
      payload.value = valTrim ? valTrim : null

      const url = isEdit ? `/api/catalog/attribute-terms/${(initial as any).id}` : '/api/catalog/attribute-terms'
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

        {/* 1. Attribute Assignment */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Building className="w-4 h-4 text-[#eba236]" /> Attribute Assignment
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelCls}>Product attribute *</label>
              {attributesLoading ? (
                <div className="mt-1 h-[42px] bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse border border-gray-200 dark:border-[#262626]" />
              ) : attributesError ? (
                <div className="mt-1 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-600 dark:text-red-300">
                  {attributesError}
                </div>
              ) : (
                <select value={form.attribute_id} onChange={(e) => set('attribute_id', e.target.value)} className={inputCls}>
                  <option value="">Select an attribute…</option>
                  {attributes.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name} — {a.slug} ({a.type})
                    </option>
                  ))}
                </select>
              )}
              {selectedAttribute && (
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">
                  Selected: <span className="font-medium text-gray-900 dark:text-white">{selectedAttribute.name}</span>{' '}
                  <span className="font-mono">({selectedAttribute.slug})</span>{' '}
                  <span className="inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium border bg-gray-100 dark:bg-[#262626] capitalize">{selectedAttribute.type}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2. Term Information */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-600" /> Term Information
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>
                Name * <span className="text-gray-400 font-normal">(e.g. Small, Red, Vanilla)</span>
              </label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                onBlur={(e) => {
                  if (!form.slug.trim()) set('slug', slugify(e.target.value))
                }}
                placeholder="Red"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>
                Slug <span className="text-gray-400 font-normal">(auto from name if blank)</span>
              </label>
              <input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="red" className={`${inputCls} font-mono`} />
              <p className="text-xs text-gray-400 mt-1">
                Preview: <span className="font-mono text-gray-600 dark:text-white">{slugPreview || '—'}</span> — unique per attribute
              </p>
            </div>
          </div>
        </div>

        {/* 3. Value & Display */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#eba236]" /> Value & Display
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={isColor ? 'sm:col-span-2' : 'sm:col-span-2'}>
              <label className={labelCls}>
                Value{' '}
                <span className="text-gray-400 font-normal">{isColor ? '(hex color, e.g. #FF5733)' : '(optional display value)'}</span>
              </label>
              <div className="flex gap-2 mt-1">
                {isColor && (
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(form.value.trim()) ? form.value.trim() : '#eba236'}
                    onChange={(e) => set('value', e.target.value)}
                    className="h-[42px] w-[52px] rounded-lg border border-gray-200 dark:border-[#262626] p-1 bg-white dark:bg-[#0a0a0a] shrink-0"
                    title="Pick color"
                  />
                )}
                <input value={form.value} onChange={(e) => set('value', e.target.value)} placeholder={isColor ? '#FF5733' : 'e.g. #FFF or custom label'} className={`${inputCls} !mt-0 flex-1 ${isColor ? 'font-mono' : ''}`} />
              </div>
              {isColor && form.value.trim() && /^#[0-9A-Fa-f]{6}$/.test(form.value.trim()) && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="h-6 w-6 rounded-full border border-gray-200 dark:border-[#262626] shrink-0" style={{ backgroundColor: form.value.trim() }} />
                  <span className="text-xs font-mono text-gray-600 dark:text-white">{form.value.trim().toUpperCase()}</span>
                </div>
              )}
              {!isColor && <p className="text-xs text-gray-400 mt-1">For color attributes, value stores the hex code.</p>}
            </div>
          </div>
        </div>

        {/* 4. Ordering & Status */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-blue-600" /> Ordering & Status
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Sort order</label>
              <input type="number" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)} className={inputCls} placeholder="0" />
              <p className="text-xs text-gray-400 mt-1">Lower numbers appear first.</p>
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
                <span className="text-sm font-medium text-gray-700 dark:text-white flex items-center gap-1">
                  <ToggleLeft className="w-4 h-4 text-[#eba236]" /> Active
                </span>
              </label>
              <span className="text-xs text-gray-400">Inactive terms are hidden from catalog.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create term'}
        </button>
      </div>
    </div>
  )
}
