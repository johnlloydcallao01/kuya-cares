'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useOrderItems, type OrderItemDoc } from '@/hooks/useOrderItems'
import { ClientOnly } from '@/components/ClientOnly'
import {
  ShoppingBag, Receipt, Package, Layers, Store, Truck, Users, Mail, Phone,
  CheckCircle, XCircle, Clock, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  ShieldAlert, Building, TrendingUp, CalendarDays, Filter, Star, Award, Eye, Pencil, Trash2, ShieldCheck,
} from '@/components/ui/IconWrapper'

const HAS_OPTIONS_OPTS: { value: string; label: string }[] = [
  { value: 'true', label: 'With Modifiers' },
  { value: 'false', label: 'No Modifiers' },
]

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) }
}
function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso) }
}
function fmtCurrency(v: number | string | null | undefined) {
  const n = typeof v === 'string' ? Number(v) : (v ?? 0)
  const num = Number.isFinite(n as number) ? (n as number) : 0
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(num)
}
function hasOptions(item: OrderItemDoc) {
  const o = item.options_snapshot as any
  if (!o) return false
  if (Array.isArray(o)) return o.length > 0
  if (typeof o === 'object') return Object.keys(o).length > 0
  return false
}
function orderStatusBadge(status?: string) {
  const s = (status || '').toLowerCase()
  if (s === 'delivered' || s === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (s === 'pending' || s === 'preparing') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (s === 'cancelled' || s === 'canceled' || s === 'rejected') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (s === 'out_for_delivery' || s === 'shipped') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
}
function initials(name: string) { return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'OI' }

function KpiCard({ title, value, sub, icon, iconBg, trend }: { title: string; value: string; sub?: string; icon: React.ReactNode; iconBg: string; trend?: string }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] truncate">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate">{sub}</p>}
          {trend && <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mt-1">{trend}</p>}
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
            <button key={opt.value} onClick={() => onToggle(opt.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:border-gray-300'}`}>{opt.label}</button>
          )
        })}
      </div>
    </div>
  )
}

function OrderItemsSkeleton(){
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({length:4}).map((_,i)=><div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="p-4 space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
    </div>
  )
}

function OrderItemsPageContent(){
  // query state
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [hasOptionsFilter, setHasOptionsFilter] = useState<string[]>([])
  const [sort, setSort] = useState<string>('-createdAt')
  const [page, setPage] = useState(1)
  const limit = 10
  const [showFilters, setShowFilters] = useState(false)

  // delete confirm
  const [deleting, setDeleting] = useState<OrderItemDoc | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim()), 400); return () => clearTimeout(id) }, [q])

  const activeFilterCount = useMemo(() => {
    return hasOptionsFilter.length + (debouncedQ ? 1 : 0)
  }, [hasOptionsFilter, debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (hasOptionsFilter.length === 1) p.set('has_options', hasOptionsFilter[0])
    return p.toString()
  }, [page, limit, sort, debouncedQ, hasOptionsFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useOrderItems(qs)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load order items') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminOrderItems(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  // reset page when filters change
  useEffect(() => { setPage(1) }, [debouncedQ, hasOptionsFilter, sort])

  // Prevent page scroll when delete confirm is open
  useEffect(() => {
    const isOpen = !!deleting
    if (isOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
    document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [deleting])

  const toggleHasOptions = (v: string) => setHasOptionsFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const clearAll = () => { setQ(''); setDebouncedQ(''); setHasOptionsFilter([]) }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    // block if order already delivered/cancelled
    const status = (deleting.order as any)?.status?.toLowerCase?.() || ''
    if (status === 'delivered' || status === 'completed' || status === 'cancelled' || status === 'canceled') {
      setDeleteError(`Cannot delete — order #${String((deleting.order as any)?.id ?? deleting.id)} is ${status}.`)
      return
    }
    try {
      const res = await fetch(`/api/order-items/${deleting.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to delete')
      setDeleting(null)
      await refetch()
    } catch (e: any) { setDeleteError(e?.message || 'Delete failed') }
  }

  const showTableSkeleton = isInitialLoading

  // derived KPIs with fallback to client aggregation if stats missing
  const kpiTotalItems = useMemo(() => {
    if (stats?.filteredTotal != null) return Number(stats.filteredTotal)
    if (stats?.totalDocs != null) return Number(stats.totalDocs)
    if (pagination?.totalDocs != null) return pagination.totalDocs
    return docs.length
  }, [stats, pagination, docs])
  const kpiRevenue = useMemo(() => {
    if (stats?.totalRevenue != null) return Number(stats.totalRevenue)
    return docs.reduce((s, d) => s + (Number(d.total_price) || 0), 0)
  }, [stats, docs])
  const kpiQuantity = useMemo(() => {
    if (stats?.totalQuantity != null) return Number(stats.totalQuantity)
    return docs.reduce((s, d) => s + (Number(d.quantity) || 0), 0)
  }, [stats, docs])
  const kpiUniqueOrders = useMemo(() => {
    if (stats?.uniqueOrders != null) return Number(stats.uniqueOrders)
    const set = new Set(docs.map((d) => String((d.order as any)?.id ?? d.id)))
    // if docs empty but pagination totalDocs exists, show at least docs length unique approximation
    return set.size || 0
  }, [stats, docs])
  const kpiWithModifiersPct = useMemo(() => {
    const withCount = (stats?.withModifiers as number) ?? (stats?.withModifiersCount as number) ?? docs.filter(hasOptions).length
    const total = kpiTotalItems || docs.length || 1
    return Math.round((withCount / Math.max(1, total)) * 100)
  }, [stats, docs, kpiTotalItems])

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><ShoppingBag className="w-4 h-4" /></span>
            Order Items
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Audit every line item — product snapshots, modifiers, pricing at purchase, and order linkage.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh order items"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          {/* Read-only: no New button for order-items; keep hidden but preserve layout parity */}
          <span className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-[#262626] text-gray-400 dark:text-[#a1a1aa] rounded-xl text-sm font-semibold border border-gray-200 dark:border-[#333] cursor-not-allowed" title="Order items are read-only">
            <Receipt className="w-4 h-4" /> Read-only
          </span>
        </div>
      </div>

      {/* KPIs */}
      {stats || pagination || !loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Total Items" value={String(kpiTotalItems)} sub={`${stats?.totalAll ? `${stats.totalAll} overall` : `${pagination?.totalDocs ?? kpiTotalItems} in DB`}`} icon={<Package className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Revenue" value={fmtCurrency(kpiRevenue)} sub="sum of line totals" icon={<TrendingUp className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Quantity Sold" value={String(kpiQuantity)} sub="units across items" icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Unique Orders" value={String(kpiUniqueOrders)} sub={`${kpiTotalItems ? `${kpiTotalItems} items` : '—'}`} icon={<Receipt className="w-5 h-5 text-white" />} iconBg="bg-violet-600" />
          <KpiCard title="With Modifiers" value={`${kpiWithModifiersPct}%`} sub={`${docs.filter(hasOptions).length} of ${kpiTotalItems || docs.length} shown`} icon={<Star className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product snapshot, order ID, merchant, options…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest first</option>
                <option value="createdAt">Oldest first</option>
                <option value="-total_price">Highest total</option>
                <option value="total_price">Lowest total</option>
                <option value="-quantity">Most quantity</option>
                <option value="-price_at_purchase">Highest unit price</option>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FilterPills label="Has Options" options={HAS_OPTIONS_OPTS} value={hasOptionsFilter} onToggle={toggleHasOptions} />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Quick Sort</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['-createdAt', 'Newest'],
                    ['-total_price', 'Highest total'],
                    ['-quantity', 'Most qty'],
                  ].map(([v, l]) => {
                    const active = sort === v
                    return <button key={v} onClick={() => setSort(v)} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{l}</button>
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Type</p>
                <div className="inline-flex items-center gap-2 text-xs text-gray-500 dark:text-[#a1a1aa]">
                  <Filter className="w-3 h-3" /> Line items are immutable audit records.
                </div>
              </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {hasOptionsFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">has_options:{v} <button onClick={() => toggleHasOptions(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {actionError && (
          <div className="mx-4 mt-4 flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{actionError}</span>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load order items</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        )}
        {showTableSkeleton ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : !error && docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><ShoppingBag className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No order items found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters. Order items appear here after orders are placed via storefront or admin.</p>
            <Link href="/orders" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-semibold"><Receipt className="w-4 h-4" /> View orders</Link>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Line Item</th>
                    <th className="text-left px-4 py-3 font-medium">Order</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Product (Live)</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Merchant Listing</th>
                    <th className="text-right px-4 py-3 font-medium">Quantity</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Unit Price</th>
                    <th className="text-right px-4 py-3 font-medium">Line Total</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Options</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Created</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((it) => {
                    const orderId = (it.order as any)?.id ?? '—'
                    const orderStatus = (it.order as any)?.status
                    const placedAt = (it.order as any)?.placed_at
                    const hasOpts = hasOptions(it)
                    const merchantListing = (it.merchant_product as any)?.display_title || `#${String((it.merchant_product as any)?.id ?? '—')}`
                    const productName = (it.product as any)?.name || it.product_name_snapshot || '—'
                    const productSlug = (it.product as any)?.slug
                    return (
                      <tr key={String(it.id)} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0">
                              <Package className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">#{String(it.id)} — {it.product_name_snapshot || productName}</div>
                              <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px] flex items-center gap-1"><Layers className="w-3 h-3" /> {productSlug ? `/${productSlug}` : 'snapshot'} </div>
                              <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><CalendarDays className="w-3 h-3" /> {fmtDate(it.createdAt)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1 min-w-[140px]">
                            <Link href={`/orders/${String(orderId)}`} className="font-mono text-xs font-semibold text-gray-900 dark:text-white hover:text-[#eba236] hover:underline">#{String(orderId)}</Link>
                            {orderStatus ? <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize w-fit ${orderStatusBadge(orderStatus)}`}>{orderStatus === 'delivered' ? <CheckCircle className="w-3 h-3" /> : orderStatus === 'pending' ? <Clock className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}{String(orderStatus).replace(/_/g, ' ')}</span> : <span className="text-xs text-gray-400">—</span>}
                            {placedAt && <span className="text-[11px] text-gray-400">{fmtDateTime(placedAt)}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[160px] flex items-center gap-1"><Store className="w-3 h-3 text-[#eba236]" /> {productName}</div>
                          {productSlug && <div className="text-[11px] text-gray-500 truncate max-w-[160px]">{productSlug}</div>}
                          {!(it.product) && <span className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 border border-amber-200">snapshot only</span>}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="text-xs text-gray-900 dark:text-white truncate max-w-[160px] flex items-center gap-1"><Building className="w-3 h-3 text-gray-400" /> {merchantListing}</div>
                          <div className="text-[11px] text-gray-500">MP #{String((it.merchant_product as any)?.id ?? '—')}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-semibold text-gray-700 dark:text-white">
                            <Layers className="w-3 h-3 text-[#eba236]" /> × {it.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <span className="text-xs font-medium text-gray-900 dark:text-white">{fmtCurrency(it.price_at_purchase)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-900 dark:text-white bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-2 py-1 rounded-full">{fmtCurrency(it.total_price)}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {hasOpts ? (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {(() => {
                                const snap = it.options_snapshot as any
                                const entries: [string, unknown][] = Array.isArray(snap) ? snap.map((v: unknown, i: number) => [String(i), v]) : Object.entries(snap as Record<string, unknown>)
                                return entries.slice(0, 3).map(([k, v]) => (
                                  <span key={k} className="inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-[#eba236]/10 text-[#8a5f17] dark:text-[#eba236] border border-[#eba236]/20 truncate max-w-[100px]">{k}: {String(v).slice(0, 20)}</span>
                                ))
                              })()}
                              {(() => {
                                const snap = it.options_snapshot as any
                                const len = Array.isArray(snap) ? snap.length : Object.keys(snap || {}).length
                                return len > 3 ? <span className="text-[11px] text-gray-400">+{len - 3}</span> : null
                              })()}
                            </div>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-gray-500 dark:text-[#a1a1aa] whitespace-nowrap">{fmtDateTime(it.createdAt)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link href={`/orders/${String(orderId)}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View order"><Eye className="w-4 h-4" /></Link>
                            <button onClick={() => setDeleting(it)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Delete line item"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination — fixed 10 per page, always visible when data exists */}
            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} items • 10 per page</div>
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

      {/* Delete confirm — portal to body for true viewport centering */}
      {deleting && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setDeleting(null); setDeleteError(null) }}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Delete line item?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">This will permanently delete line item <span className="font-semibold text-gray-900 dark:text-white">#{String(deleting.id)}</span> — {deleting.product_name_snapshot || (deleting.product as any)?.name || '—'} × {deleting.quantity}. {(() => { const s=(deleting.order as any)?.status?.toLowerCase?.(); if(s==='delivered'||s==='completed'||s==='cancelled'||s==='canceled') return `Order #${String((deleting.order as any)?.id)} is ${s} — deletion blocked.`; return 'This action cannot be undone.'})()}</p>
              {deleteError && <p className="text-sm text-red-600 mt-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {deleteError}</p>}
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setDeleting(null); setDeleteError(null) }} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626]">Cancel</button>
                <button onClick={handleDelete} disabled={(() => { const s=(deleting.order as any)?.status?.toLowerCase?.(); return s==='delivered'||s==='completed'||s==='cancelled'||s==='canceled' })()} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">Confirm delete</button>
              </div>
              {(() => { const s=(deleting.order as any)?.status?.toLowerCase?.(); if(s==='delivered'||s==='completed'||s==='cancelled'||s==='canceled') return <p className="text-xs text-amber-600 mt-3">Blocked: order is {s}. Line items of finalized orders cannot be removed.</p>; return null })()}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function OrderItemsPage(){
  return (
    <ClientOnly fallback={<OrderItemsSkeleton />}>
      <OrderItemsPageContent />
    </ClientOnly>
  )
}
