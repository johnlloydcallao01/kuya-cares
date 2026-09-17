'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Layers, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  CheckCircle, XCircle, Activity, Tag, Package
} from '@/components/ui/IconWrapper'

type VariationBrief = { id: number; name: string | null; sku: string }

type VariationModifierGroupDoc = {
  id: number
  variation_id: VariationBrief | number | null
  variation?: VariationBrief | number | null
  name: string
  selection_type: string
  is_required: boolean
  min_selections: number
  max_selections: number | null
  sort_order: number
  is_active: boolean
  createdAt: string
  updatedAt: string
}

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

type Stats = { total: number; filteredTotal: number; selectionBreakdown: Record<string, number>; requiredCount: number; optionalCount: number; activeCount: number; inactiveCount: number }

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'sort_order', label: 'Sort order' },
  { value: 'variation_id', label: 'Variation' },
]

function selectionBadge(type: string) {
  const t = type.toLowerCase()
  if (t === 'multiple') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
}

function variationLabel(v: VariationModifierGroupDoc['variation_id']): string {
  if (!v) return '—'
  if (typeof v === 'number') return `#${v}`
  const name = ((v as any).name as string) || ''
  return name ? `${name} (#${(v as any).id})` : `#${(v as any).id}`
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

function FilterPills({ label, options, value, onToggle }: { label: string; options: { value: string; label: string }[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => onToggle(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GroupsSkeleton() {
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

function GroupsContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [variationFilter, setVariationFilter] = useState<string>('')
  const [selectionFilter, setSelectionFilter] = useState<string[]>([])
  const [requiredFilter, setRequiredFilter] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<VariationModifierGroupDoc[]>([])
  const [variations, setVariations] = useState<{ id: number; name: string; sku: string; product_id: number | null }[]>([])
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
  }, [debouncedQ, variationFilter, selectionFilter, requiredFilter, activeFilter, sort])

  const activeFilterCount = useMemo(
    () => (variationFilter ? 1 : 0) + selectionFilter.length + requiredFilter.length + activeFilter.length + (debouncedQ ? 1 : 0),
    [variationFilter, selectionFilter, requiredFilter, activeFilter, debouncedQ],
  )

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
      if (variationFilter) qs.set('variation_id', variationFilter)
      if (selectionFilter.length === 1) qs.set('selection_type', selectionFilter[0])
      if (requiredFilter.length === 1) qs.set('is_required', requiredFilter[0])
      if (activeFilter.length === 1) qs.set('is_active', activeFilter[0])
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/catalog/variation-modifier-groups?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load variation modifier groups')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setVariations(Array.isArray(j.variations) ? j.variations : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load variation modifier groups')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, variationFilter, selectionFilter, requiredFilter, activeFilter, sort, page])

  const toggleSelection = (v: string) => setSelectionFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const toggleRequired = (v: string) => setRequiredFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const toggleActive = (v: string) => setActiveFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setVariationFilter('')
    setSelectionFilter([])
    setRequiredFilter([])
    setActiveFilter([])
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (selectionFilter.length > 1) arr = arr.filter((g) => selectionFilter.includes(g.selection_type.toLowerCase()))
    if (requiredFilter.length > 1) arr = arr.filter((g) => requiredFilter.includes(String(g.is_required)))
    if (activeFilter.length > 1) arr = arr.filter((g) => activeFilter.includes(String(g.is_active)))
    return arr
  }, [docs, selectionFilter, requiredFilter, activeFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Layers className="w-4 h-4" /></span>
            Variation Modifier Groups
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Add-on groups configured per variation of your products — how many selections a customer can make (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh variation modifier groups"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Groups" value={String(stats.filteredTotal)} sub={`${stats.total} matching filters`} icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Required" value={String(stats.requiredCount)} sub={`${stats.optionalCount} optional`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Active" value={String(stats.activeCount)} sub={`${stats.inactiveCount} inactive`} icon={<Activity className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="By Type" value={`${stats.selectionBreakdown.single || 0} single`} sub={`${stats.selectionBreakdown.multiple || 0} multiple`} icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-purple-600" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search group name…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
              {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => setShowFilters((v) => !v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${activeFilterCount ? 'bg-[#eba236] hover:bg-[#c88a20] text-white border-[#eba236]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
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
                {variations.map((v) => <option key={v.id} value={String(v.id)}>{v.name} (#{v.id})</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-6">
            <FilterPills label="Selection Type" options={[{ value: 'single', label: 'Single' }, { value: 'multiple', label: 'Multiple' }]} value={selectionFilter} onToggle={toggleSelection} />
            <FilterPills label="Requirement" options={[{ value: 'true', label: 'Required' }, { value: 'false', label: 'Optional' }]} value={requiredFilter} onToggle={toggleRequired} />
            <FilterPills label="Status" options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} value={activeFilter} onToggle={toggleActive} />
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {variationFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{variations.find((v) => String(v.id) === variationFilter)?.name || `Variation #${variationFilter}`} <button onClick={() => setVariationFilter('')}><X className="w-3 h-3" /></button></span>}
            {selectionFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'single' ? 'Single' : 'Multiple'} <button onClick={() => toggleSelection(v)}><X className="w-3 h-3" /></button></span>)}
            {requiredFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'true' ? 'Required only' : 'Optional only'} <button onClick={() => toggleRequired(v)}><X className="w-3 h-3" /></button></span>)}
            {activeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'true' ? 'Active only' : 'Inactive only'} <button onClick={() => toggleActive(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load variation modifier groups</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-full flex items-center justify-center mb-4"><Layers className="w-7 h-7 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No variation modifier groups found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Your variations have no modifier groups yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Group</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Variation</th>
                    <th className="text-left px-4 py-3 font-medium">Selection</th>
                    <th className="text-left px-4 py-3 font-medium">Required</th>
                    <th className="text-left px-4 py-3 font-medium">Active</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Min / Max</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Sort</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[160px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0"><Layers className="w-4 h-4" /></div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{g.name}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] font-mono truncate max-w-[180px]">#{g.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white"><Package className="w-3 h-3 text-[#eba236]" /> {variationLabel(g.variation_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border capitalize ${selectionBadge(g.selection_type)}`}>{g.selection_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${g.is_required ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          <span className={`h-2 w-2 rounded-full ${g.is_required ? 'bg-emerald-500' : 'bg-zinc-400'}`} /> {g.is_required ? 'Required' : 'Optional'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${g.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300'}`}>
                          {g.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />} {g.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-600 dark:text-[#a1a1aa]">{g.min_selections} / {g.max_selections ?? '∞'}</td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{g.sort_order}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{fmtDate(g.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? filtered.length} groups • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                    if (n > totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === page ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
        Groups bundle add-on choices from <Link href="/catalog/variation-modifier-options" className="font-semibold text-[#eba236] hover:text-[#c88a20]">Variation Modifier Options</Link>, configured per variation so customers at each variant of your product see the right add-ons.
      </div>
    </div>
  )
}

export default function CatalogVariationModifierGroupsPage() {
  return (
    <ClientOnly fallback={<GroupsSkeleton />}>
      <GroupsContent />
    </ClientOnly>
  )
}