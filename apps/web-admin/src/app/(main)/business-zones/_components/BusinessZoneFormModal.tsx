'use client'

import React, { useEffect, useState } from 'react'
import { X } from '@/components/ui/IconWrapper'
import { BusinessZoneDrawingMap } from './ZoneMaps'
import type { BusinessZoneDoc } from './types'
import { isValidGeoJSON } from './types'

export function BusinessZoneFormModal({ mode, initial, onClose, onSuccess }: { mode:'create'|'edit'; initial: BusinessZoneDoc|null; onClose:()=>void; onSuccess:()=>void }){
  const isEdit = mode==='edit' && !!initial
  const [name,setName]=useState(initial?.name||'')
  const [slug,setSlug]=useState(initial?.slug||'')
  const [description,setDescription]=useState(initial?.description||'')
  const [boundaryGeo,setBoundaryGeo]=useState<any | null>(initial?.boundary ?? null)
  const [boundaryText,setBoundaryText]=useState(initial?.boundary ? JSON.stringify(initial.boundary, null, 2) : '')
  const [showRaw,setShowRaw]=useState(false)
  const [isActive,setIsActive]=useState(initial?.isActive ?? true)
  const [disabledReason,setDisabledReason]=useState(initial?.disabledReason||'')
  const [displayOrder,setDisplayOrder]=useState(String(initial?.displayOrder ?? 0))
  const [timezone,setTimezone]=useState(initial?.timezone||'Asia/Manila')
  const [submitting,setSubmitting]=useState(false)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{
    if(!isEdit && name && !slug){
      const s=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')
      setSlug(s)
    }
  },[name, slug, isEdit])

  useEffect(()=>{
    if(boundaryGeo){
      setBoundaryText(JSON.stringify(boundaryGeo, null, 2))
    } else {
      setBoundaryText('')
    }
  },[boundaryGeo])

  const handleMapChange=(geo: any | null)=>{ setBoundaryGeo(geo) }
  const handleRawChange=(v: string)=>{
    setBoundaryText(v)
    if(!v.trim()){ setBoundaryGeo(null); return}
    try{
      const parsed=JSON.parse(v)
      if(isValidGeoJSON(parsed)) setBoundaryGeo(parsed)
    }catch{}
  }

  const handleSubmit=async(e: React.FormEvent)=>{
    e.preventDefault()
    setError(null)
    if(!name.trim() || name.trim().length<2) return setError('Name required (min 2 chars)')
    if(!slug.trim()) return setError('Slug required')
    let boundary:any = boundaryGeo
    if(!boundary && boundaryText.trim()){
      try{ boundary = JSON.parse(boundaryText) } catch{ return setError('Boundary must be valid GeoJSON JSON')}
    }
    if(boundary && !isValidGeoJSON(boundary)) return setError('Boundary must be Polygon or MultiPolygon with coordinates array')
    try{ Intl.DateTimeFormat(undefined, { timeZone: timezone }) } catch{ return setError('Timezone must be valid IANA (e.g. Asia/Manila)') }
    setSubmitting(true)
    try{
      const payload:any = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description.trim() || null,
        boundary,
        isActive,
        disabledReason: disabledReason.trim() || null,
        displayOrder: Number(displayOrder)||0,
        timezone: timezone.trim()||'Asia/Manila',
      }
      const url = isEdit ? `/api/business-zones/${initial!.id}` : '/api/business-zones'
      const method = isEdit ? 'PATCH' : 'POST'
      const res=await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)})
      const j=await res.json().catch(()=>({}))
      if(!res.ok) throw new Error(j.error||'Failed to save')
      onSuccess()
    }catch(e:any){ setError(e.message||'Failed')} finally{ setSubmitting(false)}
  }

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-white dark:bg-[#171717] rounded-2xl shadow-2xl border border-gray-200 dark:border-[#262626] w-full max-w-3xl max-h-[90vh] overflow-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#171717] border-b border-gray-200 dark:border-[#262626] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-900 dark:text-white">{isEdit ? 'Edit Business Zone' : 'New Business Zone'} — Draw on Google Maps</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#262626] flex items-center justify-center"><X className="w-4 h-4"/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-sm text-red-700 dark:text-red-300">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Name *</label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Metro Manila" className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Slug *</label>
              <input value={slug} onChange={e=>setSlug(e.target.value)} placeholder="metro-manila" className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-sm font-mono" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Description</label>
            <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={2} placeholder="Coverage notes…" className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Draw Boundary on Google Maps *</label>
            <div className="mt-2">
              <BusinessZoneDrawingMap value={boundaryGeo} onChange={handleMapChange} height={380} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={()=>setShowRaw(v=>!v)} className="text-xs font-medium text-[#eba236] hover:underline">{showRaw?'Hide':'Show'} raw GeoJSON</button>
              {boundaryGeo && <span className="text-xs text-gray-500">{(boundaryGeo as any).type} • {(boundaryGeo as any).coordinates?.[0]?.length || 0} points</span>}
            </div>
            {showRaw && (
              <textarea value={boundaryText} onChange={e=>handleRawChange(e.target.value)} rows={5} placeholder='{"type":"Polygon","coordinates":[[[121.0,14.5],...]]}' className="mt-2 w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-xs font-mono" />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Display Order</label>
              <input type="number" value={displayOrder} onChange={e=>setDisplayOrder(e.target.value)} className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-sm" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Timezone</label>
              <input value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder="Asia/Manila" className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-sm font-mono" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Active (kill-switch)</label>
              <label className="inline-flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} className="h-4 w-4 rounded" />
                <span className="text-sm">{isActive?'Active':'Disabled'}</span>
              </label>
            </div>
          </div>
          {!isActive && (
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa]">Disabled Reason</label>
              <input value={disabledReason} onChange={e=>setDisabledReason(e.target.value)} placeholder="Typhoon, rider shortage…" className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-[#0a0a0a] border-gray-200 dark:border-[#262626] text-sm" />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#262626] text-sm font-medium bg-white dark:bg-[#171717] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl bg-[#eba236] hover:bg-[#c88a20] text-white text-sm font-semibold disabled:opacity-50">{submitting ? 'Saving…' : isEdit ? 'Update Zone' : 'Create Zone'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
