'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Package, TrendingUp, Layers, Users, Sparkles, Search, X, ChevronDown, RefreshCw, AlertCircle
} from '@/components/ui/IconWrapper'

type OrderItemDoc = {
  id: number
  order: { id: number; orderNumber: string; status: string; placed_at: string | null; total: number; merchant: { id: number; outletName: string; outletCode: string } | null } | null
  product: { id: number; name: string; slug: string; sku: string | null; productType: string | null; basePrice: number | null; primaryImage: { id: number; url: string | null; filename: string | null } | null } | null
  merchant_product: { id: number; display_title: string; price_override: number | null; stock_quantity: number | null; is_active: boolean | null; is_available: boolean | null; merchant: { id: number; outletName: string } | null; product: { id: number; name: string; slug: string } | null } | null
  product_name_snapshot: string
  price_at_purchase: number
  quantity: number
  options_snapshot: Record<string, any> | null
  total_price: number
  createdAt: string
  updatedAt: string
}

type Pagination = { page: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }

type Stats = { totalAll: number; filteredTotal: number }

function fmtPeso(v: number) {
  return `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const date = d.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })
    const time = d.toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })
    return `${date} ${time}`
  } catch {
    return String(iso).slice(0, 10)
  }
}
function hasOptions(it: OrderItemDoc) {
  const o = it.options_snapshot
  if (!o || typeof o !== 'object') return false
  const v = o.variations ?? o.modifiers
  return Array.isArray(v) && v.length > 0
}
function optionsSummary(it: OrderItemDoc): string {
  const o = it.options_snapshot
  if (!o || typeof o !== 'object') return ''
  const parts: string[] = []
  const variations = o.variations ?? o.modifiers
  if (Array.isArray(variations)) {
    for (const v of variations) {
      if (typeof v === 'string') { parts.push(v); continue }
      if (v && typeof v === 'object') {
        const label = v.label || v.name || v.title || ''
        const opt = v.selected_option || v.selectedOption || v.option || ''
        if (label || opt) parts.push(`${label}${opt ? `: ${opt}` : ''}`)
      }
    }
  }
  return parts.slice(0, 3).join(', ') + (parts.length > 3 ? ' …' : '')
}

const SORTS: { value: string; label: string }[] = [
  { value: '-createdAt', label: 'Newest first' },
  { value: 'createdAt', label: 'Oldest first' },
  { value: '-total_price', label: 'Highest total' },
  { value: 'total_price', label: 'Lowest total' },
  { value: '-quantity', label: 'Most quantity' },
  { value: '-price_at_purchase', label: 'Highest unit price' },
  { value: 'product_name_snapshot', label: 'Product name A–Z' },
]

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

function OrderItemsSkeleton() {
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

function OrderItemsContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [sort, setSort] = useState('-createdAt')
  const [page, setPage] = useState(1)
  const limit = 10

  const [docs, setDocs] = useState<OrderItemDoc[]>([])
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
  }, [debouncedQ, sort])

  const kpiTotalItems = useMemo(() => stats?.filteredTotal ?? pagination?.totalDocs ?? docs.length, [stats, pagination, docs])
  const kpiRevenue = useMemo(() => docs.reduce((s, d) => s + (Number(d.total_price) || 0), 0), [docs])
  const kpiQuantity = useMemo(() => docs.reduce((s, d) => s + (Number(d.quantity) || 0), 0), [docs])
  const kpiUniqueOrders = useMemo(() => {
    const set = new Set(docs.map((d) => String((d.order as any)?.id ?? d.id)))
    return set.size || 0
  }, [docs])
  const kpiWithModifiersPct = useMemo(() => {
    const withCount = docs.filter(hasOptions).length
    return Math.round((withCount / Math.max(1, docs.length || 1)) * 100)
  }, [docs])

  const load = async (opts?: { hard?: boolean }) => {
    if (opts?.hard) { setDocs([]); setStats(null) }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (debouncedQ) qs.set('search', debouncedQ)
      qs.set('page', String(page))
      qs.set('limit', String(limit))
      qs.set('sort', sort)
      const res = await fetch(`/api/order-items?${qs.toString()}&_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load order items')
      setDocs(Array.isArray(j.docs) ? j.docs : [])
      setStats(j.stats || null)
      setPagination(j.pagination || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load order items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [debouncedQ, sort, page])

  const clearAll = () => { setQ(''); setDebouncedQ('') }
  const totalPages = Math.max(1, pagination?.totalPages ?? Math.ceil(docs.length / limit))

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Layers className="w-4 h-4" /></span>
            Order Items
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Individual line items from your orders with snapshot pricing, modifiers, and live product links (read-only).</p>
        </div>
        <button
          onClick={() => void load({ hard: true })}
          disabled={loading}
          aria-label="Refresh order items"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard title="Total Items" value={String(kpiTotalItems)} sub={stats?.totalAll ? `${stats.totalAll} overall` : `${pagination?.totalDocs ?? kpiTotalItems} in page`} icon={<Package className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
        <KpiCard title="Revenue" value={fmtPeso(kpiRevenue)} sub="sum of line totals" icon={<TrendingUp className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
        <KpiCard title="Quantity Sold" value={String(kpiQuantity)} sub="units across items" icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-blue-600" />
        <KpiCard title="Unique Orders" value={String(kpiUniqueOrders)} sub={`${kpiTotalItems} items`} icon={<Users className="w-5 h-5 text-white" />} iconBg="bg-violet-600" />
        <KpiCard title="With Modifiers" value={`${kpiWithModifiersPct}%`} sub={`${docs.filter(hasOptions).length} of ${kpiTotalItems || docs.length} shown`} icon={<Sparkles className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product name, item #…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-700 dark:text-white">
            {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load order items</h3>
            <p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={() => void load({ hard: true })} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="h-4 w-4 mr-2" />Retry</button>
          </div>
        ) : loading && docs.length === 0 ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-14 w-14 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-full flex items-center justify-center mb-4"><Layers className="w-7 h-7 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No order items found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Order items appear here once customers place orders at your outlets. Try adjusting search or filters.</p>
          </div>
        ) : (
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map((it) => {
                    const orderId = (it.order as any)?.id ?? '—'
                    const orderStatus = (it.order as any)?.status
                    const merchantListing = (it.merchant_product as any)?.display_title || `#${String((it.merchant_product as any)?.id ?? '—')}`
                    const productName = it.product?.name || it.product_name_snapshot || `#${orderId}`
                    const livePrice = it.product?.basePrice != null ? Number(it.product.basePrice) : null
                    const opts = optionsSummary(it)
                    return (
                      <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                        <td className="px-4 py-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">{it.product_name_snapshot || '—'}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-0.5">#{String(it.id).padStart(5, '0')}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-[#eba236]/10 dark:bg-[#eba236]/15 text-[#8a5f17] dark:text-[#eba236] rounded-full text-xs font-semibold border border-[#eba236]/30">
                            #{String(orderId).padStart(5, '0')}
                          </span>
                          {orderStatus && <div className="text-[11px] text-gray-400 mt-0.5 capitalize">{orderStatus.replace('_', ' ')}</div>}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 dark:text-white truncate max-w-[160px]">{productName}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[160px]">{it.product?.slug ? `/${it.product.slug}` : it.product?.sku || '—'}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[140px]">{merchantListing}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{it.quantity}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          <div className="text-sm text-gray-900 dark:text-white">{fmtPeso(it.price_at_purchase)}</div>
                          {livePrice != null && livePrice !== it.price_at_purchase && <div className="text-[11px] text-gray-400">was {fmtPeso(livePrice)}</div>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">{fmtPeso(it.total_price)}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {opts ? (
                            <span className="inline-flex px-2 py-1 bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] rounded-full text-xs font-medium border border-gray-200 dark:border-[#333] truncate max-w-[160px]">{opts}</span>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-[#a1a1aa]">{fmtDate(it.createdAt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {docs.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {pagination?.totalDocs ?? docs.length} items • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                    const n = Math.max(1, Math.min(totalPages - 4, page - 2)) + i
                    if (n > totalPages) return null
                    return <button key={n} onClick={() => setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n === page ? 'bg-[#eba236] text-white border-[#eba236]' : 'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
        Each line item is an <span className="font-semibold text-gray-700 dark:text-white">immutable audit record</span> capturing the exact product snapshot, unit price, and modifier selections at the time of purchase — these never change even if the catalog is updated. Revenue totals use <span className="font-semibold text-gray-700 dark:text-white">line totals</span> (quantity × unit price). See the parent <Link href="/orders" className="font-semibold text-[#eba236] hover:text-[#c88a20]">Orders</Link> page for full order context.
      </div>
    </div>
  )
}

export default function OrderItemsPage() {
  return (
    <ClientOnly fallback={<OrderItemsSkeleton />}>
      <OrderItemsContent />
    </ClientOnly>
  )
}