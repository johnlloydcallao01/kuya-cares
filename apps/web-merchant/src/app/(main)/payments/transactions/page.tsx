'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Receipt, CheckCircle, Clock, ShieldAlert, Banknote, XCircle, CreditCard, Users, Store,
  Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle, DollarSign
} from '@/components/ui/IconWrapper'

type TransactionDoc = {
  id: number
  payment_intent_id: string | null
  payment_method: string | null
  amount: number
  currency: string
  status: string
  paid_at: string | null
  createdAt: string
  updatedAt: string
  order: {
    id: number
    status: string
    total: number
    subtotal: number
    delivery_fee: number
    platform_fee: number
    fulfillment_type: string
    placed_at: string | null
    lalamove_order_id: string | null
    delivery_status: string
    merchant: { id: number; outletName: string; outletCode: string; isActive: boolean | null } | null
    customer: { id: number; email: string; user: { id: number; email: string; firstName: string; lastName: string; phone: string | null } | null } | null
    createdAt: string
    updatedAt: string
  } | null
  isPaid: boolean
}

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

type Stats = {
  totalAll: number
  filteredTotal: number
  statusBreakdown: Record<string, number>
  paymentMethodBreakdown: Record<string, number>
  totalRevenue: number
  totalRefunded: number
  totalFailed: number
  totalPendingAmount: number
  netRevenue: number
  avgTransactionAmount: number
  paidCount: number
  pendingCount: number
  failedCount: number
  refundedCount: number
}

const STATUS_OPTS = [
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

const PAYMENT_METHOD_OPTS = [
  { value: 'card', label: 'Card' },
  { value: 'gcash', label: 'GCash' },
  { value: 'grab_pay', label: 'GrabPay' },
  { value: 'paymaya', label: 'PayMaya' },
  { value: 'unknown', label: 'Unknown' },
]

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

function TransactionsSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="h-16 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
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
            <button key={opt.value} onClick={() => onToggle(opt.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{opt.label}</button>
          )
        })}
      </div>
    </div>
  )
}

function TransactionsContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-paid_at')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<TransactionDoc[]>([])
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
  }, [debouncedQ, statusFilter, paymentMethodFilter, sort])

  const activeFilterCount = useMemo(
    () => statusFilter.length + paymentMethodFilter.length + (debouncedQ ? 1 : 0),
    [statusFilter, paymentMethodFilter, debouncedQ],
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
      if (statusFilter.length) qs.set('status', statusFilter.join(','))
      if (paymentMethodFilter.length) qs.set('payment_method', paymentMethodFilter.join(','))
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/transactions?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load transactions')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, statusFilter, paymentMethodFilter, sort, page])

  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) =>
    setter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))

  const toggleStatus = toggleFilter(setStatusFilter)
  const togglePaymentMethod = toggleFilter(setPaymentMethodFilter)

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setStatusFilter([])
    setPaymentMethodFilter([])
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (statusFilter.length > 1) arr = arr.filter((t) => statusFilter.includes(t.status.toLowerCase()))
    if (paymentMethodFilter.length > 1) arr = arr.filter((t) => paymentMethodFilter.includes((t.payment_method || 'unknown').toLowerCase()))
    return arr
  }, [docs, statusFilter, paymentMethodFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))
  const avgDisplay = stats ? fmtCurrency(stats.avgTransactionAmount || 0) : '₱0.00'
  const totalRevenueDisplay = stats ? fmtCurrency(stats.totalRevenue || 0) : '₱0.00'

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Receipt className="w-4 h-4" /></span>
            Transactions
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Payments across your outlets — PayMongo intents, methods, and settlement status (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh transactions"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard title="Total Transactions" value={String(stats.filteredTotal)} sub={`${stats.totalAll} overall`} icon={<Receipt className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
          <KpiCard title="Paid" value={String(stats.statusBreakdown.paid || 0)} sub={`${stats.paidCount} succeeded • ${avgDisplay} avg`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Pending" value={String(stats.statusBreakdown.pending || 0)} sub={`${fmtCurrency(stats.totalPendingAmount || 0)} queued`} icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Refunded / Failed" value={String((stats.statusBreakdown.refunded || 0) + (stats.statusBreakdown.failed || 0))} sub={`${stats.statusBreakdown.refunded || 0} refunded • ${stats.statusBreakdown.failed || 0} failed`} icon={<ShieldAlert className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
          <KpiCard title="Revenue" value={totalRevenueDisplay} sub={`Net ${fmtCurrency(stats.netRevenue || 0)} • Refunded ${fmtCurrency(stats.totalRefunded || 0)}`} icon={<Banknote className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : null}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payment intent, transaction ID, order ID, amount…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
              <option value="-paid_at">Paid newest</option>
              <option value="paid_at">Paid oldest</option>
              <option value="-createdAt">Created newest</option>
              <option value="createdAt">Created oldest</option>
              <option value="-amount">Amount high→low</option>
              <option value="amount">Amount low→high</option>
              <option value="status">Status A–Z</option>
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
              <FilterPills label="Status" options={STATUS_OPTS} value={statusFilter} onToggle={toggleStatus} />
              <FilterPills label="Payment Method" options={PAYMENT_METHOD_OPTS} value={paymentMethodFilter} onToggle={togglePaymentMethod} />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Currency</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#239459] text-white border border-[#239459]">PHP</span>
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-[#0a0a0a] text-gray-400 border border-gray-200 dark:border-[#262626]">USD — n/a</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">All transactions are settled in PHP.</p>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-xs font-medium border border-[#239459]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {statusFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">status:{v} <button onClick={() => toggleStatus(v)}><X className="w-3 h-3" /></button></span>)}
            {paymentMethodFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v} <button onClick={() => togglePaymentMethod(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load transactions</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 bg-[#239459]/10 dark:bg-[#239459]/15 rounded-full flex items-center justify-center mb-4"><Receipt className="w-7 h-7 text-[#239459]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No transactions found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Transactions appear after checkout — PayMongo intent creation and webhook settlement. Try adjusting search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Transaction</th>
                    <th className="text-left px-4 py-3 font-medium">Order</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Customer</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Outlet</th>
                    <th className="text-left px-4 py-3 font-medium">Method</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((t) => {
                    const order = t.order
                    const customerName = order?.customer?.user ? `${order.customer.user.firstName} ${order.customer.user.lastName}`.trim() : order?.customer?.email || '—'
                    const customerEmail = order?.customer?.user?.email || order?.customer?.email || ''
                    const outletName = order?.merchant?.outletName || `Outlet #${order?.merchant?.id ?? '—'}`
                    return (
                      <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-white flex items-center justify-center text-xs font-bold shrink-0">
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 dark:text-white text-xs flex items-center gap-1">
                                #{t.id} <span className="font-mono text-[11px] text-gray-500 truncate max-w-[110px]">{t.payment_intent_id ? t.payment_intent_id.slice(0, 16) : '—'}</span>
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-[#a1a1aa] font-mono truncate max-w-[170px]">{t.payment_intent_id || 'no intent'}</div>
                              <div className="text-[11px] text-gray-400 mt-0.5">{fmtDate(t.createdAt)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {order ? (
                            <div className="min-w-[120px]">
                              <Link href="/orders" className="font-semibold text-gray-900 dark:text-white hover:text-[#239459] text-xs flex items-center gap-1">
                                <DollarSign className="w-3 h-3 text-[#239459]" /> #{order.id}
                              </Link>
                              <div className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-0.5 capitalize">{order.status.replace('_', ' ')}</div>
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
                            {customerEmail && <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[160px]">{customerEmail}</div>}
                            {order?.customer?.user?.phone && <div className="text-xs text-gray-500">{order.customer.user.phone}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          <div className="min-w-[150px]">
                            <div className="text-xs font-medium text-gray-900 dark:text-white truncate max-w-[150px] flex items-center gap-1"><Store className="w-3 h-3 text-[#239459]" /> {outletName}</div>
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
                            <DollarSign className="w-3 h-3 text-[#239459]" /> {fmtCurrency(t.amount, t.currency || 'PHP')}
                          </div>
                          <div className="text-[11px] text-gray-400">{t.currency || 'PHP'}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-xs text-gray-900 dark:text-white">{t.paid_at ? fmtDateTime(t.paid_at) : '—'}</div>
                          <div className="text-[11px] text-gray-400">Updated {fmtDate(t.updatedAt)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? filtered.length} transactions • 10 per page</div>
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
        Revenue counts <span className="font-semibold text-gray-700 dark:text-white">settled (paid) transactions</span> only — pending, failed, and refunded amounts are tracked separately and never inflate revenue. Refunds and chargebacks are handled by the platform; contact support if a settled payment needs review. See <Link href="/orders" className="font-semibold text-[#239459] hover:text-[#215035]">Orders</Link> for fulfillment context.
      </div>
    </div>
  )
}

export default function TransactionsPage() {
  return (
    <ClientOnly fallback={<TransactionsSkeleton />}>
      <TransactionsContent />
    </ClientOnly>
  )
}