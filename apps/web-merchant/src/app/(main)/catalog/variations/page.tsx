'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Package, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  CheckCircle, Layers, Calendar, DollarSign, Eye, EyeOff, XCircle
} from '@/components/ui/IconWrapper'

const MODE_OPTS: { value: string; label: string }[] = [
  { value: 'inherit_product', label: 'Inherit' },
  { value: 'variation_specific', label: 'Variation Only' },
  { value: 'hybrid', label: 'Hybrid' },
]

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
  { value: '-name', label: 'Name Z–A' },
  { value: 'base_price', label: 'Price low–high' },
  { value: '-base_price', label: 'Price high–low' },
  { value: 'stock_quantity', label: 'Stock low–high' },
  { value: '-stock_quantity', label: 'Stock high–low' },
]

type ProductBrief = { id: number; name: string; slug: string; productType: string }

type VariationDoc = {
  id: number
  product_id: ProductBrief | number | null
  product?: ProductBrief | number | null
  modifier_behavior_mode: string
  name: string | null
  short_description: string | null
  image: { id: number; url: string | null; filename: string | null } | null
  sku: string
  base_price: number | null
  compare_at_price: number | null
  stock_quantity: number
  is_used_for_variations: boolean
  is_visible: boolean
  sort_order: number
  createdAt: string
  updatedAt: string
}

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

type Stats = {
  total: number
  filteredTotal: number
  modeBreakdown: Record<string, number>
  inStock: number
  outOfStock: number
  visibleCount: number
  hiddenCount: number
}

function modeBadge(mode: string) {
  const m = mode.toLowerCase()
  if (m === 'hybrid') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (m === 'variation_specific') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
  return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}
function fmtPrice(v: number | null) {
  if (v == null) return '—'
  return `₱${Number(v).toFixed(2)}`
}
function productLabel(prod: VariationDoc['product_id']): string {
  if (!prod) return '—'
  if (typeof prod === 'number') return `#${prod}`
  return (prod as any).name || (prod as any).slug || `#${(prod as any).id}`
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
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function VariationsSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="h-16 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function VariationsContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [productFilter, setProductFilter] = useState<string>('')
  const [modeFilter, setModeFilter] = useState<string[]>([])
  const [visibleFilter, setVisibleFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<VariationDoc[]>([])
  const [products, setProducts] = useState<ProductBrief[]>([])
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
  }, [debouncedQ, productFilter, modeFilter, visibleFilter, sort])

  const activeFilterCount = useMemo(
    () => (productFilter ? 1 : 0) + modeFilter.length + visibleFilter.length + (debouncedQ ? 1 : 0),
    [productFilter, modeFilter, visibleFilter, debouncedQ],
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
      if (productFilter) qs.set('productId', productFilter)
      if (modeFilter.length === 1) qs.set('mode', modeFilter[0])
      if (visibleFilter.length === 1) qs.set('is_visible', visibleFilter[0])
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/catalog/variations?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load variations')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setProducts(Array.isArray(j.products) ? j.products : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load variations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, productFilter, modeFilter, visibleFilter, sort, page])

  const toggleMode = (v: string) => setModeFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const toggleVisible = (v: string) => setVisibleFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setProductFilter('')
    setModeFilter([])
    setVisibleFilter([])
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (modeFilter.length > 1) arr = arr.filter((v) => modeFilter.includes(v.modifier_behavior_mode.toLowerCase()))
    if (visibleFilter.length > 1) arr = arr.filter((v) => visibleFilter.includes(String(v.is_visible)))
    return arr
  }, [docs, modeFilter, visibleFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Layers className="w-4 h-4" /></span>
            Variations
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Sellable variations of your products — pricing, stock & modifier behavior (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh variations"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Variations" value={String(stats.total)} sub={`${stats.filteredTotal} matching filters`} icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
          <KpiCard title="Modes" value={`${stats.modeBreakdown.inherit_product || 0} inherit`} sub={`${stats.modeBreakdown.variation_specific || 0} variation · ${stats.modeBreakdown.hybrid || 0} hybrid`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Stock" value={`${stats.inStock} in`} sub={`${stats.outOfStock} out of stock`} icon={<Package className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Visibility" value={`${stats.visibleCount} shown`} sub={`${stats.hiddenCount} hidden`} icon={<Eye className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search variation name, SKU…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
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
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Product</p>
              <select value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                <option value="">All your products</option>
                {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name} ({p.slug})</option>)}
              </select>
            </div>
            <FilterPills label="Modifier Behavior" options={MODE_OPTS} value={modeFilter} onToggle={toggleMode} />
            <FilterPills label="Visibility" options={[{ value: 'true', label: 'Visible' }, { value: 'false', label: 'Hidden' }]} value={visibleFilter} onToggle={toggleVisible} />
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-xs font-medium border border-[#239459]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {productFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{products.find((p) => String(p.id) === productFilter)?.name || `Product #${productFilter}`} <button onClick={() => setProductFilter('')}><X className="w-3 h-3" /></button></span>}
            {modeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{MODE_OPTS.find((o) => o.value === v)?.label || v} <button onClick={() => toggleMode(v)}><X className="w-3 h-3" /></button></span>)}
            {visibleFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'true' ? 'Visible only' : 'Hidden only'} <button onClick={() => toggleVisible(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load variations</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 bg-[#239459]/10 dark:bg-[#239459]/15 rounded-full flex items-center justify-center mb-4"><Layers className="w-7 h-7 text-[#239459]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No variations found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">No variations exist for your products yet. Add them to a variable product when available.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Variation</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">SKU</th>
                    <th className="text-left px-4 py-3 font-medium">Product</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Mode</th>
                    <th className="text-left px-4 py-3 font-medium">Price</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Stock</th>
                    <th className="text-left px-4 py-3 font-medium">Visible</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                            {v.image?.url ? <img src={v.image.url} alt={v.name || ''} className="h-full w-full object-cover" /> : <Package className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{v.name || '—'}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] font-mono truncate max-w-[180px] sm:hidden">{v.sku}</div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {fmtDate(v.createdAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell"><span className="font-mono text-xs text-gray-700 dark:text-[#a1a1aa]">{v.sku || '—'}</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-medium text-gray-700 dark:text-[#a1a1aa] truncate max-w-[140px] inline-block">{productLabel(v.product_id)}</span></td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border capitalize ${modeBadge(v.modifier_behavior_mode)}`}>{v.modifier_behavior_mode.replace('_', ' ')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-white">
                          <DollarSign className="w-3 h-3 text-emerald-600" /> {fmtPrice(v.base_price)}
                        </span>
                        {v.compare_at_price != null && <span className="text-xs text-gray-400 line-through ml-1">{fmtPrice(v.compare_at_price)}</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${v.stock_quantity > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400'}`}>{v.stock_quantity}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${v.is_visible ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                          {v.is_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} {v.is_visible ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? filtered.length} variations • 10 per page</div>
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
        Variations map to platform <Link href="/catalog/attributes" className="font-semibold text-[#239459] hover:text-[#215035]">Attributes</Link> via <Link href="/catalog/variation-values" className="font-semibold text-[#239459] hover:text-[#215035]">Variation Values</Link>. Modifier behavior is defined by the product — see <Link href="/catalog/modifier-groups" className="font-semibold text-[#239459] hover:text-[#215035]">Modifier Groups</Link>.
      </div>
    </div>
  )
}

export default function CatalogVariationsPage() {
  return (
    <ClientOnly fallback={<VariationsSkeleton />}>
      <VariationsContent />
    </ClientOnly>
  )
}