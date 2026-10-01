'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import { AlertCircle, CreditCard, Receipt, ArrowLeft, RefreshCw } from '@/components/ui/IconWrapper'

type InvoiceDoc = {
  id: string | number
  invoice_number?: string | null
  invoiceNumber?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
}

function fmtCurrency(amount: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch { return `₱${Number(amount || 0).toFixed(2)}` }
}

function CancelledSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function CancelledContent() {
  const searchParams = useSearchParams()
  const invoiceId = searchParams.get('invoiceId') || ''
  const [doc, setDoc] = useState<InvoiceDoc | null>(null)
  const [loading, setLoading] = useState(!!invoiceId)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!invoiceId) return
      setLoading(true)
      try {
        const res = await fetch(`/api/membership/invoices/${encodeURIComponent(invoiceId)}?_t=${Date.now()}`, { cache: 'no-store' })
        const j = await res.json().catch(() => ({}))
        if (!cancelled && res.ok) setDoc((j.doc ?? j.data ?? j.invoice ?? null) as InvoiceDoc | null)
      } catch { /* summary is best-effort */ }
      finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [invoiceId])

  const handleRetry = async () => {
    setRetrying(true)
    setRetryError(null)
    try {
      const res = await fetch('/api/membership/subscriptions/renew', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
        cache: 'no-store',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || j.message || 'Failed to create checkout')
      const url = String(j.checkoutUrl ?? j.checkout_url ?? j.payment_link_url ?? j.url ?? '')
      if (!url) throw new Error('No checkout URL returned')
      window.location.href = url
    } catch (e: unknown) {
      setRetryError(e instanceof Error ? e.message : 'Failed to start payment')
    } finally {
      setRetrying(false)
    }
  }

  const invoiceNumber = doc ? String(doc.invoice_number ?? doc.invoiceNumber ?? doc.id) : invoiceId
  const amount = doc && doc.amount != null ? fmtCurrency(Number(doc.amount) || 0, String(doc.currency || 'PHP')) : null

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-zinc-500 text-white flex items-center justify-center"><Receipt className="w-4 h-4" /></span>
          Payment cancelled
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">You left PayMongo checkout before completing payment.</p>
      </div>

      <div className="bg-white dark:bg-[#171717] rounded-xl border border-amber-200 dark:border-amber-800 p-6 text-center shadow-sm">
        <div className="h-14 w-14 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4 mx-auto"><AlertCircle className="h-7 w-7 text-amber-500" /></div>
        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">Payment cancelled — no charge made</h3>
        <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Your subscription is unchanged. Retry whenever you are ready.</p>
        {loading ? (
          <p className="text-xs text-gray-400 mt-3 animate-pulse">Loading invoice summary…</p>
        ) : invoiceNumber ? (
          <p className="text-xs text-gray-400 mt-3 font-mono">{invoiceNumber}{amount ? ` • ${amount}` : ''}{doc?.status ? ` • ${String(doc.status).replace('_', ' ')}` : ''}</p>
        ) : null}
        {retryError && <p className="text-sm text-red-600 mt-3">{retryError}</p>}
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          <button onClick={() => void handleRetry()} disabled={retrying} className="px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold transition inline-flex items-center gap-2 disabled:opacity-50">
            <CreditCard className="w-4 h-4" /> {retrying ? 'Starting…' : 'Retry payment'}
          </button>
          <Link href="/billing/invoices" className="px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-white inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Back to subscription
          </Link>
        </div>
      </div>

      <Link href="/dashboard/overview" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </Link>
    </div>
  )
}

export default function BillingCancelledPage() {
  return (
    <ClientOnly fallback={<CancelledSkeleton />}>
      <Suspense fallback={<CancelledSkeleton />}>
        <CancelledContent />
      </Suspense>
    </ClientOnly>
  )
}
