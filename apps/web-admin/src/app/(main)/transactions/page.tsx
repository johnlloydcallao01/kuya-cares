'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useTransactions, type TransactionDoc } from '@/hooks/useTransactions'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Receipt, DollarSign, CreditCard, Banknote, TrendingUp, ShoppingBag, Store, Users, Mail, Phone,
  CheckCircle, XCircle, Clock, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  ShieldAlert, Building, CalendarDays, Filter, Star, Award, Eye, Pencil, Trash2, ShieldCheck, Package
} from '@/components/ui/IconWrapper'

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

const PAYMENT_METHOD_OPTS: { value: string; label: string }[] = [
  { value: 'card', label: 'Card' },
  { value: 'gcash', label: 'GCash' },
  { value: 'grab_pay', label: 'GrabPay' },
  { value: 'paymaya', label: 'PayMaya' },
  { value: 'unknown', label: 'Unknown' },
]

// Helpers
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) }
}
function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso).slice(0, 16) }
}
function fmtCurrency(amount: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch { return `₱${amount.toFixed(2)}` }
}
function txnBadge(status: string) {
  const s = status.toLowerCase()
  if (s === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (s === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (s === 'failed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (s === 'refunded') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}
function paymentBadge(method: string | null) {
  const m = (method || '').toLowerCase()
  if (m === 'card') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300'
  if (m === 'gcash') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300'
  if (m === 'grab_pay' || m === 'grabpay') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (m === 'paymaya' || m === 'maya') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#333]'
}
function initials(name: string) { return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || 'T' }

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

function TransactionsSkeleton(){
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

function TransactionsPageContent(){
  // query state
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([])
  const [sort, setSort] = useState<string>('-paid_at')
  const [page, setPage] = useState(1)
  const limit = 10
  const [showFilters, setShowFilters] = useState(false)

  // refund/delete confirm - transactions are read-only, keep for UX parity
  const [deleting, setDeleting] = useState<TransactionDoc | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => { const id = setTimeout(() => setDebouncedQ(q.trim()), 400); return () => clearTimeout(id) }, [q])

  const activeFilterCount = useMemo(() => {
    return statusFilter.length + paymentMethodFilter.length + (debouncedQ ? 1 : 0)
  }, [statusFilter, paymentMethodFilter, debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (statusFilter.length) p.set('status', statusFilter.join(','))
    if (paymentMethodFilter.length) p.set('payment_method', paymentMethodFilter.join(','))
    return p.toString()
  }, [page, limit, sort, debouncedQ, statusFilter, paymentMethodFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useTransactions(qs)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load transactions') : null
  const [actionError, setActionError] = useState<string | null>(null)

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminTransactions(qs) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  useEffect(() => { setPage(1) }, [debouncedQ, statusFilter, paymentMethodFilter, sort])

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

  const toggleStatus = (v: string) => setStatusFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const togglePaymentMethod = (v: string) => setPaymentMethodFilter((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v])
  const clearAll = () => { setQ(''); setDebouncedQ(''); setStatusFilter([]); setPaymentMethodFilter([]) }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteError(null)
    try {
      const res = await fetch(`/api/transactions/${deleting.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to delete transaction')
      setDeleting(null)
      await refetch()
    } catch (e: any) { setDeleteError(e?.message || 'Delete failed') }
  }

  const showTableSkeleton = isInitialLoading

  // derived KPI values
  const totalRevenueDisplay = stats ? fmtCurrency(stats.totalRevenue, 'PHP') : '—'
  const avgDisplay = stats ? fmtCurrency(stats.avgTransactionAmount || 0, 'PHP') : '—'

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Receipt className="w-4 h-4" /></span>
            Transactions
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Monitor payments, settlements and refunds — track PayMongo intents and order linkage in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh transactions"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Total Transactions" value={String(stats.filteredTotal)} sub={`${stats.totalAll} overall`} icon={<Receipt className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Paid" value={String(stats.statusBreakdown.paid || 0)} sub={`${stats.paidCount} succeeded • ${avgDisplay} avg`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Pending" value={String(stats.statusBreakdown.pending || 0)} sub={`${fmtCurrency(stats.totalPendingAmount || 0)} queued`} icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Refunded / Failed" value={String((stats.statusBreakdown.refunded || 0) + (stats.statusBreakdown.failed || 0))} sub={`${stats.statusBreakdown.refunded || 0} refunded • ${stats.statusBreakdown.failed || 0} failed`} icon={<ShieldAlert className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
          <KpiCard title="Revenue" value={totalRevenueDisplay} sub={`Net ${fmtCurrency(stats.netRevenue || 0)} • Refunded ${fmtCurrency(stats.totalRefunded || 0)}`} icon={<Banknote className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payment intent, transaction ID, order ID, amount…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-paid_at">Paid newest</option>
                <option value="paid_at">Paid oldest</option>
                <option value="-createdAt">Created newest</option>
                <option value="createdAt">Created oldest</option>
                <option value="-amount">Amount high → low</option>
                <option value="amount">Amount low → high</option>
                <option value="status">Status A–Z</option>
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
              <FilterPills label="Payment Method" options={PAYMENT_METHOD_OPTS} value={paymentMethodFilter} onToggle={togglePaymentMethod} />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Currency</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#eba236] text-white border border-[#eba236]">PHP</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-[#0a0a0a] text-gray-400 border border-gray-200 dark:border-[#262626]">USD — n/a</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">All transactions are settled in PHP.</p>
              </div>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {statusFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">status:{v} <button onClick={() => toggleStatus(v)}><X className="w-3 h-3" /></button></span>)}
            {paymentMethodFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v} <button onClick={() => togglePaymentMethod(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {actionError && (
          <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4" /> {actionError} <button onClick={() => setActionError(null)} className="ml-auto"><X className="w-4 h-4" /></button>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load transactions</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4 text-center max-w-md">{error}</p>
            <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        )}
        {showTableSkeleton ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : !error && docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Receipt className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No transactions found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters. Transactions appear after checkout — PayMongo intent creation and webhook settlement.</p>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Transaction</th>
                    <th className="text-left px-4 py-3 font-medium">Order</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Customer</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Merchant</th>
                    <th className="text-left px-4 py-3 font-medium">Payment Method</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Date</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((t) => {
                    const order = t.order
                    const customerName = order?.customer?.user ? `${order.customer.user.firstName} ${order.customer.user.lastName}`.trim() : order?.customer?.email || '—'
                    const customerEmail = order?.customer?.user?.email || order?.customer?.email || ''
                    const merchantName = order?.merchant?.outletName || `Outlet #${order?.merchant?.id ?? '—'}`
                    const vendorName = order?.merchant?.vendor?.businessName || ''
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0">
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white text-xs flex items-center gap-1">
                                #{t.id} <span className="font-mono text-[11px] text-gray-500 truncate max-w-[110px]">{t.payment_intent_id ? t.payment_intent_id.slice(0, 16) : '—'}</span>
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-[#a1a1aa] font-mono truncate max-w-[170px]">{t.payment_intent_id || 'no intent'}</div>
                              <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><CalendarDays className="w-3 h-3" /> {fmtDate(t.createdAt)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {order ? (
                            <div className="min-w-[120px]">
                              <Link href={`/orders/${order.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-[#eba236] text-xs flex items-center gap-1">
                                <ShoppingBag className="w-3 h-3 text-[#eba236]" /> #{order.id}
                              </Link>
                              <div className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-0.5 flex items-center gap-1">
                                <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${order.status === 'delivered' || order.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : order.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{order.status}</span>
                              </div>
                              <div className="text-[11px] text-gray-400">{fmtCurrency(order.total, 'PHP')}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="min-w-[160px]">
                            <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[160px] flex items-center gap-1">
                              <Users className="w-3 h-3 text-gray-400" /> {customerName || '—'}
                            </div>
                            {customerEmail && <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[160px] flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400" /> {customerEmail}</div>}
                            {order?.customer?.user?.phone && <div className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {order.customer.user.phone}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="min-w-[150px]">
                            <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[150px] flex items-center gap-1"><Store className="w-3 h-3 text-[#eba236]" /> {merchantName}</div>
                            {vendorName && <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[150px] flex items-center gap-1"><Building className="w-3 h-3 text-gray-400" /> {vendorName}</div>}
                            {order?.merchant?.outletCode && <div className="text-[11px] text-gray-400 font-mono">{order.merchant.outletCode}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${paymentBadge(t.payment_method)}`}>
                            <CreditCard className="w-3 h-3" /> {t.payment_method || 'unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${txnBadge(t.status)}`}>
                            {t.status === 'paid' ? <CheckCircle className="w-3 h-3" /> : t.status === 'pending' ? <Clock className="w-3 h-3" /> : t.status === 'failed' ? <XCircle className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900 dark:text-white text-xs flex items-center justify-end gap-1">
                            <DollarSign className="w-3 h-3 text-[#eba236]" /> {fmtCurrency(t.amount, t.currency || 'PHP')}
                          </div>
                          <div className="text-[11px] text-gray-400">{t.currency || 'PHP'}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-xs text-gray-900 dark:text-white">{t.paid_at ? fmtDateTime(t.paid_at) : '—'}</div>
                          <div className="text-[11px] text-gray-400">Updated {fmtDate(t.updatedAt)}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            {order ? (
                              <Link href={`/orders/${order.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View order">
                                <Eye className="w-4 h-4" />
                              </Link>
                            ) : (
                              <span className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-gray-300 dark:text-[#333]"><Eye className="w-4 h-4" /></span>
                            )}
                            <button onClick={() => setDeleting(t)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Refund / Delete">
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} transactions • 10 per page</div>
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

      {/* Delete / Refund confirm — portal to body for true viewport centering */}
      {deleting && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { setDeleting(null); setDeleteError(null) }}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Refund / Delete transaction?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">
                Transaction <span className="font-semibold text-gray-900 dark:text-white">#{deleting.id}</span> — {fmtCurrency(deleting.amount, deleting.currency)} via {deleting.payment_method || 'unknown'} is <span className="font-semibold">{deleting.status}</span>.
                {deleting.status === 'paid' ? ' This will initiate a refund flow. The CMS BFF is read-only and will reject with 405 if not allowed.' : ' This action cannot be undone and may be blocked by the CMS BFF (405).'}
              </p>
              <div className="mt-3 p-3 bg-gray-50 dark:bg-[#0a0a0a] rounded-lg border border-gray-200 dark:border-[#262626] text-xs">
                <div className="flex justify-between"><span className="text-gray-500">Payment intent</span><span className="font-mono text-gray-900 dark:text-white truncate max-w-[160px]">{deleting.payment_intent_id || '—'}</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-500">Order</span><span className="text-gray-900 dark:text-white">#{deleting.order?.id ?? '—'}</span></div>
                <div className="flex justify-between mt-1"><span className="text-gray-500">Paid at</span><span className="text-gray-900 dark:text-white">{deleting.paid_at ? fmtDateTime(deleting.paid_at) : '—'}</span></div>
              </div>
              {deleteError && <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {deleteError}</div>}
              {deleting.status === 'paid' && <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">Note: Paid transactions are settlements. Prefer refund via PayMongo dashboard; CMS BFF returns 405 for write operations.</p>}
              <div className="flex gap-2 mt-6">
                <button onClick={() => { setDeleting(null); setDeleteError(null) }} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626]">Cancel</button>
                <button onClick={handleDelete} className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">Confirm</button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function TransactionsPage(){
  return (
    <ClientOnly fallback={<TransactionsSkeleton />}>
      <TransactionsPageContent />
    </ClientOnly>
  )
}
