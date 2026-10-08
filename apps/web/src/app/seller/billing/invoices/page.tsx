'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  Banknote,
  CheckCircle,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Receipt,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react'
import { ClientOnly } from '@/app/seller/_components/ClientOnly'

type Invoice = {
  id: string | number
  invoice_number?: string | null
  invoiceNumber?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
  billingReason?: string | null
  billing_reason?: string | null
  billingreason?: string | null
  due_at?: string | null
  dueAt?: string | null
  paid_at?: string | null
  paidAt?: string | null
  createdAt?: string | null
}
type VendorProfile = { id: string; businessName: string }
type Pagination = {
  page: number
  totalDocs: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'past_due', label: 'Past due' },
  { value: 'void', label: 'Void' },
  { value: 'refunded', label: 'Refunded' },
]

function invoiceNumber(invoice: Invoice) {
  return String(invoice.invoice_number ?? invoice.invoiceNumber ?? invoice.id ?? '—')
}

function invoiceStatus(invoice: Invoice) {
  return String(invoice.status || 'pending').toLowerCase()
}

function billingReason(invoice: Invoice) {
  return String(invoice.billingReason ?? invoice.billing_reason ?? invoice.billingreason ?? '—')
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return String(value).slice(0, 10)
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(value).slice(0, 16)
  }
}

function formatCurrency(value: unknown, currency = 'PHP') {
  const amount = typeof value === 'number' ? value : Number(value ?? 0) || 0
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `₱${amount.toFixed(2)}`
  }
}

function statusClass(status: string) {
  if (status === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (status === 'pending' || status === 'past_due') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
  if (status === 'void' || status === 'refunded') return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  return 'border-gray-200 bg-gray-100 text-gray-700 dark:border-[#333] dark:bg-[#262626] dark:text-[#a1a1aa]'
}

function reasonClass(reason: string) {
  if (reason === 'initial') return 'border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300'
  if (reason === 'renewal') return 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
  if (reason === 'upgrade') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (reason === 'downgrade') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
  if (reason === 'proration') return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-900/20 dark:text-violet-300'
  if (reason === 'manual') return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  return 'border-gray-200 bg-gray-100 text-gray-700 dark:border-[#333] dark:bg-[#262626] dark:text-[#a1a1aa]'
}

async function parseResponse(response: Response) {
  try {
    return await response.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

function KpiCard({ title, value, sub, icon, iconBg }: {
  title: string
  value: string
  sub: string
  icon: React.ReactNode
  iconBg: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#262626] dark:bg-[#171717]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">{title}</p>
          <p className="mt-1 truncate text-xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="mt-1 truncate text-xs text-gray-500 dark:text-[#a1a1aa]">{sub}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      </div>
    </div>
  )
}

function InvoicesSkeleton() {
  return (
    <div className="space-y-6 px-2.5 py-5">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-[#262626]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-[86px] animate-pulse rounded-xl border border-gray-200 bg-gray-100 dark:border-[#262626] dark:bg-[#171717]" />)}</div>
      <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-[#171717]" />
    </div>
  )
}

function InvoicesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profiles, setProfiles] = useState<VendorProfile[]>([])
  const [vendorId, setVendorId] = useState('')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const [docs, setDocs] = useState<Invoice[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const limit = 10

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), 400)
    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [debouncedQuery, status, vendorId])

  useEffect(() => {
    let cancelled = false
    async function loadProfiles() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch('/api/seller-membership/profiles', { cache: 'no-store' })
        const data = await parseResponse(response)
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load vendor profiles')
        const result = Array.isArray(data.docs) ? data.docs as VendorProfile[] : []
        const requested = searchParams.get('vendorId')
        const selected = result.find((profile) => profile.id === requested) ?? result[0]
        if (!cancelled) {
          setProfiles(result)
          setVendorId(selected?.id ?? '')
          setLoading(false)
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Failed to load vendor profiles')
          setLoading(false)
        }
      }
    }
    void loadProfiles()
    return () => { cancelled = true }
  }, [searchParams])

  useEffect(() => {
    if (!vendorId) {
      setDocs([])
      setPagination(null)
      return
    }
    let cancelled = false
    async function loadInvoices() {
      setLoading(true)
      setError(null)
      try {
        const queryParams = new URLSearchParams({
          vendorId,
          page: String(page),
          limit: String(limit),
        })
        if (status !== 'all') queryParams.set('status', status)
        const response = await fetch(`/api/seller-membership/invoices?${queryParams}&_t=${Date.now()}`, { cache: 'no-store' })
        const data = await parseResponse(response)
        if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load invoices')
        const invoices = Array.isArray(data.docs) ? data.docs as Invoice[] : []
        if (!cancelled) {
          setDocs(invoices)
          setPagination(data.pagination as Pagination | null)
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Failed to load invoices')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadInvoices()
    return () => { cancelled = true }
  }, [vendorId, status, page, refreshKey])

  const activeFilterCount = (status !== 'all' ? 1 : 0) + (debouncedQuery ? 1 : 0)
  const filtered = useMemo(() => {
    const needle = debouncedQuery.toLowerCase()
    if (!needle) return docs
    return docs.filter((invoice) =>
      invoiceNumber(invoice).toLowerCase().includes(needle) || String(invoice.id).toLowerCase().includes(needle),
    )
  }, [docs, debouncedQuery])
  const pendingCount = docs.filter((invoice) => ['pending', 'past_due'].includes(invoiceStatus(invoice))).length
  const paidCount = docs.filter((invoice) => invoiceStatus(invoice) === 'paid').length
  const failedCount = docs.filter((invoice) => invoiceStatus(invoice) === 'failed').length
  const totalPages = Math.max(1, pagination?.totalPages ?? 1)

  function clearFilters() {
    setQuery('')
    setDebouncedQuery('')
    setStatus('all')
  }

  function selectProfile(nextVendorId: string) {
    const next = new URL(window.location.href)
    next.searchParams.set('vendorId', nextVendorId)
    window.history.replaceState({}, '', next)
    setVendorId(nextVendorId)
  }

  function openInvoice(invoice: Invoice) {
    const params = new URLSearchParams({ vendorId })
    router.push(`/seller/billing/invoices/${encodeURIComponent(String(invoice.id))}?${params}`)
  }

  return (
    <div className="space-y-6 px-2.5 py-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#239459] text-white"><Receipt className="h-4 w-4" /></span>
            Membership Invoices
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Plan charges, renewals, and prorations — PayMongo settlement status (read-only).</p>
        </div>
        <button onClick={() => setRefreshKey((current) => current + 1)} disabled={loading} aria-label="Refresh invoices" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 dark:border-[#262626] dark:bg-[#171717] dark:hover:bg-[#262626]">
          <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <label className="flex max-w-2xl items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 shadow-sm dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]">
        <span className="shrink-0">Vendor profile</span>
        <select value={vendorId} onChange={(event) => selectProfile(event.target.value)} disabled={loading || profiles.length === 0} className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white">
          {!profiles.length && <option value="">No vendor profiles found</option>}
          {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.businessName || `Vendor profile #${profile.id}`}</option>)}
        </select>
      </label>

      {loading && docs.length === 0 ? (
        <div className="grid animate-pulse grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-[86px] rounded-xl border border-gray-200 bg-gray-100 dark:border-[#262626] dark:bg-[#171717]" />)}</div>
      ) : !error && docs.length >= 0 && profiles.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <KpiCard title="Pending" value={String(pendingCount)} sub="awaiting payment" icon={<Clock className="h-5 w-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Paid" value={String(paidCount)} sub="settled invoices" icon={<CheckCircle className="h-5 w-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Failed" value={String(failedCount)} sub="needs retry" icon={<XCircle className="h-5 w-5 text-white" />} iconBg="bg-red-500" />
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-[#262626] dark:bg-[#171717]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search invoice number…" className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#239459] focus:outline-none focus:ring-2 focus:ring-[#239459]/20 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white" />
            {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="h-4 w-4 text-gray-400" /></button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowFilters((visible) => !visible)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition ${activeFilterCount ? 'border-[#239459] bg-[#239459] text-white hover:bg-[#215035]' : 'border-gray-200 bg-white text-gray-700 dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]'}`}>
              <SlidersHorizontal className="h-4 w-4" /> Filters {activeFilterCount > 0 && <span className="rounded-full bg-white px-1.5 py-0.5 text-xs font-bold text-[#239459]">{activeFilterCount}</span>} <ChevronDown className={`h-4 w-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {activeFilterCount > 0 && <button onClick={clearFilters} className="text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-[#a1a1aa]">Clear all</button>}
          </div>
        </div>
        {showFilters && (
          <div className="mt-4 space-y-4 border-t border-gray-100 pt-4 dark:border-[#262626]">
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Status</p>
              <div className="flex flex-wrap gap-1.5">{STATUSES.map((option) => <button key={option.value} onClick={() => setStatus(option.value)} className={`rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition ${status === option.value ? 'border-[#239459] bg-[#239459] text-white' : 'border-gray-200 bg-white text-gray-700 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#a1a1aa]'}`}>{option.label}</button>)}</div>
            </div>
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}
        {activeFilterCount > 0 && !showFilters && <div className="mt-3 flex flex-wrap gap-1.5">
          {debouncedQuery && <span className="inline-flex items-center gap-1 rounded-full border border-[#239459]/30 bg-[#239459]/10 px-2.5 py-1 text-xs font-medium text-[#215035] dark:bg-[#239459]/15 dark:text-[#239459]">Search: “{debouncedQuery}” <button onClick={() => setQuery('')} aria-label="Remove search filter"><X className="h-3 w-3" /></button></span>}
          {status !== 'all' && <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-[#262626] dark:text-[#a1a1aa]">status:{status} <button onClick={() => setStatus('all')} aria-label="Remove status filter"><X className="h-3 w-3" /></button></span>}
        </div>}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
        {error ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <AlertCircle className="mb-4 h-7 w-7 text-red-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Failed to load invoices</h2>
            <p className="mb-4 mt-1 text-sm text-gray-500">{error}</p>
            <button onClick={() => { setError(null); setRefreshKey((current) => current + 1) }} className="inline-flex items-center rounded-lg bg-[#239459] px-4 py-2 text-sm font-medium text-white"><RefreshCw className="mr-2 h-4 w-4" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="space-y-3 p-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-[#0a0a0a]" />)}</div>
        ) : profiles.length === 0 ? (
          <div className="px-6 py-16 text-center"><h2 className="font-semibold text-gray-900 dark:text-white">No vendor profiles found</h2><p className="mt-1 text-sm text-gray-500">Create a vendor profile to view invoices.</p></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Receipt className="mb-4 h-7 w-7 text-[#239459]" />
            <h2 className="font-semibold text-gray-900 dark:text-white">No invoices found</h2>
            <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-[#a1a1aa]">Invoices appear after plan checkout — PayMongo payment link creation and webhook settlement. Try adjusting search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#a1a1aa]">
                  <tr><th className="px-4 py-3 text-left font-medium">Invoice</th><th className="px-4 py-3 text-left font-medium">Billing reason</th><th className="px-4 py-3 text-left font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Amount</th><th className="hidden px-4 py-3 text-left font-medium md:table-cell">Due / Paid</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((invoice) => {
                    const state = invoiceStatus(invoice)
                    const reason = billingReason(invoice)
                    return <tr key={invoice.id} onClick={() => openInvoice(invoice)} onKeyDown={(event) => { if (event.key === 'Enter') openInvoice(invoice) }} tabIndex={0} className="cursor-pointer transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#239459] dark:hover:bg-[#0a0a0a]/50">
                      <td className="px-4 py-3">
                        <div className="flex min-w-[200px] items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-white"><Receipt className="h-4 w-4" /></div>
                          <div className="min-w-0"><div className="max-w-[200px] truncate font-mono text-xs font-semibold text-gray-900 dark:text-white">{invoiceNumber(invoice)}</div><div className="mt-0.5 text-[11px] text-gray-400">#{String(invoice.id)} • {formatDate(invoice.createdAt ?? null)}</div></div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${reasonClass(reason.toLowerCase())}`}><CreditCard className="h-3 w-3" /> {reason.replace(/_/g, ' ')}</span></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(state)}`}>{state === 'paid' ? <CheckCircle className="h-3 w-3" /> : state === 'pending' || state === 'past_due' ? <Clock className="h-3 w-3" /> : state === 'failed' ? <XCircle className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}{state.replace(/_/g, ' ')}</span></td>
                      <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1 text-xs font-semibold text-gray-900 dark:text-white"><DollarSign className="h-3 w-3 text-[#239459]" />{formatCurrency(invoice.amount, invoice.currency || 'PHP')}</div><div className="text-[11px] text-gray-400">{invoice.currency || 'PHP'}</div></td>
                      <td className="hidden px-4 py-3 md:table-cell"><div className="text-xs text-gray-900 dark:text-white">Due {formatDate(invoice.due_at ?? invoice.dueAt ?? null)}</div><div className="text-[11px] text-gray-400">Paid {formatDateTime(invoice.paid_at ?? invoice.paidAt ?? null)}</div></td>
                    </tr>
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm dark:border-[#262626] sm:flex-row">
              <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? filtered.length} invoices • {limit} per page</div>
              <div className="flex items-center gap-1">
                <button disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50 dark:border-[#262626] dark:bg-[#0a0a0a]">Prev</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, index) => Math.max(1, Math.min(totalPages - 4, page - 2)) + index).filter((number) => number <= totalPages).map((number) => <button key={number} onClick={() => setPage(number)} className={`h-8 w-8 rounded-lg border text-sm font-medium ${number === page ? 'border-[#239459] bg-[#239459] text-white' : 'border-gray-200 bg-white text-gray-700 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-white'}`}>{number}</button>)}
                <button disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-50 dark:border-[#262626] dark:bg-[#0a0a0a]">Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-500 dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]">
        Membership invoices are <strong className="text-gray-700 dark:text-white">read-only billing records</strong> — paid amounts reflect PayMongo settlement only. Refunds are handled by the platform; contact support if a settled invoice needs review. See <Link href="/seller/billing/subscription" className="font-semibold text-[#239459] hover:text-[#215035]">My subscription</Link> for subscription status.
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#a1a1aa]"><Banknote className="h-4 w-4" /><span>Amounts in PHP • settled via PayMongo</span></div>
    </div>
  )
}

export default function SellerInvoicesPage() {
  return <ClientOnly fallback={<InvoicesSkeleton />}><InvoicesContent /></ClientOnly>
}
