'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useMerchants, type MerchantDoc, type MerchantsResponse, type MerchantPagination, type MerchantStats } from '@/hooks/useMerchants'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Store, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  Building, Clock, CheckCircle, Eye, Pencil, Trash2, MapPin, Phone, Mail, Tag
} from '@/components/ui/IconWrapper'

const OPERATIONAL_OPTS = [
  { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' },
  { value: 'busy', label: 'Busy' }, { value: 'temp_closed', label: 'Temp Closed' },
  { value: 'maintenance', label: 'Maintenance' },
]
const VERIFICATION_OPTS = [
  { value: 'pending', label: 'Pending' }, { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' }, { value: 'suspended', label: 'Suspended' },
]
const BUSINESS_OPTS = [
  { value: 'restaurant', label: 'Restaurant' }, { value: 'fast_food', label: 'Fast Food' },
  { value: 'grocery', label: 'Grocery' }, { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'convenience', label: 'Convenience' }, { value: 'bakery', label: 'Bakery' },
  { value: 'coffee_shop', label: 'Coffee Shop' }, { value: 'other', label: 'Other' },
]

function businessLabel(v: string){ return BUSINESS_OPTS.find(o=>o.value===v)?.label || v.replace(/_/g,' ') }
function operationalBadge(s: string){
  const v=s.toLowerCase()
  if(v==='open') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
  if(v==='busy') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300'
  if(v==='closed') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
  if(v==='temp_closed') return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20'
  if(v==='maintenance') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}
function initials(n: string){ return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'M' }
// Deterministic timezone — server UTC vs client Asia/Manila previously
// produced different day strings during SSR → React #441. Wrapped in
// ClientOnly below so this only runs on the client, timeZone pins it.
function fmtDate(iso: string | null){ if(!iso) return '—'; try{return new Date(iso).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'})}catch{return String(iso).slice(0,10)} }

function KpiCard({ title, value, sub, icon, iconBg }: { title: string; value: string; sub?: string; icon: React.ReactNode; iconBg: string }){
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
function FilterPills({ label, options, value, onToggle }: { label: string; options:{value:string;label:string}[]; value:string[]; onToggle:(v:string)=>void }){
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

function MerchantsSkeleton(){
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

function MerchantsPageContent(){
  const [q,setQ]=useState('')
  const [debouncedQ,setDebouncedQ]=useState('')
  const [operationalFilter,setOperationalFilter]=useState<string[]>([])
  const [isActiveFilter,setIsActiveFilter]=useState<boolean|null>(null)
  const [isAcceptingFilter,setIsAcceptingFilter]=useState<boolean|null>(null)
  const [verificationFilter,setVerificationFilter]=useState<string[]>([])
  const [showFilters,setShowFilters]=useState(false)
  const [page,setPage]=useState(1)
  const limit=10
const [sort,setSort]=useState('-createdAt')
  const [deleting,setDeleting]=useState<MerchantDoc|null>(null)
  const [isDeleting,setIsDeleting]=useState(false)

  useEffect(()=>{ const t=setTimeout(()=>setDebouncedQ(q.trim().toLowerCase()),400); return()=>clearTimeout(t)},[q])
  const activeFilterCount=useMemo(()=> operationalFilter.length + verificationFilter.length + (isActiveFilter!==null?1:0) + (isAcceptingFilter!==null?1:0) + (debouncedQ?1:0),[operationalFilter,verificationFilter,isActiveFilter,isAcceptingFilter,debouncedQ])

  const qs=useMemo(()=>{
    const p=new URLSearchParams()
    p.set('page',String(page)); p.set('limit',String(limit)); p.set('sort',sort)
    if(debouncedQ) p.set('search',debouncedQ)
    if(operationalFilter.length) p.set('operationalStatus',operationalFilter.join(','))
    if(isActiveFilter!==null) p.set('isActive',String(isActiveFilter))
    if(isAcceptingFilter!==null) p.set('isAcceptingOrders',String(isAcceptingFilter))
    if(verificationFilter.length) p.set('verificationStatus',verificationFilter.join(','))
    return p.toString()
  },[page,limit,sort,debouncedQ,operationalFilter,isActiveFilter,isAcceptingFilter,verificationFilter])

  const queryClient=useQueryClient()
  const [hardRefreshing,setHardRefreshing]=useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useMerchants(qs)

  const docs=data?.docs||[]
  const pagination=data?.pagination||null
  const stats=data?.stats||null

  const isInitialLoading=(isPending&&!data)||hardRefreshing
  const loading=isFetching||hardRefreshing
  const error=isError&&!data&&!hardRefreshing?(queryError instanceof Error?queryError.message:'Failed to load merchants'):null

  const handleHardRefresh=()=>{
    if(hardRefreshing) return
    setHardRefreshing(true)
    void (async()=>{
      try{
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminMerchants(qs) })
        await refetch({ cancelRefetch: true })
      }finally{ setHardRefreshing(false) }
    })()
  }

  useEffect(()=>{
    const isOpen=!!deleting
    if(isOpen){ const prev=document.body.style.overflow; document.body.style.overflow='hidden'; return()=>{document.body.style.overflow=prev} }
    document.body.style.overflow=''; return()=>{document.body.style.overflow=''}
  },[deleting])

  const handleDelete=async()=>{
    if(!deleting||isDeleting) return
    setIsDeleting(true)
    try{
      const res=await fetch(`/api/merchants/${deleting.id}`,{method:'DELETE'})
      const j=await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(j.error||'Failed to delete')
      const deletedId=deleting.id
      // Optimistic removal across every cached merchants list (all pages/filters).
      // Length-guard keeps sibling queries untouched.
      // The row vanishes instantly even while the CMS Redis list cache
      // is still converging; invalidate+refetch below reconciles with the server.
      queryClient.setQueriesData<MerchantsResponse>(
        {
          queryKey: QUERY_KEYS.adminMerchants().slice(0, 2),
          predicate: (q)=>q.queryKey.length===3&&typeof q.queryKey[2]==='string',
        },
        (old)=>{
          if(!old||!Array.isArray(old.docs)) return old
          const docs=old.docs.filter((d)=>d.id!==deletedId)
          const removed=old.docs.length-docs.length
          if(!removed) return old
          const limit=Math.max(1,old.pagination?.limit??10)
          const totalDocs=Math.max(0,(old.pagination?.totalDocs??old.docs.length)-removed)
          const pagination=old.pagination
            ? {...old.pagination,totalDocs,totalPages:Math.max(1,Math.ceil(totalDocs/limit))}
            : old.pagination
          const stats=old.stats
            ? {...old.stats,filteredCount:Math.max(0,old.stats.filteredCount-removed),totalMerchants:Math.max(0,old.stats.totalMerchants-removed)}
            : old.stats
          return {...old,docs,pagination,stats}
        }
      )
      setDeleting(null)
      // Bust every cached merchants list (all pages/filters) so the removal
      // reconciles with the server instead of waiting out the 3-min staleTime.
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminMerchants().slice(0, 2) })
      await refetch()
    }catch(e:any){ alert(e.message||'') }
    finally{ setIsDeleting(false) }
  }

  const isInitial=isInitialLoading

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><Store className="w-4 h-4" /></span>
            Merchants <span className="text-sm font-normal text-gray-500 dark:text-[#a1a1aa] hidden sm:inline">(Outlets)</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Manage outlets per vendor — status, location, categories, and delivery readiness.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleHardRefresh} disabled={loading} aria-label="Refresh merchants" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading?'animate-spin':''}`} />
          </button>
          <Link href="/merchants/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" /> New Outlet
          </Link>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Total Outlets" value={String(stats.totalMerchants)} sub={`${stats.filteredCount} filtered`} icon={<Store className="w-5 h-5 text-white" />} iconBg="bg-[#eba236]" />
          <KpiCard title="Active Outlets" value={String(stats.activeMerchants)} sub={`${stats.acceptingOrders} accepting orders`} icon={<CheckCircle className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Open Now" value={String(stats.operationalBreakdown.open||0)} sub={`${stats.operationalBreakdown.busy||0} busy • ${stats.operationalBreakdown.closed||0} closed`} icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-blue-500" />
          <KpiCard title="Vendors" value={String(stats.totalVendors)} sub={`${stats.activeVendors} active`} icon={<Building className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
        </div>
      ) : isInitialLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({length:4}).map((_,i)=><div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : null}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e)=>{setQ(e.target.value); setPage(1)}} placeholder="Search outlet, code, vendor, manager, email…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-[#0a0a0a] rounded-full border border-gray-200 dark:border-[#262626]">
              <select value={sort} onChange={(e)=>{setSort(e.target.value); setPage(1)}} className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#333] text-gray-700 dark:text-white">
                <option value="-createdAt">Newest</option>
                <option value="createdAt">Oldest</option>
                <option value="outletName">Name A–Z</option>
                <option value="-outletName">Name Z–A</option>
              </select>
            </div>
            <span className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-gray-600 dark:text-[#a1a1aa]">10 / page</span>
            <button onClick={()=>setShowFilters(v=>!v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border ${activeFilterCount?'bg-[#eba236] hover:bg-[#c88a20] text-white border-[#eba236]':'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount>0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters?'rotate-180':''}`} />
            </button>
            {activeFilterCount>0 && <button onClick={()=>{ setQ(''); setDebouncedQ(''); setOperationalFilter([]); setVerificationFilter([]); setIsActiveFilter(null); setIsAcceptingFilter(null)}} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">Clear</button>}
          </div>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FilterPills label="Operational Status" options={OPERATIONAL_OPTS} value={operationalFilter} onToggle={(v)=>{setPage(1); setOperationalFilter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}} />
              <FilterPills label="Vendor Verification" options={VERIFICATION_OPTS} value={verificationFilter} onToggle={(v)=>{setPage(1); setVerificationFilter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])}} />
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Toggles</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    ['isActive','Active only'],
                    ['isAccepting','Accepting only'],
                  ].map(([key,label])=>{
                    const isActiveKey=key==='isActive'
                    const active=isActiveKey ? isActiveFilter===true : isAcceptingFilter===true
                    return <button key={key} onClick={()=>{
                      setPage(1)
                      if(isActiveKey) setIsActiveFilter(active?null:true)
                      else setIsAcceptingFilter(active?null:true)
                    }} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${active?'bg-[#eba236] text-white border-[#eba236]':'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{label}</button>
                  })}
                  <button onClick={()=>{setPage(1); setIsActiveFilter(v=> v===false?null:false)}} className={`px-2.5 py-1 rounded-full text-xs font-medium border ${isActiveFilter===false?'bg-[#eba236] text-white border-[#eba236]':'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>Inactive only</button>
                </div>
              </div>
            </div>
            <div className="flex justify-end"><button onClick={()=>setShowFilters(false)} className="text-xs font-semibold text-[#eba236]">Done</button></div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load merchants</h3><p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="w-4 h-4 mr-2" />Retry</button>
          </div>
        )}
        {isInitialLoading ? (
          <div className="p-4 space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
        ) : !error && docs.length===0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#eba236]/10 dark:bg-[#eba236]/15 rounded-2xl flex items-center justify-center mb-4"><Store className="w-8 h-8 text-[#eba236]" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No outlets found</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">Try adjusting search or filters, or create your first outlet. Each outlet belongs to a vendor and has its own hours and delivery settings.</p>
            <Link href="/merchants/new" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-semibold"><Plus className="w-4 h-4" /> New Outlet</Link>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Outlet</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Vendor</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Contact</th>
                    <th className="text-left px-4 py-3 font-medium">Operational</th>
                    <th className="text-left px-4 py-3 font-medium">Active</th>
                    <th className="text-left px-4 py-3 font-medium">Categories</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map(m=>(
                    <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-[#262626] dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">{m.vendor?.logo?.url ? <img src={m.vendor.logo.url} alt={m.vendor.businessName || m.outletName} className="h-9 w-9 rounded-xl object-cover" /> : initials(m.vendor?.businessName || m.outletName)}</div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{m.outletName}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] font-mono truncate max-w-[180px]">{m.outletCode} • {fmtDate(m.createdAt)}</div>
                            {m.activeAddress?.formatted_address && <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> <span className="truncate max-w-[180px]">{m.activeAddress.formatted_address}</span></div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[160px]">{m.vendor?.businessName || '—'}</div>
                        <div className="text-xs text-gray-500">{m.vendor?.verificationStatus || '—'} • {m.vendor?.businessType ? businessLabel(m.vendor.businessType) : ''}</div>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <div className="text-xs text-gray-900 dark:text-white truncate max-w-[160px] flex items-center gap-1"><Mail className="w-3 h-3 text-gray-400" /> {m.contactInfo?.email || '—'}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {m.contactInfo?.managerName || m.contactInfo?.phone || '—'}</div>
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${operationalBadge(m.operationalStatus)}`}>{m.operationalStatus.replace(/_/g,' ')}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border w-fit ${m.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>{m.isActive ? 'Active' : 'Inactive'}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border w-fit ${m.isAcceptingOrders ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20'}`}>{m.isAcceptingOrders ? 'Accepting' : 'Paused'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[160px]">
                          {m.merchant_categories?.length ? m.merchant_categories.slice(0,2).map((c:any)=><span key={c.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-[#262626] text-gray-600 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]"><Tag className="w-3 h-3" />{c.name}</span>) : <span className="text-xs text-gray-400">—</span>}
                          {m.merchant_categories?.length>2 && <span className="text-xs text-gray-400">+{m.merchant_categories.length-2}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link href={`/merchants/${m.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/merchants/${m.id}/edit`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600" title="Edit"><Pencil className="w-4 h-4" /></Link>
                          <button onClick={()=>setDeleting(m)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && pagination.totalDocs>0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} outlets • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || !pagination.hasPrevPage} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({length:Math.min(5,pagination.totalPages)}).map((_,i)=>{
                    const n=Math.max(1,Math.min(pagination.totalPages-4,page-2))+i; if(n>pagination.totalPages) return null
                    return <button key={n} onClick={()=>setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n===page?'bg-[#eba236] text-white border-[#eba236]':'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || !pagination.hasNextPage} onClick={()=>setPage(p=>Math.min(pagination.totalPages,p+1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {deleting && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { if(!isDeleting) setDeleting(null) }}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4"><Trash2 className="w-6 h-6 text-red-600" /></div>
              <h3 className="font-bold text-gray-900 dark:text-white">Delete outlet?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">This will permanently delete <span className="font-semibold text-gray-900 dark:text-white">{deleting.outletName}</span> ({deleting.outletCode}). This cannot be undone.</p>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setDeleting(null)} disabled={isDeleting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed">Cancel</button>
                <button onClick={handleDelete} disabled={isDeleting} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                  {isDeleting && <RefreshCw className="w-4 h-4 animate-spin" />}
                  {isDeleting ? 'Deleting…' : 'Confirm delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function MerchantsPage(){
  // Pure CSR: server + first client render emit identical skeleton,
  // real table/dates/portal only run after mount → no hydration mismatch (#441).
  return (
    <ClientOnly fallback={<MerchantsSkeleton />}>
      <MerchantsPageContent />
    </ClientOnly>
  )
}
