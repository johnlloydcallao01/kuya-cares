'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import { Tag, ArrowLeft, Pencil, Hash, Star, Building, CalendarDays, AlertCircle, Image as ImageIcon } from '@/components/ui/IconWrapper'

type Doc = {
  id: number
  name: string
  slug: string
  description: string | null
  displayOrder: number
  isActive: boolean
  isFeatured: boolean
  icon: { id: number; url: string | null } | null
  merchantCount: number
  createdAt: string
  updatedAt: string
}
function fmtDate(iso: string | null){ if(!iso) return '—'; try{return new Date(iso).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'})}catch{return String(iso).slice(0,10)} }
function initials(n: string){ return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'C' }

function Section({ title, children }: { title: string; children: React.ReactNode }){
  return <div><h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4><div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div></div>
}
function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }){
  return <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono?'font-mono text-xs':'text-sm'}`}>{value as any}</span></div>
}

function MerchantCategoryViewSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function MerchantCategoryViewContent(){
  const params=useParams()
  const router=useRouter()
  const id=params.id as string
  const [doc,setDoc]=useState<Doc|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{
    let cancelled=false
    async function load(){
      setLoading(true); setError(null)
      try{
        const res=await fetch(`/api/merchant-categories/${id}`,{cache:'no-store'})
        const j=await res.json()
        if(!res.ok) throw new Error(j.error||'Failed to load category')
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
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/merchant-categories'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load category</h3><p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/merchant-categories" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/merchant-categories'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
            {doc.icon?.url ? <img src={doc.icon.url} alt={doc.name} className="h-12 w-12 object-cover" /> : initials(doc.name)}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">{doc.name} {doc.isFeatured && <Star className="w-5 h-5 text-amber-500" />}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] font-mono">/{doc.slug} • Order #{doc.displayOrder}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/merchant-categories/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/merchant-categories" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Status</p><p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${doc.isActive?'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20':'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800'}`}>{doc.isActive?'Active':'Inactive'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Featured</p><p className={`mt-2 font-semibold text-sm ${doc.isFeatured?'text-amber-600':'text-zinc-500'}`}>{doc.isFeatured?'Featured':'Standard'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Merchants</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><Building className="w-5 h-5 text-[#eba236]" /> {doc.merchantCount}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Display Order</p><p className="mt-2 font-mono font-bold text-gray-900 dark:text-white">{doc.displayOrder}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Category Details">
            <Row label="Name" value={doc.name} />
            <Row label="Slug" value={`/${doc.slug}`} mono />
            <Row label="Description" value={doc.description || '—'} />
            <Row label="Display order" value={String(doc.displayOrder)} mono />
          </Section>
          <Section title="Flags">
            <Row label="Active" value={doc.isActive ? 'Yes' : 'No'} />
            <Row label="Featured" value={doc.isFeatured ? 'Yes — highlighted' : 'No'} />
          </Section>
        </div>
        <div className="space-y-5">
          {doc.icon?.url && (
            <Section title="Icon">
              <div className="p-4 flex items-center gap-3">
                <img src={doc.icon.url} alt={doc.name} className="h-16 w-16 rounded-xl object-cover border border-gray-200 dark:border-[#262626]" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Icon</p>
                  <a href={doc.icon.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Open original</a>
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

export default function MerchantCategoryViewPage(){
  return (
    <ClientOnly fallback={<MerchantCategoryViewSkeleton />}>
      <MerchantCategoryViewContent />
    </ClientOnly>
  )
}
