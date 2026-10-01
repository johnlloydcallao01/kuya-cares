'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Receipt, CheckCircle, Clock, ShieldAlert, Banknote, XCircle,
  Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle, DollarSign, CreditCard
} from '@/components/ui/IconWrapper'

type InvoiceDoc = {
  id: string | number
  invoice_number?: string | null
  invoiceNumber?: string | null
  amount?: number | null
  currency?: string | null
  commission_due?: number | null
  status?: string | null
  billingReason?: string | null
  billing_reason?: string | null
  billingreason?: string | null
  prorationDelta?: number | null
  proration_delta?: number | null
  discount_amount?: number | null
  discountAmount?: number | null
  couponCode?: string | null
  coupon_code?: string | null
  payment_provider?: string | null
  paymentProvider?: string | null
  payment_link_url?: string | null
  paymentLinkUrl?: string | null
  checkoutUrl?: string | null
  checkout_url?: string | null
  period_start?: string | null
  periodStart?: string | null
  period_end?: string | null
  periodEnd?: string | null
  due_at?: string | null
  dueAt?: string | null
  paid_at?: string | null
  paidAt?: string | null
  retry_count?: number | null
  failure_reason?: string | null
  failureReason?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

const STATUS_OPTS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'past_due', label: 'Past due' },
  { value: 'void', label: 'Void' },
  { value: 'refunded', label: 'Refunded' },
]

function getInvoiceNumber(inv: InvoiceDoc): string {
  return String(inv.invoice_number ?? inv.invoiceNumber ?? inv.id ?? '—')
}
function getAmount(inv: InvoiceDoc): number {
  const v = inv.amount
  return typeof v === 'number' ? v : Number(v ?? 0) || 0
}
function getCurrency(inv: InvoiceDoc): string {
  return String(inv.currency || 'PHP')
}
function getStatus(inv: InvoiceDoc): string {
  return String(inv.status || 'pending').toLowerCase()
}
function getBillingReason(inv: InvoiceDoc): string {
  return String(inv.billingReason ?? inv.billing_reason ?? inv.billingreason ?? '—')
}
function getPaidAt(inv: InvoiceDoc): string | null {
  return (inv.paid_at ?? inv.paidAt ?? null) as string | null
}
function getDueAt(inv: InvoiceDoc): string | null {
  return (inv.due_at ?? inv.dueAt ?? null) as string | null
}
function getCreatedAt(inv: InvoiceDoc): string | null {
  return (inv.createdAt ?? null) as string | null
}

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
  } catch { return `₱${Number(amount || 0).toFixed(2)}` }
}
function invBadge(status: string) {
  const s = String(status || '').toLowerCase()
  if (s === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (s === 'pending' || s === 'past_due') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (s === 'failed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (s === 'void' || s === 'refunded') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}
function reasonBadge(reason: string) {
  const r = String(reason || '').toLowerCase()
  if (r === 'initial') return 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300'
  if (r === 'renewal') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300'
  if (r === 'upgrade') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (r === 'downgrade') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300'
  if (r === 'proration') return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300'
  if (r === 'manual') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
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

function InvoicesSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
      </div>
      <div className="h-16 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function FilterPills({ label, options, value, onSelect }: { label: string; options: { value: string; label: string }[]; value: string; onSelect: (v: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value === opt.value
          return (
            <button key={opt.value} onClick={() => onSelect(opt.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition capitalize ${active ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{opt.label}</button>
          )
        })}
      </div>
    </div>
  )
}

function InvoicesContent() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [status, setStatus] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<InvoiceDoc[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 400)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, status])

  const activeFilterCount = useMemo(
    () => (status !== 'all' ? 1 : 0) + (debouncedQ ? 1 : 0),
    [status, debouncedQ],
  )

  const load = async (opts?: { hard?: boolean }) => {
    if (opts?.hard) {
      setDocs([])
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (status !== 'all') qs.set('status', status)
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      const res = await fetch(`/api/membership/invoices?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || j.message || 'Failed to load invoices')
      const arr = Array.isArray(j.docs) ? j.docs : Array.isArray(j.data) ? j.data : []
      setDocs(arr)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [debouncedQ, status, page])

  const clearAll = () => {
    setQ('')
    setDebouncedQ('')
    setStatus('all')
  }

  const filtered = useMemo(() => {
    let arr = [...docs]
    if (status !== 'all') arr = arr.filter((d) => getStatus(d) === status)
    if (debouncedQ) {
      const needle = debouncedQ.toLowerCase()
      arr = arr.filter((d) => getInvoiceNumber(d).toLowerCase().includes(needle) || String(d.id).toLowerCase().includes(needle))
    }
    return arr
  }, [docs, status, debouncedQ])

  const pendingCount = useMemo(() => docs.filter((d) => ['pending', 'past_due'].includes(getStatus(d))).length, [docs])
  const paidCount = useMemo(() => docs.filter((d) => getStatus(d) === 'paid').length, [docs])
  const failedCount = useMemo(() => docs.filter((d) => getStatus(d) === 'failed').length, [docs])

  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(filtered.length / limit))

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Receipt className="w-4 h-4" /></span>
            Membership Invoices
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Plan charges, renewals, and prorations — PayMongo settlement status (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh invoices"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && docs.length === 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : error ? null : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <KpiCard title="Pending" value={String(pendingCount)} sub="awaiting payment" icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Paid" value={String(paidCount)} sub="settled invoices" icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Failed" value={String(failedCount)} sub="needs retry" icon={<XCircle className="w-5 h-5 text-white" />} iconBg="bg-red-500" />
        </div>
      )}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoice number…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowFilters((v) => !v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition shrink-0 ${activeFilterCount ? 'bg-[#239459] hover:bg-[#215035] text-white border-[#239459]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount > 0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#239459]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters ? 'rotate-180' : ''}`} />
            </button>
            {activeFilterCount > 0 && <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">Clear all</button>}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <FilterPills label="Status" options={STATUS_OPTS} value={status} onSelect={(v) => setStatus(v)} />
            <div className="flex justify-end"><button onClick={() => setShowFilters(false)} className="text-xs font-semibold text-[#239459]">Done</button></div>
          </div>
        )}

        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {debouncedQ && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#239459]/10 dark:bg-[#239459]/15 text-[#8a5f17] dark:text-[#239459] rounded-full text-xs font-medium border border-[#239459]/30">Search: “{debouncedQ}” <button onClick={() => setQ('')}><X className="w-3 h-3" /></button></span>}
            {status !== 'all' && <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium">status:{status} <button onClick={() => setStatus('all')}><X className="w-3 h-3" /></button></span>}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load invoices</h3>
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
            <h3 className="font-semibold text-gray-900 dark:text-white">No invoices found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Invoices appear after plan checkout — PayMongo payment link creation and webhook settlement. Try adjusting search or filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Invoice</th>
                    <th className="text-left px-4 py-3 font-medium">Billing reason</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-right px-4 py-3 font-medium">Amount</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Due / Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {filtered.map((inv) => {
                    const st = getStatus(inv)
                    const reason = getBillingReason(inv)
                    return (
                      <tr key={String(inv.id)} onClick={() => router.push(`/billing/invoices/${inv.id}`)} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-white flex items-center justify-center text-xs font-bold shrink-0">
                              <Receipt className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-mono font-semibold text-gray-900 dark:text-white text-xs truncate max-w-[200px]">{getInvoiceNumber(inv)}</div>
                              <div className="text-[11px] text-gray-400 mt-0.5">#{String(inv.id)} • {fmtDate(getCreatedAt(inv))}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${reasonBadge(reason)}`}>
                            <CreditCard className="w-3 h-3" /> {reason.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${invBadge(st)}`}>
                            {st === 'paid' ? <CheckCircle className="w-3 h-3" /> : st === 'pending' || st === 'past_due' ? <Clock className="w-3 h-3" /> : st === 'failed' ? <XCircle className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                            {st.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-semibold text-gray-900 dark:text-white text-xs flex items-center justify-end gap-1">
                            <DollarSign className="w-3 h-3 text-[#239459]" /> {fmtCurrency(getAmount(inv), getCurrency(inv))}
                          </div>
                          <div className="text-[11px] text-gray-400">{getCurrency(inv)}</div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="text-xs text-gray-900 dark:text-white">Due {fmtDate(getDueAt(inv))}</div>
                          <div className="text-[11px] text-gray-400">Paid {fmtDateTime(getPaidAt(inv))}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? filtered.length} invoices • 10 per page</div>
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
        Membership invoices are <span className="font-semibold text-gray-700 dark:text-white">read-only billing records</span> — paid amounts reflect PayMongo settlement only. Refunds handled by platform; contact support if a settled invoice needs review. See <Link href="/billing/invoices" className="font-semibold text-[#239459] hover:text-[#215035]">Invoices</Link> for payment history.
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#a1a1aa]">
        <Banknote className="w-4 h-4" />
        <span>Amounts in PHP • settled via PayMongo</span>
      </div>
    </div>
  )
}

export default function InvoicesPage() {
  return (
    <ClientOnly fallback={<InvoicesSkeleton />}>
      <InvoicesContent />
    </ClientOnly>
  )
}
