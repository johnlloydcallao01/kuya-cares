'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { useBusinessZones, useBusinessZoneOverview, type MerchantZoneDoc, type BusinessZoneDoc } from '@/hooks/useBusinessZones'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Globe, MapPin, Store, Search, X, RefreshCw, Eye, Pencil, CheckCircle
} from '@/components/ui/IconWrapper'
import { BusinessZoneOverviewMap } from '../_components/ZoneMaps'
import { initials } from '../_components/types'

function MerchantZonesSkeleton(){
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="h-[420px] bg-gray-100 dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] animate-pulse" />
      <div className="p-4 space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
    </div>
  )
}

function MerchantZonesPageContent(){
  const [zoneFilter,setZoneFilter]=useState<string>('all')
  const [merchantSearch,setMerchantSearch]=useState('')

  const zonesQuery=useBusinessZones('limit=100')
  const zones=zonesQuery.data?.docs||[]

  const overviewQs=useMemo(()=>{
    if(zoneFilter!=='all' && zoneFilter!=='unassigned') return `zoneId=${zoneFilter}`
    return ''
  },[zoneFilter])

  const queryClient=useQueryClient()
  const [hardRefreshing,setHardRefreshing]=useState(false)
  const overview=useBusinessZoneOverview(overviewQs)

  const stats=overview.data?.stats||null
  const allMerchantZones=overview.data?.merchantZones||[]

  const isInitialLoading=hardRefreshing || (overview.isPending && !overview.data)
  const overviewLoading=overview.isFetching||hardRefreshing
  const error=overview.isError&&!overview.data&&!hardRefreshing?(overview.error instanceof Error?overview.error.message:'Failed to load merchant zones'):null

  // client-side filter for unassigned (overview returns all; zoneId filter handled server-side)
  const filteredMerchantZones=useMemo(()=>{
    let list = zoneFilter==='unassigned' ? allMerchantZones.filter(m=>!m.businessZoneId) : allMerchantZones
    if(merchantSearch.trim()){
      const s=merchantSearch.toLowerCase()
      list=list.filter(m=> m.outletName.toLowerCase().includes(s) || m.outletCode.toLowerCase().includes(s) || (m.vendor?.businessName.toLowerCase().includes(s)) )
    }
    return list
  },[allMerchantZones,merchantSearch,zoneFilter])

  const handleHardRefresh=()=>{
    if(hardRefreshing) return
    setHardRefreshing(true)
    void (async()=>{
      try{
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminBusinessZoneOverview(overviewQs) })
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminBusinessZones('limit=100') })
        await overview.refetch({ cancelRefetch: true })
        await zonesQuery.refetch({ cancelRefetch: true })
      }finally{ setHardRefreshing(false) }
    })()
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-blue-500 text-white flex items-center justify-center"><Store className="w-4 h-4" /></span>
            Merchant Zones
            <span className="text-sm font-normal text-gray-500 dark:text-[#a1a1aa] hidden sm:inline">Per-outlet delivery fences</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Each outlet&apos;s <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#262626] rounded text-xs">service_area</code> + <code className="px-1 py-0.5 bg-gray-100 dark:bg-[#262626] rounded text-xs">delivery_radius</code> inside its Business Zone. Blue polygons = merchant fences, green/red = Business Zone.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleHardRefresh} disabled={overviewLoading} aria-label="Refresh merchant zones" className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${overviewLoading?'animate-spin':''}`} />
          </button>
          <Link href="/merchants" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-semibold hover:bg-gray-50">Manage Outlets</Link>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
            <p className="text-xs text-gray-500">Total Merchant Zones</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalMerchants}</p>
            <p className="text-xs text-gray-500 mt-1">{filteredMerchantZones.length} filtered</p>
          </div>
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
            <p className="text-xs text-gray-500">Assigned / Unassigned</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stats.assignedMerchants} / {stats.unassignedMerchants}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.totalMerchants? Math.round((stats.assignedMerchants/stats.totalMerchants)*100):0}% coverage</p>
          </div>
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
            <p className="text-xs text-gray-500">Business Zones</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalZones}</p>
            <p className="text-xs text-gray-500 mt-1">{stats.activeZones} active</p>
          </div>
          <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
            <p className="text-xs text-gray-500">With Service Area</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{allMerchantZones.filter(m=>m.service_area).length}</p>
            <p className="text-xs text-gray-500 mt-1">{allMerchantZones.filter(m=>!m.service_area).length} need fence</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500" /> Merchant Zones Map — Real Google Maps</h3>
          <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">{filteredMerchantZones.length} outlets • blue = fence • <span className="h-2 w-2 rounded-full bg-blue-500 inline-block"/> merchant point</span>
        </div>
        <BusinessZoneOverviewMap zones={zoneFilter==='all' ? zones : zones.filter(z=> String(z.id)===zoneFilter)} merchantZones={filteredMerchantZones} height={420} />
        <p className="text-[11px] text-gray-500 mt-2">Blue polygons = per-merchant <code>service_area</code> (delivery fence). Green/red polygons = Business Zones. Gold/blue dots = merchant locations. Filter by Business Zone to inspect assignment.</p>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={merchantSearch} onChange={e=>setMerchantSearch(e.target.value)} placeholder="Search outlet, code, vendor…" className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 dark:text-white placeholder:text-gray-400" />
            {merchantSearch && <button onClick={()=>setMerchantSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626]"><X className="w-4 h-4 text-gray-400" /></button>}
          </div>
          <select value={zoneFilter} onChange={e=>setZoneFilter(e.target.value)} className="px-3 py-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] text-gray-700 dark:text-white min-w-[200px]">
            <option value="all">All Business Zones</option>
            {zones.map(z=> <option key={z.id} value={String(z.id)}>{z.name} ({(stats?.merchantCountByZone?.[String(z.id)] ?? z.merchantCount ?? 0)} )</option>)}
            <option value="unassigned">Unassigned only</option>
          </select>
          <button onClick={handleHardRefresh} disabled={overviewLoading} className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${overviewLoading?'animate-spin':''}`} />
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={handleHardRefresh} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button>
          </div>
        )}
        {isInitialLoading ? (
          <div className="p-4 space-y-3 animate-pulse">{Array.from({length:6}).map((_,i)=><div key={i} className="h-16 bg-gray-100 dark:bg-[#0a0a0a] rounded-lg" />)}</div>
        ) : filteredMerchantZones.length===0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="h-16 w-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4"><Store className="w-8 h-8 text-blue-500"/></div>
            <h3 className="font-semibold text-gray-900 dark:text-white">No merchant zones</h3>
            <p className="text-sm text-gray-500 mt-1">No outlets match the filter. Assign a Business Zone to each merchant and define its service_area polygon in the outlet form.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Outlet (Merchant Zone)</th>
                  <th className="text-left px-4 py-3 font-medium">Business Zone</th>
                  <th className="text-left px-4 py-3 font-medium">Service Area</th>
                  <th className="text-left px-4 py-3 font-medium">Delivery</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                {filteredMerchantZones.slice(0,200).map(m=>(
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">{m.vendor?.logo?.url ? <img src={m.vendor.logo.url} alt={m.vendor.businessName || m.outletName} className="h-9 w-9 rounded-xl object-cover" /> : initials(m.vendor?.businessName || m.outletName)}</div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate max-w-[180px]">{m.outletName}</div>
                          <div className="text-xs text-gray-500 font-mono">{m.outletCode} • {m.vendor?.businessName||'—'}</div>
                          {m.merchant_latitude && m.merchant_longitude && <div className="text-[11px] text-gray-400 flex items-center gap-1"><MapPin className="w-3 h-3"/>{Number(m.merchant_latitude).toFixed(4)}, {Number(m.merchant_longitude).toFixed(4)}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {m.businessZone ? <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${m.businessZone.isActive?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-red-50 text-red-700 border-red-200'}`}>{m.businessZone.name}</span> : <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      {m.service_area ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200"><CheckCircle className="w-3 h-3"/> {(m.service_area as any).type || 'Polygon'}</span> : <span className="text-xs text-gray-400">No service_area</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-700 dark:text-[#a1a1aa]">{m.delivery_radius_meters? `${m.delivery_radius_meters}m radius` : '—'}</div>
                      <div className="text-[11px] text-gray-500">{m.timezone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${m.isActive?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>{m.isActive?'Active':'Inactive'}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/business-zones/merchants/${m.id}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] hover:bg-gray-50 text-xs text-gray-700 dark:text-[#a1a1aa]"><Eye className="w-3 h-3"/> View zones</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MerchantZonesPage(){
  // Pure CSR: Google Maps is client-only → server + hydration emit identical skeleton.
  return (
    <ClientOnly fallback={<MerchantZonesSkeleton />}>
      <MerchantZonesPageContent />
    </ClientOnly>
  )
}
