'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useVendors, type VendorDoc, type Pagination, type Stats } from '@/hooks/useVendors'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Building, Search, X, SlidersHorizontal, ChevronDown, RefreshCw, AlertCircle,
  ShieldCheck, ShieldAlert, Clock, CheckCircle, Eye, Pencil, FileText, Image as ImageIcon, CalendarDays, Ban, XCircle
} from '@/components/ui/IconWrapper'

const VERIFICATION_OPTS = [
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
]
const BUSINESS_OPTS = [
  { value: 'restaurant', label: 'Restaurant' }, { value: 'fast_food', label: 'Fast Food' },
  { value: 'grocery', label: 'Grocery' }, { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'convenience', label: 'Convenience' }, { value: 'bakery', label: 'Bakery' },
  { value: 'coffee_shop', label: 'Coffee Shop' }, { value: 'other', label: 'Other' },
]

function verificationBadge(s: string) {
  const v = s.toLowerCase()
  if (v === 'verified') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (v === 'pending') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (v === 'rejected') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (v === 'suspended') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}
function businessLabel(v: string) { return BUSINESS_OPTS.find(o=>o.value===v)?.label || v.replace(/_/g,' ') }
function fmtDate(iso: string | null) { if(!iso) return '—'; try{return new Date(iso).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'})}catch{return String(iso).slice(0,10)} }
function initials(n: string){ return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'V' }

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

function VerificationSkeleton(){
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="p-4 space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
    </div>
  )
}

function VerificationPageContent() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [verificationFilter, setVerificationFilter] = useState<string[]>(['pending'])
  const [businessTypeFilter, setBusinessTypeFilter] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 10
  const [sort] = useState('-createdAt')
  const [actioningId, setActioningId] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<{ id: number; businessName: string; next: string } | null>(null)

  useEffect(()=>{ const t=setTimeout(()=>setDebouncedQ(q.trim()),400); return()=>clearTimeout(t)},[q])
  const activeFilterCount = useMemo(()=> verificationFilter.length + businessTypeFilter.length + (debouncedQ?1:0),[verificationFilter,businessTypeFilter,debouncedQ])

  const qs = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('limit', String(limit))
    p.set('sort', sort)
    if (debouncedQ) p.set('search', debouncedQ)
    if (verificationFilter.length) p.set('verificationStatus', verificationFilter.join(','))
    if (businessTypeFilter.length) p.set('businessType', businessTypeFilter.join(','))
    return p.toString()
  }, [page, limit, sort, debouncedQ, verificationFilter, businessTypeFilter])

  const queryClient = useQueryClient()
  const [hardRefreshing, setHardRefreshing] = useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useVendors(qs)

  const docs = data?.docs || []
  const pagination = data?.pagination || null
  const stats = data?.stats || null

  const isInitialLoading = (isPending && !data) || hardRefreshing
  const loading = isFetching || hardRefreshing
  const error = isError && !data && !hardRefreshing ? (queryError instanceof Error ? queryError.message : 'Failed to load') : null

  const handleHardRefresh = () => {
    if (hardRefreshing) return
    setHardRefreshing(true)
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminVendors(qs) })
        await refetch({ cancelRefetch: true })
      } finally {
        setHardRefreshing(false)
      }
    })()
  }

  useEffect(()=>{setPage(1)},[debouncedQ,verificationFilter,businessTypeFilter])
  useEffect(()=>{
    const isOpen=!!confirm
    if(isOpen){ const prev=document.body.style.overflow; document.body.style.overflow='hidden'; return()=>{document.body.style.overflow=prev} }
    document.body.style.overflow=''; return()=>{document.body.style.overflow=''}
  },[confirm])

  const toggleVerification=(v:string)=> setVerificationFilter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])
  const toggleBusiness=(v:string)=> setBusinessTypeFilter(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v])
  const clearAll=()=>{setQ('');setDebouncedQ('');setVerificationFilter(['pending']);setBusinessTypeFilter([])}

  const doVerify = async (id:number, next:string) => {
    setActioningId(id)
    try{
      const res=await fetch(`/api/vendors/${id}`,{method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({verificationStatus:next})})
      const j=await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(j.error||'Failed to update')
      setConfirm(null)
      await refetch()
    }catch(e:any){ alert(e.message||'Update failed') } finally{ setActioningId(null) }
  }

  const showTableSkeleton = loading // professional: skeleton on any loading, not just initial

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center"><ShieldCheck className="w-4 h-4" /></span>
            Verification & Compliance
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Review business documents, approve or reject vendors, and track compliance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleHardRefresh} disabled={loading} aria-label="Refresh" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading?'animate-spin':''}`} />
          </button>
          <Link href="/vendors" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50">Back to vendors</Link>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Pending" value={String(stats.verificationBreakdown.pending||0)} sub="awaiting review" icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
          <KpiCard title="Verified" value={String(stats.verificationBreakdown.verified||0)} sub={`${Math.round(((stats.verificationBreakdown.verified||0)/Math.max(1,stats.totalAll))*100)}% verified`} icon={<ShieldCheck className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Rejected" value={String(stats.verificationBreakdown.rejected||0)} sub="needs resubmission" icon={<XCircle className="w-5 h-5 text-white" />} iconBg="bg-red-500" />
          <KpiCard title="Suspended" value={String(stats.verificationBreakdown.suspended||0)} sub="compliance hold" icon={<Ban className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
          {Array.from({length:4}).map((_,i)=><div key={i} className="h-[86px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]" />)}
        </div>
      ) : null}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search business, registration, email…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-gray-600 dark:text-[#a1a1aa]">10 / page</span>
            <button onClick={()=>setShowFilters(v=>!v)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold border transition ${activeFilterCount ? 'bg-[#eba236] hover:bg-[#c88a20] text-white border-[#eba236]' : 'bg-white dark:bg-[#171717] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626]'}`}>
              <SlidersHorizontal className="w-4 h-4" /> Filters {activeFilterCount>0 && <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-white text-[#eba236]">{activeFilterCount}</span>} <ChevronDown className={`w-4 h-4 transition ${showFilters?'rotate-180':''}`} />
            </button>
            {activeFilterCount>0 && <button onClick={clearAll} className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900">Clear</button>}
          </div>
        </div>
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-[#262626] space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Verification</p>
                <div className="flex flex-wrap gap-1.5">
                  {VERIFICATION_OPTS.map(o=>{
                    const active=verificationFilter.includes(o.value)
                    return <button key={o.value} onClick={()=>toggleVerification(o.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${active?'bg-[#eba236] text-white border-[#eba236]':'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{o.label}</button>
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Business Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {BUSINESS_OPTS.map(o=>{
                    const active=businessTypeFilter.includes(o.value)
                    return <button key={o.value} onClick={()=>toggleBusiness(o.value)} className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${active?'bg-[#eba236] text-white border-[#eba236]':'bg-white dark:bg-[#0a0a0a] text-gray-700 dark:text-[#a1a1aa] border-gray-200 dark:border-[#262626]'}`}>{o.label}</button>
                  })}
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
            <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load</h3><p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><RefreshCw className="w-4 h-4 mr-2" />Retry</button>
          </div>
        )}
        {isInitialLoading ? (
          <div className="p-4 space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
        ) : !error && docs.length===0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-4"><CheckCircle className="w-8 h-8 text-emerald-600" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No vendors in this queue</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Try another filter or clear to see all.</p>
          </div>
        ) : !error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Business</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Registration</th>
                    <th className="text-left px-4 py-3 font-medium">Docs</th>
                    <th className="text-left px-4 py-3 font-medium">Verification</th>
                    <th className="text-right px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {docs.map(v=>(
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[220px]">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0">{v.logo?.url ? <img src={v.logo.url} alt={v.businessName} className="h-9 w-9 rounded-xl object-cover" /> : initials(v.businessName)}</div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">{v.businessName}</div>
                            <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate max-w-[180px]">{v.primaryContactEmail} • {fmtDate(v.onboardingDate || v.createdAt)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell"><div className="font-mono text-xs text-gray-900 dark:text-white">{v.businessRegistrationNumber}</div><div className="text-xs text-gray-500">{v.taxIdentificationNumber||'—'}</div></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`h-7 w-7 rounded-lg border flex items-center justify-center ${v.logo?.url ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-gray-100 border-gray-200 text-gray-400 dark:bg-[#262626] dark:border-[#333]'}`} title={v.logo?.url?'Logo':'No logo'}><ImageIcon className="w-3.5 h-3.5" /></span>
                          <span className={`h-7 w-7 rounded-lg border flex items-center justify-center ${v.businessLicense?.url ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800'}`} title={v.businessLicense?.url?'License':'Missing license'}><FileText className="w-3.5 h-3.5" /></span>
                          <span className={`h-7 w-7 rounded-lg border flex items-center justify-center ${v.taxCertificate?.url ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-900/20 dark:border-amber-800'}`} title={v.taxCertificate?.url?'Tax cert':'Missing cert'}><FileText className="w-3.5 h-3.5" /></span>
                          {(v.logo?.url || v.businessLicense?.url || v.taxCertificate?.url) ? <a href={v.logo?.url || v.businessLicense?.url || v.taxCertificate?.url || '#'} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline ml-1">View</a> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${verificationBadge(v.verificationStatus)}`}>{v.verificationStatus}</span></td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1 flex-wrap justify-end">
                          <Link href={`/vendors/${v.id}`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white" title="View"><Eye className="w-4 h-4" /></Link>
                          <Link href={`/vendors/${v.id}/edit`} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 dark:text-[#a1a1aa] hover:text-blue-600" title="Edit"><Pencil className="w-4 h-4" /></Link>
                          {v.verificationStatus!=='verified' && <button disabled={actioningId===v.id} onClick={()=>setConfirm({id:v.id,businessName:v.businessName,next:'verified'})} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"><ShieldCheck className="w-3.5 h-3.5" /> Approve</button>}
                          {v.verificationStatus!=='rejected' && <button disabled={actioningId===v.id} onClick={()=>setConfirm({id:v.id,businessName:v.businessName,next:'rejected'})} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"><XCircle className="w-3.5 h-3.5" /> Reject</button>}
                          {v.verificationStatus!=='suspended' && <button disabled={actioningId===v.id} onClick={()=>setConfirm({id:v.id,businessName:v.businessName,next:'suspended'})} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-600 hover:bg-zinc-700 text-white disabled:opacity-50"><Ban className="w-3.5 h-3.5" /> Suspend</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pagination && pagination.totalDocs>0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} vendors • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || !pagination.hasPrevPage} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({length:Math.min(5,pagination.totalPages)}).map((_,i)=>{
                    const n=Math.max(1,Math.min(pagination.totalPages-4,pagination.page-2))+i; if(n>pagination.totalPages) return null
                    return <button key={n} onClick={()=>setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n===pagination.page?'bg-[#eba236] text-white border-[#eba236]':'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || !pagination.hasNextPage} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {confirm && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setConfirm(null)}>
            <div
              className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-md p-6 animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-gray-900 dark:text-white capitalize">{confirm.next} vendor?</h3>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa] mt-1">This will set <span className="font-semibold text-gray-900 dark:text-white">{confirm.businessName}</span> to <span className="font-semibold capitalize">{confirm.next}</span>.</p>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setConfirm(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] hover:bg-gray-50 dark:hover:bg-[#262626]">Cancel</button>
                <button
                  onClick={() => doVerify(confirm.id, confirm.next)}
                  disabled={actioningId === confirm.id}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 ${confirm.next === 'verified' ? 'bg-emerald-600 hover:bg-emerald-700' : confirm.next === 'rejected' ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-600 hover:bg-zinc-700'}`}
                >
                  {actioningId === confirm.id ? 'Updating…' : `Confirm ${confirm.next}`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

export default function VerificationPage(){
  return (
    <ClientOnly fallback={<VerificationSkeleton />}>
      <VerificationPageContent />
    </ClientOnly>
  )
}
