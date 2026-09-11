'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import Link from 'next/link'
import { ArrowLeft, Tag, AlertCircle } from '@/components/ui/IconWrapper'
import { MerchantCategoryForm } from '../../_components/MerchantCategoryForm'
import { ClientOnly } from '@/components/ClientOnly'

function EditMerchantCategorySkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function EditMerchantCategoryContent() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const queryClient = useQueryClient()
  const [doc, setDoc] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/merchant-categories/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load category')
        if (!cancelled) setDoc(j.doc)
      } catch (e:any) { if(!cancelled) setError(e.message||'Failed') } finally { if(!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/merchant-categories')
  }

  if (loading) {
    return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back</button>
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
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Tag className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Edit category</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">ID #{doc.id} • {doc.name} • /{doc.slug}</p>
        </div>
      </div>
      <MerchantCategoryForm initial={doc} onSuccess={async () => {
        // Keep the list fresh for when the user navigates back to /merchant-categories.
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminMerchantCategories().slice(0, 2) })
        router.push(`/merchant-categories/${id}`)
      }} onCancel={handleBack} />
    </div>
  )
}

export default function EditMerchantCategoryPage(){
  return (
    <ClientOnly fallback={<EditMerchantCategorySkeleton />}>
      <EditMerchantCategoryContent />
    </ClientOnly>
  )
}
