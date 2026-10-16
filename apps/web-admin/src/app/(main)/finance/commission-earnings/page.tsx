'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { ClientOnly } from '@/components/ClientOnly'
import { useCommissionEarnings } from '@/hooks/useCommissionEarnings'
import {
  Coins, Banknote, Receipt, CalendarDays, FileText, Search, X, RefreshCw, AlertCircle,
} from '@/components/ui/IconWrapper'

const RANGE_OPTS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '12 months' },
  { value: 'all', label: 'All time' },
]

const SOURCE_OPTS = ['vendor', 'category', 'plan', 'global', 'product', 'product_category', 'volume_tier']

function fmtPHP(n: number) {
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtCompact(n: number) {
  if (Math.abs(n) >= 1000000) return `₱${(n / 1000000).toFixed(1)}M`
  if (Math.abs(n) >= 1000) return `₱${(n / 1000).toFixed(1)}k`
  return fmtPHP(n)
}

function KpiCard({ title, value, sub, icon, iconBg }: { title: string; value: string; sub?: string; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] truncate">{title}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate">{sub}</p>}
        </div>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      </div>
    </div>
  )
}

function EarningsSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
        ))}
      </div>
    </div>
  )
}

function EarningsPageContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [range, setRange] = useState(() => {
    const r = searchParams.get('range')
    return RANGE_OPTS.some((o) => o.value === r) ? (r as string) : '30d'
  })
  const [q, setQ] = useState(() => searchParams.get('q') ?? '')
  const [debouncedQ, setDebouncedQ] = useState(() => searchParams.get('q') ?? '')
  const [sourceFilter, setSourceFilter] = useState<string[]>(() =>
    (searchParams.get('source') || '').split(',').map((s) => s.trim()).filter(Boolean),
  )
  const [page, setPage] = useState(() => {
    const n = parseInt(searchParams.get('page') || '1', 10)
    return Number.isFinite(n) && n > 0 ? n : 1
  })
  const limit = 10

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 400)
    return () => clearTimeout(t)
  }, [q])

  // Shareable URL: mirror filter state into query params (replace, no navigation)
  useEffect(() => {
    const p = new URLSearchParams()
    if (range !== '30d') p.set('range', range)
    if (debouncedQ) p.set('q', debouncedQ)
    if (sourceFilter.length) p.set('source', sourceFilter.join(','))
    if (page > 1) p.set('page', String(page))
    const next = p.toString()
    if (next !== searchParams.toString()) router.replace(`${pathname}${next ? `?${next}` : ''}`, { scroll: false })
  }, [range, debouncedQ, sourceFilter, page, pathname, router, searchParams])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('range', range)
    if (sourceFilter.length) p.set('source', sourceFilter.join(','))
    return p.toString()
  }, [range, sourceFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useCommissionEarnings(qs)
  const isInitialLoading = isPending || isFetching || hardRefreshing
  const loading = isFetching || hardRefreshing
  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminCommissionEarnings(qs) })
        await refetch({ cancelRefetch: true })
      } finally {
        setHardRefreshing(false)
      }
    })()
  }
  useEffect(() => { setPage(1) }, [debouncedQ, sourceFilter, range])

  const vendors = useMemo(() => {
    const rows = data?.byVendor || []
    if (!debouncedQ) return rows
    return rows.filter((r) => r.businessName.toLowerCase().includes(debouncedQ))
  }, [data, debouncedQ])
  const totalPages = Math.max(1, Math.ceil(vendors.length / limit))
  const pagedVendors = useMemo(() => vendors.slice((page - 1) * limit, page * limit), [vendors, page, limit])

  const handleExport = () => {
    if (!vendors.length) return
    const headers = ['Vendor', 'Commission', 'Txn Fees', 'Net Income', 'Entries', 'Orders']
    const csvRows = vendors.map((r) => [
      `"${r.businessName.replace(/"/g, '""')}"`,
      r.commission.toFixed(2),
      r.fees.toFixed(2),
      r.net.toFixed(2),
      String(r.entries),
      String(r.orders),
    ])
    const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `commission-earnings-${range}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const toggleSource = (s: string) =>
    setSourceFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center shrink-0">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Commission Earnings</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">How much the platform earns — net of refunds</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
            {RANGE_OPTS.map((o) => (
              <button
                key={o.value}
                onClick={() => setRange(o.value)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition disabled:opacity-50 disabled:cursor-wait ${range === o.value ? 'bg-white dark:bg-[#171717] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-[#333]' : 'text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <button onClick={handleHardRefresh} disabled={loading} className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            disabled={!vendors.length}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {isError && (
        <div className="flex flex-col items-center justify-center py-10 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <p className="text-sm text-gray-500">{queryError instanceof Error ? queryError.message : 'Failed to load'}</p>
          <button onClick={() => refetch()} className="mt-3 px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium">Retry</button>
        </div>
      )}

      {isInitialLoading || !data ? (
        <EarningsSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Net commission income" value={fmtCompact(data.summary.netIncome)} sub={`${data.summary.totalEntries} entries • ${data.summary.totalOrders} orders`} icon={<Coins className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
            <KpiCard title="Commission" value={fmtCompact(data.summary.totalCommission)} sub={`Reversed ${fmtCompact(data.summary.totalReversed)}`} icon={<Receipt className="w-5 h-5 text-white" />} iconBg="bg-emerald-600" />
            <KpiCard title="Transaction fees" value={fmtCompact(data.summary.totalFees)} sub="Fixed per-order fees" icon={<Banknote className="w-5 h-5 text-white" />} iconBg="bg-teal-600" />
            <KpiCard title="Member fees" value={fmtCompact(data.summary.memberFeeIncome)} sub={`${data.summary.paidMemberFees} paid registrations`} icon={<Coins className="w-5 h-5 text-white" />} iconBg="bg-violet-600" />
          </div>

          {data.daily.length > 0 && (
            <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#239459]" /> Daily Net Earnings
              </h3>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1 h-24">
                  {data.daily.slice(-14).map((d) => {
                    const max = Math.max(...data.daily.slice(-14).map((x) => x.net), 1)
                    const h = Math.max(4, (d.net / max) * 80)
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${fmtPHP(d.net)} (${d.orders} orders)`}>
                        <div className="w-full bg-[#239459] rounded-t" style={{ height: `${h}px` }} />
                        <span className="text-[10px] text-gray-500 dark:text-[#a1a1aa]">{d.date.slice(5)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-[#262626] space-y-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search vendor…"
                  className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400"
                />
                {q && (
                  <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTS.map((s) => {
                  const active = sourceFilter.includes(s)
                  return (
                    <button
                      key={s}
                      onClick={() => toggleSource(s)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${active ? 'bg-[#239459] text-white border-[#239459]' : 'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Vendor</th>
                    <th className="text-right px-4 py-3 font-medium">Commission</th>
                    <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Txn fees</th>
                    <th className="text-right px-4 py-3 font-medium">Net income</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Orders</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {pagedVendors.map((r) => (
                    <tr key={r.vendorId} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{r.businessName}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs">{fmtPHP(r.commission)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs hidden sm:table-cell">{fmtPHP(r.fees)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400">{fmtPHP(r.net)}</td>
                      <td className="px-4 py-2.5 text-right hidden md:table-cell">{r.orders}</td>
                    </tr>
                  ))}
                  {!pagedVendors.length && (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">No earnings in this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-[#262626] text-xs text-gray-500">
              <span>Page {page} of {totalPages} • {vendors.length} vendors • 10 per page</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#262626] disabled:opacity-40">Prev</button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[#262626] disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white p-4 pb-0">By rule</h3>
              <table className="w-full text-sm mt-2">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa]">
                  <tr><th className="text-left px-4 py-2.5 font-medium">Rule</th><th className="text-right px-4 py-2.5 font-medium">Net income</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {data.byRule.map((r) => (
                    <tr key={r.ruleId} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                      <td className="px-4 py-2.5 text-gray-900 dark:text-white">{r.name} <span className="text-xs text-gray-500">• {r.entries} entries</span></td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400">{fmtPHP(r.net)}</td>
                    </tr>
                  ))}
                  {!data.byRule.length && <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-500">No data.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white p-4 pb-0">By source</h3>
              <table className="w-full text-sm mt-2">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa]">
                  <tr><th className="text-left px-4 py-2.5 font-medium">Source</th><th className="text-right px-4 py-2.5 font-medium">Net income</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {data.bySource.map((s) => (
                    <tr key={s.source} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                      <td className="px-4 py-2.5 capitalize text-gray-900 dark:text-white">{s.source.replace('_', ' ')} <span className="text-xs text-gray-500">• {s.entries} entries</span></td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400">{fmtPHP(s.net)}</td>
                    </tr>
                  ))}
                  {!data.bySource.length && <tr><td colSpan={2} className="px-4 py-8 text-center text-sm text-gray-500">No data.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function CommissionEarningsPage() {
  return (
    <ClientOnly fallback={<EarningsSkeleton />}>
      <Suspense fallback={<EarningsSkeleton />}>
        <EarningsPageContent />
      </Suspense>
    </ClientOnly>
  )
}
