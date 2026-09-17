'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Ticket, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  Store, Clock, CheckCircle, Eye, Edit, Trash2, TrendingUp, Calendar, XCircle, Check,
} from '@/components/ui/IconWrapper'

type MerchantBrief = { id: number; outletName: string; outletCode: string }

type CouponDoc = {
  id: number
  code: string
  description: string | null
  status: string
  discount_type: string
  amount: number
  max_discount_amount: number | null
  applies_to: string
  free_delivery: boolean
  delivery_discount_cap: number | null
  vendor: { id: number; businessName: string } | null
  merchant_scope: string
  merchants: MerchantBrief[]
  menu_items: unknown[]
  excluded_menu_items: unknown[]
  menu_categories: unknown[]
  excluded_menu_categories: unknown[]
  exclude_promo_items: boolean
  minimum_basket: number | null
  maximum_basket: number | null
  limit_per_order_items: number | null
  individual_use: boolean
  max_coupons_per_order: number
  starts_at: string | null
  expires_at: string | null
  usage_limit: number
  usage_limit_per_user: number
  usage_count: number
  email_restrictions: string[]
  phone_restrictions: string[]
  first_order_only: boolean
  allowed_payment_methods: string[]
  time_windows: unknown[]
  funded_by: string
  vendor_share_pct: number
  createdAt: string
  updatedAt: string
}

type Pagination = { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
type Stats = { totalAll: number; filteredTotal: number; statusBreakdown: Record<string, number>; totalUsage: number }

const STATUS_OPTS: { value: string; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'paused', label: 'Paused' },
  { value: 'archived', label: 'Archived' },
]
const TYPE_OPTS: { value: string; label: string }[] = [
  { value: 'percent', label: 'Percent' },
  { value: 'fixed_cart', label: 'Fixed cart' },
  { value: 'fixed_product', label: 'Fixed product' },
]

function fmtMoney(n: number) {
  try {
    return `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  } catch {
    return `₱${Number(n || 0).toFixed(2)}`
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
function typeLabel(t: string) {
  if (t === 'percent') return 'Percent off'
  if (t === 'fixed_cart') return 'Fixed off basket'
  if (t === 'fixed_product') return 'Fixed off item'
  return t || '—'
}
function appliesLabel(a: string) {
  if (a === 'delivery_fee') return 'Delivery'
  if (a === 'both') return 'Food + delivery'
  return 'Food'
}
function discountSummary(c: CouponDoc) {
  if (c.discount_type === 'percent') {
    const cap = c.max_discount_amount != null ? ` up to ${fmtMoney(Number(c.max_discount_amount))}` : ''
    return `${c.amount}%${cap}`
  }
  return fmtMoney(Number(c.amount))
}
function statusBadge(s: string) {
  const v = (s || '').toLowerCase()
  if (v === 'published') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (v === 'scheduled') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (v === 'paused') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (v === 'archived') return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#262626]'
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

function CouponsSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="h-16 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function CouponsPageContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [sort, setSort] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<CouponDoc[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<CouponDoc | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 400)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, statusFilter, typeFilter, sort])

  useEffect(() => {
    const open = !!deleting
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
    document.body.style.overflow = ''
  }, [deleting])

  const activeFilterCount = useMemo(
    () => statusFilter.length + typeFilter.length + (debouncedQ ? 1 : 0),
    [statusFilter, typeFilter, debouncedQ],
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
      if (statusFilter.length === 1) qs.set('status', statusFilter[0])
      if (typeFilter.length === 1) qs.set('discount_type', typeFilter[0])
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/coupons?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load coupons')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load coupons')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, statusFilter, typeFilter, sort, page])

  const toggleStatus = (v: string) => setStatusFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const toggleType = (v: string) => setTypeFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))
  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setStatusFilter([])
    setTypeFilter([])
  }

  const togglePublish = async (c: CouponDoc) => {
    const next = c.status === 'published' ? 'paused' : 'published'
    try {
      const res = await fetch(`/api/coupons/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to update status')
      setDocs((prev) => prev.map((d) => (d.id === c.id ? { ...d, status: next } : d)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  const handleDelete = async () => {
    if (!deleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/coupons/${deleting.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Failed to delete coupon')
      setDocs((prev) => prev.filter((d) => d.id !== deleting.id))
      setDeleting(null)
      void load()
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Failed to delete coupon')
    } finally {
      setIsDeleting(false)
    }
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (statusFilter.length > 1) arr = arr.filter((c) => statusFilter.includes(c.status))
    if (typeFilter.length > 1) arr = arr.filter((c) => typeFilter.includes(c.discount_type))
    return arr
  }, [docs, statusFilter, typeFilter])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))
  const sb = stats?.statusBreakdown || {}
  const published = Number(sb.published || 0)
  const draftScheduled = Number(sb.draft || 0) + Number(sb.scheduled || 0)
  const pausedArchived = Number(sb.paused || 0) + Number(sb.archived || 0)

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Ticket className="w-4 h-4" /></span>
            Coupons
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Promo codes for your brand — percent, fixed, or free delivery, always platform-funded.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void load({ hard: true })}
            disabled={loading}
            aria-label="Refresh coupons"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/coupons/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" /> New Coupon
          </Link>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Coupons" value={String(stats.totalAll)} sub={`${stats.filteredTotal} filtered`} icon={<Ticket className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Published" value={String(published)} sub={`${stats.totalUsage} redemptions`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Draft / Scheduled" value={String(draftScheduled)} sub="not live yet" icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Paused / Archived" value={String(pausedArchived)} sub="hidden from checkout" icon={<XCircle className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
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
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search coupon code, e.g. SAVE10…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest first</option>
                <option value="createdAt">Oldest first</option>
                <option value="code">Code A–Z</option>
                <option value="-usage_count">Most used</option>
                <option value="-expires_at">Expiring soon</option>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FilterPills label="Status" options={STATUS_OPTS} value={statusFilter} onToggle={toggleStatus} />
              <FilterPills label="Discount Type" options={TYPE_OPTS} value={typeFilter} onToggle={toggleType} />
            </div>
            <p className="text-xs text-gray-400">Pick one status or type to filter server-side; multiple picks filter in this list view.</p>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-medium border border-[#eba236]/30 dark:border-[#eba236]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {statusFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium capitalize">status:{v} <button onClick={() => toggleStatus(v)}><X className="w-3 h-3" /></button></span>)}
            {typeFilter.map((v) => <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">{v} <button onClick={() => toggleType(v)}><X className="w-3 h-3" /></button></span>)}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load coupons</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Ticket className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No coupons found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters, or create your first promo code for your brand.</p>
            <Link href="/coupons/new" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> New coupon</Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Code</th>
                    <th className="text-left px-4 py-3 font-medium">Discount</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Branches</th>
                    <th className="text-right px-4 py-3 font-medium">Usage</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Validity</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center shrink-0">
                            <Ticket className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-mono font-semibold text-sm text-gray-900 dark:text-white truncate max-w-[180px]">{c.code}</div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><Calendar className="w-3 h-3" /> {fmtDate(c.createdAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 dark:text-white whitespace-nowrap">{discountSummary(c)}</div>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]">{typeLabel(c.discount_type)}</span>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]">{appliesLabel(c.applies_to)}</span>
                          {c.free_delivery && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">Free delivery</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><Store className="w-3 h-3 text-[#eba236]" /> {c.merchant_scope === 'selected_branches' ? `${c.merchants.length} branch${c.merchants.length === 1 ? '' : 'es'}` : 'All branches'}</div>
                        {c.merchant_scope === 'selected_branches' && c.merchants.length > 0 && (
                          <div className="text-[11px] text-gray-400 truncate max-w-[180px] mt-0.5">{c.merchants.map((m) => m.outletName).join(', ')}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-full text-xs font-semibold text-gray-700 dark:text-white whitespace-nowrap">
                          <TrendingUp className="w-3 h-3 text-[#eba236]" /> {c.usage_count}{c.usage_limit > 0 ? ` / ${c.usage_limit}` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="text-xs text-gray-500 dark:text-[#a1a1aa] whitespace-nowrap">
                          {c.starts_at ? fmtDate(c.starts_at) : '—'} → {c.expires_at ? fmtDate(c.expires_at) : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => void togglePublish(c)}
                          title={c.status === 'published' ? 'Pause coupon' : 'Publish coupon'}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize transition ${statusBadge(c.status)}`}
                        >
                          {c.status === 'published' ? <XCircle className="w-3 h-3" /> : c.status === 'paused' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {c.status}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link href={`/coupons/${c.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/coupons/${c.id}/edit`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600 dark:hover:text-blue-400" title="Edit"><Edit className="w-4 h-4" /></Link>
                          <button onClick={() => { setDeleteError(null); setDeleting(c) }} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600 dark:hover:text-red-400" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination && pagination.totalDocs > 0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} coupons • 10 per page</div>
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

      {deleting && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { if (!isDeleting) setDeleting(null) }}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Delete coupon?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">This will permanently delete <span className="font-mono font-semibold text-gray-900 dark:text-white">{deleting.code}</span>. Past order history keeps its snapshots.</p>
              {deleteError && <p className="text-sm text-red-600 mt-3">{deleteError}</p>}
              <div className="flex gap-2 mt-6">
                <button onClick={() => setDeleting(null)} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                <button onClick={() => void handleDelete()} disabled={isDeleting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {isDeleting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isDeleting ? 'Deleting…' : 'Confirm delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default function CouponsPage() {
  return (
    <ClientOnly fallback={<CouponsSkeleton />}>
      <CouponsPageContent />
    </ClientOnly>
  )
}
