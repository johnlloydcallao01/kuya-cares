'use client'

import React, { useState, useEffect } from 'react'
import { Building, AlertCircle, RefreshCw } from '@/components/ui/IconWrapper'

export const ATTRIBUTE_TYPE_OPTS: { value: string; label: string }[] = [
  { value: 'select', label: 'Select' },
  { value: 'color', label: 'Color' },
  { value: 'button', label: 'Button' },
  { value: 'radio', label: 'Radio' },
]

export type AttributeDoc = {
  id: number
  name: string
  slug: string
  type: string
  is_active: boolean
  createdAt: string
  updatedAt: string
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
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

export function AttributeForm({ initial, onSuccess, onCancel }: { initial?: AttributeDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: initial?.name || '',
    slug: initial?.slug || '',
    type: initial?.type || 'select',
    is_active: initial?.is_active ?? true,
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      name: initial?.name || '',
      slug: initial?.slug || '',
      type: initial?.type || 'select',
      is_active: initial?.is_active ?? true,
    })
    setError(null)
  }, [initial])

  const slugPreview = form.slug.trim() ? form.slug.trim().toLowerCase() : slugify(form.name)

  const submit = async () => {
    setError(null)
    const name = form.name.trim()
    if (!name || name.length < 2) return setError('Name is required (min 2 chars)')
    if (name.length > 100) return setError('Name must be at most 100 characters')
    if (!ATTRIBUTE_TYPE_OPTS.some((o) => o.value === form.type)) return setError('Type must be one of: select, color, button, radio')
    const slugVal = form.slug.trim().toLowerCase()
    if (slugVal) {
      if (slugVal.length > 100) return setError('Slug must be at most 100 characters')
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugVal)) return setError('Slug must be lowercase alphanumeric with hyphens (e.g. my-attribute)')
    }

    setSaving(true)
    try {
      const payload: any = {
        name,
        type: form.type,
        is_active: form.is_active,
      }
      // only send slug if user provided one explicitly; otherwise let hook auto-generate from name
      if (slugVal) payload.slug = slugVal
      else if (!isEdit) {
        // for create, if no slug provided, hook will generate — still send name only; but include slug derived for preview
        // don't send empty slug
      } else {
        // edit without slug change: don't send slug to avoid overwriting
      }

      const url = isEdit ? `/api/catalog/attributes/${(initial as any).id}` : '/api/catalog/attributes'
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
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Basic Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Name * <span className="text-gray-400 font-normal">(e.g. Size, Color, Flavor)</span></label><input value={form.name} onChange={(e) => set('name', e.target.value)} onBlur={(e) => { if (!form.slug.trim()) set('slug', slugify(e.target.value)) }} placeholder="Color" className={inputCls} /></div>
            <div>
              <label className={labelCls}>Slug <span className="text-gray-400 font-normal">(auto from name if blank)</span></label>
              <input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="color" className={`${inputCls} font-mono`} />
              <p className="text-xs text-gray-400 mt-1">Preview: <span className="font-mono text-gray-600 dark:text-white">{slugPreview || '—'}</span></p>
            </div>
            <div>
              <label className={labelCls}>Type *</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
                {ATTRIBUTE_TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
                <span className="text-sm font-medium text-gray-700 dark:text-white">Active</span>
              </label>
              <span className="text-xs text-gray-400">Inactive attributes are hidden from product forms.</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create attribute'}
        </button>
      </div>
    </div>
  )
}
