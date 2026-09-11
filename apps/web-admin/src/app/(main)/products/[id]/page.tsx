'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, notFound } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import { Package, ArrowLeft, Pencil, Building, Tag, DollarSign, Eye, EyeOff, Image as ImageIcon, CalendarDays, AlertCircle } from '@/components/ui/IconWrapper'

type ProductDoc = {
  id: number
  name: string
  slug: string
  sku: string | null
  productType: string
  basePrice: number | null
  compareAtPrice: number | null
  isActive: boolean
  catalogVisibility: string
  categories: { id: number; name: string; slug: string }[]
  primaryImage: { id: number; url: string | null } | null
  shortDescription: string | null
  description: any
  vendor: { id: number; businessName: string } | null
  createdAt: string
  updatedAt: string
}
function fmtPHP(n: number | null){ if(n==null) return '—'; return `₱${Number(n).toLocaleString('en-PH',{minimumFractionDigits:2, maximumFractionDigits:2})}` }
function fmtDate(iso: string | null){ if(!iso) return '—'; try{return new Date(iso).toLocaleDateString('en-PH',{timeZone:'Asia/Manila',year:'numeric',month:'short',day:'numeric'})}catch{return String(iso).slice(0,10)} }
function initials(n: string){ return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('')||'P' }
function Section({ title, children }: { title: string; children: React.ReactNode }){
  return <div><h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4><div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div></div>
}
function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }){
  return <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono?'font-mono text-xs':'text-sm'}`}>{value as any}</span></div>
}

function ProductViewSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function ProductViewContent(){
  const params=useParams()
  const router=useRouter()
  const id=params.id as string
  if (!/^\d+$/.test(id)) notFound()
  const [doc,setDoc]=useState<ProductDoc|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)

  useEffect(()=>{
    let cancelled=false
    async function load(){
      setLoading(true); setError(null)
      try{
        const res=await fetch(`/api/products/${id}`,{cache:'no-store'})
        const j=await res.json()
        if(!res.ok) throw new Error(j.error||'Failed to load product')
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
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/products'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load product</h3><p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/products" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/products'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
            {doc.primaryImage?.url ? <img src={doc.primaryImage.url} alt={doc.name} className="h-12 w-12 object-cover" /> : initials(doc.name)}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{doc.name}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] font-mono">/{doc.slug} • {doc.sku || 'no SKU'} • {doc.productType}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/products/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/products" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Type</p><p className="mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20">{doc.productType}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Price</p><p className="mt-2 font-bold text-gray-900 dark:text-white">{fmtPHP(doc.basePrice)} {doc.compareAtPrice ? <span className="text-xs font-normal text-gray-400 line-through ml-1">{fmtPHP(doc.compareAtPrice)}</span> : null}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Visibility</p><p className="mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20">{doc.catalogVisibility}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Active</p><p className={`mt-2 font-semibold text-sm ${doc.isActive?'text-emerald-600':'text-zinc-500'}`}>{doc.isActive?'Active':'Inactive'}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Product Details">
            <Row label="Name" value={doc.name} />
            <Row label="Slug" value={`/${doc.slug}`} mono />
            <Row label="SKU" value={doc.sku || '—'} mono />
            <Row label="Short description" value={doc.shortDescription || '—'} />
          </Section>
          <Section title="Pricing & Visibility">
            <Row label="Base price" value={fmtPHP(doc.basePrice)} />
            <Row label="Compare at" value={doc.compareAtPrice ? fmtPHP(doc.compareAtPrice) : '—'} />
            <Row label="Visibility" value={doc.catalogVisibility} />
            <Row label="Active" value={doc.isActive ? 'Yes' : 'No'} />
          </Section>
          <Section title="Ownership">
            <Row label="Vendor" value={doc.vendor?.businessName ? `${doc.vendor.businessName} (#${doc.vendor.id})` : '—'} icon={<Building className="w-3 h-3" />} />
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Categories">
            <div className="p-4">
              {doc.categories?.length ? (
                <div className="flex flex-wrap gap-2">
                  {doc.categories.map((c:any)=><span key={c.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]"><Tag className="w-3 h-3" />{c.name}</span>)}
                </div>
              ) : <p className="text-sm text-gray-500 text-center">No categories.</p>}
            </div>
          </Section>
          {doc.primaryImage?.url && (
            <Section title="Media">
              <div className="p-4 flex items-center gap-3">
                <img src={doc.primaryImage.url} alt={doc.name} className="h-16 w-16 rounded-xl object-cover border border-gray-200 dark:border-[#262626]" />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Primary image</p>
                  <a href={doc.primaryImage.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Open original</a>
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

export default function ProductViewPage(){
  return (
    <ClientOnly fallback={<ProductViewSkeleton />}>
      <ProductViewContent />
    </ClientOnly>
  )
}
