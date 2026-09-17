'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Layers, Package, ShoppingBag, Store, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle, Plus
} from '@/components/ui/IconWrapper'

type ProductBrief = { id: number; name: string; slug: string; productType: string }

type GroupedItemDoc = {
  id: number
  parent_product_id: ProductBrief | number | null
  parent_product?: ProductBrief | number | null
  child_product_id: ProductBrief | number | null
  child_product?: ProductBrief | number | null
  default_quantity: number
  sort_order: number
  createdAt: string
  updatedAt: string
}

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

type Stats = {
  total: number
  totalAll: number
  filteredTotal: number
  perParent: Record<string, number>
  totalGrouped: number
  uniqueParents: number
  uniqueChildren: number
}

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: 'sort_order', label: 'Sort order (low→high)' },
  { value: '-sort_order', label: 'Sort order (high→low)' },
  { value: 'default_quantity', label: 'Qty (low→high)' },
  { value: '-default_quantity', label: 'Qty (high→low)' },
]

function productName(v: GroupedItemDoc['parent_product_id']): string {
  if (!v) return '—'
  if (typeof v === 'number') return `#${v}`
  return (v as any).name || `#${(v as any).id}`
}
function productSlug(v: GroupedItemDoc['parent_product_id']): string {
  if (!v || typeof v === 'number') return ''
  return (v as any).slug || ''
}
function productTypeBadge(pt: string) {
  if (!pt) return ''
  const t = pt.toLowerCase()
  if (t === 'bundle') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
  if (t === 'grouped') return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800'
  return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
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

function GroupedItemsSkeleton() {
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

function GroupedItemsContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [parentFilter, setParentFilter] = useState('')
  const [childFilter, setChildFilter] = useState('')
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<GroupedItemDoc[]>([])
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
  }, [debouncedQ, parentFilter, childFilter, sort])

  const activeFilterCount = useMemo(
    () => (parentFilter ? 1 : 0) + (childFilter ? 1 : 0) + (debouncedQ ? 1 : 0),
    [parentFilter, childFilter, debouncedQ],
  )

  const avgChildren = useMemo(() => {
    if (!stats) return '0'
    const count = stats.uniqueParents || 0
    return count ? String(Math.round((stats.filteredTotal / count) * 10) / 10) : '0'
  }, [stats])

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
      if (parentFilter) qs.set('parent_product_id', parentFilter)
      if (childFilter) qs.set('child_product_id', childFilter)
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/catalog/grouped-items?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load grouped items')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setProducts(Array.isArray(j.products) ? j.products : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load grouped items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, parentFilter, childFilter, sort, page])

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setParentFilter('')
    setChildFilter('')
  }

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(docs.length / limit))

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Layers className="w-4 h-4" /></span>
            Grouped Items
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Product bundles that combine multiple stand-alone products with default quantities (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh grouped items"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Items" value={String(stats.filteredTotal)} sub={`${stats.totalAll} overall`} icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
          <KpiCard title="Unique Parents" value={String(stats.uniqueParents)} sub={`${stats.filteredTotal} links`} icon={<Package className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Avg Children" value={avgChildren} sub="per parent" icon={<ShoppingBag className="w-5 h-5 text-white" />} iconBg="bg-sky-600" />
          <KpiCard title="Unique Children" value={String(stats.uniqueChildren)} sub={`${stats.totalAll} overall`} icon={<Store className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product name…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Parent Product (grouped)</p>
                <select value={parentFilter} onChange={(e) => setParentFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  <option value="">All your parent products</option>
                  {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name} (#{p.id})</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Child Product</p>
                <select value={childFilter} onChange={(e) => setChildFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  <option value="">All your child products</option>
                  {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name} (#{p.id})</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-xs font-medium border border-[#239459]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {parentFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">parent: {products.find((p) => String(p.id) === parentFilter)?.name || `#${parentFilter}`} <button onClick={() => setParentFilter('')}><X className="w-3 h-3" /></button></span>}
            {childFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">child: {products.find((p) => String(p.id) === childFilter)?.name || `#${childFilter}`} <button onClick={() => setChildFilter('')}><X className="w-3 h-3" /></button></span>}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load grouped items</h3>
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
            <h3 className="font-semibold text-gray-900 dark:text-white">No grouped items found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Grouped products bundle multiple stand-alone products with default quantities.</p>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-3">Create them in the CMS admin console or via batch import. Linked items appear here automatically.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Parent (Grouped)</th>
                    <th className="text-left px-4 py-3 font-medium">Child Product</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Qty / Sort</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-white flex items-center justify-center text-xs font-bold shrink-0"><Package className="w-4 h-4" /></div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{productName(row.parent_product_id)}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px]">
                              {productSlug(row.parent_product_id) ? `/${productSlug(row.parent_product_id)}` : `ID #${typeof row.parent_product_id === 'number' ? row.parent_product_id : (row.parent_product_id as any)?.id ?? '?'}`}
                            </div>
                            {typeof row.parent_product_id === 'object' && row.parent_product_id && (row.parent_product_id as any).productType && (
                              <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${productTypeBadge((row.parent_product_id as any).productType)}`}>{(row.parent_product_id as any).productType}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="h-9 w-9 rounded-xl bg-gray-100 dark:bg-[#262626] border border-gray-200 dark:border-[#404040] text-gray-700 dark:text-white flex items-center justify-center text-xs font-bold shrink-0"><Package className="w-4 h-4" /></div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[160px]">{productName(row.child_product_id)}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[160px]">
                              {productSlug(row.child_product_id) ? `/${productSlug(row.child_product_id)}` : `ID #${typeof row.child_product_id === 'number' ? row.child_product_id : (row.child_product_id as any)?.id ?? '?'}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white">
                            <Layers className="w-3 h-3 text-[#239459] mr-1" /> qty: {row.default_quantity}
                          </span>
                          <span className="inline-flex items-center px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white">
                            sort: {row.sort_order}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{fmtDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {docs.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? docs.length} items • 10 per page</div>
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
        Grouped items are junction records linking a <span className="font-semibold text-gray-700 dark:text-white">Parent Product</span> to a <span className="font-semibold text-gray-700 dark:text-white">Child Product</span> with a default quantity. A child product can appear across multiple groups. Create and manage these in the CMS admin console — this page is read-only for your vendor products.
      </div>
    </div>
  )
}

export default function CatalogGroupedItemsPage() {
  return (
    <ClientOnly fallback={<GroupedItemsSkeleton />}>
      <GroupedItemsContent />
    </ClientOnly>
  )
}