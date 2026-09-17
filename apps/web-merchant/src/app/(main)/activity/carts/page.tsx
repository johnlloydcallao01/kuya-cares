'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ClientOnly } from '@/components/ClientOnly'
import {
  ShoppingCart, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  Users, Package, Store, DollarSign,
} from '@/components/ui/IconWrapper'

type CartDoc = {
  id: number
  customer: { id: number; email: string; firstName: string; lastName: string } | null
  merchant: { id: number; outletName: string; outletCode: string } | null
  merchantProduct: { id: number; display_title: string } | null
  product: { id: number; name: string; slug: string } | null
  quantity: number
  subtotal: number
  priceAtAdd: number
  status: string
  createdAt: string
  updatedAt: string
}

type OutletOption = { id: number; outletName: string }

type Pagination = { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
type Stats = {
  totalCarts: number
  filteredTotal: number
  uniqueCustomers: number
  uniqueProducts: number
  recoverableRevenue: number
  perOutlet: { id: number; outletName: string; count: number; revenue: number }[]
}

const SORTS: { value: string; label: string }[] = [
  { value: '-updatedAt', label: 'Recently updated' },
  { value: 'updatedAt', label: 'Least recently updated' },
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: '-subtotal', label: 'Highest value' },
  { value: 'subtotal', label: 'Lowest value' },
  { value: '-quantity', label: 'Most quantity' },
]

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '—'
  try {
    return `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  } catch {
    return `₱${Number(n).toFixed(2)}`
  }
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}
function customerLabel(c: CartDoc['customer']): string {
  if (!c) return 'Unknown customer'
  const name = `${c.firstName || ''} ${c.lastName || ''}`.trim()
  return name || c.email || `Customer #${c.id}`
}
function customerInitials(c: CartDoc['customer']): string {
  const name = customerLabel(c === null ? null : c)
  if (name === 'Unknown customer') return '?'
  return name.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
}
function itemLabel(d: CartDoc): string {
  return d.merchantProduct?.display_title || d.product?.name || 'Cart item'
}
function itemSub(d: CartDoc): string {
  const parts: string[] = []
  if (d.product?.name && d.merchantProduct?.display_title !== d.product.name) parts.push(d.product.name)
  parts.push(`× ${d.quantity}`)
  return parts.join(' • ')
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

function CartsSkeleton() {
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

function CartsContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [outletFilter, setOutletFilter] = useState('')
  const [sort, setSort] = useState('-updatedAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<CartDoc[]>([])
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
  }, [debouncedQ, outletFilter, sort])

  const activeFilterCount = useMemo(
    () => (outletFilter ? 1 : 0) + (debouncedQ ? 1 : 0),
    [outletFilter, debouncedQ],
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
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/activity/carts?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load abandoned carts')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setMerchants(Array.isArray(j.merchants) ? j.merchants : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load abandoned carts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, outletFilter, sort, page])

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setOutletFilter('')
  }

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(docs.length / limit))
  const topOutlet = stats && stats.perOutlet.length > 0 ? `${stats.perOutlet[0].outletName} (${fmtMoney(stats.perOutlet[0].revenue)})` : '—'

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><ShoppingCart className="w-4 h-4" /></span>
            Abandoned Carts
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Products customers added but did not check out at your outlets (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh abandoned carts"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Abandoned Carts" value={String(stats.filteredTotal)} sub={`${stats.totalCarts} overall`} icon={<ShoppingCart className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Recoverable Revenue" value={fmtMoney(stats.recoverableRevenue)} sub="sum of line subtotals" icon={<DollarSign className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Unique Customers" value={String(stats.uniqueCustomers)} sub="carts left behind" icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, outlet, or product…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
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
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Outlet</p>
              <select value={outletFilter} onChange={(e) => setOutletFilter(e.target.value)} className="w-full sm:max-w-xs px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
                <option value="">All your outlets</option>
                {merchants.map((m) => <option key={m.id} value={String(m.id)}>{m.outletName} (#{m.id})</option>)}
              </select>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {outletFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{merchants.find((m) => String(m.id) === outletFilter)?.outletName || `Outlet #${outletFilter}`} <button onClick={() => setOutletFilter('')}><X className="w-3 h-3" /></button></span>}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load abandoned carts</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><ShoppingCart className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No abandoned carts found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Carts appear here when customers add items at your outlets but don&apos;t check out. Try adjusting search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Customer</th>
                    <th className="text-left px-4 py-3 font-medium">Cart Item</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Outlet</th>
                    <th className="text-right px-4 py-3 font-medium">Subtotal</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="h-9 w-9 rounded-xl bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] flex items-center justify-center text-xs font-bold shrink-0">
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
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-[220px] flex items-center gap-1">
                            <Package className="w-3 h-3 text-[#eba236] shrink-0" /> {itemLabel(d)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[220px]">{itemSub(d)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-medium text-gray-700 dark:text-white">
                          <Store className="w-3 h-3 text-[#eba236]" /> {d.merchant?.outletName || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{fmtMoney(d.subtotal)}</div>
                        <div className="text-[11px] text-gray-400">× {d.quantity}</div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa] whitespace-nowrap">{fmtDate(d.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} carts • 10 per page</div>
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
        Only abandoned carts at <span className="font-semibold text-gray-700 dark:text-white">your outlets</span> appear here. Revenue is recoverable line value, not verified sales. This page is read-only — cart data is owned by customers in the storefront app.
      </div>
    </div>
  )
}

export default function CartsPage() {
  return (
    <ClientOnly fallback={<CartsSkeleton />}>
      <CartsContent />
    </ClientOnly>
  )
}
