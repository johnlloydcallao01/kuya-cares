'use client'

import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useReports } from '@/hooks/useReports'
import type { ReportsData } from '@/lib/reports-types'
import { ClientOnly } from '@/components/ClientOnly'
import { FileText, Download, Clock, ShieldCheck, DollarSign, Store, ShoppingCart, Truck, Package, Award, AlertCircle, RefreshCw, FileSpreadsheet } from '@/components/ui/IconWrapper'

type Range = '7d' | '30d' | '90d' | '1y' | 'all'
const RANGE_OPTS: { value: Range; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

function fmtCurrency(n: number) { return `₱${Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 })}` }
function fmtDate(iso: string) { try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) } catch { return iso } }
function fmtDateTime(iso: string) { try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) } catch { return iso } }
function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">{label}</p>
      <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1">{sub}</p>}
    </div>
  )
}

function ReportsSkeleton(){
  return (
    <div className="space-y-[10px] py-5 px-2.5 animate-pulse">
      <div className="h-7 bg-gray-100 dark:bg-[#171717] rounded w-40" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}</div>
      <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />
    </div>
  )
}

function ReportsPageContent() {
  const [range, setRange] = useState<Range>('30d')
  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useReports(range)

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load reports') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminReports(range) })
        await refetch({ cancelRefetch: true })
      } finally {
        setHardRefreshing(false)
      }
    })()
  }

  if (isInitialLoading) {
    return <ReportsSkeleton />
  }

  if (error && !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{error}</p>
        <button onClick={handleHardRefresh} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" />Retry</button>
      </div>
    )
  }

  if (!data) return null

  const period = `${fmtDate(data.meta.periodStart)} — ${fmtDate(data.meta.periodEnd)}`

  return (
    <div className="space-y-[10px] py-5 px-2.5">
      {/* Header — final numbers for the selected period */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2"><FileText className="w-6 h-6 text-blue-600" />Reports</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Final numbers for <span className="font-medium text-gray-700 dark:text-white">{period}</span> • Ready to download for accounting • Updated {fmtDateTime(data.meta.generatedAt)}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Completed payments only — these numbers are final and won&apos;t change. For up-to-the-minute activity, check Analytics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#171717] rounded-full border border-gray-200 dark:border-[#262626]">
            {RANGE_OPTS.map((o) => (
              <button key={o.value} onClick={() => setRange(o.value)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${range === o.value ? 'bg-white dark:bg-[#262626] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-[#333]' : 'text-gray-600 dark:text-[#a1a1aa]'}`}>{o.label}</button>
            ))}
          </div>
          <button onClick={handleHardRefresh} disabled={isFetching || hardRefreshing} title="Refresh fresh data" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-full hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"><RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${isFetching || hardRefreshing ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* Summary — final totals for the selected period */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">
        <Kpi label="Total sales" value={fmtCurrency(data.summary.totalRevenue)} sub={`${data.summary.paidCount} payments`} />
        <Kpi label="Refunded" value={fmtCurrency(data.summary.totalRefunded)} sub={`${data.summary.refundedCount} refunds`} />
        <Kpi label="Net sales" value={fmtCurrency(data.summary.netRevenue)} sub={`Average order ${fmtCurrency(data.summary.avgOrder)}`} />
        <Kpi label="Orders" value={String(data.summary.totalOrders)} sub={`${data.summary.failedCount} failed`} />
      </div>

      {/* Report cards — download per section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[10px]">
        {[
          { title: 'Sales & Fees Details', desc: 'Every completed payment with store, partner, fees, and payment method. Use this for bookkeeping.', icon: DollarSign, count: `${data.financialReconciliation.totalCount} payments`, rows: data.financialReconciliation.rows.length, action: () => downloadCsv(`financial-${data.meta.range}-${Date.now()}.csv`, toCsv(data.financialReconciliation.rows as unknown as Record<string, unknown>[], ['transactionId','orderId','date','merchant','vendor','amount','platformFee','deliveryFee','status','paymentMethod'])) },
          { title: 'Vendor Payouts', desc: 'Total sales, fees, and payout per partner. Use this to settle payments with partners.', icon: Store, count: `${data.vendorPayouts.count} vendors`, rows: data.vendorPayouts.rows.length, action: () => downloadCsv(`vendor-payouts-${data.meta.range}.csv`, toCsv(data.vendorPayouts.rows as unknown as Record<string, unknown>[], ['vendorId','businessName','orders','gross','platformFees','deliveryFees','net'])) },
          { title: 'Refunds & Failed Payments', desc: 'Refunded and failed payments in this period. Use this for customer support and refunds.', icon: AlertCircle, count: `${data.refundsFailures.count} rows`, rows: data.refundsFailures.rows.length, action: () => downloadCsv(`refunds-failures-${data.meta.range}.csv`, toCsv(data.refundsFailures.rows as unknown as Record<string, unknown>[], ['transactionId','orderId','date','amount','status','paymentMethod'])) },
          { title: 'Top Products', desc: 'Best-selling products by quantity and sales, based on completed orders only.', icon: Package, count: `${data.productPerformance.count} products`, rows: data.productPerformance.rows.length, action: () => downloadCsv(`product-performance-${data.meta.range}.csv`, toCsv(data.productPerformance.rows as unknown as Record<string, unknown>[], ['id','name','quantity','revenue','orders'])) },
          { title: 'Vendor Status', desc: 'Partner approval status and active stores. Use this to check which partners can sell.', icon: ShieldCheck, count: `${data.vendorCompliance.count} vendors`, rows: data.vendorCompliance.rows.length, action: () => downloadCsv(`vendor-compliance-${data.meta.range}.csv`, toCsv(data.vendorCompliance.rows as unknown as Record<string, unknown>[], ['vendorId','businessName','businessType','verificationStatus','isActive','totalMerchants'])) },
          { title: 'Deliveries', desc: 'Deliveries in this period by status, with driver and fee details.', icon: Truck, count: `${data.deliveryLogistics.totalBookings} deliveries`, rows: data.deliveryLogistics.sampleRows.length, action: () => downloadCsv(`delivery-${data.meta.range}.csv`, toCsv(data.deliveryLogistics.sampleRows as unknown as Record<string, unknown>[], ['orderId','status','deliveryFee','serviceType','driverName'])) },
        ].map((card) => (
          <div key={card.title} className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0"><card.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div>
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#a1a1aa]">{card.count}</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">{card.title}</h3>
            <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 flex-1">{card.desc}</p>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={card.action} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"><Download className="w-3.5 h-3.5" />CSV</button>
              <span className="text-xs text-gray-400">{card.rows} preview rows</span>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed tables — final line items for the selected period */}
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />Sales & Fees Details — {period} ({data.financialReconciliation.totalCount} payments)</h3>
          <button onClick={() => downloadCsv(`financial-${data.meta.range}.csv`, toCsv(data.financialReconciliation.rows as unknown as Record<string, unknown>[], ['transactionId','orderId','date','merchant','vendor','amount','platformFee','deliveryFee']))} className="text-xs font-semibold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" />Export CSV</button>
        </div>
        <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 dark:text-[#a1a1aa] sticky top-0"><tr><th className="text-left px-3 py-2 font-medium">Date</th><th className="text-left px-3 py-2 font-medium">Order</th><th className="text-left px-3 py-2 font-medium">Merchant</th><th className="text-left px-3 py-2 font-medium">Vendor</th><th className="text-right px-3 py-2 font-medium">Amount</th><th className="text-right px-3 py-2 font-medium">Platform</th><th className="text-right px-3 py-2 font-medium">Delivery</th><th className="text-left px-3 py-2 font-medium">Method</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
              {data.financialReconciliation.rows.map((r) => (
                <tr key={r.transactionId} className="hover:bg-gray-50 dark:hover:bg-[#262626]/50"><td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td><td className="px-3 py-2 font-mono">#{r.orderId.slice(-6)}</td><td className="px-3 py-2 truncate max-w-[140px]">{r.merchant}</td><td className="px-3 py-2 truncate max-w-[140px]">{r.vendor}</td><td className="px-3 py-2 text-right font-medium">{fmtCurrency(r.amount)}</td><td className="px-3 py-2 text-right">{fmtCurrency(r.platformFee)}</td><td className="px-3 py-2 text-right">{fmtCurrency(r.deliveryFee)}</td><td className="px-3 py-2 capitalize">{r.paymentMethod}</td></tr>
              ))}
              {!data.financialReconciliation.rows.length && <tr><td colSpan={8} className="text-center py-8 text-gray-500">No completed payments in this period</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-between text-xs text-gray-600 dark:text-[#a1a1aa]"><span>Showing {data.financialReconciliation.count} of {data.financialReconciliation.totalCount} rows (first 200)</span><span>Total sales {fmtCurrency(data.financialReconciliation.totals.gross)} • Platform fees {fmtCurrency(data.financialReconciliation.totals.platformFees)} • Delivery fees {fmtCurrency(data.financialReconciliation.totals.deliveryFees)}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px]">
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Vendor Payouts</h3><button onClick={() => downloadCsv(`vendor-payouts-${data.meta.range}.csv`, toCsv(data.vendorPayouts.rows as unknown as Record<string, unknown>[], ['vendorId','businessName','orders','gross','net']))} className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1"><Download className="w-3 h-3" />CSV</button></div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 dark:text-[#a1a1aa] sticky top-0"><tr><th className="text-left px-3 py-2">Vendor</th><th className="text-right px-3 py-2">Orders</th><th className="text-right px-3 py-2">Gross</th><th className="text-right px-3 py-2">Net</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{data.vendorPayouts.rows.map((r) => <tr key={r.vendorId} className="hover:bg-gray-50 dark:hover:bg-[#262626]/50"><td className="px-3 py-2 truncate max-w-[160px]">{r.businessName}</td><td className="px-3 py-2 text-right">{r.orders}</td><td className="px-3 py-2 text-right">{fmtCurrency(r.gross)}</td><td className="px-3 py-2 text-right font-semibold">{fmtCurrency(r.net)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Award className="w-4 h-4" />Top Products (completed orders only)</h3><button onClick={() => downloadCsv(`products-${data.meta.range}.csv`, toCsv(data.productPerformance.rows as unknown as Record<string, unknown>[], ['name','quantity','revenue','orders']))} className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1"><Download className="w-3 h-3" />CSV</button></div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 sticky top-0"><tr><th className="text-left px-3 py-2">Product</th><th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">Revenue</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{data.productPerformance.rows.map((r) => <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-[#262626]/50"><td className="px-3 py-2 truncate max-w-[180px]">{r.name}</td><td className="px-3 py-2 text-right">{r.quantity}</td><td className="px-3 py-2 text-right font-medium">{fmtCurrency(r.revenue)}</td></tr>)}
                {!data.productPerformance.rows.length && <tr><td colSpan={3} className="text-center py-6 text-gray-500">No sold items in this period</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between"><h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Clock className="w-4 h-4" />Daily Orders</h3><span className="text-xs text-gray-500">{data.orderVolume.daily.length} days</span></div>
        <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
          <table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 sticky top-0"><tr><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Orders</th><th className="text-right px-3 py-2">Revenue</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{data.orderVolume.daily.slice(-30).map((d) => <tr key={d.date}><td className="px-3 py-2">{d.date}</td><td className="px-3 py-2 text-right">{d.orders}</td><td className="px-3 py-2 text-right">{fmtCurrency(d.revenue)}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <p className="text-[11px] text-gray-400 dark:text-[#52525b] text-center">Showing final numbers for {period} • Updated {fmtDateTime(data.meta.generatedAt)} • For live activity, see Dashboard. For trends, see Analytics.</p>
    </div>
  )
}

export default function ReportsPage(){
  // Pure CSR: currency/date formatting is locale+timezone sensitive → render post-mount only.
  return (
    <ClientOnly fallback={<ReportsSkeleton />}>
      <ReportsPageContent />
    </ClientOnly>
  )
}
