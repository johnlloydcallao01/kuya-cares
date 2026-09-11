'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useVendorPayouts, type PayoutResponse, type PayoutRow, type Summary } from '@/hooks/useVendorPayouts'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Building, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  DollarSign, CreditCard, Truck, TrendingUp, TrendingDown, Receipt, Coins, Store, Eye, Pencil, FileText, CalendarDays
} from '@/components/ui/IconWrapper'

const RANGE_OPTS: { value: string; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '1y', label: '12 months' },
  { value: 'all', label: 'All time' },
]
const BUSINESS_OPTS = [
  { value: 'restaurant', label: 'Restaurant' }, { value: 'fast_food', label: 'Fast Food' },
  { value: 'grocery', label: 'Grocery' }, { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'convenience', label: 'Convenience' }, { value: 'bakery', label: 'Bakery' },
  { value: 'coffee_shop', label: 'Coffee Shop' }, { value: 'other', label: 'Other' },
]
const VERIFICATION_OPTS = [
  { value: 'pending', label: 'Pending' }, { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' }, { value: 'suspended', label: 'Suspended' },
]

function businessLabel(v: string){ return BUSINESS_OPTS.find(o=>o.value===v)?.label || v.replace(/_/g,' ') }
function fmtPHP(n: number){ return `₱${n.toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2})}` }
function fmtCompact(n: number){ if(n>=1000000) return `₱${(n/1000000).toFixed(1)}M`; if(n>=1000) return `₱${(n/1000).toFixed(1)}k`; return fmtPHP(n) }
function fmtDate(iso: string | null){ if(!iso) return '—'; try{return new Date(iso).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',month:'short',day:'numeric',year:'numeric'})}catch{return iso.slice(0,10)} }
function initials(name: string){ return name.split(' ').slice(0,2).map(word=>word[0]?.toUpperCase() || '').join('') || 'V' }

function KpiCard({ title, value, sub, icon, iconBg, trend }: { title: string; value: string; sub?: string; icon: React.ReactNode; iconBg: string; trend?: string }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] truncate">{title}</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-gray-500 dark:text-[#a1a1aa] mt-1 truncate">{sub}</p>}
          {trend && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">{trend}</p>}
        </div>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      </div>
    </div>
  )
}
function FilterPills({ label, options, value, onToggle }: { label: string; options:{value:string;label:string}[]; value:string[]; onToggle:(v:string)=>void }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map(o=>{
          const active=value.includes(o.value)
          return <button key={o.value} onClick={()=>onToggle(o.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${active?'bg-[#eba236] text-white border-[#eba236]':'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{o.label}</button>
        })}
      </div>
    </div>
  )
}

function PayoutsSkeleton(){
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

function PayoutsPageContent() {
  const [range, setRange] = useState('30d')
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [verificationFilter, setVerificationFilter] = useState<string[]>([])
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10

  useEffect(()=>{ const t=setTimeout(()=>setDebouncedQ(q.trim().toLowerCase()),400); return()=>clearTimeout(t)},[q])
  const activeFilterCount = useMemo(()=> verificationFilter.length + businessTypeFilter.length + (debouncedQ?1:0),[verificationFilter,businessTypeFilter,debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('range', range)
    if (debouncedQ) p.set('search', debouncedQ)
    if (verificationFilter.length) p.set('verificationStatus', verificationFilter.join(','))
    if (businessTypeFilter.length) p.set('businessType', businessTypeFilter.join(','))
    return p.toString()
  }, [range, debouncedQ, verificationFilter, businessTypeFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useVendorPayouts(qs)

  // Range switches (7d/30d/90d/1y/all) reuse the skeleton screen while fetching
  // instead of keeping the previous range's numbers on screen.
  const isInitialLoading = isPending || isFetching || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !isInitialLoading ? (queryError instanceof Error ? queryError.message : 'Failed to load payouts') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminVendorPayouts(qs) })
        await refetch({ cancelRefetch: true })
      } finally {
        setHardRefreshing(false)
      }
    })()
  }

  useEffect(()=>{ setPage(1) },[debouncedQ,verificationFilter,businessTypeFilter,range])

  const toggleVerification=(v:string)=> setVerificationFilter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])
  const toggleBusiness=(v:string)=> setBusinessTypeFilter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])
  const clearAll=()=>{setQ('');setDebouncedQ('');setVerificationFilter([]);setBusinessTypeFilter([])}

  const rows = data?.vendorPayouts.rows || []
  const totalPages = Math.max(1, Math.ceil(rows.length / limit))
  const pagedRows = useMemo(()=> rows.slice((page-1)*limit, page*limit),[rows,page,limit])

  const handleExport = () => {
    if(!rows.length) return
    const headers = ['Vendor','Legal Name','Type','Verification','Is Active','Outlets','Orders','Gross','Platform Fee','Delivery Fee','Net Payout','Refunded','Avg Order']
    const csvRows = rows.map(r=>[
      `"${r.businessName.replace(/"/g,'""')}"`,
      `"${r.legalName.replace(/"/g,'""')}"`,
      r.businessType, r.verificationStatus, String(r.isActive), String(r.totalMerchants),
      String(r.orders), String(r.gross.toFixed(2)), String(r.platformFees.toFixed(2)), String(r.deliveryFees.toFixed(2)),
      String(r.net.toFixed(2)), String(r.refunded.toFixed(2)), String(r.avgOrder.toFixed(2))
    ])
    const csv=[headers.join(','), ...csvRows.map(r=>r.join(','))].join('\n')
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'})
    const url=URL.createObjectURL(blob)
    const a=document.createElement('a'); a.href=url; a.download=`vendor-payouts-${range}-${new Date().toISOString().slice(0,10)}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Coins className="w-4 h-4" /></span>
            Vendor Payouts Overview
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Settlements per vendor — gross, platform & delivery fees, refunds, net payout. Period: {data?.meta.range || range} • {data ? fmtDate(data.meta.periodStart) + ' → ' + fmtDate(data.meta.periodEnd) : '—'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
            {RANGE_OPTS.map(o=>(
              <button key={o.value} onClick={()=>setRange(o.value)} disabled={loading} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition disabled:opacity-50 disabled:cursor-wait ${range===o.value?'bg-white dark:bg-[#171717] text-gray-900 dark:text-white shadow-sm border border-gray-200 dark:border-[#333]':'text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900'}`}>{o.label}</button>
            ))}
          </div>
          <button onClick={handleHardRefresh} disabled={loading} aria-label="Refresh payouts" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading?'animate-spin':''}`} />
          </button>
          <button onClick={handleExport} disabled={!rows.length} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><FileText className="w-4 h-4" /> Export CSV</button>
          <Link href="/vendors" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50">Back to vendors</Link>
        </div>
      </div>

      {isInitialLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({length:4}).map((_,i)=><div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Net Payout" value={fmtCompact(data.summary.totalNet)} sub={`${data.summary.totalVendors} vendors • ${data.summary.totalOrders} orders`} icon={<Coins className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Total Gross" value={fmtCompact(data.summary.totalGross)} sub={`Avg order ${fmtPHP(data.summary.avgOrder)}`} icon={<DollarSign className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Platform + Delivery Fees" value={fmtCompact(data.summary.totalPlatformFees + data.summary.totalDeliveryFees)} sub={`Platform ${fmtCompact(data.summary.totalPlatformFees)} • Delivery ${fmtCompact(data.summary.totalDeliveryFees)}`} icon={<Receipt className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
          <KpiCard title="Refunded" value={fmtCompact(data.summary.totalRefunded)} sub={`${((data.summary.totalRefunded/Math.max(1,data.summary.totalGross))*100).toFixed(1)}% of gross`} icon={<TrendingDown className="w-5 h-5 text-white" />} iconBg="bg-red-500" />
        </div>
      ) : null}

      {isInitialLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 animate-pulse">
          {Array.from({length:3}).map((_,i)=><div key={i} className="h-[76px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">Avg Net per Vendor</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{fmtPHP(data.summary.avgPayout)}</p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-amber-600" /></div>
          </div>
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">Active Vendors</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{data.summary.activeVendors} / {data.summary.totalVendors}</p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center"><Store className="w-5 h-5 text-emerald-600" /></div>
          </div>
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">Daily Net (last point)</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">{data.daily.length ? fmtPHP(data.daily[data.daily.length-1].net) : '—'}</p>
              <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">{data.daily.length ? data.daily[data.daily.length-1].date : 'no data'}</p>
            </div>
            <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center"><CalendarDays className="w-5 h-5 text-blue-600" /></div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search vendor, legal name, registration…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-gray-600 dark:text-[#a1a1aa]">10 / page</span>
            <button onClick={()=>setShowFilters(v=>!v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border ${activeFilterCount?'bg-[#eba236] hover:bg-[#c88a20] text-white border-[#eba236]':'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount>0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters?'rotate-180':''}`} />
            </button>
            {activeFilterCount>0 && <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">Clear</button>}
          </div>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FilterPills label="Verification" options={VERIFICATION_OPTS} value={verificationFilter} onToggle={(v)=> setVerificationFilter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])} />
              <FilterPills label="Business Type" options={BUSINESS_OPTS} value={businessTypeFilter} onToggle={(v)=> setBusinessTypeFilter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])} />
            </div>
            <div className="flex justify-end"><button onClick={()=>setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && !isInitialLoading && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load payouts</h3><p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="w-4 h-4 mr-2" />Retry</button>
          </div>
        )}
        {isInitialLoading ? (
          <div className="p-4 space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
        ) : !error && pagedRows.length===0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Coins className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No payouts in this period</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Try a larger range (90d / All) or clear filters.</p>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Type</th>
                    <th className="text-right px-4 py-3 font-medium">Orders</th>
                    <th className="text-right px-4 py-3 font-medium">Gross</th>
                    <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Platform Fee</th>
                    <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Delivery Fee</th>
                    <th className="text-right px-4 py-3 font-medium">Net Payout</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Refunded</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {pagedRows.map(r=>(
                    <tr key={r.vendorId} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="min-w-[180px] flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                            {r.logo?.url ? <img src={r.logo.url} alt={r.businessName} className="h-9 w-9 rounded-xl object-cover" /> : initials(r.businessName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{r.businessName}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px]">{r.legalName} • {businessLabel(r.businessType)} • {r.verificationStatus} • {r.isActive?'Active':'Inactive'}</div>
                            <div className="text-[11px] text-gray-400">{r.totalMerchants} outlet{r.totalMerchants!==1?'s':''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell"><span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]">{businessLabel(r.businessType)}</span></td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{r.orders}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{fmtPHP(r.gross)}</td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell text-gray-600 dark:text-[#a1a1aa]">{fmtPHP(r.platformFees)}</td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell text-gray-600 dark:text-[#a1a1aa]">{fmtPHP(r.deliveryFees)}</td>
                      <td className="px-4 py-3 text-right"><span className="inline-flex px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800">{fmtPHP(r.net)}</span></td>
                      <td className="px-4 py-3 text-right hidden md:table-cell"><span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${r.refunded>0?'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300':'bg-gray-100 text-gray-500 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa]'}`}>{r.refunded?fmtPHP(r.refunded):'—'}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link href={`/vendors/${r.vendorId}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View vendor"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/vendors/${r.vendorId}/edit`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600" title="Edit"><Pencil className="w-4 h-4" /></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
              <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {rows.length} vendors • 10 per page • {data?.meta.range} • {fmtDate(data?.meta.periodStart ?? null)} → {fmtDate(data?.meta.periodEnd ?? null)}</div>
              <div className="flex items-center gap-1">
                <button disabled={loading || page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                {Array.from({length:Math.min(5,totalPages)}).map((_,i)=>{
                  const n=Math.max(1,Math.min(totalPages-4,page-2))+i; if(n>totalPages) return null
                  return <button key={n} onClick={()=>setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n===page?'bg-[#eba236] text-white border-[#eba236]':'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                })}
                <button disabled={loading || page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
              </div>
            </div>
          </>
        )}
      </div>

      {!isInitialLoading && data && data.daily.length>0 && (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#eba236]" /> Daily Net Payout Trend</h3>
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-24">
              {data.daily.slice(-14).map(d=>{
                const max=Math.max(...data.daily.slice(-14).map(x=>x.net),1)
                const h=Math.max(4, (d.net/max)*80)
                return <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${fmtPHP(d.net)} (${d.orders} orders)`}>
                  <div className="w-full bg-[#eba236] rounded-t" style={{height:`${h}px`}} />
                  <span className="text-[10px] text-gray-500 dark:text-[#a1a1aa]">{d.date.slice(5)}</span>
                </div>
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PayoutsPage(){
  return (
    <ClientOnly fallback={<PayoutsSkeleton />}>
      <PayoutsPageContent />
    </ClientOnly>
  )
}
