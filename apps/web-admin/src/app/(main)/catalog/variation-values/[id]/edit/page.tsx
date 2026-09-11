'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft, Building, AlertCircle, Layers } from '@/components/ui/IconWrapper'
import { VariationValueForm, VariationValueDoc } from '../../_components/VariationValueForm'
import { ClientOnly } from '@/components/ClientOnly'

function EditVariationValueSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function EditVariationValueContent() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string
  const [doc, setDoc] = useState<VariationValueDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/catalog/variation-values/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load variation value')
        if (!cancelled) setDoc(j.doc)
      } catch (e: any) { if (!cancelled) setError(e.message || 'Failed to load') }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/catalog/variation-values')
  }

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
        <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load variation value</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/catalog/variation-values" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium"><ArrowLeft className="w-4 h-4" /> Back</Link>
        </div>
      </div>
    )
  }

  const variation = (doc as any).variation || (doc as any).variationBrief

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Layers className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Edit variation value — #{doc.id}</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] font-mono">{variation?.sku || `#${doc.variation_id}`} {doc.attribute ? `• ${doc.attribute.name}` : ''} {doc.term ? `• ${doc.term.name}` : ''}</p>
        </div>
      </div>
      <VariationValueForm initial={doc} onSuccess={async () => {
        // Keep the list fresh for when the user navigates back to /catalog/variation-values.
        await queryClient.invalidateQueries({ queryKey: ['admin', 'catalog', 'variation-values'] })
        router.push(`/catalog/variation-values/${doc.id}`)
      }} onCancel={handleBack} />
    </div>
  )
}

export default function EditVariationValuePage(){
  return (
    <ClientOnly fallback={<EditVariationValueSkeleton />}>
      <EditVariationValueContent />
    </ClientOnly>
  )
}
