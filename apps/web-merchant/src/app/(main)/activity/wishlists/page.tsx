'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Heart, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  Users, Package, Store, Eye,
} from '@/components/ui/IconWrapper'

type WishlistDoc = {
  id: number
  customer: { id: number; email: string; firstName: string; lastName: string } | null
  itemType: string
  merchant: { id: number; outletName: string; outletCode: string } | null
  merchantProduct: { id: number; display_title: string } | null
  product: { id: number; name: string; slug: string } | null
  createdAt: string
  updatedAt: string
}

type OutletOption = { id: number; outletName: string }

type Pagination = { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
type Stats = {
  totalWishlists: number
  filteredTotal: number
  uniqueCustomers: number
  uniqueProducts: number
  itemTypeSplit: Record<string, number>
  perOutlet: { id: number; outletName: string; count: number }[]
}

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Recently saved' },
  { value: 'createdAt', label: 'Oldest saved' },
  { value: '-updatedAt', label: 'Recently updated' },
  { value: 'updatedAt', label: 'Least recently updated' },
]

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}
function customerLabel(c: WishlistDoc['customer']): string {
  if (!c) return 'Unknown customer'
  const name = `${c.firstName || ''} ${c.lastName || ''}`.trim()
  return name || c.email || `Customer #${c.id}`
}
function customerInitials(c: WishlistDoc['customer']): string {
  const name = customerLabel(c === null ? null : c)
  if (name === 'Unknown customer') return '?'
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
}
function savedLabel(d: WishlistDoc): string {
  if (d.itemType === 'merchantproduct') {
    return d.merchantProduct?.display_title || d.product?.name || 'Listing'
  }
  return d.merchant?.outletName || 'Outlet'
}
function savedSub(d: WishlistDoc): string {
  if (d.itemType === 'merchantproduct') {
    return d.product?.name && d.merchantProduct?.display_title !== d.product.name ? d.product.name : (d.merchant?.outletName || '')
  }
  return d.merchant?.outletCode ? `Code ${d.merchant.outletCode}` : 'Saved outlet'
}
function typeBadge(t: string) {
  const v = (t || '').toLowerCase()
  if (v === 'merchantproduct') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
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

function WishlistsSkeleton() {
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

function WishlistsContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<WishlistDoc[]>([])
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
  }, [debouncedQ, outletFilter, typeFilter, sort])

  const activeFilterCount = useMemo(
    () => (outletFilter ? 1 : 0) + typeFilter.length + (debouncedQ ? 1 : 0),
    [outletFilter, typeFilter, debouncedQ],
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
      if (typeFilter.length === 1) qs.set('itemType', typeFilter[0])
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/activity/wishlists?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load wishlists')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setMerchants(Array.isArray(j.merchants) ? j.merchants : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load wishlists')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, outletFilter, typeFilter, sort, page])

  const toggleType = (v: string) => setTypeFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setOutletFilter('')
    setTypeFilter([])
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (typeFilter.length > 1) arr = arr.filter((d) => typeFilter.includes(d.itemType.toLowerCase()))
    return arr
  }, [docs, typeFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))
  const topOutlet = stats && stats.perOutlet.length > 0 ? `${stats.perOutlet[0].outletName} (${stats.perOutlet[0].count})` : '—'

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Heart className="w-4 h-4" /></span>
            Customer Wishlists
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Outlets and listings your customers saved for later (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh wishlists"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Saves" value={String(stats.filteredTotal)} sub={`${stats.totalWishlists} overall`} icon={<Heart className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
          <KpiCard title="Unique Customers" value={String(stats.uniqueCustomers)} sub="people saving" icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Unique Products" value={String(stats.uniqueProducts)} sub="products saved" icon={<Package className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Top Outlet" value={topOutlet} sub={`${stats.perOutlet.length} outlet(s)`} icon={<Store className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, outlet, or product…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
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
            <FilterPills label="Saved Item Type" options={[{ value: 'merchant', label: 'Outlet' }, { value: 'merchantproduct', label: 'Listing' }]} value={typeFilter} onToggle={toggleType} />
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-xs font-medium border border-[#239459]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {outletFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{merchants.find((m) => String(m.id) === outletFilter)?.outletName || `Outlet #${outletFilter}`} <button onClick={() => setOutletFilter('')}><X className="w-3 h-3" /></button></span>}
            {typeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">{v === 'merchantproduct' ? 'Listing' : 'Outlet'} <button onClick={() => toggleType(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load wishlists</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#239459]/10 dark:bg-[#239459]/15 rounded-2xl flex items-center justify-center mb-4"><Heart className="w-8 h-8 text-[#239459]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No wishlist saves found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Saves appear here once customers wishlist your outlets or listings. Try adjusting search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 font-medium">Saved Item</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Outlet</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="h-9 w-9 rounded-xl bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] flex items-center justify-center text-xs font-bold shrink-0">
                            {customerInitials(d.customer)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{customerLabel(d.customer)}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px]">{d.customer?.email || 'No email available'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-[220px]">{savedLabel(d)}</div>
                          <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[220px]">{savedSub(d)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border capitalize ${typeBadge(d.itemType)}`}>
                          {d.itemType === 'merchantproduct' ? <Eye className="w-3 h-3" /> : <Store className="w-3 h-3" />} {d.itemType === 'merchantproduct' ? 'Listing' : 'Outlet'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white">
                          <Store className="w-3 h-3 text-[#239459]" /> {d.merchant?.outletName || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa] whitespace-nowrap">{fmtDate(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} saves • 10 per page</div>
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
        Only saves of <span className="font-semibold text-gray-700 dark:text-white">your outlets and listings</span> appear here. This page is read-only — wishlist data is owned by customers in the storefront app.
      </div>
    </div>
  )
}

export default function WishlistsPage() {
  return (
    <ClientOnly fallback={<WishlistsSkeleton />}>
      <WishlistsContent />
    </ClientOnly>
  )
}
