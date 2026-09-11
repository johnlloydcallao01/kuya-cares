'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import { Building, ArrowLeft, Store, Eye, Pencil, RefreshCw, AlertCircle, Search, X } from '@/components/ui/IconWrapper'

type Merchant = {
  id: number
  outletName: string
  outletCode: string
  isActive: boolean
  isAcceptingOrders: boolean
  operationalStatus: string
  totalProducts?: number
  media?: { thumbnail?: { url: string | null } | null } | null
}
type Vendor = { id: number; businessName: string; legalName: string; businessType: string; verificationStatus: string; logo?: { id: number; url: string | null } | null }

function initials(n: string){ return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'V' }

function VendorMerchantsSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function VendorMerchantsPageContent(){
  const params=useParams()
  const router=useRouter()
  const vendorId=params.vendorId as string
  const [vendor,setVendor]=useState<Vendor|null>(null)
  const [merchants,setMerchants]=useState<Merchant[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [q,setQ]=useState('')
  const [page,setPage]=useState(1)
  const limit=10

  useEffect(()=>{
    let cancelled=false
    async function load(){
      setLoading(true); setError(null)
      try{
        const [vendorRes, merchantsRes] = await Promise.all([
          fetch(`/api/vendors/${vendorId}`,{cache:'no-store'}).then(r=>r.json()),
          fetch(`/api/merchants?vendor=${vendorId}&limit=100`,{cache:'no-store'}).then(r=>r.json()),
        ])
        if(!cancelled){
          const vDoc = vendorRes.doc || vendorRes
          setVendor(vDoc.vendor ? vDoc.vendor : vDoc.doc?.businessName ? vDoc.doc : vDoc)
          // Fallback: if vendorRes is from /api/vendors/${id} it returns {doc: {businessName...}} or via BFF
          const v = vendorRes.doc || vendorRes.vendor || vendorRes
          // Try to get vendor from merchants BFF if needed
          let vendorData = v.businessName ? v : null
          if(!vendorData || !vendorData.businessName){
            // fetch via merchant-products BFF which has vendor info
            const mpRes = await fetch(`/api/merchant-products?vendor=${vendorId}&limit=1`,{cache:'no-store'}).then(r=>r.json())
            const vFromMp = mpRes.vendors?.[0]?.vendor
            if(vFromMp) vendorData = vFromMp
          }
          if(vendorData && vendorData.businessName) setVendor(vendorData as Vendor)
          else if(vDoc && vDoc.businessName) setVendor({ id: Number(vendorId), businessName: vDoc.businessName, legalName: vDoc.legalName||'', businessType: vDoc.businessType||'other', verificationStatus: vDoc.verificationStatus||'pending' })

          const docs = merchantsRes.docs || merchantsRes.merchants || merchantsRes.data || []
          const list: Merchant[] = Array.isArray(docs) ? docs.map((m:any)=>({
            id: Number(m.id), outletName: String(m.outletName||''), outletCode: String(m.outletCode||''), isActive: !!m.isActive, isAcceptingOrders: !!m.isAcceptingOrders, operationalStatus: String(m.operationalStatus||'open'), media: m.media || null
          })) : []
          setMerchants(list)
        }
      }catch(e:any){ if(!cancelled) setError(e.message||'Failed') } finally{ if(!cancelled) setLoading(false) }
    }
    void load()
    return()=>{cancelled=true}
  },[vendorId])

  const filtered = merchants.filter(m=> !q || `${m.outletName} ${m.outletCode}`.toLowerCase().includes(q.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
  const paged = filtered.slice((page-1)*limit, page*limit)

  useEffect(()=>{ setPage(1) },[q])

  const handleBack = () => {
    if(typeof window!=='undefined' && window.history.length>1) router.back()
    else router.push('/products')
  }

  if(loading){
    return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
  }
  if(error){
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load outlets</h3><p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to vendors
      </button>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center font-bold overflow-hidden shrink-0">
          {vendor?.logo?.url ? <img src={vendor.logo.url} alt={vendor.businessName} className="h-10 w-10 object-cover" /> : vendor ? initials(vendor.businessName) : 'V'}
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{vendor?.businessName || `Vendor #${vendorId}`}</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{vendor?.legalName || ''} • {merchants.length} outlet{merchants.length!==1?'s':''} • {filtered.length} filtered</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search outlet, code…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] text-gray-900 dark:text-white placeholder:text-gray-400" />
          {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {paged.length===0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-gray-100 dark:bg-[#262626] rounded-2xl flex items-center justify-center mb-4"><Store className="w-8 h-8 text-gray-400" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No outlets</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">This vendor has no outlets or none match your search.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-[#262626]">
              {paged.map(m=>(
                <Link key={m.id} href={`/products/vendors/${vendorId}/merchants/${m.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#262626] dark:hover:bg-[#0a0a0a] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                      {(m as any).media?.thumbnail?.url ? <img src={(m as any).media.thumbnail.url} alt={m.outletName} className="h-9 w-9 object-cover" /> : initials(m.outletName)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">{m.outletName}</div>
                      <div className="text-xs text-gray-500 dark:text-[#a1a1aa] font-mono truncate">{m.outletCode} • {m.operationalStatus} • {m.isActive?'Active':'Inactive'}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${m.isActive?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>{m.isActive?'Active':'Inactive'}</span>
                    <Eye className="w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
            {totalPages>1 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {page} of {totalPages} • {filtered.length} outlets</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({length:Math.min(5,totalPages)}).map((_,i)=>{
                    const n=Math.max(1,Math.min(totalPages-4,page-2))+i; if(n>totalPages) return null
                    return <button key={n} onClick={()=>setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n===page?'bg-[#eba236] text-white border-[#eba236]':'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function VendorMerchantsPage(){
  return (
    <ClientOnly fallback={<VendorMerchantsSkeleton />}>
      <VendorMerchantsPageContent />
    </ClientOnly>
  )
}
