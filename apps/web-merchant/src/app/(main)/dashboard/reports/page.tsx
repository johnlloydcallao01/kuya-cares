'use client'
import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useMerchantReportsSummary, useMerchantReportsFinancial, useMerchantReportsCatalog } from '@/hooks/useMerchantReports'
import { ClientOnly } from '@/components/ClientOnly'
import { FileText, Download, Clock, ShieldCheck, DollarSign, Store, Package, AlertCircle, RefreshCw, FileSpreadsheet, Truck } from '@/components/ui/IconWrapper'

type Range='7d'|'30d'|'90d'|'1y'|'all'
const RANGE_OPTS:{value:Range;label:string}[]=[{value:'7d',label:'Last 7 days'},{value:'30d',label:'Last 30 days'},{value:'90d',label:'Last 90 days'},{value:'1y',label:'Last 12 months'},{value:'all',label:'All time'}]
function fmtCurrency(n:number){return `₱${Number(n).toLocaleString('en-PH',{maximumFractionDigits:2})}`}
function fmtDate(iso:string){try{return new Date(iso).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'})}catch{return iso}}
function fmtDateTime(iso:string){try{return new Date(iso).toLocaleString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}catch{return iso}}
function toCsv(rows:Record<string,unknown>[], headers:string[]){const esc=(v:unknown)=>`"${String(v??'').replace(/"/g,'""')}"`; return [headers.join(','), ...rows.map(r=>headers.map(h=>esc(r[h])).join(','))].join('\n')}
function downloadCsv(fn:string, csv:string){const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fn;a.click();URL.revokeObjectURL(url)}
function Kpi({label,value,sub}:{label:string;value:string;sub?:string}){
  return <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4"><p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">{label}</p><p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{value}</p>{sub&&<p className="text-xs text-gray-500 mt-1">{sub}</p>}</div>
}
function ReportsSkeleton(){
  return <div className="space-y-[10px] py-5 px-2.5 animate-pulse"><div className="h-7 bg-gray-100 dark:bg-[#171717] rounded w-40" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 bg-gray-100 dark:bg-[#171717] rounded-xl" />)}</div><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl" /></div>;
}
function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="bg-white dark:bg-[#171717] rounded-xl border border-red-200 dark:border-red-900/40 p-6 text-center"><p className="text-sm text-gray-500 dark:text-[#a1a1aa] mb-4">{message}</p><button onClick={onRetry} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" />Retry</button></div>;
}
function CardSkeleton(){
  return <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 h-[148px] animate-pulse"><div className="h-9 w-9 rounded-lg bg-gray-100 dark:bg-[#262626]" /><div className="h-4 bg-gray-100 dark:bg-[#262626] rounded w-2/3 mt-3" /><div className="h-3 bg-gray-100 dark:bg-[#262626] rounded w-full mt-2" /></div>;
}
function TableSkeleton({ rows = 5 }: { rows?: number }){
  return <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden animate-pulse"><div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626]"><div className="h-4 bg-gray-100 dark:bg-[#262626] rounded w-48" /></div><div className="divide-y divide-gray-100 dark:divide-[#262626]">{Array.from({length:rows}).map((_,i)=><div key={i} className="px-4 py-3"><div className="h-3 bg-gray-100 dark:bg-[#262626] rounded w-full" /></div>)}</div></div>;
}

function ReportsPageContent(){
  const [range,setRange]=useState<Range>('30d')

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  // Three independent queries under the same reports/ directory — same range,
  // fetched in parallel; each section renders as soon as its group resolves.
  const summaryQuery = useMerchantReportsSummary(range)
  const financialQuery = useMerchantReportsFinancial(range)
  const catalogQuery = useMerchantReportsCatalog(range)
  const summary = summaryQuery.data
  const financial = financialQuery.data
  const catalog = catalogQuery.data
  const hasAnyData = !!summary || !!financial || !!catalog
  const isFetching = summaryQuery.isFetching || financialQuery.isFetching || catalogQuery.isFetching
  const queryError = summaryQuery.error ?? financialQuery.error ?? catalogQuery.error

  const isInitialLoading = (!hasAnyData && (summaryQuery.isPending || financialQuery.isPending || catalogQuery.isPending)) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = queryError && !hasAnyData && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load reports') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantReportsSummary(range) })
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantReportsFinancial(range) })
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantReportsCatalog(range) })
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantReports(range) })
        await Promise.all([
          summaryQuery.refetch({ cancelRefetch: true }),
          financialQuery.refetch({ cancelRefetch: true }),
          catalogQuery.refetch({ cancelRefetch: true }),
        ])
      } finally { setHardRefreshing(false) }
    })()
  }

  if(isInitialLoading) return <div className="space-y-[10px] py-5 px-2.5 animate-pulse"><div className="h-7 bg-gray-100 dark:bg-[#171717] rounded w-40" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 bg-gray-100 dark:bg-[#171717] rounded-xl" />)}</div><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl" /></div>
  if(error&&!hasAnyData) return <div className="p-6 flex flex-col items-center justify-center min-h-[400px]"><AlertCircle className="w-10 h-10 text-red-500 mb-3" /><p className="text-sm text-gray-600 mb-4">{error}</p><button onClick={handleHardRefresh} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" />Retry</button></div>
  const period=summary?`${fmtDate(summary.meta.periodStart||'')} — ${fmtDate(summary.meta.periodEnd)}`:''
  return (
    <div className="space-y-[10px] py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2"><FileText className="w-6 h-6 text-blue-600" />Reports</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Period-closed for <span className="font-medium text-gray-700 dark:text-white">{summary?.meta.vendorName ?? '…'}</span> • {period || '…'} • <span className="font-mono text-xs">/vendor/reports</span>{isFetching && !hardRefreshing ? <span className="ml-2 text-xs text-gray-400">Updating…</span> : null}</p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Your outlets only — verified paid transactions. Not global admin view.</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#171717] rounded-full border border-gray-200 dark:border-[#262626]">
          {RANGE_OPTS.map(o=><button key={o.value} onClick={()=>setRange(o.value)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${range===o.value?'bg-white dark:bg-[#262626] text-gray-900 dark:text-white shadow-sm border border-gray-200':'text-gray-600 dark:text-[#a1a1aa]'}`}>{o.label}</button>)}
          <button onClick={handleHardRefresh} disabled={loading} aria-label="Refresh reports" title="Refresh — re-fetch from BFF and show skeleton" className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">
        {summary ? (
          <>
            <Kpi label="Gross (my outlets)" value={fmtCurrency(summary.summary.totalRevenue)} sub={`${summary.summary.paidCount} paid`} />
            <Kpi label="Net (after fees)" value={fmtCurrency(summary.summary.netRevenue)} sub={`Avg ${fmtCurrency(summary.summary.avgOrder)}`} />
            <Kpi label="Orders" value={String(summary.summary.totalOrders)} sub={`${summary.summary.failedCount} failed`} />
            <Kpi label="Outlets" value={String(summary.summary.totalOutlets)} sub={financial ? `${financial.financialReconciliation.count} tx` : '…'} />
          </>
        ) : summaryQuery.isError ? (
          <div className="col-span-full"><SectionError message={summaryQuery.error instanceof Error ? summaryQuery.error.message : 'Failed to load summary'} onRetry={() => void summaryQuery.refetch({ cancelRefetch: true })} /></div>
        ) : (
          Array.from({length:4}).map((_,i)=><div key={i} className="h-24 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />)
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[10px]">
        {financial ? (
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3"><div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0"><DollarSign className="w-5 h-5 text-blue-600" /></div><span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600">{financial.financialReconciliation.count} tx</span></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">My Financial Reconciliation</h3><p className="text-xs text-gray-500 mt-1 flex-1">Paid transactions for your outlets joined to outlet/fee. Your truth for accounting.</p>
            <button onClick={()=>downloadCsv(`my-financial-${range}.csv`, toCsv(financial.financialReconciliation.rows as unknown as Record<string,unknown>[], ['transactionId','orderId','date','outlet','amount','platformFee','deliveryFee']))} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"><Download className="w-3.5 h-3.5" />CSV</button>
          </div>
        ) : financialQuery.isError ? (
          <SectionError message="Failed to load financial" onRetry={() => void financialQuery.refetch({ cancelRefetch: true })} />
        ) : (
          <CardSkeleton />
        )}
        {financial ? (
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3"><div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0"><Store className="w-5 h-5 text-blue-600" /></div><span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600">{financial.outletPayouts.count} outlets</span></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">Outlet Payouts</h3><p className="text-xs text-gray-500 mt-1 flex-1">Per-outlet gross/fees/net — your outlets only.</p>
            <button onClick={()=>downloadCsv(`my-outlet-payouts-${range}.csv`, toCsv(financial.outletPayouts.rows as unknown as Record<string,unknown>[], ['outletId','outletName','orders','gross','net']))} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"><Download className="w-3.5 h-3.5" />CSV</button>
          </div>
        ) : financialQuery.isError ? (
          <SectionError message="Failed to load payouts" onRetry={() => void financialQuery.refetch({ cancelRefetch: true })} />
        ) : (
          <CardSkeleton />
        )}
        {financial ? (
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3"><div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5 text-blue-600" /></div><span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600">{financial.refundsFailures.count} rows</span></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">Refunds & Failures</h3><p className="text-xs text-gray-500 mt-1 flex-1">Your refunded/failed in period.</p>
            <button onClick={()=>downloadCsv(`my-refunds-${range}.csv`, toCsv(financial.refundsFailures.rows as unknown as Record<string,unknown>[], ['transactionId','orderId','date','amount','status']))} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"><Download className="w-3.5 h-3.5" />CSV</button>
          </div>
        ) : financialQuery.isError ? (
          <SectionError message="Failed to load refunds" onRetry={() => void financialQuery.refetch({ cancelRefetch: true })} />
        ) : (
          <CardSkeleton />
        )}
        {catalog ? (
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3"><div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0"><Package className="w-5 h-5 text-blue-600" /></div><span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600">{catalog.productPerformance.count} SKUs</span></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">My Product Performance</h3><p className="text-xs text-gray-500 mt-1 flex-1">Verified items for your catalog only.</p>
            <button onClick={()=>downloadCsv(`my-products-${range}.csv`, toCsv(catalog.productPerformance.rows as unknown as Record<string,unknown>[], ['name','quantity','revenue']))} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"><Download className="w-3.5 h-3.5" />CSV</button>
          </div>
        ) : catalogQuery.isError ? (
          <SectionError message="Failed to load products" onRetry={() => void catalogQuery.refetch({ cancelRefetch: true })} />
        ) : (
          <CardSkeleton />
        )}
        {catalog ? (
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3"><div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0"><Clock className="w-5 h-5 text-blue-600" /></div><span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600">{catalog.orderVolume.daily.length} days</span></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">Order Volume</h3><p className="text-xs text-gray-500 mt-1 flex-1">Daily orders/revenue for your outlets.</p>
            <button onClick={()=>downloadCsv(`my-volume-${range}.csv`, toCsv(catalog.orderVolume.daily as unknown as Record<string,unknown>[], ['date','orders','revenue']))} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"><Download className="w-3.5 h-3.5" />CSV</button>
          </div>
        ) : catalogQuery.isError ? (
          <SectionError message="Failed to load volume" onRetry={() => void catalogQuery.refetch({ cancelRefetch: true })} />
        ) : (
          <CardSkeleton />
        )}
        {catalog ? (
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3"><div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0"><Truck className="w-5 h-5 text-blue-600" /></div><span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600">{catalog.deliveryLogistics.totalBookings} bookings</span></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">My Delivery Logs</h3><p className="text-xs text-gray-500 mt-1 flex-1">Lalamove bookings for your orders.</p>
            <button onClick={()=>downloadCsv(`my-delivery-${range}.csv`, toCsv(catalog.deliveryLogistics.sampleRows as unknown as Record<string,unknown>[], ['orderId','status','deliveryFee']))} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"><Download className="w-3.5 h-3.5" />CSV</button>
          </div>
        ) : catalogQuery.isError ? (
          <SectionError message="Failed to load deliveries" onRetry={() => void catalogQuery.refetch({ cancelRefetch: true })} />
        ) : (
          <CardSkeleton />
        )}
      </div>

      {financial ? (
      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between"><h3 className="text-sm font-semibold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />My Financial — {period}</h3><button onClick={()=>downloadCsv(`my-financial-${range}.csv`, toCsv(financial.financialReconciliation.rows as unknown as Record<string,unknown>[], ['transactionId','orderId','date','outlet','amount']))} className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" />CSV</button></div>
        <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
          <table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 sticky top-0"><tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Order</th><th className="text-left px-3 py-2">Outlet</th><th className="text-right px-3 py-2">Amount</th><th className="text-right px-3 py-2">Platform</th><th className="text-right px-3 py-2">Delivery</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{financial.financialReconciliation.rows.map(r=><tr key={r.transactionId}><td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td><td className="px-3 py-2 font-mono">#{r.orderId.slice(-6)}</td><td className="px-3 py-2 truncate max-w-[140px]">{r.outlet}</td><td className="px-3 py-2 text-right font-medium">{fmtCurrency(r.amount)}</td><td className="px-3 py-2 text-right">{fmtCurrency(r.platformFee)}</td><td className="px-3 py-2 text-right">{fmtCurrency(r.deliveryFee)}</td></tr>)}
            {!financial.financialReconciliation.rows.length&&<tr><td colSpan={6} className="text-center py-8 text-gray-500">No paid transactions in period for your outlets</td></tr>}</tbody></table>
        </div>
        <div className="px-4 py-2 bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-between text-xs text-gray-600"><span>{financial.financialReconciliation.count} rows</span><span>Gross {fmtCurrency(financial.financialReconciliation.totals.gross)}</span></div>
      </div>
      ) : financialQuery.isError ? (
        <SectionError message={financialQuery.error instanceof Error ? financialQuery.error.message : 'Failed to load financial'} onRetry={() => void financialQuery.refetch({ cancelRefetch: true })} />
      ) : (
        <TableSkeleton rows={8} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px]">
        {financial ? (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden"><div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626]"><h3 className="text-sm font-semibold">My Outlet Payouts</h3></div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto"><table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 sticky top-0"><tr><th className="text-left px-3 py-2">Outlet</th><th className="text-right px-3 py-2">Orders</th><th className="text-right px-3 py-2">Gross</th><th className="text-right px-3 py-2">Net</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{financial.outletPayouts.rows.map(r=><tr key={r.outletId}><td className="px-3 py-2 truncate max-w-[160px]">{r.outletName}</td><td className="px-3 py-2 text-right">{r.orders}</td><td className="px-3 py-2 text-right">{fmtCurrency(r.gross)}</td><td className="px-3 py-2 text-right font-semibold">{fmtCurrency(r.net)}</td></tr>)}</tbody></table></div></div>
        ) : financialQuery.isError ? (
          <SectionError message={financialQuery.error instanceof Error ? financialQuery.error.message : 'Failed to load payouts'} onRetry={() => void financialQuery.refetch({ cancelRefetch: true })} />
        ) : (
          <TableSkeleton rows={5} />
        )}
        {catalog ? (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden"><div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626]"><h3 className="text-sm font-semibold">My Products (verified)</h3></div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto"><table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 sticky top-0"><tr><th className="text-left px-3 py-2">Product</th><th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">Revenue</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{catalog.productPerformance.rows.map(r=><tr key={r.id}><td className="px-3 py-2 truncate max-w-[180px]">{r.name}</td><td className="px-3 py-2 text-right">{r.quantity}</td><td className="px-3 py-2 text-right font-medium">{fmtCurrency(r.revenue)}</td></tr>)}</tbody></table></div></div>
        ) : catalogQuery.isError ? (
          <SectionError message={catalogQuery.error instanceof Error ? catalogQuery.error.message : 'Failed to load products'} onRetry={() => void catalogQuery.refetch({ cancelRefetch: true })} />
        ) : (
          <TableSkeleton rows={5} />
        )}
      </div>

      {summary ? <p className="text-[11px] text-gray-400 text-center">Vendor {summary.meta.vendorName} • {summary.meta.range} • {fmtDateTime(summary.meta.generatedAt)} • BFF /vendor/reports • Reports=auditable (your outlets only)</p> : null}
    </div>
  )
}

export default function ReportsPage(){
  // Pure CSR: locale-sensitive currency/dates + generated-at timestamp only
  // render post-mount → identical skeleton on server + hydration → no #441.
  return (
    <ClientOnly fallback={<ReportsSkeleton />}>
      <ReportsPageContent />
    </ClientOnly>
  );
}
