'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Layers, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  CheckCircle, Building, Package, Tag, Activity
} from '@/components/ui/IconWrapper'

type MerchantProductBrief = { id: number; display_title: string | null }
type VariationBrief = { id: number; name: string | null; sku: string }
type GroupBrief = { id: number; name: string }

type OverrideDoc = {
  id: number
  merchant_product_id: MerchantProductBrief | number | null
  merchant_product?: MerchantProductBrief | number | null
  variation_id: VariationBrief | number | null
  variation?: VariationBrief | number | null
  target_group_source: string
  base_modifier_group_id: GroupBrief | number | null
  base_modifier_group?: GroupBrief | number | null
  variation_modifier_group_id: GroupBrief | number | null
  variation_modifier_group?: GroupBrief | number | null
  mode: string
  name_override: string | null
  selection_type_override: string | null
  required_behavior: string
  min_selections_override: number | null
  max_selections_override: number | null
  sort_order_override: number | null
  is_active: boolean
  createdAt: string
  updatedAt: string
}

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

type Stats = {
  total: number; filteredTotal: number;
  modeBreakdown: Record<string, number>;
  sourceBreakdown: Record<string, number>;
  requiredBehaviorBreakdown: Record<string, number>;
  activeCount: number; inactiveCount: number;
}

const TARGET_OPTS = [
  { value: 'product_base', label: 'Product Base' },
  { value: 'variation_added', label: 'Variation Added' },
]
const MODE_OPTS = [
  { value: 'inherit', label: 'Inherit' },
  { value: 'hide', label: 'Hide' },
  { value: 'override', label: 'Override' },
]

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'name_override', label: 'Name A–Z' },
  { value: 'sort_order_override', label: 'Sort order' },
  { value: 'merchant_product_id', label: 'Merchant Product' },
]

function modeBadge(m: string) {
  const v = m.toLowerCase()
  if (v === 'inherit') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (v === 'hide') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
}
function sourceBadge(s: string) {
  const v = s.toLowerCase()
  if (v === 'product_base') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
  return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300'
}
function sourceLabel(s: string) {
  return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
function merchantProductLabel(v: OverrideDoc['merchant_product_id']): string {
  if (!v) return '—'
  if (typeof v === 'number') return `#${v}`
  return (v as any).display_title ? `${(v as any).display_title} (#${(v as any).id})` : `#${(v as any).id}`
}
function variationLabel(v: OverrideDoc['variation_id']): string {
  if (!v) return '—'
  if (typeof v === 'number') return `#${v}`
  const anyV = v as any
  return anyV.name ? `${anyV.name} (#${anyV.id})` : anyV.sku ? `${anyV.sku} (#${anyV.id})` : `#${anyV.id}`
}
function groupLabel(g: OverrideDoc['base_modifier_group_id'] | OverrideDoc['variation_modifier_group_id']): string {
  if (!g) return '—'
  if (typeof g === 'number') return `#${g}`
  return (g as any).name || `#${(g as any).id}`
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

function OverridesSkeleton() {
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

function OverridesContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [merchantProductFilter, setMerchantProductFilter] = useState('')
  const [variationFilter, setVariationFilter] = useState('')
  const [baseGroupFilter, setBaseGroupFilter] = useState('')
  const [variationGroupFilter, setVariationGroupFilter] = useState('')
  const [targetFilter, setTargetFilter] = useState<string[]>([])
  const [modeFilter, setModeFilter] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<OverrideDoc[]>([])
  const [merchantProducts, setMerchantProducts] = useState<{ id: number; display_title: string; product_id: number | null }[]>([])
  const [variations, setVariations] = useState<{ id: number; name: string; sku: string; product_id: number | null }[]>([])
  const [baseGroups, setBaseGroups] = useState<{ id: number; name: string; product_id: number | null }[]>([])
  const [variationGroups, setVariationGroups] = useState<{ id: number; name: string; variation_id: number | null }[]>([])
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
  }, [debouncedQ, merchantProductFilter, variationFilter, baseGroupFilter, variationGroupFilter, targetFilter, modeFilter, activeFilter, sort])

  const activeFilterCount = useMemo(
    () => (merchantProductFilter ? 1 : 0) + (variationFilter ? 1 : 0) + (baseGroupFilter ? 1 : 0) + (variationGroupFilter ? 1 : 0) + targetFilter.length + modeFilter.length + activeFilter.length + (debouncedQ ? 1 : 0),
    [merchantProductFilter, variationFilter, baseGroupFilter, variationGroupFilter, targetFilter, modeFilter, activeFilter, debouncedQ],
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
      if (merchantProductFilter) qs.set('merchant_product_id', merchantProductFilter)
      if (variationFilter) qs.set('variation_id', variationFilter)
      if (baseGroupFilter) qs.set('base_modifier_group_id', baseGroupFilter)
      if (variationGroupFilter) qs.set('variation_modifier_group_id', variationGroupFilter)
      if (targetFilter.length) qs.set('target_group_source', targetFilter.join(','))
      if (modeFilter.length) qs.set('mode', modeFilter.join(','))
      if (activeFilter.length === 1) qs.set('is_active', activeFilter[0])
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/catalog/merchant-variation-modifier-group-overrides?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load overrides')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setMerchantProducts(Array.isArray(j.merchant_products) ? j.merchant_products : [])
      setVariations(Array.isArray(j.variations) ? j.variations : [])
      setBaseGroups(Array.isArray(j.base_groups) ? j.base_groups : [])
      setVariationGroups(Array.isArray(j.variation_groups) ? j.variation_groups : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load overrides')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, merchantProductFilter, variationFilter, baseGroupFilter, variationGroupFilter, targetFilter, modeFilter, activeFilter, sort, page])

  const toggleTarget = (v: string) => setTargetFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const toggleMode = (v: string) => setModeFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const toggleActive = (v: string) => setActiveFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setMerchantProductFilter('')
    setVariationFilter('')
    setBaseGroupFilter('')
    setVariationGroupFilter('')
    setTargetFilter([])
    setModeFilter([])
    setActiveFilter([])
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (targetFilter.length > 1) arr = arr.filter((d) => targetFilter.includes(d.target_group_source.toLowerCase()))
    if (modeFilter.length > 1) arr = arr.filter((d) => modeFilter.includes(d.mode.toLowerCase()))
    if (activeFilter.length > 1) arr = arr.filter((d) => activeFilter.includes(String(d.is_active)))
    return arr
  }, [docs, targetFilter, modeFilter, activeFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Building className="w-4 h-4" /></span>
            Merchant Variation Modifier Group Overrides
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Per-listing, per-variation rules that inherit, hide or override a base or variation-added modifier group (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh overrides"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Overrides" value={String(stats.filteredTotal)} sub={`${stats.total} matching filters`} icon={<Building className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Inherit" value={String(stats.modeBreakdown.inherit || 0)} sub={`${stats.modeBreakdown.hide || 0} hide`} icon={<Activity className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Override" value={String(stats.modeBreakdown.override || 0)} sub={`${stats.sourceBreakdown.variation_added || 0} variation-added`} icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Active" value={String(stats.activeCount)} sub={`${stats.inactiveCount} inactive`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name override…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Merchant Product</p>
                <select value={merchantProductFilter} onChange={(e) => setMerchantProductFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  <option value="">All your merchant products</option>
                  {merchantProducts.map((mp) => <option key={mp.id} value={String(mp.id)}>{mp.display_title} (#{mp.id})</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Variation</p>
                <select value={variationFilter} onChange={(e) => setVariationFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  <option value="">All your variations</option>
                  {variations.map((v) => <option key={v.id} value={String(v.id)}>{v.name} (#{v.id})</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Base Group (product-level)</p>
                <select value={baseGroupFilter} onChange={(e) => setBaseGroupFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  <option value="">All your product groups</option>
                  {baseGroups.map((g) => <option key={g.id} value={String(g.id)}>{g.name} (#{g.id})</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Variation Group (variation-added)</p>
                <select value={variationGroupFilter} onChange={(e) => setVariationGroupFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  <option value="">All your variation groups</option>
                  {variationGroups.map((g) => <option key={g.id} value={String(g.id)}>{g.name} (#{g.id})</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FilterPills label="Target Source" options={TARGET_OPTS} value={targetFilter} onToggle={toggleTarget} />
              <FilterPills label="Mode" options={MODE_OPTS} value={modeFilter} onToggle={toggleMode} />
              <FilterPills label="Active" options={[{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }]} value={activeFilter} onToggle={toggleActive} />
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {merchantProductFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{merchantProducts.find((mp) => String(mp.id) === merchantProductFilter)?.display_title || `Merchant Product #${merchantProductFilter}`} <button onClick={() => setMerchantProductFilter('')}><X className="w-3 h-3" /></button></span>}
            {variationFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{variations.find((v) => String(v.id) === variationFilter)?.name || `Variation #${variationFilter}`} <button onClick={() => setVariationFilter('')}><X className="w-3 h-3" /></button></span>}
            {baseGroupFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">base: {baseGroups.find((g) => String(g.id) === baseGroupFilter)?.name || `#${baseGroupFilter}`} <button onClick={() => setBaseGroupFilter('')}><X className="w-3 h-3" /></button></span>}
            {variationGroupFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">variation: {variationGroups.find((g) => String(g.id) === variationGroupFilter)?.name || `#${variationGroupFilter}`} <button onClick={() => setVariationGroupFilter('')}><X className="w-3 h-3" /></button></span>}
            {targetFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">source: {v.replace('_', ' ')} <button onClick={() => toggleTarget(v)}><X className="w-3 h-3" /></button></span>)}
            {modeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">mode: {v} <button onClick={() => toggleMode(v)}><X className="w-3 h-3" /></button></span>)}
            {activeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'true' ? 'Active only' : 'Inactive only'} <button onClick={() => toggleActive(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load overrides</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-full flex items-center justify-center mb-4"><Building className="w-7 h-7 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No overrides found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Your merchant products have no variation modifier group overrides yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Merchant Product</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Variation</th>
                    <th className="text-left px-4 py-3 font-medium">Target Source</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Base / Variation Group</th>
                    <th className="text-left px-4 py-3 font-medium">Mode</th>
                    <th className="text-left px-4 py-3 font-medium">Active</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white"><Building className="w-3 h-3 text-[#eba236]" /> {merchantProductLabel(d.merchant_product_id)}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white"><Package className="w-3 h-3 text-[#eba236]" /> {variationLabel(d.variation_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${sourceBadge(d.target_group_source)}`}>{sourceLabel(d.target_group_source)}</span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white"><Layers className="w-3 h-3 text-[#eba236]" /> {d.target_group_source === 'product_base' ? groupLabel(d.base_modifier_group_id) : groupLabel(d.variation_modifier_group_id)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border capitalize ${modeBadge(d.mode)}`}>{d.mode}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${d.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          <span className={`h-2 w-2 rounded-full ${d.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} /> {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{fmtDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? filtered.length} overrides • 10 per page</div>
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
        Overrides apply per <span className="font-semibold text-gray-700 dark:text-white">Merchant Product</span> + <span className="font-semibold text-gray-700 dark:text-white">Variation</span>. <span className="font-semibold text-gray-700 dark:text-white">Product Base</span> targets inherited product-level groups; <span className="font-semibold text-gray-700 dark:text-white">Variation Added</span> targets groups owned by the variation. Chip-companion pages: <Link href="/catalog/merchant-product-modifier-group-overrides" className="font-semibold text-[#eba236] hover:text-[#c88a20]">product group overrides</Link> and their <Link href="/catalog/merchant-variation-modifier-option-overrides" className="font-semibold text-[#eba236] hover:text-[#c88a20]">variation option overrides</Link>.
      </div>
    </div>
  )
}

export default function CatalogMerchantVariationModifierGroupOverridesPage() {
  return (
    <ClientOnly fallback={<OverridesSkeleton />}>
      <OverridesContent />
    </ClientOnly>
  )
}