'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  MapPin, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  Users, CheckCircle, Store, ShoppingBag, Layers,
} from '@/components/ui/IconWrapper'

type AddressDoc = {
  id: number
  formatted_address: string
  shortAddress: string
  street: string | null
  floor_unit_room: string | null
  delivery_instructions: string | null
  label: string | null
  barangay: string | null
  locality: string | null
  postal_code: string | null
  country: string
  address_type: string
  is_default: boolean
  customer: { id: number; email: string; firstName: string; lastName: string } | null
  customerActiveAddressId: number | null
  isActiveAddress: boolean
  ordersCount: number
  createdAt: string
}

type OutletOption = { id: number; outletName: string }

type Pagination = { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
type Stats = {
  totalAddresses: number
  filteredTotal: number
  defaultCount: number
  activeAddressCount: number
  typeBreakdown: Record<string, number>
  topLocalities: { name: string; count: number }[]
}

const TYPE_OPTS: { value: string; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'partner', label: 'Partner' },
  { value: 'billing', label: 'Billing' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'delivery', label: 'Delivery' },
]

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
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
function customerLabel(c: AddressDoc['customer']): string {
  if (!c) return '—'
  const name = `${c.firstName || ''} ${c.lastName || ''}`.trim()
  return name || c.email || `Customer #${c.id}`
}
function typeBadge(t: string) {
  const v = (t || '').toLowerCase()
  if (v === 'home') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (v === 'work') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
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

function AddressesContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [defaultFilter, setDefaultFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<AddressDoc[]>([])
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
  }, [debouncedQ, outletFilter, typeFilter, defaultFilter, sort])

  const activeFilterCount = useMemo(
    () => (outletFilter ? 1 : 0) + (typeFilter ? 1 : 0) + defaultFilter.length + (debouncedQ ? 1 : 0),
    [outletFilter, typeFilter, defaultFilter, debouncedQ],
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
      if (typeFilter) qs.set('address_type', typeFilter)
      if (defaultFilter.length === 1) qs.set('is_default', defaultFilter[0])
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/customers/addresses?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load addresses')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setMerchants(Array.isArray(j.merchants) ? j.merchants : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, outletFilter, typeFilter, defaultFilter, sort, page])

  const toggleDefault = (v: string) => setDefaultFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setOutletFilter('')
    setTypeFilter('')
    setDefaultFilter([])
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (defaultFilter.length > 1) arr = arr.filter((a) => defaultFilter.includes(String(a.is_default)))
    return arr
  }, [docs, defaultFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))
  const topLocality = stats && stats.topLocalities.length > 0 ? `${stats.topLocalities[0].name} (${stats.topLocalities[0].count})` : '—'

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm mb-2">
            <Link href="/customers" className="inline-flex items-center gap-2 font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
              <Users className="w-4 h-4" /> Customers
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><MapPin className="w-4 h-4" /></span>
            Customer Addresses
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Delivery addresses of customers who ordered from your outlets (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh addresses"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Addresses" value={String(stats.filteredTotal)} sub={`${stats.totalAddresses} overall`} icon={<MapPin className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Active Current" value={String(stats.activeAddressCount)} sub="customers' current" icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Defaults" value={String(stats.defaultCount)} sub="marked default" icon={<Store className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Top Area" value={topLocality} sub="by address count" icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-violet-600" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search address, area, customer…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
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
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Outlet</p>
                <select value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  <option value="">All your outlets</option>
                  {merchants.map((m) => <option key={m.id} value={String(m.id)}>{m.outletName} (#{m.id})</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Address type</p>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                  {TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <FilterPills label="Default" options={[{ value: 'true', label: 'Default only' }, { value: 'false', label: 'Non-default' }]} value={defaultFilter} onToggle={toggleDefault} />
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {outletFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{merchants.find((m) => String(m.id) === outletFilter)?.outletName || `Outlet #${outletFilter}`} <button onClick={() => setOutletFilter('')}><X className="w-3 h-3" /></button></span>}
            {typeFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">type: {typeFilter} <button onClick={() => setTypeFilter('')}><X className="w-3 h-3" /></button></span>}
            {defaultFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v === 'true' ? 'Default only' : 'Non-default'} <button onClick={() => toggleDefault(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load addresses</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><MapPin className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No addresses found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Delivery addresses appear here once your customers save them. Try adjusting search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Delivery Address</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Customer</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Flags</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-3 min-w-[220px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm text-gray-900 dark:text-white max-w-[280px]" title={a.formatted_address}>
                              {a.formatted_address.length > 80 ? `${a.formatted_address.slice(0, 80)}…` : a.formatted_address}
                            </div>
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              {[a.barangay, a.locality, a.postal_code].filter(Boolean).join(' • ') || '—'}
                            </div>
                            {a.delivery_instructions && (
                              <div className="text-[11px] text-gray-500 dark:text-[#a1a1aa] truncate max-w-[280px] mt-0.5">“{a.delivery_instructions}”</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-[160px]">{customerLabel(a.customer)}</div>
                        <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[160px]">{a.customer?.email || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border capitalize ${typeBadge(a.address_type)}`}>{a.address_type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {a.isActiveAddress && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
                            </span>
                          )}
                          {a.is_default && (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-300">Default</span>
                          )}
                          {!a.isActiveAddress && !a.is_default && <span className="text-xs text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-900 dark:text-white"><ShoppingBag className="w-3 h-3 text-[#eba236]" /> {a.ordersCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} addresses • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || !pagination.hasPrevPage} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(pagination.totalPages - 4, pagination.page - 2)) + i
                    if (n > pagination.totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === pagination.page ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || !pagination.hasNextPage} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
        Only delivery addresses of customers who ordered from your outlets are listed. This page is read-only — addresses are managed by customers in the storefront app. Exact coordinates and verification internals are never shown here.
      </div>
    </div>
  )
}

export default function CustomerAddressesPage() {
  return (
    <ClientOnly fallback={<AddressesSkeleton />}>
      <AddressesContent />
    </ClientOnly>
  )
}
