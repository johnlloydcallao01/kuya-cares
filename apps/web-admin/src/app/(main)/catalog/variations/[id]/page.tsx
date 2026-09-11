'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import { Building, ArrowLeft, Pencil, CalendarDays, AlertCircle, DollarSign, Package, Layers, Eye, EyeOff } from '@/components/ui/IconWrapper'

type VariationDoc = {
  id: number
  product_id: { id: number; name: string; slug: string; productType: string } | number | null
  modifier_behavior_mode: string
  name: string | null
  short_description: string | null
  image: { id: number; url: string | null; filename: string | null } | null
  sku: string
  base_price: number | null
  compare_at_price: number | null
  stock_quantity: number
  is_used_for_variations: boolean
  is_visible: boolean
  sort_order: number
  modifier_configuration_hint: string | null
  effective_modifier_preview: unknown
  createdAt: string
  updatedAt: string
}

function modeBadge(mode: string) {
  const m = (mode || '').toLowerCase()
  if (m === 'hybrid') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (m === 'variation_specific') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800'
  return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      <div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div>
    </div>
  )
}
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0">{label}</span>
      <span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value as any}</span>
    </div>
  )
}

function VariationViewSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function VariationViewContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [doc, setDoc] = useState<VariationDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/catalog/variations/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load variation')
        if (!cancelled) setDoc(j.doc)
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
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
        <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/catalog/variations'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load variation</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/catalog/variations" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>
      </div>
    )
  }

  const productLabel =
    !doc.product_id
      ? '—'
      : typeof doc.product_id === 'number'
        ? `#${doc.product_id}`
        : `${(doc.product_id as any).name || (doc.product_id as any).slug || '#'} (#${(doc.product_id as any).id})`

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/catalog/variations'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center shrink-0 overflow-hidden">
            {doc.image?.url ? <img src={doc.image.url} alt={doc.name || ''} className="h-full w-full object-cover" /> : <Building className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight truncate">{doc.name || doc.sku || `Variation #${doc.id}`}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa] font-mono truncate">
              {doc.sku || '—'} • <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${modeBadge(doc.modifier_behavior_mode)}`}>{doc.modifier_behavior_mode.replace('_', ' ')}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/catalog/variations/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition">
            <Pencil className="w-4 h-4" /> Edit
          </Link>
          <Link href="/catalog/variations" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">
            Close
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Package className="w-3 h-3" /> Product
          </p>
          <p className="mt-2 font-semibold text-sm text-gray-900 dark:text-white truncate">{productLabel}</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Price
          </p>
          <p className="mt-2 font-semibold text-sm text-gray-900 dark:text-white">{doc.base_price != null ? `₱${Number(doc.base_price).toFixed(2)}` : '—'}</p>
          {doc.compare_at_price != null && <p className="text-xs text-gray-400 line-through">₱{Number(doc.compare_at_price).toFixed(2)}</p>}
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Layers className="w-3 h-3" /> Stock
          </p>
          <p className={`mt-2 font-semibold text-sm ${doc.stock_quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{doc.stock_quantity} {doc.stock_quantity > 0 ? 'in stock' : 'out of stock'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            {doc.is_visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />} Visibility
          </p>
          <p className={`mt-2 font-semibold text-sm ${doc.is_visible ? 'text-emerald-600' : 'text-zinc-500'}`}>{doc.is_visible ? 'Visible' : 'Hidden'}</p>
          <p className="text-xs text-gray-500">Used: {doc.is_used_for_variations ? 'Yes' : 'No'} • Sort: {doc.sort_order}</p>
        </div>
      </div>

      {doc.image?.url && (
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
          <p className="text-xs font-semibold text-gray-700 dark:text-[#a1a1aa] mb-2">Image</p>
          <img src={doc.image.url} alt={doc.name || 'Variation image'} className="max-h-64 rounded-lg border border-gray-200 dark:border-[#262626]" />
        </div>
      )}

      <Section title="Variation Details">
        <Row label="Name" value={doc.name || '—'} />
        <Row label="SKU" value={doc.sku || '—'} mono />
        <Row label="Product" value={productLabel} />
        <Row label="Modifier Mode" value={doc.modifier_behavior_mode} />
        <Row label="Short Description" value={doc.short_description || '—'} />
        <Row label="Base Price" value={doc.base_price != null ? `₱${Number(doc.base_price).toFixed(2)}` : '—'} />
        <Row label="Compare At Price" value={doc.compare_at_price != null ? `₱${Number(doc.compare_at_price).toFixed(2)}` : '—'} />
        <Row label="Stock Quantity" value={String(doc.stock_quantity)} />
        <Row label="Sort Order" value={String(doc.sort_order)} />
        <Row label="Visible" value={doc.is_visible ? 'Yes' : 'No'} />
        <Row label="Used for Variations" value={doc.is_used_for_variations ? 'Yes' : 'No'} />
        <Row label="ID" value={`#${doc.id}`} mono />
        <Row label="Created" value={fmtDate(doc.createdAt)} />
        <Row label="Updated" value={fmtDate(doc.updatedAt)} />
      </Section>

      {doc.modifier_configuration_hint && (
        <Section title="Modifier Configuration Hint">
          <div className="px-4 py-3 text-sm text-gray-700 dark:text-[#a1a1aa] whitespace-pre-wrap">{doc.modifier_configuration_hint}</div>
        </Section>
      )}

      <Section title="Effective Modifier Preview (read-only)">
        <div className="px-4 py-3">
          {doc.effective_modifier_preview == null || (Array.isArray(doc.effective_modifier_preview) && (doc.effective_modifier_preview as any[]).length === 0) ? (
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">No effective modifiers — preview is empty for this variation/mode.</p>
          ) : (
            <pre className="text-xs font-mono bg-gray-50 dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-lg p-3 overflow-auto max-h-96 whitespace-pre-wrap break-words">
              {JSON.stringify(doc.effective_modifier_preview, null, 2)}
            </pre>
          )}
        </div>
      </Section>
    </div>
  )
}

export default function VariationViewPage(){
  return (
    <ClientOnly fallback={<VariationViewSkeleton />}>
      <VariationViewContent />
    </ClientOnly>
  )
}
