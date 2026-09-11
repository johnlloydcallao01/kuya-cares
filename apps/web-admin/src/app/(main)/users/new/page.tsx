'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users } from '@/components/ui/IconWrapper'
import { UserForm } from '../_components/UserForm'
import { ClientOnly } from '@/components/ClientOnly'

function NewUserSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function NewUserContent() {
  const router = useRouter()
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/users')
  }
  const handleSuccess = () => router.push('/users')

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center">
          <Users className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">New user</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">Create a platform user — role determines access, password is set on creation.</p>
        </div>
      </div>
      <UserForm onSuccess={handleSuccess} onCancel={handleBack} />
    </div>
  )
}

export default function NewUserPage(){
  return (
    <ClientOnly fallback={<NewUserSkeleton />}>
      <NewUserContent />
    </ClientOnly>
  )
}
