'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, AlertCircle, RefreshCw, CheckCircle, Users } from '@/components/ui/IconWrapper'
import { UserForm } from '../../_components/UserForm'
import { ClientOnly } from '@/components/ClientOnly'

function EditUserSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function EditUserContent() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [doc, setDoc] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/users/${id}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || j.details || 'Failed to load user')
      setDoc(j.doc || j)
    } catch (e:any) { setError(e.message || 'Failed to load') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const handleSaveSuccess = async () => {
    setSaveSuccess(true)
    try {
      const res = await fetch(`/api/users/${id}`, { cache: 'no-store' })
      const j = await res.json()
      if (res.ok && j.doc) setDoc(j.doc)
      else if (res.ok && j) setDoc(j)
    } catch {}
    setTimeout(() => setSaveSuccess(false), 4000)
  }

  if (loading) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
        <div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      </div>
    )
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <Link href="/users" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back to users</Link>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load user</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/users" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
        </div>
      </div>
    )
  }

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/users')
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {saveSuccess && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          User updated successfully.
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center overflow-hidden">
          {doc.profilePicture?.url ? (
            <img src={doc.profilePicture.url} alt={`${doc.firstName} ${doc.lastName}`} className="h-full w-full object-cover" />
          ) : (
            <Users className="w-5 h-5" />
          )}
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Edit user</h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">ID #{doc.id} • {doc.firstName} {doc.lastName} • {doc.email}</p>
        </div>
      </div>
      <UserForm initial={doc} onSuccess={handleSaveSuccess} onCancel={handleBack} />
    </div>
  )
}

export default function EditUserPage(){
  return (
    <ClientOnly fallback={<EditUserSkeleton />}>
      <EditUserContent />
    </ClientOnly>
  )
}
