'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import { ArrowLeft, Layers, Package, CalendarDays, AlertCircle, Pencil } from '@/components/ui/IconWrapper'

type Doc = {
  id: number
  merchant_product_id: any
  merchant_product: any
  base_modifier_group_id: any
  base_modifier_group: any
  mode: string
  name_override: string | null
  selection_type_override: string | null
  required_behavior: string
  min_selections_override: number | null
  max_selections_override: number | null
  sort_order_override: number | null
  is_active: boolean
  createdAt: string
  updatedAt: string
}

function fmtDate(iso: string | null) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso).slice(0,10) } }
function labelOf(v: any){ if(!v) return '—'; if(typeof v==='number') return `#${v}`; return v.name ? `${v.name} (#${v.id})` : `#${v.id}` }
function mpLabel(v: any){ if(!v) return '—'; if(typeof v==='number') return `#${v}`; return v.display_title ? `${v.display_title} (#${v.id})` : `#${v.id}` }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4><div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div></div>
}
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0">{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value as any}</span></div>
}

function MerchantProductModifierGroupOverrideViewSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function MerchantProductModifierGroupOverrideViewContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [doc, setDoc] = useState<Doc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/catalog/merchant-product-modifier-group-overrides/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load override')
        if (!cancelled) setDoc(j.doc)
      } catch (e: any) { if (!cancelled) setError(e.message || 'Failed to load') }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      </div>
    )
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/catalog/merchant-product-modifier-group-overrides'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load override</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/catalog/merchant-product-modifier-group-overrides" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/catalog/merchant-product-modifier-group-overrides'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-[#eba236] text-white flex items-center justify-center font-bold text-lg shrink-0"><Layers className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Override #{doc.id}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{doc.mode} • {doc.is_active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/catalog/merchant-product-modifier-group-overrides/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/catalog/merchant-product-modifier-group-overrides" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Mode</p><p className="mt-2 font-semibold text-sm capitalize">{doc.mode}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Required Behavior</p><p className="mt-2 font-semibold text-sm capitalize">{doc.required_behavior}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Active</p><p className={`mt-2 font-semibold text-sm ${doc.is_active ? 'text-emerald-600' : 'text-zinc-500'}`}>{doc.is_active ? 'Active' : 'Inactive'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Sort Override</p><p className="mt-2 font-bold text-lg">{doc.sort_order_override ?? '—'}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Override Information">
            <Row label="Merchant Product" value={mpLabel(doc.merchant_product_id)} />
            <Row label="Base Group" value={labelOf(doc.base_modifier_group_id)} />
            <Row label="Mode" value={doc.mode} />
            <Row label="Name Override" value={doc.name_override || '—'} />
            <Row label="Selection Type Override" value={doc.selection_type_override || '—'} />
            <Row label="Required Behavior" value={doc.required_behavior} />
            <Row label="Min / Max Override" value={`${doc.min_selections_override ?? '—'} / ${doc.max_selections_override ?? '—'}`} mono />
            <Row label="Sort Order Override" value={doc.sort_order_override != null ? String(doc.sort_order_override) : '—'} mono />
            <Row label="Is Active" value={doc.is_active ? 'Yes' : 'No'} />
          </Section>
        </div>
        <div className="space-y-5">
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

export default function MerchantProductModifierGroupOverrideViewPage(){
  return (
    <ClientOnly fallback={<MerchantProductModifierGroupOverrideViewSkeleton />}>
      <MerchantProductModifierGroupOverrideViewContent />
    </ClientOnly>
  )
}
