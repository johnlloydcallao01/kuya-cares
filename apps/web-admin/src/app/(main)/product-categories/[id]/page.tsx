'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import { ArrowLeft, Tag, Layers, Sparkles, AlertCircle, Globe, Store, ShieldCheck, Hash } from '@/components/ui/IconWrapper'

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

function ProductCategoryDetailSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function ProductCategoryDetailContent() {
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
        const res = await fetch(`/api/product-categories/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load product category')
        if (!cancelled) setDoc(j.doc)
      } catch (e: any) { if (!cancelled) setError(e.message || 'Failed to load') } finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  const handleBack = () => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/product-categories') }

  if (loading) {
    return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load product category</h3><p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/product-categories" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
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
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Tag className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{doc.name}</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">/{doc.slug} • Level {doc.categoryLevel ?? 1} • {doc.isActive ? 'Active' : 'Inactive'} {doc.isFeatured ? '• Featured' : ''}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
        <div className="p-6 space-y-6">
          <Section title="Basic">
            <Row label="Name" value={doc.name} icon={<Tag className="w-3 h-3" />} />
            <Row label="Slug" value={doc.slug} mono />
            <Row label="Description" value={doc.description || '—'} />
          </Section>

          <Section title="Hierarchy">
            <Row label="Parent" value={doc.parentCategory ? `${doc.parentCategory.name} (${doc.parentCategory.slug})` : '— Top-level —'} icon={<Layers className="w-3 h-3" />} />
            <Row label="Level" value={String(doc.categoryLevel ?? 1)} mono icon={<Hash className="w-3 h-3" />} />
            <Row label="Path" value={doc.categoryPath || '—'} mono />
            <Row label="Display order" value={String(doc.displayOrder ?? 0)} mono icon={<Hash className="w-3 h-3" />} />
            <Row label="Products" value={`${doc.productCount ?? 0} product(s)`} icon={<Tag className="w-3 h-3" />} />
          </Section>

          <Section title="Visual">
            <Row label="Icon" value={doc.media?.icon?.url ? <a href={doc.media.icon.url} target="_blank" rel="noopener noreferrer" className="text-[#eba236] hover:text-[#c88a20]">View</a> : '—'} icon={<Layers className="w-3 h-3" />} />
            <Row label="Banner" value={doc.media?.bannerImage?.url ? <a href={doc.media.bannerImage.url} target="_blank" rel="noopener noreferrer" className="text-[#eba236] hover:text-[#c88a20]">View</a> : '—'} />
            <Row label="Thumbnail" value={doc.media?.thumbnailImage?.url ? <a href={doc.media.thumbnailImage.url} target="_blank" rel="noopener noreferrer" className="text-[#eba236] hover:text-[#c88a20]">View</a> : '—'} />
          </Section>

          <Section title="Attributes">
            <Row label="Category type" value={doc.attributes?.categoryType || 'other'} icon={<Store className="w-3 h-3" />} />
            <Row label="Dietary tags" value={Array.isArray(doc.attributes?.dietaryTags) ? doc.attributes.dietaryTags.join(', ') : String(doc.attributes?.dietaryTags || '—')} />
            <Row label="Age restriction" value={doc.attributes?.ageRestriction || 'none'} icon={<ShieldCheck className="w-3 h-3" />} />
            <Row label="Requires prescription" value={doc.attributes?.requiresPrescription ? 'Yes' : 'No'} />
          </Section>

          <Section title="SEO">
            <Row label="Meta title" value={doc.seo?.metaTitle || '—'} icon={<Globe className="w-3 h-3" />} />
            <Row label="Meta description" value={doc.seo?.metaDescription || '—'} />
            <Row label="Keywords" value={Array.isArray(doc.seo?.keywords) ? doc.seo.keywords.join(', ') : String(doc.seo?.keywords || '—')} />
            <Row label="Canonical URL" value={doc.seo?.canonicalUrl ? <a href={doc.seo.canonicalUrl} target="_blank" rel="noopener noreferrer" className="text-[#eba236] hover:text-[#c88a20] break-all">{doc.seo.canonicalUrl}</a> : '—'} icon={<Globe className="w-3 h-3" />} />
          </Section>

          <Section title="Status">
            <Row label="Active" value={doc.isActive ? 'Active' : 'Inactive'} icon={<Hash className="w-3 h-3" />} />
            <Row label="Featured" value={doc.isFeatured ? 'Featured' : 'No'} icon={<Sparkles className="w-3 h-3" />} />
            <Row label="Created" value={fmtDateTime(doc.createdAt)} />
            <Row label="Updated" value={fmtDateTime(doc.updatedAt)} />
          </Section>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
          <Link href={`/product-categories/${doc.id}/edit`} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white">Edit product category</Link>
        </div>
      </div>
    </div>
  )
}

export default function ProductCategoryDetailPage(){
  return (
    <ClientOnly fallback={<ProductCategoryDetailSkeleton />}>
      <ProductCategoryDetailContent />
    </ClientOnly>
  )
}
