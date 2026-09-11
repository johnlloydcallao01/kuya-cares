'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import { ArrowLeft, Layers, Package, Hash, CalendarDays, AlertCircle } from '@/components/ui/IconWrapper'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      <div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div>
    </div>
  )
}
function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span>
      <span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value as any}</span>
    </div>
  )
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso).slice(0, 19).replace('T', ' ') }
}
function getProductDisplay(v: any): string {
  if (!v) return '—'
  if (typeof v === 'number') return `#${v}`
  return v.name ? `${v.name} (${v.slug || ''}) — #${v.id}` : `#${v.id}`
}

function GroupedItemDetailSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function GroupedItemDetailContent() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [doc, setDoc] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/catalog/grouped-items/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load grouped item')
        if (!cancelled) setDoc(j.doc)
      } catch (e: any) { if (!cancelled) setError(e.message || 'Failed to load') } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  const handleBack = () => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/catalog/grouped-items') }

  if (loading) {
    return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load grouped item</h3><p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/catalog/grouped-items" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Layers className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Grouped item #{doc.id}</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">Parent: {getProductDisplay(doc.parent_product_id)} • Child: {getProductDisplay(doc.child_product_id)}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          <Section title="Bundle Composition">
            <Row label="Parent product" value={getProductDisplay(doc.parent_product_id)} icon={<Package className="w-3 h-3" />} />
            <Row label="Child product" value={getProductDisplay(doc.child_product_id)} icon={<Package className="w-3 h-3" />} />
            <Row label="Default quantity" value={String(doc.default_quantity ?? 1)} mono icon={<Hash className="w-3 h-3" />} />
            <Row label="Sort order" value={String(doc.sort_order ?? 0)} mono icon={<Hash className="w-3 h-3" />} />
          </Section>

          <Section title="Timeline">
            <Row label="Created" value={fmtDate(doc.createdAt)} icon={<CalendarDays className="w-3 h-3" />} />
            <Row label="Updated" value={fmtDate(doc.updatedAt)} icon={<CalendarDays className="w-3 h-3" />} />
            <Row label="ID" value={String(doc.id)} mono />
          </Section>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
          <Link href={`/catalog/grouped-items/${doc.id}/edit`} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white">Edit grouped item</Link>
        </div>
      </div>
    </div>
  )
}

export default function GroupedItemDetailPage(){
  return (
    <ClientOnly fallback={<GroupedItemDetailSkeleton />}>
      <GroupedItemDetailContent />
    </ClientOnly>
  )
}
