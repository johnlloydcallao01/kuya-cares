'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import { ArrowLeft, Tag, Layers, Sparkles, AlertCircle, Palette, Hash, ToggleLeft, Store, CalendarDays } from '@/components/ui/IconWrapper'

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

function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso).slice(0, 19).replace('T', ' ') }
}

function TagDetailSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function TagDetailContent() {
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
        const res = await fetch(`/api/catalog/tags/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load tag')
        if (!cancelled) setDoc(j.doc)
      } catch (e: any) { if (!cancelled) setError(e.message || 'Failed to load') } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  const handleBack = () => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/catalog/tags') }

  if (loading) {
    return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load tag</h3><p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/catalog/tags" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
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
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center shrink-0" style={doc.color ? { backgroundColor: doc.color } : undefined}>
          <Tag className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{doc.name}</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">/{doc.slug} • {doc.tag_type} • {doc.is_active ? 'Active' : 'Inactive'} {doc.is_featured ? '• Featured' : ''}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          <Section title="Basic">
            <Row label="Name" value={doc.name} icon={<Tag className="w-3 h-3" />} />
            <Row label="Slug" value={doc.slug} mono />
            <Row label="Description" value={doc.description || '—'} />
            <Row label="Tag type" value={doc.tag_type} icon={<Layers className="w-3 h-3" />} />
          </Section>

          <Section title="Visual">
            <Row
              label="Color"
              value={
                doc.color ? (
                  <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-gray-200 dark:border-[#262626]" style={{ backgroundColor: doc.color }} /> <span className="font-mono text-xs">{doc.color}</span></span>
                ) : '—'
              }
              icon={<Palette className="w-3 h-3" />}
            />
          </Section>

          <Section title="Hierarchy">
            <Row label="Parent" value={doc.parent_tag_id ? `${doc.parent_tag_id.name} (${doc.parent_tag_id.slug})` : '— Top-level —'} icon={<Layers className="w-3 h-3" />} />
            <Row label="Usage count" value={String(doc.usage_count ?? 0)} mono icon={<Hash className="w-3 h-3" />} />
            <Row label="Products" value={`${doc.productCount ?? 0} product(s) via prod-tags-junction`} icon={<Store className="w-3 h-3" />} />
            <Row label="Groups" value={`${doc.groupCount ?? 0} group(s) via tag-group-memberships`} icon={<Layers className="w-3 h-3" />} />
          </Section>

          <Section title="Status">
            <Row label="Active" value={doc.is_active ? 'Active' : 'Inactive'} icon={<ToggleLeft className="w-3 h-3" />} />
            <Row label="Featured" value={doc.is_featured ? 'Featured' : 'No'} icon={<Sparkles className="w-3 h-3" />} />
          </Section>

          <Section title="Timestamps">
            <Row label="Created" value={fmtDateTime(doc.createdAt)} icon={<CalendarDays className="w-3 h-3" />} />
            <Row label="Updated" value={fmtDateTime(doc.updatedAt)} icon={<CalendarDays className="w-3 h-3" />} />
            <Row label="ID" value={String(doc.id)} mono />
          </Section>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
          <Link href={`/catalog/tags/${doc.id}/edit`} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white">Edit tag</Link>
        </div>
      </div>
    </div>
  )
}

export default function TagDetailPage(){
  return (
    <ClientOnly fallback={<TagDetailSkeleton />}>
      <TagDetailContent />
    </ClientOnly>
  )
}
