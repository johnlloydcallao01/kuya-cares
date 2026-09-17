'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import { Ticket, ArrowLeft, CheckCircle } from '@/components/ui/IconWrapper'
import { CouponForm, type CouponDoc } from '../../_components/CouponForm'

function EditCouponSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function EditCouponContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  if (['new', 'usage'].includes(id)) notFound()

  const [doc, setDoc] = useState<CouponDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/coupons')
  }

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coupons/${id}?_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load coupon')
      setDoc(j.doc || null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load coupon')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const handleSaveSuccess = async () => {
    // Re-fetch to verify persisted state before showing success.
    try {
      const res = await fetch(`/api/coupons/${id}?_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json()
      if (res.ok && j.doc) setDoc(j.doc)
    } catch { /* keep stale doc */ }
    setSaved(true)
    setTimeout(() => setSaved(false), 4000)
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to coupons
      </button>
      <div className="flex items-center gap-3">
        <span className="h-10 w-10 rounded-xl bg-[#eba236] text-white flex items-center justify-center"><Ticket className="w-5 h-5" /></span>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Edit coupon {doc ? <span className="font-mono">#{doc.id} · {doc.code}</span> : `#${id}`}
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Code and discount type stay locked — archive and recreate to change them.</p>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2">
          <CheckCircle className="w-4 h-4" /> Saved.
        </div>
      )}

      {loading ? (
        <div className="h-96 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      ) : error ? (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => void load()} className="px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Retry</button>
            <Link href="/coupons" className="px-4 py-2 border border-gray-200 dark:border-[#262626] rounded-lg text-sm font-medium">Back</Link>
          </div>
        </div>
      ) : doc ? (
        <CouponForm initial={doc} onSuccess={() => void handleSaveSuccess()} onCancel={handleBack} />
      ) : null}
    </div>
  )
}

export default function EditCouponPage() {
  return (
    <ClientOnly fallback={<EditCouponSkeleton />}>
      <EditCouponContent />
    </ClientOnly>
  )
}
