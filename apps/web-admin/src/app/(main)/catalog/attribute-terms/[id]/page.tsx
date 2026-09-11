'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import {
  Building, ArrowLeft, Pencil, Tag, CalendarDays, AlertCircle, ToggleLeft, Palette, Hash
} from '@/components/ui/IconWrapper'

type AttributeTermDoc = {
  id: number
  attribute_id: number | null
  attribute: { id: number; name: string; slug: string; type: string } | null
  name: string
  slug: string
  value: string | null
  sort_order: number
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

function AttributeTermViewSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function AttributeTermViewContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [doc, setDoc] = useState<AttributeTermDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/catalog/attribute-terms/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load attribute term')
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
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/catalog/attribute-terms'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load attribute term</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/catalog/attribute-terms" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      </div>
    )
  }

  const isHex = doc.value ? /^#[0-9A-Fa-f]{6}$/.test(doc.value) : false

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/catalog/attribute-terms'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Tag className="w-5 h-5" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{doc.name}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] font-mono">{doc.slug} {doc.attribute && <>• <Link href={`/catalog/attributes/${doc.attribute.id}`} className="text-[#eba236] hover:underline">{doc.attribute.name}</Link></>}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/catalog/attribute-terms/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/catalog/attribute-terms" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 flex items-center gap-1"><Palette className="w-3 h-3" /> Attribute</p><p className="mt-2 font-semibold text-sm text-gray-900 dark:text-white">{doc.attribute?.name || `#${doc.attribute_id}`}</p><p className="text-xs text-gray-500 font-mono">{doc.attribute?.slug || '—'} <span className={`ml-1 inline-flex px-1.5 py-0.5 rounded-full text-[11px] font-medium border capitalize ${doc.attribute ? typeBadge(doc.attribute.type) : 'bg-gray-100'}`}>{doc.attribute?.type || '—'}</span></p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 flex items-center gap-1"><Tag className="w-3 h-3" /> Value</p><div className="mt-2 flex items-center gap-2">{isHex && doc.value ? <span className="h-6 w-6 rounded-full border border-gray-200 dark:border-[#333]" style={{ backgroundColor: doc.value }} /> : <span className="h-6 w-6 rounded bg-gray-100 dark:bg-[#262626] flex items-center justify-center"><Palette className="w-3 h-3 text-gray-400" /></span>}<span className="font-mono text-xs font-medium text-gray-900 dark:text-white">{doc.value || '—'}</span></div></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 flex items-center gap-1"><Hash className="w-3 h-3" /> Sort Order</p><p className="mt-2 font-semibold text-sm text-gray-900 dark:text-white">{doc.sort_order}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500 flex items-center gap-1"><ToggleLeft className="w-3 h-3" /> Status</p><p className={`mt-2 font-semibold text-sm ${doc.is_active ? 'text-emerald-600' : 'text-zinc-500'}`}>{doc.is_active ? 'Active' : 'Inactive'}</p></div>
      </div>

      <Section title="Term Details">
        <Row label="Name" value={doc.name} />
        <Row label="Slug" value={doc.slug} mono />
        <Row label="Attribute" value={doc.attribute ? `${doc.attribute.name} (${doc.attribute.slug})` : `#${doc.attribute_id}`} />
        <Row label="Attribute Type" value={doc.attribute?.type || '—'} />
        <Row label="Value" value={
          doc.value ? (
            <span className="inline-flex items-center gap-2">
              {isHex && <span className="h-4 w-4 rounded-full border border-gray-200 dark:border-[#333]" style={{ backgroundColor: doc.value }} />}
              <span className="font-mono">{doc.value}</span>
            </span>
          ) : '—'
        } />
        <Row label="Sort Order" value={String(doc.sort_order)} mono />
        <Row label="Active" value={doc.is_active ? 'Yes' : 'No'} />
        <Row label="ID" value={`#${doc.id}`} mono />
        <Row label="Created" value={fmtDate(doc.createdAt)} />
        <Row label="Updated" value={fmtDate(doc.updatedAt)} />
      </Section>

      {doc.attribute && (
        <div className="flex justify-end">
          <Link href={`/catalog/attributes/${doc.attribute.id}`} className="inline-flex items-center gap-2 text-sm text-[#eba236] hover:underline"><Building className="w-4 h-4" /> View parent attribute</Link>
        </div>
      )}
    </div>
  )
}

export default function AttributeTermViewPage(){
  return (
    <ClientOnly fallback={<AttributeTermViewSkeleton />}>
      <AttributeTermViewContent />
    </ClientOnly>
  )
}
