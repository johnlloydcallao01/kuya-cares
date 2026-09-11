'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Building, ArrowLeft, Pencil, Tag, CalendarDays, AlertCircle, ToggleLeft, Palette
} from '@/components/ui/IconWrapper'

type AttributeDoc = {
  id: number
  name: string
  slug: string
  type: string
  is_active: boolean
  createdAt: string
  updatedAt: string
}

function typeBadge(type: string) {
  const t = type.toLowerCase()
  if (t === 'color') return 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/20 dark:text-pink-300 dark:border-pink-800'
  if (t === 'button') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (t === 'radio') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
}
function fmtDate(iso: string | null) { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0,10) } }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4><div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div></div>
}
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm"><span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0">{label}</span><span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value as any}</span></div>
}

function AttributeViewSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function AttributeViewContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [doc, setDoc] = useState<AttributeDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/catalog/attributes/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load attribute')
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
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/catalog/attributes'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load attribute</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/catalog/attributes" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/catalog/attributes'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Building className="w-5 h-5" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{doc.name}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] font-mono">{doc.slug} • <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${typeBadge(doc.type)}`}>{doc.type}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/catalog/attributes/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/catalog/attributes" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 flex items-center gap-1"><Palette className="w-3 h-3" /> Type</p><p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${typeBadge(doc.type)}`}>{doc.type}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 flex items-center gap-1"><ToggleLeft className="w-3 h-3" /> Status</p><p className={`mt-2 font-semibold text-sm ${doc.is_active ? 'text-emerald-600' : 'text-zinc-500'}`}>{doc.is_active ? 'Active' : 'Inactive'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Created</p><p className="mt-2 font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.createdAt)}</p><p className="text-xs text-gray-500">Updated {fmtDate(doc.updatedAt)}</p></div>
      </div>

      <Section title="Attribute Details">
        <Row label="Name" value={doc.name} />
        <Row label="Slug" value={doc.slug} mono />
        <Row label="Type" value={doc.type} />
        <Row label="Active" value={doc.is_active ? 'Yes' : 'No'} />
        <Row label="ID" value={`#${doc.id}`} mono />
        <Row label="Created" value={fmtDate(doc.createdAt)} />
        <Row label="Updated" value={fmtDate(doc.updatedAt)} />
      </Section>
    </div>
  )
}

export default function AttributeViewPage(){
  return (
    <ClientOnly fallback={<AttributeViewSkeleton />}>
      <AttributeViewContent />
    </ClientOnly>
  )
}
