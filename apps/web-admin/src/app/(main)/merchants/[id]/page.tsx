'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, notFound } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Store, ArrowLeft, Pencil, Building, MapPin, Phone, Mail, Clock, Tag, Image as ImageIcon, AlertCircle, CalendarDays
} from '@/components/ui/IconWrapper'

type MerchantDoc = {
  id: number
  outletName: string
  outletCode: string
  vendor: { id: number; businessName: string; verificationStatus: string } | null
  contactInfo: any
  isActive: boolean
  isAcceptingOrders: boolean
  operationalStatus: string
  timezone: string
  description: string | null
  merchant_categories: { id: number; name: string }[]
  activeAddress: { id: number; formatted_address: string } | null
  media: { thumbnail: { id: number; url: string | null } | null; storeFrontImage: any }
  createdAt: string
  updatedAt: string
  merchant_latitude: number | null
  merchant_longitude: number | null
  delivery_radius_meters: number | null
  is_currently_delivering: boolean | null
}

function operationalBadge(s: string){
  const v=s.toLowerCase()
  if(v==='open') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300'
  if(v==='busy') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20'
  if(v==='closed') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}
function fmtDate(iso: string | null){ if(!iso) return '—'; try{return new Date(iso).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'})}catch{return String(iso).slice(0,10)} }
function initials(n: string){ return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'M' }

function Section({ title, children }: { title: string; children: React.ReactNode }){
  return <div><h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4><div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div></div>
}
function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }){
  return <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono?'font-mono text-xs':'text-sm'}`}>{value as any}</span></div>
}

function MerchantViewSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function MerchantViewContent(){
  const params=useParams()
  const router=useRouter()
  const id=params.id as string
  // Deleted pages must 404 — not "Failed to load outlet" puta
  if (['operating-hours','order-status','locations'].includes(id) || !/^\d+$/.test(id)) {
    notFound()
  }
  const [doc,setDoc]=useState<MerchantDoc|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{
    let cancelled=false
    async function load(){
      setLoading(true); setError(null)
      try{
        const res=await fetch(`/api/merchants/${id}`,{cache:'no-store'})
        const j=await res.json()
        if(!res.ok) throw new Error(j.error||'Failed to load merchant')
        if(!cancelled) setDoc(j.doc)
      }catch(e:any){ if(!cancelled) setError(e.message||'Failed') } finally{ if(!cancelled) setLoading(false) }
    }
    void load()
    return()=>{cancelled=true}
  },[id])

  if(loading){
    return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
  }
  if(error||!doc){
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/merchants'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load outlet</h3><p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/merchants" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/merchants'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center font-bold text-lg shrink-0">
            {doc.media?.thumbnail?.url ? <img src={doc.media.thumbnail.url} alt={doc.outletName} className="h-12 w-12 rounded-xl object-cover" /> : initials(doc.outletName)}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{doc.outletName}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] font-mono">{doc.outletCode} • {doc.vendor?.businessName || '—'} • {doc.timezone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/merchants/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/merchants" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Operational</p><p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${operationalBadge(doc.operationalStatus)}`}>{doc.operationalStatus.replace(/_/g,' ')}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Active</p><p className={`mt-2 font-semibold text-sm ${doc.isActive?'text-emerald-600':'text-zinc-500'}`}>{doc.isActive?'Active':'Inactive'}</p><p className="text-xs text-gray-500 mt-1">{doc.isAcceptingOrders?'Accepting orders':'Paused'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Vendor</p><p className="mt-2 font-bold text-gray-900 dark:text-white truncate">{doc.vendor?.businessName || '—'}</p><p className="text-xs text-gray-500">{doc.vendor?.verificationStatus || '—'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Categories</p><p className="mt-2 font-bold text-gray-900 dark:text-white">{doc.merchant_categories?.length || 0}</p><p className="text-xs text-gray-500">assigned</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Outlet Identity">
            <Row label="Outlet name" value={doc.outletName} />
            <Row label="Outlet code" value={doc.outletCode} mono />
            <Row label="Vendor" value={doc.vendor?.businessName ? `${doc.vendor.businessName} (#${doc.vendor.id})` : '—'} />
            <Row label="Timezone" value={doc.timezone} mono />
            <Row label="Description" value={doc.description || '—'} />
          </Section>
          <Section title="Contact">
            <Row label="Outlet email" value={doc.contactInfo?.email || '—'} icon={<Mail className="w-3 h-3" />} />
            <Row label="Outlet phone" value={doc.contactInfo?.phone || '—'} icon={<Phone className="w-3 h-3" />} />
            <Row label="Manager" value={doc.contactInfo?.managerName ? `${doc.contactInfo.managerName} ${doc.contactInfo.managerPhone ? `• ${doc.contactInfo.managerPhone}` : ''}` : '—'} />
          </Section>
          <Section title="Location">
            <Row label="Active address" value={doc.activeAddress?.formatted_address || '—'} icon={<MapPin className="w-3 h-3" />} />
            <Row label="Coordinates" value={doc.merchant_latitude && doc.merchant_longitude ? `${doc.merchant_latitude}, ${doc.merchant_longitude}` : '—'} mono />
            <Row label="Delivery radius" value={doc.delivery_radius_meters ? `${doc.delivery_radius_meters} m` : '—'} />
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Categories">
            <div className="p-4">
              {doc.merchant_categories?.length ? (
                <div className="flex flex-wrap gap-2">
                  {doc.merchant_categories.map((c:any)=><span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]"><Tag className="w-3 h-3" />{c.name}</span>)}
                </div>
              ) : <p className="text-sm text-gray-500 text-center">No categories assigned.</p>}
            </div>
          </Section>
          {doc.media?.thumbnail?.url && (
            <Section title="Media">
              <div className="p-4 flex items-center gap-3">
                <img src={doc.media.thumbnail.url} alt={doc.outletName} className="h-16 w-16 rounded-xl object-cover border border-gray-200 dark:border-[#262626]" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Thumbnail</p>
                  <a href={doc.media.thumbnail.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Open original</a>
                </div>
              </div>
            </Section>
          )}
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#eba236]" /> Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Updated</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-xs text-gray-900 dark:text-white">#{doc.id}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MerchantViewPage(){
  return (
    <ClientOnly fallback={<MerchantViewSkeleton />}>
      <MerchantViewContent />
    </ClientOnly>
  )
}
