'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useMerchantProducts } from '@/hooks/useMerchantProducts'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Package, Search, X, SlidersHorizontal, ChevronDown, Plus, RefreshCw, AlertCircle,
  Building, Store, ChevronRight, Layers, Tag, Eye
} from '@/components/ui/IconWrapper'

function initials(n: string){ return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'V' }

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

function ProductsSkeleton(){
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

function ProductsPageContent(){
  const router=useRouter()
  const searchParams=useSearchParams()
  const requestedView=searchParams.get('view')
  const view=requestedView==='vendor'?'vendor':requestedView==='all'?'all':'merchant'
  const vendorId=searchParams.get('vendor')
  const [q,setQ]=useState('')
  const [debouncedQ,setDebouncedQ]=useState('')
  const [showFilters,setShowFilters]=useState(false)
  const [page,setPage]=useState(1)
  const limit=10

  useEffect(()=>{ const t=setTimeout(()=>setDebouncedQ(q.trim().toLowerCase()),400); return()=>clearTimeout(t)},[q])
  const activeFilterCount=useMemo(()=> debouncedQ?1:0,[debouncedQ])

  const qs=useMemo(()=>{
    const p=new URLSearchParams()
    p.set('page',String(page)); p.set('limit',String(limit))
    p.set('view',view)
    if(view==='vendor'&&vendorId) p.set('vendor',vendorId)
    if(debouncedQ) p.set('search',debouncedQ)
    return p.toString()
  },[page,limit,debouncedQ,view,vendorId])

  const queryClient=useQueryClient()
  const [hardRefreshing,setHardRefreshing]=useState(false)
  const { data, isPending, isFetching, isError, error: queryError, refetch } = useMerchantProducts(qs)

  const vendors=data?.vendors||[]
  const products=data?.docs||[]
  const pagination=data?.pagination||null
  const stats=data?.stats||null
  const allViewStats=data?.allViewStats||null
  const selectedVendor=data?.selectedVendor||null

  const isInitialLoading=(isPending&&!data)||hardRefreshing
  const loading=isFetching||hardRefreshing
  const error=isError&&!data&&!hardRefreshing?(queryError instanceof Error?queryError.message:'Failed to load merchant products'):null

  const handleHardRefresh=()=>{
    if(hardRefreshing) return
    setHardRefreshing(true)
    void (async()=>{
      try{
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminMerchantProducts(qs) })
        await refetch({ cancelRefetch: true })
      }finally{ setHardRefreshing(false) }
    })()
  }

  const isInitial=isInitialLoading
  const switchView=(nextView:'merchant'|'vendor'|'all',nextVendorId?:number)=>{
    const nextParams=new URLSearchParams(searchParams.toString())
    nextParams.set('view',nextView)
    if(nextView==='vendor'&&nextVendorId) nextParams.set('vendor',String(nextVendorId))
    else nextParams.delete('vendor')
    nextParams.delete('page')
    router.push(`/products?${nextParams.toString()}`,{scroll:false})
    setPage(1)
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Package className="w-4 h-4" /></span>
            Products
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">{view==='merchant'?'Browse products through their vendor and merchant outlet.':view==='vendor'?vendorId?`Products across all merchant outlets owned by ${selectedVendor?.businessName||'this vendor'}.`:'Select a vendor to view products across all its outlets.':'Browse product assignments across all merchant outlets.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 dark:border-[#262626] dark:bg-[#171717]" role="group" aria-label="Product browsing view">
            <button type="button" onClick={()=>switchView('merchant')} aria-pressed={view==='merchant'} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${view==='merchant'?'bg-[#239459] text-white':'text-gray-600 hover:bg-gray-100 dark:text-[#a1a1aa] dark:hover:bg-[#262626]'}`}>Merchant-scoped</button>
            <button type="button" onClick={()=>switchView('vendor')} aria-pressed={view==='vendor'} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${view==='vendor'?'bg-[#239459] text-white':'text-gray-600 hover:bg-gray-100 dark:text-[#a1a1aa] dark:hover:bg-[#262626]'}`}>Vendor-scoped</button>
            <button type="button" onClick={()=>switchView('all')} aria-pressed={view==='all'} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${view==='all'?'bg-[#239459] text-white':'text-gray-600 hover:bg-gray-100 dark:text-[#a1a1aa] dark:hover:bg-[#262626]'}`}>All merchants</button>
          </div>
          {view==='vendor'&&vendorId&&<button type="button" onClick={()=>switchView('vendor')} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]">All vendors</button>}
          <button onClick={handleHardRefresh} disabled={loading} aria-label="Refresh" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${loading?'animate-spin':''}`} />
          </button>
          <Link href="/products/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Plus className="w-4 h-4" /> New Merchant Product
          </Link>
        </div>
      </div>

      {(view==='merchant'||view==='vendor'&&!vendorId)&&stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title="Vendors" value={String(stats.totalVendors)} sub={`${stats.filteredVendors} filtered`} icon={<Building className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
          <KpiCard title="Outlets" value={String(stats.totalMerchants)} sub={`${stats.activeMerchants} active`} icon={<Store className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Merchant Products" value={String(stats.totalMerchantProducts)} sub={`${vendors.reduce((s,v)=>s+v.totalProductsFiltered,0)} filtered`} icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-blue-500" />
          <KpiCard title="Avg per Vendor" value={String(stats.totalVendors? Math.round(stats.totalMerchantProducts / stats.totalVendors):0)} sub="products / vendor" icon={<Tag className="w-5 h-5 text-white" />} iconBg="bg-zinc-600" />
        </div>
      ) : (view==='all'||view==='vendor'&&vendorId)&&allViewStats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard title={view==='vendor'?'Vendor products':'Merchant assignments'} value={String(allViewStats.totalAssignments)} sub={view==='vendor'?'Across this vendor’s outlets':'Across all merchant outlets'} icon={<Layers className="w-5 h-5 text-white" />} iconBg="bg-blue-500" />
          <KpiCard title="Active assignments" value={String(allViewStats.activeAssignments)} sub="Active and available" icon={<Store className="w-5 h-5 text-white" />} iconBg="bg-emerald-500" />
          <KpiCard title="Filtered results" value={String(allViewStats.filteredAssignments)} sub="Matching current search" icon={<Search className="w-5 h-5 text-white" />} iconBg="bg-[#239459]" />
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
            <input value={q} onChange={(e)=>{setQ(e.target.value); setPage(1)}} placeholder={view==='merchant'||view==='vendor'&&!vendorId?'Search vendor, legal name…':'Search product, SKU, merchant, vendor…'} className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#239459]/20 focus:border-[#239459] text-gray-900 dark:text-white placeholder:text-gray-400" />
            {q && <button onClick={()=>setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] text-gray-600 dark:text-[#a1a1aa]">10 {view==='merchant'||view==='vendor'&&!vendorId?'vendors':'merchant products'} / page</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{view==='merchant'||view==='vendor'&&!vendorId?'Failed to load vendors':'Failed to load merchant products'}</h3><p className="text-sm text-gray-500 mt-1 mb-4">{error}</p>
            <button onClick={handleHardRefresh} className="inline-flex items-center px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><RefreshCw className="w-4 h-4 mr-2" />Retry</button>
          </div>
        )}
        {isInitialLoading ? (
          <div className="p-4 space-y-3 animate-pulse">
            {Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}
          </div>
        ) : !error && ((view==='merchant'||view==='vendor'&&!vendorId)?vendors.length===0:products.length===0) ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-[#239459]/10 dark:bg-[#239459]/15 rounded-2xl flex items-center justify-center mb-4">{view==='merchant'||view==='vendor'&&!vendorId?<Building className="w-8 h-8 text-[#239459]" />:<Package className="w-8 h-8 text-[#239459]" />}</div>
            <h3 className="font-semibold text-gray-900 dark:text-white">{view==='merchant'||view==='vendor'&&!vendorId?'No vendors found':'No merchant products found'}</h3>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md">{view==='merchant'||view==='vendor'&&!vendorId?'No vendors match your search. Try adjusting filters.':'No merchant product assignments match your search.'}</p>
          </div>
        ) : !error && (
          <>
            {(view==='merchant'||view==='vendor'&&!vendorId)?<div className="divide-y divide-gray-100 dark:divide-[#262626]">
              {vendors.map(v=>(
                <Link key={v.vendor.id} href={view==='vendor'?`/products?view=vendor&vendor=${v.vendor.id}`:`/products/vendors/${v.vendor.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#262626] dark:hover:bg-[#0a0a0a] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-white flex items-center justify-center font-bold shrink-0 overflow-hidden">
                      {v.vendor.logo?.url ? <img src={v.vendor.logo.url} alt={v.vendor.businessName} className="h-10 w-10 object-cover" /> : initials(v.vendor.businessName)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white truncate">{v.vendor.businessName}</div>
                      <div className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{v.vendor.legalName} • {v.vendor.businessType} • {v.vendor.verificationStatus}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{v.totalMerchants} outlet{v.totalMerchants!==1?'s':''} • {v.totalProducts} product{v.totalProducts!==1?'s':''} total • {v.totalProductsFiltered} filtered</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]"><Store className="w-3 h-3" />{v.totalMerchants}</span>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#239459]/10 text-[#8a5f17] dark:text-[#239459] border border-[#239459]/20">{v.totalProducts} products</span>
                    <Eye className="w-4 h-4 text-gray-400" />
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>:<div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#a1a1aa]"><tr><th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">Vendor</th><th className="px-4 py-3 font-medium">Merchant outlet</th><th className="px-4 py-3 text-right font-medium">Price</th><th className="px-4 py-3 text-right font-medium">Stock</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 text-right font-medium">Action</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                  {products.map((row)=>(
                    <tr key={row.merchantProductId} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                      <td className="px-4 py-3"><div className="flex items-center gap-3">{row.product?.primaryImage?.url?<img src={row.product.primaryImage.url} alt="" className="h-10 w-10 rounded-lg object-cover"/>:<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-[#262626]"><Package className="h-5 w-5"/></div>}<div><p className="font-semibold text-gray-900 dark:text-white">{row.product?.name||'Product unavailable'}</p><p className="text-xs text-gray-500">{row.product?.sku||`Product #${row.product?.id??'—'}`} · {row.product?.productType||'—'}</p></div></div></td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.vendor?.businessName||'Vendor unavailable'}</td>
                      <td className="px-4 py-3"><p className="font-medium text-gray-900 dark:text-white">{row.merchant?.outletName||'Merchant unavailable'}</p><p className="text-xs text-gray-500">{row.merchant?.outletCode||'—'}</p></td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{(row.priceOverride??row.product?.basePrice)==null?'—':`₱${(row.priceOverride??row.product?.basePrice??0).toLocaleString('en-PH',{minimumFractionDigits:2})}`}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{row.stockQuantity??'—'}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.isActive&&row.isAvailable?'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300':'bg-gray-100 text-gray-600 dark:bg-[#262626] dark:text-[#a1a1aa]'}`}>{row.isActive&&row.isAvailable?'Active':'Inactive'}</span><p className="mt-1 text-xs text-gray-500">Catalog: {row.product?.approvalStatus||'—'}</p></td>
                      <td className="px-4 py-3 text-right">{row.vendor&&row.merchant?<Link href={`/products/vendors/${row.vendor.id}/merchants/${row.merchant.id}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#239459] hover:text-[#239459] dark:border-[#333] dark:text-gray-200">View outlet<ChevronRight className="h-3 w-3"/></Link>:<span className="text-xs text-gray-400">Unavailable</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
            {pagination && pagination.totalDocs>0 && !loading && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-[#262626] flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
                <div className="text-gray-600 dark:text-[#a1a1aa]">Page {pagination.page} of {pagination.totalPages} • {pagination.totalDocs} {view==='merchant'||view==='vendor'&&!vendorId?'vendors':'merchant products'} • 10 per page</div>
                <div className="flex items-center gap-1">
                  <button disabled={loading || !pagination.hasPrevPage} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Prev</button>
                  {Array.from({length:Math.min(5,pagination.totalPages)}).map((_,i)=>{
                    const n=Math.max(1,Math.min(pagination.totalPages-4,page-2))+i; if(n>pagination.totalPages) return null
                    return <button key={n} onClick={()=>setPage(n)} className={`h-8 w-8 rounded-lg text-sm font-medium border ${n===page?'bg-[#239459] text-white border-[#239459]':'bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white'}`}>{n}</button>
                  })}
                  <button disabled={loading || !pagination.hasNextPage} onClick={()=>setPage(p=>Math.min(pagination.totalPages,p+1))} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] disabled:opacity-50 text-sm">Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function ProductsPage(){
  return (
    <ClientOnly fallback={<ProductsSkeleton />}>
      <ProductsPageContent />
    </ClientOnly>
  )
}
