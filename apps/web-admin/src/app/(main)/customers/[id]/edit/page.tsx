'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, RefreshCw } from '@/components/ui/IconWrapper'
import { CustomerForm } from '../../_components/CustomerForm'
import { ClientOnly } from '@/components/ClientOnly'

function EditCustomerSkeleton(){
  return <div className="py-5 px-2.5"><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function EditCustomerContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true); setError(null)
      try {
        const res = await fetch(`/api/customers/${id}`, { cache: 'no-store' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Failed to load customer')
        if (!cancelled) setDoc(j.doc)
      } catch (e:any) { if (!cancelled) setError(e.message || 'Failed to load') }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="py-5 px-2.5"><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
  if (error || !doc) return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/customers'))} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa]"><ArrowLeft className="w-4 h-4" /> Back</button>
      <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border"><AlertCircle className="h-7 w-7 text-red-500 mb-2" /><p className="text-sm text-gray-500">{error}</p></div>
    </div>
  )

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/customers'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back to customers</button>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Edit Customer #{doc.id}</h1>
        <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">{doc.user ? `${doc.user.firstName} ${doc.user.lastName} — ${doc.user.email}` : doc.email} • {doc.srn || 'no SRN'}</p>
      </div>
      {success && <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Customer updated — redirecting…</div>}
      <CustomerForm initial={doc} onSuccess={() => { setSuccess(true); setTimeout(()=> router.push(`/customers/${doc.id}`), 700) }} onCancel={() => router.push(`/customers/${doc.id}`)} />
    </div>
  )
}

export default function EditCustomerPage(){
  return (
    <ClientOnly fallback={<EditCustomerSkeleton />}>
      <EditCustomerContent />
    </ClientOnly>
  )
}
