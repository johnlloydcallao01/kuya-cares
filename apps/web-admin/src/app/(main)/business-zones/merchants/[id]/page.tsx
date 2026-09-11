'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Globe, Store, MapPin, ArrowLeft, RefreshCw, Eye, Pencil, Activity, CheckCircle, AlertCircle, Building
} from '@/components/ui/IconWrapper'
import { BusinessZoneOverviewMap, BusinessZoneDrawingMap } from '../../_components/ZoneMaps'

type MerchantDoc = {
  id: number
  outletName: string
  outletCode: string
  vendor: { id: number; businessName: string; logo?: { id: number; url: string | null } | null } | null
  businessZone: { id: number; name: string; isActive: boolean; slug?: string; boundary?: any } | null
  businessZoneId: number | null
  isActive: boolean
  isAcceptingOrders: boolean
  operationalStatus: string
  merchant_latitude: number | null
  merchant_longitude: number | null
  merchant_coordinates: any | null
  service_area: any | null
  priority_zones: any | null
  restricted_areas: any | null
  delivery_zones: any | null
  timezone: string
  delivery_radius_meters: number | null
}

type ZoneRow = {
  key: string
  name: string
  type: 'businessZone' | 'service_area' | 'priority_zones' | 'restricted_areas' | 'delivery_zones'
  boundary: any | null
  isActive: boolean
  disabledReason?: string | null
  meta?: string
}

function isValidGeoJSON(v: any): boolean {
  if (!v) return true
  if (typeof v !== 'object' || Array.isArray(v)) return false
  if (v.type !== 'Polygon' && v.type !== 'MultiPolygon') return false
  return Array.isArray(v.coordinates)
}

function MerchantZoneDetailSkeleton(){
  return <div className="py-10 px-2.5"><div className="animate-pulse space-y-3"><div className="h-24 bg-gray-100 dark:bg-[#171717] rounded-xl"/><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl"/><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl"/></div></div>
}

function MerchantZoneDetailPageContent(){
  const params = useParams() as { id: string }
  const id = params?.id
  const router = useRouter()
  const [doc,setDoc]=useState<MerchantDoc|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [viewZone,setViewZone]=useState<ZoneRow|null>(null)
  const [editZone,setEditZone]=useState<ZoneRow|null>(null)
  const [editGeo,setEditGeo]=useState<any|null>(null)
  const [saving,setSaving]=useState(false)

  const load=useCallback(async()=>{
    if(!id) return
    setLoading(true); setError(null)
    try{
      const res=await fetch(`/api/merchants/${id}`,{cache:'no-store'})
      if(!res.ok){ const t=await res.text(); throw new Error(t)}
      const j=await res.json()
      const d = j.doc || j.merchant || j
      // Normalize to MerchantDoc
      const m: MerchantDoc = {
        id: Number(d.id),
        outletName: String(d.outletName||''),
        outletCode: String(d.outletCode||''),
        vendor: d.vendor && typeof d.vendor==='object' ? { id: Number((d.vendor as any).id), businessName: String((d.vendor as any).businessName||''), logo: (d.vendor as any).logo ?? null } : null,
        businessZone: d.businessZone && typeof d.businessZone==='object' ? { id: Number((d.businessZone as any).id), name: String((d.businessZone as any).name||''), isActive: !!(d.businessZone as any).isActive, slug: (d.businessZone as any).slug, boundary: (d.businessZone as any).boundary } : (d.businessZoneId ? { id: Number(d.businessZoneId), name: String(d.businessZone||''), isActive: true } : null),
        businessZoneId: d.businessZone && typeof d.businessZone==='object' ? Number((d.businessZone as any).id) : (d.businessZoneId ? Number(d.businessZoneId) : (d.businessZone ? Number(d.businessZone) : null)),
        isActive: !!d.isActive,
        isAcceptingOrders: !!d.isAcceptingOrders,
        operationalStatus: String(d.operationalStatus||'open'),
        merchant_latitude: d.merchant_latitude ?? null,
        merchant_longitude: d.merchant_longitude ?? null,
        merchant_coordinates: d.merchant_coordinates ?? null,
        service_area: d.service_area ?? null,
        priority_zones: d.priority_zones ?? null,
        restricted_areas: d.restricted_areas ?? null,
        delivery_zones: d.delivery_zones ?? null,
        timezone: String(d.timezone||'Asia/Manila'),
        delivery_radius_meters: d.delivery_radius_meters ?? null,
      }
      // Try to enrich businessZone boundary if not populated
      if(m.businessZoneId && (!m.businessZone?.boundary)){
        try{
          const zr=await fetch(`/api/business-zones/${m.businessZoneId}`,{cache:'no-store'})
          if(zr.ok){
            const zj=await zr.json()
            const zdoc = zj.doc || zj
            m.businessZone = { id: Number(zdoc.id), name: String(zdoc.name||''), isActive: !!zdoc.isActive, slug: String(zdoc.slug||''), boundary: zdoc.boundary ?? null }
          }
        }catch{}
      }
      setDoc(m)
    }catch(e:any){ setError(e.message||'Failed to load merchant') } finally{ setLoading(false)}
  },[id])

  useEffect(()=>{ void load() },[load])

  const zoneRows: ZoneRow[] = (() => {
    if(!doc) return []
    const rows: ZoneRow[] = []
    if(doc.businessZone){
      rows.push({ key: 'businessZone', name: doc.businessZone.name || `Business Zone #${doc.businessZone.id}`, type: 'businessZone', boundary: doc.businessZone.boundary ?? null, isActive: doc.businessZone.isActive, meta: `Business Zone • ${doc.businessZone.slug||''}` })
    } else if(doc.businessZoneId){
      rows.push({ key: 'businessZone', name: `Business Zone #${doc.businessZoneId}`, type: 'businessZone', boundary: null, isActive: true, meta: 'Assigned but not populated' })
    }
    rows.push({ key: 'service_area', name: 'Service Area', type: 'service_area', boundary: doc.service_area, isActive: doc.isActive, meta: doc.delivery_radius_meters ? `${doc.delivery_radius_meters}m radius` : 'Delivery fence' })
    rows.push({ key: 'priority_zones', name: 'Priority Zones', type: 'priority_zones', boundary: doc.priority_zones, isActive: doc.isActive, meta: 'Premium areas' })
    rows.push({ key: 'restricted_areas', name: 'Restricted Areas', type: 'restricted_areas', boundary: doc.restricted_areas, isActive: true, meta: 'No-delivery zones' })
    if(doc.delivery_zones){
      rows.push({ key: 'delivery_zones', name: 'Delivery Zones (pricing)', type: 'delivery_zones', boundary: doc.delivery_zones, isActive: doc.isActive, meta: 'Zone pricing config' })
    }
    return rows
  })()

  const handleToggleZone=async(row: ZoneRow)=>{
    if(!doc) return
    try{
      if(row.type==='businessZone' && doc.businessZoneId){
        const newActive = !row.isActive
        const res=await fetch(`/api/business-zones/${doc.businessZoneId}`,{method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isActive: newActive })})
        if(!res.ok){ const j=await res.json().catch(()=>({})); throw new Error(j.error||'Failed')}
        await load()
      } else {
        // For merchant-owned zones, toggle merchant isActive / isAcceptingOrders as proxy
        const newActive = !row.isActive
        const res=await fetch(`/api/merchants/${doc.id}`,{method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ isActive: newActive })})
        if(!res.ok){ const j=await res.json().catch(()=>({})); throw new Error(j.error||'Failed')}
        await load()
      }
    }catch(e:any){ alert(e.message||'Toggle failed')}
  }

  const openEdit=(row: ZoneRow)=>{
    setEditZone(row)
    setEditGeo(row.boundary ?? null)
  }

  const saveEdit=async()=>{
    if(!doc || !editZone) return
    let boundary: any = editGeo
    if(editGeo && !isValidGeoJSON(editGeo)) return alert('Boundary must be Polygon or MultiPolygon')
    setSaving(true)
    try{
      if(editZone.type==='businessZone' && doc.businessZoneId){
        const res=await fetch(`/api/business-zones/${doc.businessZoneId}`,{method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ boundary })})
        if(!res.ok){ const j=await res.json().catch(()=>({})); throw new Error(j.error||'Failed')}
      } else {
        const patch: any = {}
        patch[editZone.type] = boundary
        const res=await fetch(`/api/merchants/${doc.id}`,{method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(patch)})
        if(!res.ok){ const j=await res.json().catch(()=>({})); throw new Error(j.error||'Failed')}
      }
      setEditZone(null); setEditGeo(null)
      await load()
    }catch(e:any){ alert(e.message||'Save failed')} finally{ setSaving(false)}
  }

  if(loading){
    return <div className="py-10 px-2.5"><div className="animate-pulse space-y-3"><div className="h-24 bg-gray-100 dark:bg-[#171717] rounded-xl"/><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl"/><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl"/></div></div>
  }
  if(error || !doc){
    return <div className="py-10 px-2.5 max-w-2xl mx-auto text-center"><div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle className="h-7 w-7 text-red-500"/></div><h3 className="font-semibold text-gray-900 dark:text-white">Failed to load merchant zone</h3><p className="text-sm text-gray-500 mt-1">{error||'Not found'}</p><button onClick={()=>void load()} className="mt-4 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm">Retry</button></div>
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="flex items-center gap-2 text-sm">
        <Link href="/business-zones/merchants" className="inline-flex items-center gap-1 text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white"><ArrowLeft className="w-4 h-4"/> Back to Merchant Zones</Link>
        <span className="text-gray-300">/</span>
        <span className="font-semibold text-gray-900 dark:text-white truncate">{doc.outletName}</span>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold overflow-hidden">{doc.vendor?.logo?.url ? <img src={doc.vendor.logo.url} alt={doc.vendor.businessName || doc.outletName} className="h-12 w-12 rounded-xl object-cover" /> : doc.outletName.slice(0,2).toUpperCase()}</div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">{doc.outletName} <span className="text-sm font-mono text-gray-500">({doc.outletCode})</span></h1>
            <p className="text-sm text-gray-500 flex items-center gap-2"><Building className="w-3 h-3"/>{doc.vendor?.businessName||'—'} • {doc.operationalStatus} • {doc.timezone}</p>
            {doc.merchant_latitude && doc.merchant_longitude && <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3 h-3"/>{Number(doc.merchant_latitude).toFixed(5)}, {Number(doc.merchant_longitude).toFixed(5)} • {doc.delivery_radius_meters||'—'}m radius</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/merchants/${doc.id}`} className="px-3 py-2 rounded-xl border bg-white dark:bg-[#171717] text-xs font-medium">View Outlet</Link>
          <Link href={`/merchants/${doc.id}/edit`} className="px-3 py-2 rounded-xl bg-[#eba236] text-white text-xs font-semibold">Edit Outlet</Link>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Globe className="w-4 h-4 text-[#eba236]"/> Zone Map — Merchant + Business Zone</h3>
        <div className="mt-3">
          <BusinessZoneOverviewMap
            zones={doc.businessZone?.boundary ? [{ id: doc.businessZone.id, name: doc.businessZone.name, isActive: doc.businessZone.isActive, boundary: doc.businessZone.boundary }] : []}
            merchantZones={[{
              id: doc.id,
              outletName: doc.outletName,
              outletCode: doc.outletCode,
              vendor: doc.vendor,
              businessZone: doc.businessZone,
              merchant_latitude: doc.merchant_latitude,
              merchant_longitude: doc.merchant_longitude,
              service_area: doc.service_area,
              priority_zones: doc.priority_zones,
              restricted_areas: doc.restricted_areas,
              delivery_zones: doc.delivery_zones,
            } as any]}
            height={360}
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-2">Green/red = Business Zone boundary • Blue = merchant service areas (fence) • Dot = outlet location. Edit a zone below to redraw on Google Maps.</p>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-[#262626] flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Zones for this merchant</h3>
          <span className="text-xs text-gray-500">{zoneRows.length} zones</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-[#0a0a0a] text-xs text-gray-500 dark:text-[#a1a1aa] border-b border-gray-200 dark:border-[#262626]">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Zone</th>
                <th className="text-left px-4 py-3 font-medium">Boundary</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
              {zoneRows.map(row=>(
                <tr key={row.key} className="hover:bg-gray-50 dark:hover:bg-[#0a0a0a]/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{row.name}</div>
                    <div className="text-xs text-gray-500 font-mono">{row.type} • {row.meta||''}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.boundary ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle className="w-3 h-3"/>{(row.boundary as any).type||'Polygon'}</span> : <span className="text-xs text-gray-400">No boundary</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border w-fit ${row.isActive?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-red-50 text-red-700 border-red-200'}`}>{row.isActive?'Active':'Disabled'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button onClick={()=>setViewZone(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] text-gray-500" title="View"><Eye className="w-4 h-4"/></button>
                      <button onClick={()=>openEdit(row)} className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-gray-500 hover:text-blue-600" title="Edit"><Pencil className="w-4 h-4"/></button>
                      <button onClick={()=>handleToggleZone(row)} className={`h-7 w-7 inline-flex items-center justify-center rounded-lg border ${row.isActive?'hover:bg-amber-50 text-amber-600 border-amber-200':'hover:bg-emerald-50 text-emerald-600 border-emerald-200'}`} title={row.isActive?'Disable':'Enable'}><Activity className="w-4 h-4"/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewZone && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={()=>setViewZone(null)}>
          <div className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-2xl max-h-[80vh] overflow-auto p-6" onClick={e=>e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><Globe className="w-5 h-5 text-[#eba236]"/> {viewZone.name}</h3>
                <p className="text-xs text-gray-500 font-mono">{viewZone.type} • {viewZone.isActive?'Active':'Disabled'}</p>
              </div>
              <button onClick={()=>setViewZone(null)} className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626] flex items-center justify-center">✕</button>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-[#262626] mb-3">
              <BusinessZoneOverviewMap zones={viewZone.type==='businessZone' && viewZone.boundary ? [{ id: 999, name: viewZone.name, isActive: viewZone.isActive, boundary: viewZone.boundary }] : []} merchantZones={viewZone.type!=='businessZone' && viewZone.boundary ? [{ id: doc.id, outletName: doc.outletName, outletCode: doc.outletCode, merchant_latitude: doc.merchant_latitude, merchant_longitude: doc.merchant_longitude, service_area: viewZone.type==='service_area'?viewZone.boundary:null, priority_zones: viewZone.type==='priority_zones'?viewZone.boundary:null, restricted_areas: viewZone.type==='restricted_areas'?viewZone.boundary:null } as any] : []} height={260} />
            </div>
            <pre className="p-3 bg-gray-50 dark:bg-[#0a0a0a] rounded-lg border overflow-auto text-xs max-h-[180px]">{viewZone.boundary ? JSON.stringify(viewZone.boundary, null, 2) : 'No boundary'}</pre>
            <div className="flex gap-2 mt-3">
              <button onClick={()=>{const r=viewZone; setViewZone(null); if(r) openEdit(r)}} className="px-3 py-2 rounded-lg bg-[#eba236] text-white text-xs font-semibold">Edit</button>
              <button onClick={()=>setViewZone(null)} className="px-3 py-2 rounded-lg border text-xs">Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {editZone && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={()=>{setEditZone(null); setEditGeo(null)}}>
          <div className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-3xl max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-[#171717] border-b border-gray-200 dark:border-[#262626] px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white">Edit {editZone.name} — Draw on Google Maps</h3>
              <button onClick={()=>{setEditZone(null); setEditGeo(null)}} className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626] flex items-center justify-center">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <BusinessZoneDrawingMap value={editGeo} onChange={setEditGeo} height={380} />
              <div className="flex gap-2">
                <button onClick={()=>{setEditZone(null); setEditGeo(null)}} className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium">Cancel</button>
                <button onClick={saveEdit} disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl bg-[#eba236] text-white text-sm font-semibold disabled:opacity-50">{saving?'Saving…':'Save Zone'}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function MerchantZoneDetailPage(){
  // Pure CSR: Google Maps overview + drawing map are client-only,
  // portals need document.body → identical skeleton on server + hydration.
  return (
    <ClientOnly fallback={<MerchantZoneDetailSkeleton />}>
      <MerchantZoneDetailPageContent />
    </ClientOnly>
  )
}
