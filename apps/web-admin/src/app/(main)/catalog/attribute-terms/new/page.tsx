'use client'

import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@encreasl/client-services'
import { ArrowLeft, Building } from '@/components/ui/IconWrapper'
import { AttributeTermForm } from '../_components/AttributeTermForm'
import { ClientOnly } from '@/components/ClientOnly'

function NewAttributeTermSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function NewAttributeTermContent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/catalog/attribute-terms')
  }
  const handleSuccess = async () => {
    // Bust the 3-min list cache BEFORE navigating back, otherwise /catalog/attribute-terms
    // remounts with fresh-but-stale data and the new term is invisible
    // until a manual reload.
    await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminCatalogAttributeTerms().slice(0, 3) })
    router.push('/catalog/attribute-terms')
  }
  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Building className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Create attribute term</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">Define a new term for a product attribute — color swatch or selectable value.</p>
        </div>
      </div>
      <AttributeTermForm onSuccess={handleSuccess} onCancel={handleBack} />
    </div>
  )
}

export default function NewAttributeTermPage(){
  return (
    <ClientOnly fallback={<NewAttributeTermSkeleton />}>
      <NewAttributeTermContent />
    </ClientOnly>
  )
}
