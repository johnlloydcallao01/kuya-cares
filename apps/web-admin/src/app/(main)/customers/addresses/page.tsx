'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useCustomers } from '@/hooks/useCustomers'
import { useCustomerAddressStats } from '@/hooks/useCustomerAddressStats'
import { ClientOnly } from '@/components/ClientOnly'
import {
  MapPin, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  Eye, Mail, Phone, Users, Layers, LocateFixed, ShoppingBag,
} from '@/components/ui/IconWrapper'

// ─── Customer-first list: pick a customer → dedicated view page ───
// BFF pattern (docs/BFF-pattern.md): only aggregation endpoints:
//   GET /api/customers (customers BFF)
//   GET /api/customers/addresses?page=1&limit=1 (stats only)
// Row click navigates to /customers/addresses/[customerId] (dedicated view).

function initials(first: string, last: string) {
  const a = (first?.[0] || '').toUpperCase()
  const b = (last?.[0] || '').toUpperCase()
  return `${a}${b}`.trim() || 'C'
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

function AddressesSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
        ))}
      </div>
      <div className="p-4 space-y-3 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
    </div>
  )
}

function CustomerAddressesPageContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [hasActiveFilter, setHasActiveFilter] = useState<boolean | null>(null)
  const [sort, setSort] = useState('-createdAt')
  const [page, setPage] = useState(1)
  const limit = 10
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim()), 400); return () => clearTimeout(id) }, [q])

  const activeFilterCount = (debouncedQ ? 1 : 0) + (hasActiveFilter !== null ? 1 : 0)

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (hasActiveFilter !== null) p.set('has_active', String(hasActiveFilter))
    return p.toString()
  }, [page, limit, sort, debouncedQ, hasActiveFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useCustomers(qs)
  const addrStatsQuery = useCustomerAddressStats('page=1&limit=1')

  const customers = data?.docs || []
  const custPagination = data?.pagination || null
  const custStats = data?.stats || null
  const addrStats = addrStatsQuery.data || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load customers') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminCustomers(qs) })
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminCustomerAddresses('page=1&limit=1') })
        await Promise.all([refetch({ cancelRefetch: true }), addrStatsQuery.refetch({ cancelRefetch: true })])
      } finally { setHardRefreshing(false) }
    })()
  }

  useEffect(() => { setPage(1) }, [debouncedQ, hasActiveFilter, sort])

  const clearAll = () => { setQ(''); setDebouncedQ(''); setHasActiveFilter(null) }

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><MapPin className="w-4 h-4" /></span>
            Customer Addresses
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Customer-first: select a customer to open their dedicated address book with active current and saved addresses.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh customers"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/customers" className="hidden sm:inline-flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-xl text-sm font-medium transition">
            <Users className="w-4 h-4" /> Customers
          </Link>
        </div>
      </div>

      {/* KPIs */}
      {custStats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Total Customers" value={String(custStats.filteredTotal)} sub={`${custStats.totalAll} overall`} icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="With Active Address" value={String(custStats.withActiveAddressCount ?? addrStats?.totalActiveCustomers ?? 0)} sub="have current active" icon={<LocateFixed className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Without Active" value={String(custStats.withoutActiveAddressCount ?? 0)} sub="need active set" icon={<AlertCircle className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Saved Addresses" value={String(addrStats?.totalAll ?? '—')} sub={`${addrStats?.savedCount ?? 0} saved • ${addrStats?.activeCount ?? 0} active`} icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Verified" value={String(addrStats?.verifiedCount ?? '—')} sub="verified addresses" icon={<MapPin className="w-5 h-5 text-white" />} iconBg="bg-violet-600" />
        </div>
      ) : isInitialLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
          ))}
        </div>
      ) : null}

      {/* Search + Filters bar */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers by name, email, phone…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest first</option>
                <option value="createdAt">Oldest first</option>
              </select>
            </div>
            <span className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-gray-600 dark:text-[#a1a1aa]">10 / page</span>
            <button onClick={() => setShowFilters((v) => !v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${activeFilterCount ? 'bg-[#eba236] hover:bg-[#c88a20] text-white border-[#eba236] hover:border-[#c88a20]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626] hover:text-gray-900 dark:hover:text-white'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {activeFilterCount > 0 && <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">Clear all</button>}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Active Coverage</p>
              <div className="flex gap-1.5 flex-wrap">
                {([['all', 'All customers'], ['true', 'With active'], ['false', 'Without active']] as const).map(([v, l]) => {
                  const active = (hasActiveFilter === null && v === 'all') || String(hasActiveFilter) === v
                  return <button key={v} onClick={() => setHasActiveFilter(v === 'all' ? null : v === 'true')} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{l}</button>
                })}
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-3">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">BFF tip</p>
              <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">Filters run server-side via the BFF aggregation endpoint — combining search + active coverage uses a single backend join.</p>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {hasActiveFilter !== null && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{hasActiveFilter ? 'With active' : 'Without active'} <button onClick={() => setHasActiveFilter(null)}><X className="w-3 h-3" /></button></span>}
          </div>
        )}
      </div>

      {/* Customers table — each row opens its dedicated address book */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load customers</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        )}
        {isInitialLoading ? (
          <div className="p-4 space-y-3 animate-pulse">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
        ) : !error && customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Users className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No customers found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters.</p>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Active Current Address</th>
                    <th className="text-right px-4 py-3 font-medium">Saved</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Orders</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {customers.map((c) => (
                    <tr key={`${c.customerId ?? c.userId}`} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0">{c.user ? initials(c.user.firstName, c.user.lastName) : 'C'}</div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{c.user ? `${c.user.firstName} ${c.user.lastName}` : c.email}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px] flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400 shrink-0" />{c.email}</div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {c.user?.phone || '—'} • Cust #{c.customerId ?? '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {c.activeAddress ? (
                          <div className="max-w-[280px]">
                            <div className="text-xs font-medium text-gray-900 dark:text-white truncate" title={c.activeAddress.formatted_address}><span className="inline-block h-2 w-2 rounded-full bg-emerald-500 mr-1" />#{c.activeAddress.id} {c.activeAddress.formatted_address.slice(0, 60)}</div>
                            <div className="text-[11px] text-gray-500 dark:text-[#a1a1aa]">{[c.activeAddress.locality, c.activeAddress.postal_code].filter(Boolean).join(' • ') || '—'}</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800">No active set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-semibold text-gray-700 dark:text-white"><MapPin className="w-3 h-3 text-[#eba236]" /> {c.addressCount}</span></td>
                      <td className="px-4 py-3 text-right hidden md:table-cell"><span className="inline-flex items-center gap-1 text-xs font-medium text-gray-900 dark:text-white"><ShoppingBag className="w-3 h-3 text-[#eba236]" /> {c.orderCount}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {c.customerId != null ? (
                            <Link href={`/customers/addresses/${c.customerId}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="Open address book"><Eye className="w-4 h-4" /></Link>
                          ) : (
                            <span className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-gray-300" title="No customer profile"><Eye className="w-4 h-4" /></span>
                          )}
                          <Link href="/customers" className="hidden h-7 px-2 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] text-xs font-medium" title="All customers"><Plus className="w-4 h-4" /></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {custPagination && custPagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {custPagination.page} of {custPagination.totalPages} • {custPagination.totalDocs} customers • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || !custPagination.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm text-gray-700 dark:text-white">Prev</button>
                  {Array.from({ length: Math.min(5, custPagination.totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(custPagination.totalPages - 4, custPagination.page - 2)) + i
                    if (n > custPagination.totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === custPagination.page ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || !custPagination.hasNextPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm text-gray-700 dark:text-white">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function CustomerAddressesPage() {
  return (
    <ClientOnly fallback={<AddressesSkeleton />}>
      <CustomerAddressesPageContent />
    </ClientOnly>
  )
}
