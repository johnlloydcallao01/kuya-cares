'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  Users, TrendingUp, Store, Tag,
} from '@/components/ui/IconWrapper'

type SearchDoc = {
  query: string
  normalizedQuery: string
  frequency: number
  uniqueUsers: number
  lastSearchedAt: string
  firstSearchedAt: string
  scope: string
  source: string
  outlets: { id: number; outletName: string }[]
  products: { id: number; name: string }[]
  customers: { id: number; email: string; firstName: string; lastName: string }[]
}

type OutletOption = { id: number; outletName: string }

type Pagination = { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
type Stats = {
  totalQueries: number
  filteredTotal: number
  totalSearches: number
  uniqueCustomers: number
  topQueries: { query: string; frequency: number }[]
}

const SORTS: { value: string; label: string }[] = [
  { value: '-frequency', label: 'Highest frequency' },
  { value: 'frequency', label: 'Lowest frequency' },
  { value: '-updatedAt', label: 'Recently searched' },
  { value: 'updatedAt', label: 'Least recently searched' },
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
]

const SCOPE_OPTS = [
  { value: 'restaurants', label: 'Restaurants' },
  { value: 'merchant_menu', label: 'Merchant menu' },
  { value: 'global', label: 'Global' },
]

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}
function customerLabel(c: { firstName: string; lastName: string; email: string; id: number }): string {
  const name = `${c.firstName || ''} ${c.lastName || ''}`.trim()
  return name || c.email || `Customer #${c.id}`
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

function SearchesSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="p-4 space-y-3 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
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

function SearchesContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [scopeFilter, setScopeFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-frequency')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<SearchDoc[]>([])
  const [merchants, setMerchants] = useState<OutletOption[]>([])
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
  }, [debouncedQ, outletFilter, scopeFilter, sort])

  const activeFilterCount = useMemo(
    () => (outletFilter ? 1 : 0) + scopeFilter.length + (debouncedQ ? 1 : 0),
    [outletFilter, scopeFilter, debouncedQ],
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
      if (outletFilter) qs.set('outletId', outletFilter)
      if (scopeFilter.length === 1) qs.set('scope', scopeFilter[0])
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/activity/searches?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load recent searches')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setMerchants(Array.isArray(j.merchants) ? j.merchants : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load recent searches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, outletFilter, scopeFilter, sort, page])

  const toggleScope = (v: string) => setScopeFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setOutletFilter('')
    setScopeFilter([])
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (scopeFilter.length > 1) arr = arr.filter((d) => scopeFilter.includes(d.scope.toLowerCase()))
    return arr
  }, [docs, scopeFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))
  const topQuery = stats && stats.topQueries.length > 0 ? `“${stats.topQueries[0].query}” (${stats.topQueries[0].frequency})` : '—'

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Search className="w-4 h-4" /></span>
            Recent Searches
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">What your customers searched for when it touched your catalog (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh recent searches"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Searches" value={String(stats.totalSearches)} sub={`${stats.filteredTotal} queries`} icon={<Search className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
          <KpiCard title="Unique Queries" value={String(stats.filteredTotal)} sub={`${stats.totalQueries} overall`} icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Unique Customers" value={String(stats.uniqueCustomers)} sub="people searching" icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Top Query" value={topQuery} sub="by frequency" icon={<TrendingUp className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : null}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search query text…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
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
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Outlet</p>
              <select value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} className="w-full sm:max-w-xs px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                <option value="">All your outlets</option>
                {merchants.map((m) => <option key={m.id} value={String(m.id)}>{m.outletName} (#{m.id})</option>)}
              </select>
            </div>
            <FilterPills label="Search Surface" options={SCOPE_OPTS} value={scopeFilter} onToggle={toggleScope} />
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-xs font-medium border border-[#239459]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {outletFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{merchants.find((m) => String(m.id) === outletFilter)?.outletName || `Outlet #${outletFilter}`} <button onClick={() => setOutletFilter('')}><X className="w-3 h-3" /></button></span>}
            {scopeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">{v.replace('_', ' ')} <button onClick={() => toggleScope(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load recent searches</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#239459]/10 dark:bg-[#239459]/15 rounded-2xl flex items-center justify-center mb-4"><Search className="w-8 h-8 text-[#239459]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No matching searches found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Searches appear here when your customers look for things in your catalog. Try adjusting search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Query</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Matched In Catalog</th>
                    <th className="text-left px-4 py-3 font-medium">Customers</th>
                    <th className="text-right px-4 py-3 font-medium">Frequency</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Last Searched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((d) => (
                    <tr key={d.normalizedQuery} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-[220px]">“{d.query}”</div>
                          <div className="text-xs text-gray-500 dark:text-[#a1a1aa] capitalize">{d.scope.replace('_', ' ')} • {d.source}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {d.outlets.slice(0, 2).map((o) => (
                            <span key={`o-${o.id}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-[11px] font-medium text-gray-700 dark:text-white">
                              <Store className="w-3 h-3 text-[#239459]" /> {o.outletName}
                            </span>
                          ))}
                          {d.products.slice(0, 2).map((p) => (
                            <span key={`p-${p.id}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-[11px] font-medium border border-[#239459]/30">
                              <Tag className="w-3 h-3" /> {p.name}
                            </span>
                          ))}
                          {d.outlets.length + d.products.length > 4 && (
                            <span className="text-[11px] text-gray-400">+{d.outlets.length + d.products.length - 4}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white">{d.uniqueUsers} customer{d.uniqueUsers === 1 ? '' : 's'}</div>
                          <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px]">
                            {d.customers.slice(0, 2).map(customerLabel).join(', ') || '—'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-semibold text-gray-700 dark:text-white">
                          <TrendingUp className="w-3 h-3 text-[#239459]" /> {d.frequency}×
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa] whitespace-nowrap">{fmtDate(d.lastSearchedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} queries • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || !pagination.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(pagination.totalPages - 4, pagination.page - 2)) + i
                    if (n > pagination.totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === pagination.page ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || !pagination.hasNextPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
        Only searches by <span className="font-semibold text-gray-700 dark:text-white">customers who ordered from your outlets</span>, touching <span className="font-semibold text-gray-700 dark:text-white">your catalog</span>, appear here. This page is read-only — search history is owned by customers in the storefront app.
      </div>
    </div>
  )
}

export default function SearchesPage() {
  return (
    <ClientOnly fallback={<SearchesSkeleton />}>
      <SearchesContent />
    </ClientOnly>
  )
}
