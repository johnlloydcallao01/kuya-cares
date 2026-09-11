'use client'

import React, { useEffect, useState } from 'react'
import { Building, Palette, Tag, AlertCircle, RefreshCw } from '@/components/ui/IconWrapper'

export type VariationOption = {
  id: number
  sku: string
  name: string | null
  product_id?: { id: number; name: string; slug: string } | number | null
  product?: { id: number; name: string; slug: string } | number | null
}

export type AttributeOption = { id: number; name: string; slug: string; type: string }
export type TermOption = { id: number; name: string; slug: string; value: string | null; attribute_id: number | null; attribute?: { id: number; name: string } | null }

export type VariationValueDoc = {
  id: number
  variation_id: number | null
  variation?: { id: number; sku: string; name: string | null; product: { id: number; name: string; slug: string } | number | null } | null
  attribute_id: number | null
  attribute?: { id: number; name: string; slug: string; type: string } | null
  term_id: number | null
  term?: { id: number; name: string; slug: string; value: string | null; attribute_id?: number | null } | null
  createdAt: string
  updatedAt: string
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400'
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'

export function VariationValueForm({
  initial,
  onSuccess,
  onCancel,
}: {
  initial?: VariationValueDoc | null
  onSuccess: () => void
  onCancel: () => void
}) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [variations, setVariations] = useState<VariationOption[]>([])
  const [variationsLoading, setVariationsLoading] = useState(true)
  const [attributes, setAttributes] = useState<AttributeOption[]>([])
  const [attributesLoading, setAttributesLoading] = useState(true)
  const [terms, setTerms] = useState<TermOption[]>([])
  const [termsLoading, setTermsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [form, setForm] = useState({
    variation_id: initial?.variation_id ? String(initial.variation_id) : '',
    attribute_id: initial?.attribute_id ? String(initial.attribute_id) : '',
    term_id: initial?.term_id ? String(initial.term_id) : '',
  })
  const set = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }))

  useEffect(() => {
    if (!initial) return
    setForm({
      variation_id: initial?.variation_id ? String(initial.variation_id) : '',
      attribute_id: initial?.attribute_id ? String(initial.attribute_id) : '',
      term_id: initial?.term_id ? String(initial.term_id) : '',
    })
    setError(null)
  }, [initial])

  // fetch variations
  useEffect(() => {
    let cancelled = false
    async function load() {
      setVariationsLoading(true)
      try {
        const res = await fetch(`/api/catalog/variations?limit=100&_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) {
          const txt = await res.text()
          try { const j = JSON.parse(txt); throw new Error(j.error || 'Failed to load variations') } catch { throw new Error(txt || 'Failed to load variations') }
        }
        const j = await res.json()
        const docs = (j.docs || []) as any[]
        if (!cancelled) setVariations(docs.map((d) => ({ id: d.id, sku: d.sku || '', name: d.name ?? null, product_id: d.product_id, product: d.product || d.product_id })))
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || 'Failed to load variations')
      } finally { if (!cancelled) setVariationsLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // fetch attributes
  useEffect(() => {
    let cancelled = false
    async function load() {
      setAttributesLoading(true)
      try {
        const res = await fetch(`/api/catalog/attributes?limit=100&_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) {
          const txt = await res.text()
          try { const j = JSON.parse(txt); throw new Error(j.error || 'Failed to load attributes') } catch { throw new Error(txt || 'Failed to load attributes') }
        }
        const j = await res.json()
        const docs = (j.docs || []) as AttributeOption[]
        if (!cancelled) setAttributes(docs)
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message || 'Failed to load attributes')
      } finally { if (!cancelled) setAttributesLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  // fetch terms filtered by selected attribute_id
  useEffect(() => {
    const attrId = form.attribute_id
    if (!attrId) { setTerms([]); return }
    let cancelled = false
    async function load() {
      setTermsLoading(true)
      try {
        const res = await fetch(`/api/catalog/attribute-terms?limit=100&attribute_id=${encodeURIComponent(attrId)}&_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) {
          const txt = await res.text()
          try { const j = JSON.parse(txt); throw new Error(j.error || 'Failed to load terms') } catch { throw new Error(txt || 'Failed to load terms') }
        }
        const j = await res.json()
        const docs = (j.docs || []) as any[]
        if (!cancelled) {
          setTerms(docs.map((d: any) => ({ id: d.id, name: d.name, slug: d.slug, value: d.value ?? null, attribute_id: d.attribute_id ?? d.attribute?.id ?? Number(attrId) })))
          // if current term_id not in filtered list, keep it but warn via validation
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load terms')
      } finally { if (!cancelled) setTermsLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [form.attribute_id])

  // for edit: ensure terms loaded even if attribute_id present on mount — handled above

  const selectedAttribute = attributes.find((a) => String(a.id) === String(form.attribute_id))
  const selectedTerm = terms.find((t) => String(t.id) === String(form.term_id))
  // also fallback to initial term value for swatch if editing and term not in filtered list
  const termForSwatch = selectedTerm || (initial?.term as any) || null
  const isHex = termForSwatch?.value ? /^#[0-9A-Fa-f]{6}$/.test(String(termForSwatch.value).trim()) : false
  const selectedVariation = variations.find((v) => String(v.id) === String(form.variation_id))

  const submit = async () => {
    setError(null)
    if (!form.variation_id || Number.isNaN(Number(form.variation_id))) return setError('Product variation is required')
    if (!form.attribute_id || Number.isNaN(Number(form.attribute_id))) return setError('Product attribute is required')
    if (!form.term_id || Number.isNaN(Number(form.term_id))) return setError('Attribute term is required')
    // client check: term belongs to attribute
    if (selectedTerm && String(selectedTerm.attribute_id) !== String(form.attribute_id)) {
      return setError('Selected term does not belong to the selected attribute')
    }
    // also if we have fetched terms and term not in list but attribute mismatch, allow server to validate — warn
    // but if terms loaded and selected term not found, it could be stale; we still send
    setSaving(true)
    try {
      const payload: any = {
        variation_id: Number(form.variation_id),
        attribute_id: Number(form.attribute_id),
        term_id: Number(form.term_id),
      }
      const url = isEdit ? `/api/catalog/variation-values/${(initial as any).id}` : '/api/catalog/variation-values'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = j.error || j.details || 'Request failed'
        // surface duplicate code nicely
        if (j.code === 'DUPLICATE_ATTRIBUTE_FOR_VARIATION' || String(msg).toLowerCase().includes('duplicate')) {
          throw new Error(j.error || 'Duplicate attribute for this variation — each variation can have only one value per attribute')
        }
        throw new Error(msg)
      }
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
        {loadError && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {loadError}
          </div>
        )}

        {/* 1. Variation & Attribute */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Building className="w-4 h-4 text-[#eba236]" /> Variation &amp; Attribute
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Product variation * <span className="text-gray-400 font-normal">(SKU + product)</span></label>
              {variationsLoading ? (
                <div className="mt-1 h-[42px] bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse border border-gray-200 dark:border-[#262626]" />
              ) : (
                <select value={form.variation_id} onChange={(e) => set('variation_id', e.target.value)} className={inputCls}>
                  <option value="">Select variation…</option>
                  {variations.map((v) => {
                    const prod = (v.product || v.product_id) as any
                    const prodLabel = typeof prod === 'object' && prod ? prod.name || prod.slug || `#${prod.id}` : prod ? `#${prod}` : ''
                    return (
                      <option key={v.id} value={String(v.id)}>
                        {v.sku ? `${v.sku}` : `VAR #${v.id}`} {v.name ? `— ${v.name}` : ''} {prodLabel ? `(${prodLabel})` : ''}
                      </option>
                    )
                  })}
                </select>
              )}
              {selectedVariation && (
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">Selected: <span className="font-mono font-medium text-gray-900 dark:text-white">{selectedVariation.sku || `#${selectedVariation.id}`}</span> {selectedVariation.name ? `— ${selectedVariation.name}` : ''}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Product attribute *</label>
              {attributesLoading ? (
                <div className="mt-1 h-[42px] bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse border border-gray-200 dark:border-[#262626]" />
              ) : (
                <select value={form.attribute_id} onChange={(e) => { set('attribute_id', e.target.value); set('term_id', '') }} className={inputCls}>
                  <option value="">Select attribute…</option>
                  {attributes.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name} — {a.slug} ({a.type})
                    </option>
                  ))}
                </select>
              )}
              {selectedAttribute && (
                <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">
                  Selected: <span className="font-medium text-gray-900 dark:text-white">{selectedAttribute.name}</span> <span className="font-mono">({selectedAttribute.slug})</span> <span className="inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium border bg-gray-100 dark:bg-[#262626] capitalize">{selectedAttribute.type}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 2. Term Selection */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-600" /> Term Selection
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className={labelCls}>Attribute term * <span className="text-gray-400 font-normal">(filtered by attribute)</span></label>
              {!form.attribute_id ? (
                <div className="mt-1 p-3 rounded-lg bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-xs text-gray-500">Select a product attribute first to load terms.</div>
              ) : termsLoading ? (
                <div className="mt-1 h-[42px] bg-gray-100 dark:bg-[#0a0a0a] rounded-lg animate-pulse border border-gray-200 dark:border-[#262626]" />
              ) : (
                <select value={form.term_id} onChange={(e) => set('term_id', e.target.value)} className={inputCls} disabled={!form.attribute_id}>
                  <option value="">Select term…</option>
                  {terms.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {t.name} — {t.slug} {t.value ? `(${t.value})` : ''}
                    </option>
                  ))}
                </select>
              )}
              {terms.length === 0 && form.attribute_id && !termsLoading && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">No terms found for this attribute. Create a term in Catalog → Attribute Terms first.</p>
              )}
              {selectedTerm && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Selected:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{selectedTerm.name}</span>
                  <span className="text-xs font-mono text-gray-500">({selectedTerm.slug})</span>
                  {selectedTerm.value && (
                    <span className="inline-flex items-center gap-1.5">
                      {isHex && <span className="h-5 w-5 rounded-full border border-gray-200 dark:border-[#333] shrink-0" style={{ backgroundColor: String(selectedTerm.value) }} />}
                      <span className={`text-xs ${isHex ? 'font-mono font-medium text-gray-900 dark:text-white' : 'text-gray-600'}`}>{String(selectedTerm.value)}</span>
                    </span>
                  )}
                </div>
              )}
              {/* Show swatch for initial term even if not in filtered list (edit mode) */}
              {!selectedTerm && termForSwatch?.value && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Value:</span>
                  {isHex && <span className="h-5 w-5 rounded-full border border-gray-200 dark:border-[#333] shrink-0" style={{ backgroundColor: String(termForSwatch.value) }} />}
                  <span className="text-xs font-mono text-gray-700 dark:text-white">{String(termForSwatch.value)}</span>
                </div>
              )}
            </div>
            {selectedTerm?.value && isHex && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626]">
                <Palette className="w-4 h-4 text-[#eba236]" />
                <span className="h-8 w-8 rounded-full border border-gray-200 dark:border-[#333] shrink-0" style={{ backgroundColor: String(selectedTerm.value) }} />
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-white">Swatch preview</p>
                  <p className="text-xs font-mono text-gray-500">{String(selectedTerm.value).toUpperCase()}</p>
                </div>
              </div>
            )}
            {!selectedTerm && termForSwatch?.value && isHex && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626]">
                <Palette className="w-4 h-4 text-[#eba236]" />
                <span className="h-8 w-8 rounded-full border border-gray-200 dark:border-[#333] shrink-0" style={{ backgroundColor: String(termForSwatch.value) }} />
                <div>
                  <p className="text-xs font-medium text-gray-700 dark:text-white">Swatch preview</p>
                  <p className="text-xs font-mono text-gray-500">{String(termForSwatch.value).toUpperCase()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create value'}
        </button>
      </div>
    </div>
  )
}
