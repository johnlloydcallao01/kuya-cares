'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from '@/components/ui/IconWrapper'
import { CustomerForm } from '../_components/CustomerForm'
import { ClientOnly } from '@/components/ClientOnly'

function NewCustomerSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function NewCustomerContent() {
  const router = useRouter()
  const [success, setSuccess] = useState(false)
  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/customers'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to customers
      </button>
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">New Customer</h1>
        <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Onboard a new customer — creates the linked user account and profile in one flow (BFF-owned).</p>
      </div>
      {success && <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm text-emerald-700 dark:text-emerald-300">Customer created — redirecting…</div>}
      <CustomerForm onSuccess={() => { setSuccess(true); setTimeout(()=> router.push('/customers'), 700) }} onCancel={() => router.push('/customers')} />
    </div>
  )
}

export default function NewCustomerPage(){
  return (
    <ClientOnly fallback={<NewCustomerSkeleton />}>
      <NewCustomerContent />
    </ClientOnly>
  )
}
