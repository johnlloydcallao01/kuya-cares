'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { AlertCircle, CalendarDays, ChevronDown, Eye, Heart, RefreshCw, Search, ShoppingCart, SlidersHorizontal, X } from '@/components/ui/IconWrapper'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useActivity, type ActivityDoc, type ActivityKey } from '@/hooks/useActivity'

const DEFINITIONS: Record<ActivityKey, { title: string; description: string; icon: React.ReactNode; empty: string; searchPlaceholder: string }> = {
  wishlists: { title: 'Customer Wishlists', description: 'Review the merchants and products customers have saved for later.', icon: <Heart className="w-4 h-4" />, empty: 'No wishlist items found', searchPlaceholder: 'Search customer, merchant, or product...' },
  carts: { title: 'Abandoned Carts', description: 'Monitor products customers added but did not complete checkout for.', icon: <ShoppingCart className="w-4 h-4" />, empty: 'No abandoned cart items found', searchPlaceholder: 'Search customer, merchant, or product...' },
  searches: { title: 'Recent Searches', description: 'Understand what customers are looking for across the marketplace.', icon: <Search className="w-4 h-4" />, empty: 'No recent searches found', searchPlaceholder: 'Search query or customer email...' },
  views: { title: 'Recently Viewed', description: 'See the merchants and products customers viewed most recently.', icon: <Eye className="w-4 h-4" />, empty: 'No recently viewed items found', searchPlaceholder: 'Search customer, merchant, or product...' },
}

function formatDate(value: string | null) { if (!value) return '—'; try { return new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return value.slice(0, 10) } }
function formatMoney(value: number) { return value ? `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—' }
function customerName(customer: ActivityDoc['customer']) { if (!customer) return 'Unknown customer'; return `${customer.firstName} ${customer.lastName}`.trim() || customer.email || 'Unknown customer' }
function initials(customer: ActivityDoc['customer']) {
  const name = customerName(customer)
  if (customer?.profilePicture?.url) {
    return <img src={customer.profilePicture.url} alt={name} className="h-9 w-9 rounded-xl object-cover" />
  }
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'
}

export default function ActivityPage({ activity }: { activity: ActivityKey }) {
  const definition = DEFINITIONS[activity]
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState(activity === 'views' ? '-lastViewedAt' : activity === 'searches' ? '-frequency' : activity === 'carts' ? '-updatedAt' : '-createdAt')
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const limit = 10

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350); return () => clearTimeout(timer) }, [search])
  useEffect(() => { setPage(1) }, [debouncedSearch, sort, activity])

  const qs = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit), sort })
    if (debouncedSearch) params.set('search', debouncedSearch)
    return params.toString()
  }, [page, sort, debouncedSearch])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useActivity(activity, qs)

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load customer activity') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminActivity(activity, qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  const activeFilterCount = useMemo(() => debouncedSearch ? 1 : 0, [debouncedSearch])
  const rows = data?.docs || []

  return <div className="space-y-6 py-5 px-2.5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2"><span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center">{definition.icon}</span>{definition.title}</h1><p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">{definition.description}</p></div>
      <button onClick={handleHardRefresh} disabled={loading} aria-label={`Refresh ${definition.title}`} title="Refresh" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"><RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} /></button>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3"><div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm"><p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">Total records</p><p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{data ? data.stats.total : '—'}</p><p className="text-xs text-gray-500 mt-1">{definition.title.toLowerCase()}</p></div><div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm"><p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">Showing</p><p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{data ? rows.length : '—'}</p><p className="text-xs text-gray-500 mt-1">current page</p></div><div className="hidden lg:block bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm"><p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">View</p><p className="text-xl font-bold text-gray-900 dark:text-white mt-1">Customer activity</p><p className="text-xs text-gray-500 mt-1">backend aggregated</p></div></div>

    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={definition.searchPlaceholder} className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />{search && <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-gray-400" /></button>}</div><div className="flex items-center gap-2"><div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]"><select value={sort} onChange={(event) => setSort(event.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white"><option value="-createdAt">Newest first</option><option value="-updatedAt">Recently updated</option><option value="frequency">Most frequent</option><option value="-frequency">Highest frequency</option><option value="-viewCount">Most viewed</option><option value="-lastViewedAt">Recently viewed</option></select></div><button onClick={() => setShowFilters((current) => !current)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border ${activeFilterCount ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}><SlidersHorizontal className="w-4 h-4" />Filters{activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>}<ChevronDown className={`w-4 h-4 ${showFilters ? 'rotate-180' : ''}`} /></button></div></div>{showFilters && <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#262626] text-xs text-gray-500 dark:text-[#a1a1aa]">Search is applied across the customer and activity fields by the CMS aggregation endpoint.</div>}</div>

    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">{error ? <div className="flex flex-col items-center justify-center py-16 px-6"><AlertCircle className="h-7 w-7 text-red-500 mb-3" /><h3 className="font-semibold text-gray-900 dark:text-white">Failed to load activity</h3><p className="text-sm text-gray-500 mt-1 mb-4">{error}</p><button onClick={handleHardRefresh} className="inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4" />Retry</button></div> : isInitialLoading ? <div className="p-4 space-y-3 animate-pulse">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div> : rows.length === 0 ? <div className="flex flex-col items-center justify-center py-16 px-6 text-center"><div className="h-16 w-16 bg-[#eba236]/10 rounded-2xl flex items-center justify-center mb-4">{definition.icon}</div><h3 className="font-semibold text-gray-900 dark:text-white">{definition.empty}</h3><p className="text-sm text-gray-500 mt-1">Try adjusting the search.</p></div> : <><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]"><tr><th className="text-left px-4 py-3 font-medium">Customer</th><th className="text-left px-4 py-3 font-medium">Activity</th><th className="text-left px-4 py-3 font-medium hidden md:table-cell">Source</th><th className="text-right px-4 py-3 font-medium">Signal</th><th className="text-right px-4 py-3 font-medium">Date</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{rows.map((row) => <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50"><td className="px-4 py-3"><div className="flex items-center gap-3 min-w-[220px]"><div className="h-9 w-9 rounded-xl bg-[#eba236]/15 text-[#8a5f17] flex items-center justify-center text-xs font-bold shrink-0">{initials(row.customer)}</div><div className="min-w-0"><div className="font-semibold text-gray-900 dark:text-white truncate max-w-[220px]">{customerName(row.customer)}</div><div className="text-xs text-gray-500 truncate max-w-[220px]">{row.customer?.email || 'No email available'}</div></div></div></td><td className="px-4 py-3"><div className="font-medium text-gray-900 dark:text-white max-w-[260px] truncate">{activity === 'searches' ? `“${row.query}”` : row.product !== 'Unknown' ? row.product : row.merchant}</div><div className="text-xs text-gray-500 mt-0.5">{activity === 'searches' ? row.scope || 'global' : row.merchant}</div></td><td className="px-4 py-3 hidden md:table-cell"><span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] capitalize">{row.source}</span></td><td className="px-4 py-3 text-right text-gray-700 dark:text-[#a1a1aa]">{activity === 'carts' ? <><span className="font-semibold text-gray-900 dark:text-white">{formatMoney(row.subtotal)}</span><div className="text-xs">{row.quantity} item{row.quantity === 1 ? '' : 's'}</div></> : activity === 'searches' ? `${row.frequency || 0} searches` : `${activity === 'views' ? row.viewCount : 1} ${activity === 'views' ? 'views' : 'saved'}`}</td><td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-[#a1a1aa] whitespace-nowrap"><CalendarDays className="w-3 h-3 inline mr-1" />{formatDate(activity === 'views' ? row.lastViewedAt : row.updatedAt || row.createdAt)}</td></tr>)}</tbody></table></div><div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm"><div className="text-gray-600 dark:text-[#a1a1aa]">Page {data?.pagination.page} of {data?.pagination.totalPages} • {data?.pagination.totalDocs} records • 10 per page</div><div className="flex items-center gap-1"><button disabled={!data?.pagination.hasPrevPage} onClick={() => setPage((current) => Math.max(1, current - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] disabled:opacity-50">Prev</button><button disabled={!data?.pagination.hasNextPage} onClick={() => setPage((current) => current + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] disabled:opacity-50">Next</button></div></div></>}</div>
  </div>
}
