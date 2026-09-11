'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useOrders, type OrderDoc, type OrdersResponse } from '@/hooks/useOrders'
import { ClientOnly } from '@/components/ClientOnly'
import {
  ShoppingBag, Receipt, Package, Truck, Store, Users, Mail, Phone, CheckCircle, XCircle, Clock,
  Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle, ShieldAlert, Building,
  TrendingUp, CalendarDays, Filter, Star, Award, Eye, Pencil, Trash2, ShieldCheck
} from '@/components/ui/IconWrapper'

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready_for_pickup', label: 'Ready for Pickup' },
  { value: 'on_delivery', label: 'On Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const FULFILLMENT_OPTS: { value: string; label: string }[] = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'pickup', label: 'Pickup' },
]

const DELIVERY_STATUS_OPTS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigning_driver', label: 'Assigning Driver' },
  { value: 'driver_assigned', label: 'Driver Assigned' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'expired', label: 'Expired' },
]

function statusBadge(s: string) {
  const v = (s || '').toLowerCase()
  if (v === 'delivered') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (v === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (v === 'cancelled') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (v === 'on_delivery') return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800'
  if (v === 'preparing') return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800'
  if (v === 'accepted') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (v === 'ready_for_pickup') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#262626]'
}

function fulfillmentBadge(s: string) {
  const v = (s || '').toLowerCase()
  if (v === 'delivery') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (v === 'pickup') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa]'
}

function deliveryBadge(s: string | null) {
  const v = (s || 'none').toLowerCase()
  if (v === 'completed') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (v === 'pending' || v === 'assigning_driver') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (v === 'canceled' || v === 'expired') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (v === 'driver_assigned' || v === 'picked_up') return 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-300 dark:border-cyan-800'
  if (v === 'none') return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#262626]'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) }
}
function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso).slice(0, 16) }
}
function fmtCurrency(n: number) {
  try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(n || 0) } catch { return `₱${(n || 0).toFixed(2)}` }
}
function orderNumber(o: OrderDoc) {
  return o.orderNumber || o.order_number || `#${o.id}`
}
function initials(name: string) { return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'O' }

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

function OrdersSkeleton(){
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
        {Array.from({length:5}).map((_,i)=><div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="p-4 space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
    </div>
  )
}

function OrdersPageContent() {
  const searchParams = useSearchParams()
  // query state
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>(() => {
    const s = searchParams.get('status')
    return s ? [s] : []
  })
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string[]>([])
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<string[]>([])
  const [sort, setSort] = useState<string>('-placed_at')
  const [page, setPage] = useState(1)
  const limit = 10
  const [showFilters, setShowFilters] = useState(false)

  // cancel confirm
  const [deleting, setDeleting] = useState<OrderDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim()), 400); return () => clearTimeout(id) }, [q])

  useEffect(() => {
    const s = searchParams.get('status')
    if (s && !statusFilter.includes(s)) setStatusFilter([s])
  }, [searchParams])

  const activeFilterCount = useMemo(() => {
    return statusFilter.length + fulfillmentFilter.length + deliveryStatusFilter.length + (debouncedQ ? 1 : 0)
  }, [statusFilter, fulfillmentFilter, deliveryStatusFilter, debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (statusFilter.length) p.set('status', statusFilter.join(','))
    if (fulfillmentFilter.length) p.set('fulfillmentType', fulfillmentFilter.join(','))
    if (deliveryStatusFilter.length) p.set('deliveryStatus', deliveryStatusFilter.join(','))
    return p.toString()
  }, [page, limit, sort, debouncedQ, statusFilter, fulfillmentFilter, deliveryStatusFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useOrders(qs)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load orders') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminOrders(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  // reset page when filters change
  useEffect(() => { setPage(1) }, [debouncedQ, statusFilter, fulfillmentFilter, deliveryStatusFilter, sort])

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

  // auto-dismiss toast
  useEffect(() => {
    if (!actionError) return
    const id = setTimeout(() => setActionError(null), 4000)
    return () => clearTimeout(id)
  }, [actionError])

  const toggleStatus = (v: string) => setStatusFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const toggleFulfillment = (v: string) => setFulfillmentFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const toggleDeliveryStatus = (v: string) => setDeliveryStatusFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const clearAll = () => { setQ(''); setDebouncedQ(''); setStatusFilter([]); setFulfillmentFilter([]); setDeliveryStatusFilter([]) }

  const handleCancel = async () => {
    if (!deleting || isDeleting) return
    const st = (deleting.status || '').toLowerCase()
    if (st === 'delivered' || st === 'cancelled') {
      setDeleteError('Order already finalized — cannot cancel')
      return
    }
    setIsDeleting(true); setDeleteError(null)
    try {
      const res = await fetch(`/api/orders/${deleting.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to cancel order')
      const cancelledId = deleting.id
      const prevStatus = st
      // Optimistic status flip across every cached orders list (all pages/filters).
      // The row shows Cancelled instantly even while the CMS Redis list cache
      // is still converging; invalidate+refetch below reconciles with the server.
      queryClient.setQueriesData<OrdersResponse>(
        {
          queryKey: ['admin', 'orders'],
          predicate: (q) => q.queryKey.length === 3 && typeof q.queryKey[2] === 'string',
        },
        (old) => {
          if (!old || !Array.isArray(old.docs)) return old
          let flipped = false
          const docs = old.docs.map((d) => {
            if (String(d.id) !== String(cancelledId)) return d
            flipped = true
            return { ...d, status: 'cancelled' }
          })
          if (!flipped) return old
          const stats = old.stats && old.stats.statusBreakdown
            ? {
                ...old.stats,
                statusBreakdown: {
                  ...old.stats.statusBreakdown,
                  [prevStatus]: Math.max(0, (old.stats.statusBreakdown[prevStatus] ?? 1) - 1),
                  cancelled: (old.stats.statusBreakdown['cancelled'] ?? 0) + 1,
                },
              }
            : old.stats
          return { ...old, docs, stats }
        }
      )
      setDeleting(null)
      // Bust every cached orders list (all pages/filters) so the cancellation
      // reconciles with the server instead of waiting out the 3-min staleTime.
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] })
      await refetch()
    } catch (e: any) {
      const msg = e?.message || 'Cancel failed'
      setDeleteError(msg)
      setActionError(msg)
    } finally { setIsDeleting(false) }
  }

  const showTableSkeleton = isInitialLoading

  // derived KPI values
  const totalOrdersVal = stats ? String(stats.filteredTotal ?? stats.totalAll ?? pagination?.totalDocs ?? 0) : '—'
  const pendingVal = stats ? String(stats.statusBreakdown?.pending ?? stats.pendingCount ?? 0) : '—'
  const inProgressVal = stats ? String(
    (stats.statusBreakdown?.preparing || 0) + (stats.statusBreakdown?.ready_for_pickup || 0) + (stats.statusBreakdown?.on_delivery || 0)
  ) : '—'
  const deliveredVal = stats ? String(stats.statusBreakdown?.delivered ?? stats.deliveredCount ?? 0) : '—'
  const revenueVal = stats ? fmtCurrency(stats.totalRevenue || 0) : '—'
  const avgVal = stats ? fmtCurrency(stats.averageOrderValue || 0) : ''

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><ShoppingBag className="w-4 h-4" /></span>
            Orders
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Track and manage customer orders — monitor fulfillment, delivery status, and revenue.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh orders"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/orders/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" /> New Order
          </Link>
        </div>
      </div>

      {/* KPIs */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Total Orders" value={totalOrdersVal} sub={`${stats.totalAll} overall`} icon={<ShoppingBag className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Pending" value={pendingVal} sub="awaiting acceptance" icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="In Progress" value={inProgressVal} sub="preparing + delivery" icon={<Package className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
          <KpiCard title="Delivered" value={deliveredVal} sub={`${Math.round(((stats.statusBreakdown?.delivered||0)/Math.max(1,stats.totalAll))*100)}% completed`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Revenue" value={revenueVal} sub={avgVal ? `avg ${avgVal}` : 'total revenue'} icon={<Receipt className="w-5 h-5 text-white" />} iconBg="bg-[#c88a20]" trend={avgVal ? `avg ${avgVal}` : undefined} />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order number, customer, merchant, outlet…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-placed_at">Newest first</option>
                <option value="placed_at">Oldest first</option>
                <option value="-total">Highest total</option>
                <option value="total">Lowest total</option>
                <option value="-createdAt">Recently created</option>
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
              <FilterPills label="Status" options={STATUS_OPTS} value={statusFilter} onToggle={toggleStatus} />
              <FilterPills label="Fulfillment" options={FULFILLMENT_OPTS} value={fulfillmentFilter} onToggle={toggleFulfillment} />
              <FilterPills label="Delivery Status" options={DELIVERY_STATUS_OPTS} value={deliveryStatusFilter} onToggle={toggleDeliveryStatus} />
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {statusFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">status:{v} <button onClick={() => toggleStatus(v)}><X className="w-3 h-3" /></button></span>)}
            {fulfillmentFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">fulfillment:{v} <button onClick={() => toggleFulfillment(v)}><X className="w-3 h-3" /></button></span>)}
            {deliveryStatusFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">delivery:{v} <button onClick={() => toggleDeliveryStatus(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load orders</h3>
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
            <h3 className="font-semibold text-gray-900 dark:text-white">No orders found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters. Orders appear here once customers place them through the mobile app.</p>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Order</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Customer</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Merchant</th>
                    <th className="text-left px-4 py-3 font-medium">Fulfillment</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Delivery</th>
                    <th className="text-right px-4 py-3 font-medium">Total</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Placed</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((o) => {
                    const fulfillment = o.fulfillment_type || o.fulfillmentType || 'delivery'
                    const placed = (o as any).placed_at || (o as any).placedAt || o.createdAt
                    const total = o.total ?? 0
                    const customerName = o.customer?.user ? `${o.customer.user.firstName} ${o.customer.user.lastName}`.trim() : o.customer?.email || 'Guest'
                    const customerEmail = o.customer?.email || '—'
                    const merchantName = o.merchant?.outletName || '—'
                    const merchantVendor = o.merchant?.vendor?.businessName || ''
                    const merchantLogo = (o.merchant?.vendor as any)?.logo?.url || null
                    const deliveryStatus = o.lalamove?.status || 'none'
                    return (
                      <tr key={String(o.id)} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-[180px]">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0">
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[160px]">{orderNumber(o)}</div>
                              <div className="text-xs text-gray-500 dark:text-[#a1a1aa] flex items-center gap-1 truncate max-w-[160px]"><Building className="w-3 h-3" /> {merchantName}</div>
                              <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><CalendarDays className="w-3 h-3" /> {fmtDate(placed)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[160px]">{customerName}</div>
                          <div className="text-xs text-gray-500 dark:text-[#a1a1aa] flex items-center gap-1 truncate max-w-[160px]"><Mail className="w-3 h-3 text-gray-400" /> {customerEmail}</div>
                          {(o.customer as any)?.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {(o.customer as any).phone}</div>}
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="flex items-center gap-2 min-w-[140px]">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden">
                              {merchantLogo ? <img src={merchantLogo} alt={merchantVendor} className="h-8 w-8 rounded-lg object-cover" /> : initials(merchantName)}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[140px]">{merchantName}</div>
                              <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[140px] flex items-center gap-1"><Store className="w-3 h-3 text-[#eba236]" /> {merchantVendor || o.merchant?.outletCode || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${fulfillmentBadge(fulfillment)}`}>
                            {fulfillment === 'delivery' ? <Truck className="w-3 h-3" /> : <Package className="w-3 h-3" />}
                            {fulfillment}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${statusBadge(o.status)}`}>
                            {o.status === 'delivered' ? <CheckCircle className="w-3 h-3" /> : o.status === 'cancelled' ? <XCircle className="w-3 h-3" /> : o.status === 'pending' ? <Clock className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                            {o.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${deliveryBadge(deliveryStatus)}`}>
                            <Truck className="w-3 h-3" /> {deliveryStatus.replace(/_/g, ' ')}
                          </span>
                          {o.lalamove?.trackingLink && <a href={o.lalamove.trackingLink} target="_blank" rel="noreferrer" className="block text-[11px] text-[#eba236] hover:underline mt-1">Track</a>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-gray-900 dark:text-white">{fmtCurrency(total)}</div>
                          <div className="text-xs text-gray-500 dark:text-[#a1a1aa]">sub {fmtCurrency(o.subtotal || 0)}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-xs text-gray-900 dark:text-white flex items-center gap-1"><CalendarDays className="w-3 h-3 text-gray-400" /> {fmtDateTime(placed)}</div>
                          {o.notes && <div className="text-xs text-gray-500 truncate max-w-[160px]">{o.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link href={`/orders/${o.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View"><Eye className="w-4 h-4" /></Link>
                            <Link href={`/orders/${o.id}/edit`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600 dark:hover:text-blue-400" title="Edit"><Pencil className="w-4 h-4" /></Link>
                            <button onClick={() => { setDeleting(o); setDeleteError(null) }} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Cancel"><Trash2 className="w-4 h-4" /></button>
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
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} orders • 10 per page</div>
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

      {/* Delete/Cancel portal */}
      {deleting && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { if (!isDeleting) setDeleting(null) }}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Cancel order?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">This will cancel order <span className="font-semibold text-gray-900 dark:text-white">{orderNumber(deleting)}</span> ({deleting.status}). {['delivered','cancelled'].includes((deleting.status||'').toLowerCase()) ? 'This order is already finalized and cannot be cancelled.' : 'This action cannot be undone.'}</p>
              {deleteError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{deleteError}</p>}
              <div className="flex gap-2 mt-6">
                <button onClick={() => setDeleting(null)} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                <button onClick={handleCancel} disabled={isDeleting || ['delivered','cancelled'].includes((deleting.status||'').toLowerCase())} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {isDeleting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isDeleting ? 'Cancelling…' : 'Confirm cancel'}
                </button>
              </div>
              {['delivered','cancelled'].includes((deleting.status||'').toLowerCase()) && <p className="text-xs text-amber-600 mt-3">Blocked: order already {deleting.status}. Finalized orders cannot be cancelled.</p>}
            </div>
          </div>,
          document.body
        )}

      {/* toast */}
      {actionError && (
        <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-[#171717] border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {actionError} <button onClick={() => setActionError(null)} className="ml-2 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><X className="w-3 h-3" /></button>
        </div>
      )}
    </div>
  )
}

export default function OrdersPage(){
  // Pure CSR: ?status= seeds useState on first render (server [] vs client
  // [status]) + dates are TZ-sensitive → identical skeleton until mounted.
  return (
    <ClientOnly fallback={<OrdersSkeleton />}>
      <OrdersPageContent />
    </ClientOnly>
  )
}
