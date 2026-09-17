'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Hash, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  Layers, Tag, Building, Palette, Calendar, Link as LinkIcon
} from '@/components/ui/IconWrapper'

type AttributeBrief = { id: number; name: string; slug: string; type: string }
type TermBrief = { id: number; name: string; slug: string; value: string | null; attribute_id: number }
type ProductBrief = { id: number; name: string; slug: string }
type VariationBrief = { id: number; sku: string; name: string | null; product: ProductBrief | number | null }

type VariationValueDoc = {
  id: number
  variation_id: number | null
  variation: VariationBrief | null
  attribute_id: number | null
  attribute: AttributeBrief | null
  term_id: number | null
  term: TermBrief | null
  createdAt: string
  updatedAt: string
}

type Stats = { total: number; filteredTotal: number; perVariation: Record<string, number>; perAttribute: Record<string, number>; perTerm: Record<string, number> }

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'variation_id', label: 'Variation' },
  { value: 'attribute_id', label: 'Attribute' },
  { value: 'term_id', label: 'Term' },
]

function typeBadge(type: string) {
  const t = type.toLowerCase()
  if (t === 'color') return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800'
  if (t === 'button') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (t === 'radio') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
}

function variationLabel(v: VariationBrief | null): string {
  if (!v) return '—'
  return v.name || v.sku || `#${v.id}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}

function KpiCard({ title, value, sub, icon, iconBg }: { title: string; value: string; sub?: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] truncate">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      </div>
    </div>
  )
}

function ValuesSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-56 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="h-16 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function ValuesContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [variationFilter, setVariationFilter] = useState<string>('')
  const [attributeFilter, setAttributeFilter] = useState<string>('')
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<VariationValueDoc[]>([])
  const [variations, setVariations] = useState<VariationBrief[]>([])
  const [attributes, setAttributes] = useState<AttributeBrief[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 400)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, variationFilter, attributeFilter, sort])

  const activeFilterCount = useMemo(() => (variationFilter ? 1 : 0) + (attributeFilter ? 1 : 0) + (debouncedQ ? 1 : 0), [variationFilter, attributeFilter, debouncedQ])

  const load = async (opts?: { hard?: boolean }) => {
    if (opts?.hard) {
      setDocs([])
      setStats(null)
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (debouncedQ) qs.set('search', debouncedQ)
      if (variationFilter) qs.set('variationId', variationFilter)
      if (attributeFilter) qs.set('attributeId', attributeFilter)
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/catalog/variation-values?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load variation values')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setVariations(Array.isArray(j.variations) ? j.variations : [])
      setAttributes(Array.isArray(j.attributes) ? j.attributes : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load variation values')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, variationFilter, attributeFilter, sort, page])

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setVariationFilter('')
    setAttributeFilter('')
  }

  const perAttrTop = useMemo(() => {
    if (!stats) return []
    return Object.entries(stats.perAttribute || {})
      .map(([id, count]) => ({ id: Number(id), count, label: attributes.find((a) => a.id === Number(id))?.name || `Attr #${id}` }))
      .sort((a, b) => b.count - a.count)
  }, [stats, attributes])

  const perVariationTop = useMemo(() => {
    if (!stats) return []
    return Object.entries(stats.perVariation || {})
      .map(([id, count]) => ({ id: Number(id), count, label: variations.find((v) => v.id === Number(id))?.name || variations.find((v) => v.id === Number(id))?.sku || `Var #${id}` }))
      .sort((a, b) => b.count - a.count)
  }, [stats, variations])

  const totalPages = Math.max(1, pagination?.totalPages ?? 1)

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><LinkIcon className="w-4 h-4" /></span>
            Variation Values
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Attribute & term links that describe each of your variations — read-only.</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh variation values"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Values" value={String(stats.filteredTotal)} sub={`${stats.total} matching filters`} icon={<Hash className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
          <KpiCard title="Per Attribute" value={perAttrTop[0] ? `${perAttrTop[0].count} values` : '—'} sub={perAttrTop[0]?.label || perAttrTop.map((p) => `${p.label}:${p.count}`).join(' • ') || 'no breakdown'} icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Per Variation" value={perVariationTop[0] ? `${perVariationTop[0].count} vals` : '—'} sub={perVariationTop[0]?.label || perVariationTop.map((p) => `${p.label}:${p.count}`).join(' • ') || 'no breakdown'} icon={<Building className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Per Term" value={String(Object.keys(stats.perTerm || {}).length)} sub={`${Object.values(stats.perTerm || {}).reduce((a, b) => a + (b as number), 0)} links`} icon={<Palette className="w-5 h-5 text-white" />} iconBg="bg-zinc-500" />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : null}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search term name, slug, value…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
              {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => setShowFilters((v) => !v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${activeFilterCount ? 'bg-[#239459] hover:bg-[#215035] text-white border-[#239459]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#239459]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {activeFilterCount > 0 && <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">Clear all</button>}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Variation</p>
              <select value={variationFilter} onChange={(e) => setVariationFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                <option value="">All your variations</option>
                {variations.map((v) => <option key={v.id} value={String(v.id)}>{v.name || v.sku || `#${v.id}`}</option>)}
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Attribute</p>
              <select value={attributeFilter} onChange={(e) => setAttributeFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                <option value="">All attributes</option>
                {attributes.map((a) => <option key={a.id} value={String(a.id)}>{a.name} ({a.slug})</option>)}
              </select>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-xs font-medium border border-[#239459]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {variationFilter && (() => { const v = variations.find((x) => String(x.id) === variationFilter); return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">var: {v ? variationLabel(v) : variationFilter} <button onClick={() => setVariationFilter('')}><X className="w-3 h-3" /></button></span> })()}
            {attributeFilter && (() => { const a = attributes.find((x) => String(x.id) === attributeFilter); return <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">attr: {a ? a.name : attributeFilter} <button onClick={() => setAttributeFilter('')}><X className="w-3 h-3" /></button></span> })()}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load variation values</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 bg-[#239459]/10 dark:bg-[#239459]/15 rounded-full flex items-center justify-center mb-4"><Layers className="w-7 h-7 text-[#239459]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No variation values found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Your variations have no attribute-term links yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Variation</th>
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                    <th className="text-left px-4 py-3 font-medium">Attribute</th>
                    <th className="text-left px-4 py-3 font-medium">Term</th>
                    <th className="text-left px-4 py-3 font-medium">Term Value</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((v) => {
                    const termVal = v.term?.value
                    const isHex = termVal ? /^#[0-9A-Fa-f]{6}$/.test(termVal) : false
                    return (
                      <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                        <td className="px-4 py-3">
                          <div className="min-w-[150px]">
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
                              <Layers className="w-3 h-3 text-[#239459] shrink-0" /> {variationLabel(v.variation)}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono">{v.variation?.sku || `#${v.variation_id ?? '—'}`}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-gray-700 dark:text-[#a1a1aa] truncate max-w-[140px] inline-block">
                            {v.variation?.product ? (typeof v.variation.product === 'number' ? `#${v.variation.product}` : v.variation.product.name || `#${v.variation.product.id}`) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {v.attribute ? (
                            <div className="min-w-[120px]">
                              <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{v.attribute.name}</div>
                              <div className="text-[11px] text-gray-500 font-mono">{v.attribute.slug}</div>
                              <span className={`inline-flex mt-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${typeBadge(v.attribute.type)}`}>{v.attribute.type}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 font-mono">#{v.attribute_id ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {v.term ? (
                            <div className="min-w-[120px]">
                              <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{v.term.name}</div>
                              <div className="text-[11px] text-gray-500 font-mono">{v.term.slug}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 font-mono">#{v.term_id ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {termVal ? (
                            <span className="inline-flex items-center gap-2">
                              {isHex && <span className="h-5 w-5 rounded-full border border-gray-200 dark:border-[#333] shrink-0" style={{ backgroundColor: termVal }} />}
                              <span className={`text-xs ${isHex ? 'font-mono font-medium text-gray-900 dark:text-white' : 'font-mono text-gray-700 dark:text-[#a1a1aa]'}`}>{termVal}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{fmtDate(v.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {docs.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? docs.length} values • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                    if (n > totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === page ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
        Values link <Link href="/catalog/variations" className="font-semibold text-[#239459] hover:text-[#215035]">Variations</Link> to shared <Link href="/catalog/attributes" className="font-semibold text-[#239459] hover:text-[#215035]">Attributes</Link> and <Link href="/catalog/attribute-terms" className="font-semibold text-[#239459] hover:text-[#215035]">Attribute Terms</Link>.
      </div>
    </div>
  )
}

export default function CatalogVariationValuesPage() {
  return (
    <ClientOnly fallback={<ValuesSkeleton />}>
      <ValuesContent />
    </ClientOnly>
  )
}