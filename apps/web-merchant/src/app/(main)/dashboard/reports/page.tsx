'use client'
import React, { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useMerchantReports } from '@/hooks/useMerchantReports'
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

function ReportsPageContent(){
  const [range,setRange]=useState<Range>('30d')

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useMerchantReports(range)

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load reports') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantReports(range) })
        await refetch({ cancelRefetch: true })
      } finally { setHardRefreshing(false) }
    })()
  }

  if(isInitialLoading) return <div className="space-y-[10px] py-5 px-2.5 animate-pulse"><div className="h-7 bg-gray-100 dark:bg-[#171717] rounded w-40" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 bg-gray-100 dark:bg-[#171717] rounded-xl" />)}</div><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl" /></div>
  if(error&&!data) return <div className="p-6 flex flex-col items-center justify-center min-h-[400px]"><AlertCircle className="w-10 h-10 text-red-500 mb-3" /><p className="text-sm text-gray-600 mb-4">{error}</p><button onClick={handleHardRefresh} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" />Retry</button></div>
  if(!data) return null
  const period=`${fmtDate(data.meta.periodStart||'')} — ${fmtDate(data.meta.periodEnd)}`
  return (
    <div className="space-y-[10px] py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2"><FileText className="w-6 h-6 text-blue-600" />Reports</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Period-closed for <span className="font-medium text-gray-700 dark:text-white">{data.meta.vendorName}</span> • {period} • <span className="font-mono text-xs">/vendor/reports</span></p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Your outlets only — verified paid transactions. Not global admin view.</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#171717] rounded-full border border-gray-200 dark:border-[#262626]">
          {RANGE_OPTS.map(o=><button key={o.value} onClick={()=>setRange(o.value)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${range===o.value?'bg-white dark:bg-[#262626] text-gray-900 dark:text-white shadow-sm border border-gray-200':'text-gray-600 dark:text-[#a1a1aa]'}`}>{o.label}</button>)}
          <button onClick={handleHardRefresh} disabled={loading} aria-label="Refresh reports" title="Refresh — re-fetch from BFF and show skeleton" className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-white dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw className={`w-4 h-4 ${loading?'animate-spin':''}`} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[10px]">
        <Kpi label="Gross (my outlets)" value={fmtCurrency(data.summary.totalRevenue)} sub={`${data.summary.paidCount} paid`} />
        <Kpi label="Net (after fees)" value={fmtCurrency(data.summary.netRevenue)} sub={`Avg ${fmtCurrency(data.summary.avgOrder)}`} />
        <Kpi label="Orders" value={String(data.summary.totalOrders)} sub={`${data.summary.failedCount} failed`} />
        <Kpi label="Outlets" value={String(data.summary.totalOutlets)} sub={`${data.financialReconciliation.count} tx`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[10px]">
        {[
          {title:'My Financial Reconciliation',desc:'Paid transactions for your outlets joined to outlet/fee. Your truth for accounting.', icon:DollarSign, count:`${data.financialReconciliation.count} tx`, action:()=>downloadCsv(`my-financial-${data.meta.range}.csv`, toCsv(data.financialReconciliation.rows as unknown as Record<string,unknown>[], ['transactionId','orderId','date','outlet','amount','platformFee','deliveryFee']))},
          {title:'Outlet Payouts',desc:'Per-outlet gross/fees/net — your outlets only.', icon:Store, count:`${data.outletPayouts.count} outlets`, action:()=>downloadCsv(`my-outlet-payouts-${data.meta.range}.csv`, toCsv(data.outletPayouts.rows as unknown as Record<string,unknown>[], ['outletId','outletName','orders','gross','net']))},
          {title:'Refunds & Failures',desc:'Your refunded/failed in period.', icon:AlertCircle, count:`${data.refundsFailures.count} rows`, action:()=>downloadCsv(`my-refunds-${data.meta.range}.csv`, toCsv(data.refundsFailures.rows as unknown as Record<string,unknown>[], ['transactionId','orderId','date','amount','status']))},
          {title:'My Product Performance',desc:'Verified items for your catalog only.', icon:Package, count:`${data.productPerformance.count} SKUs`, action:()=>downloadCsv(`my-products-${data.meta.range}.csv`, toCsv(data.productPerformance.rows as unknown as Record<string,unknown>[], ['name','quantity','revenue']))},
          {title:'Order Volume',desc:'Daily orders/revenue for your outlets.', icon:Clock, count:`${data.orderVolume.daily.length} days`, action:()=>downloadCsv(`my-volume-${data.meta.range}.csv`, toCsv(data.orderVolume.daily as unknown as Record<string,unknown>[], ['date','orders','revenue']))},
          {title:'My Delivery Logs',desc:'Lalamove bookings for your orders.', icon:Truck, count:`${data.deliveryLogistics.totalBookings} bookings`, action:()=>downloadCsv(`my-delivery-${data.meta.range}.csv`, toCsv(data.deliveryLogistics.sampleRows as unknown as Record<string,unknown>[], ['orderId','status','deliveryFee']))},
        ].map(c=>(
          <div key={c.title} className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex flex-col">
            <div className="flex items-start justify-between gap-3"><div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0"><c.icon className="w-5 h-5 text-blue-600" /></div><span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 dark:bg-[#262626] text-gray-600">{c.count}</span></div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3">{c.title}</h3><p className="text-xs text-gray-500 mt-1 flex-1">{c.desc}</p>
            <button onClick={c.action} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"><Download className="w-3.5 h-3.5" />CSV</button>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between"><h3 className="text-sm font-semibold flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" />My Financial — {period}</h3><button onClick={()=>downloadCsv(`my-financial-${data.meta.range}.csv`, toCsv(data.financialReconciliation.rows as unknown as Record<string,unknown>[], ['transactionId','orderId','date','outlet','amount']))} className="text-xs font-semibold text-blue-600 inline-flex items-center gap-1"><Download className="w-3.5 h-3.5" />CSV</button></div>
        <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
          <table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 sticky top-0"><tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Order</th><th className="text-left px-3 py-2">Outlet</th><th className="text-right px-3 py-2">Amount</th><th className="text-right px-3 py-2">Platform</th><th className="text-right px-3 py-2">Delivery</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{data.financialReconciliation.rows.map(r=><tr key={r.transactionId}><td className="px-3 py-2 whitespace-nowrap">{fmtDate(r.date)}</td><td className="px-3 py-2 font-mono">#{r.orderId.slice(-6)}</td><td className="px-3 py-2 truncate max-w-[140px]">{r.outlet}</td><td className="px-3 py-2 text-right font-medium">{fmtCurrency(r.amount)}</td><td className="px-3 py-2 text-right">{fmtCurrency(r.platformFee)}</td><td className="px-3 py-2 text-right">{fmtCurrency(r.deliveryFee)}</td></tr>)}
            {!data.financialReconciliation.rows.length&&<tr><td colSpan={6} className="text-center py-8 text-gray-500">No paid transactions in period for your outlets</td></tr>}</tbody></table>
        </div>
        <div className="px-4 py-2 bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-between text-xs text-gray-600"><span>{data.financialReconciliation.count} rows</span><span>Gross {fmtCurrency(data.financialReconciliation.totals.gross)}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[10px]">
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden"><div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626]"><h3 className="text-sm font-semibold">My Outlet Payouts</h3></div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto"><table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 sticky top-0"><tr><th className="text-left px-3 py-2">Outlet</th><th className="text-right px-3 py-2">Orders</th><th className="text-right px-3 py-2">Gross</th><th className="text-right px-3 py-2">Net</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{data.outletPayouts.rows.map(r=><tr key={r.outletId}><td className="px-3 py-2 truncate max-w-[160px]">{r.outletName}</td><td className="px-3 py-2 text-right">{r.orders}</td><td className="px-3 py-2 text-right">{fmtCurrency(r.gross)}</td><td className="px-3 py-2 text-right font-semibold">{fmtCurrency(r.net)}</td></tr>)}</tbody></table></div></div>
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden"><div className="px-4 py-3 border-b border-gray-100 dark:border-[#262626]"><h3 className="text-sm font-semibold">My Products (verified)</h3></div>
          <div className="overflow-x-auto max-h-[300px] overflow-y-auto"><table className="w-full text-xs"><thead className="bg-gray-50 dark:bg-[#0a0a0a] text-gray-500 sticky top-0"><tr><th className="text-left px-3 py-2">Product</th><th className="text-right px-3 py-2">Qty</th><th className="text-right px-3 py-2">Revenue</th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">{data.productPerformance.rows.map(r=><tr key={r.id}><td className="px-3 py-2 truncate max-w-[180px]">{r.name}</td><td className="px-3 py-2 text-right">{r.quantity}</td><td className="px-3 py-2 text-right font-medium">{fmtCurrency(r.revenue)}</td></tr>)}</tbody></table></div></div>
      </div>

      <p className="text-[11px] text-gray-400 text-center">Vendor {data.meta.vendorName} • {data.meta.range} • {fmtDateTime(data.meta.generatedAt)} • BFF /vendor/reports • Reports=auditable (your outlets only)</p>
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
