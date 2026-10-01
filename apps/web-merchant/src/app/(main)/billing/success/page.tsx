'use client'

import React, { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, Receipt, CreditCard, ArrowLeft } from '@/components/ui/IconWrapper'

type InvoiceDoc = {
  id: string | number
  invoice_number?: string | null
  invoiceNumber?: string | null
  amount?: number | null
  currency?: string | null
  status?: string | null
  paid_at?: string | null
  paidAt?: string | null
  failure_reason?: string | null
  failureReason?: string | null
}

function fmtCurrency(amount: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch { return `₱${Number(amount || 0).toFixed(2)}` }
}
function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso).slice(0, 16) }
}
function getInvoiceNumber(inv: InvoiceDoc): string {
  return String(inv.invoice_number ?? inv.invoiceNumber ?? inv.id ?? '—')
}
function getAmount(inv: InvoiceDoc): number {
  return typeof inv.amount === 'number' ? inv.amount : Number(inv.amount ?? 0) || 0
}
function getStatus(inv: InvoiceDoc): string {
  return String(inv.status || 'pending').toLowerCase()
}
function getPaidAt(inv: InvoiceDoc): string | null {
  return (inv.paid_at ?? inv.paidAt ?? null) as string | null
}
function getFailureReason(inv: InvoiceDoc): string | null {
  const v = inv.failure_reason ?? inv.failureReason
  return v ? String(v) : null
}

function SuccessSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const initialId = searchParams.get('invoiceId') || ''
  const [invoiceId, setInvoiceId] = useState(initialId)
  const [doc, setDoc] = useState<InvoiceDoc | null>(null)
  const [phase, setPhase] = useState<'loading' | 'paid' | 'failed' | 'pending-timeout' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<number | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function resolveId(): Promise<string | null> {
      if (initialId) return initialId
      try {
        const res = await fetch(`/api/membership/invoices?status=pending&limit=1&_t=${Date.now()}`, { cache: 'no-store' })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) return null
        const arr = Array.isArray(j.docs) ? j.docs : []
        if (arr.length > 0) return String(arr[0].id)
        return null
      } catch { return null }
    }
    async function poll() {
      const resolved = await resolveId()
      if (cancelled) return
      if (!resolved) {
        setError('No invoice found. Check your invoices list for the latest status.')
        setPhase('error')
        return
      }
      setInvoiceId(resolved)
      const started = Date.now()
      const maxMs = 60000
      const intervalMs = 3000
      for (;;) {
        try {
          const res = await fetch(`/api/membership/invoices/${encodeURIComponent(resolved)}?_t=${Date.now()}`, { cache: 'no-store' })
          const j = await res.json().catch(() => ({}))
          if (cancelled) return
          if (!res.ok) {
            setErrorCode(res.status)
            setError(j.error || j.message || (res.status === 403 ? 'Access denied for this invoice' : res.status === 404 ? 'Invoice not found' : 'Failed to verify payment'))
            setPhase('error')
            return
          }
          const inv = (j.doc ?? j.data ?? j.invoice ?? null) as InvoiceDoc | null
          setDoc(inv)
          const st = inv ? getStatus(inv) : 'pending'
          if (st === 'paid') {
            // Confirm sell-access via subscription (tolerate 402)
            try {
              const sub = await fetch(`/api/membership/subscription?_t=${Date.now()}`, { cache: 'no-store' })
              if (sub.status === 402) {
                // still paywalled — keep paid card (webhook raced); do not block
              }
            } catch { /* ignore */ }
            if (!cancelled) setPhase('paid')
            return
          }
          if (st === 'failed') {
            if (!cancelled) setPhase('failed')
            return
          }
          if (Date.now() - started >= maxMs) {
            if (!cancelled) setPhase('pending-timeout')
            return
          }
          setElapsed(Math.round((Date.now() - started) / 1000))
          await new Promise((r) => setTimeout(r, intervalMs))
        } catch (e: unknown) {
          if (Date.now() - started >= maxMs) {
            if (!cancelled) {
              setError(e instanceof Error ? e.message : 'Verification timed out')
              setPhase('pending-timeout')
            }
            return
          }
          await new Promise((r) => setTimeout(r, intervalMs))
        }
      }
    }
    void poll()
    return () => { cancelled = true }
  }, [initialId])

  const handleRetry = async () => {
    setRetrying(true)
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
      setError(e instanceof Error ? e.message : 'Failed to start payment')
      setPhase('error')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <span className="h-8 w-8 rounded-lg bg-[#239459] text-white flex items-center justify-center"><Receipt className="w-4 h-4" /></span>
          Payment result
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Verifying your PayMongo payment with the membership service.</p>
      </div>

      {phase === 'loading' && (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6 text-center shadow-sm">
          <Clock className="w-8 h-8 text-amber-500 mx-auto mb-3 animate-pulse" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Confirming payment… ({elapsed}s)</h3>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">Waiting for the PayMongo webhook to settle invoice {invoiceId || initialId || '…'}. This usually takes a few seconds.</p>
        </div>
      )}

      {phase === 'paid' && doc && (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-emerald-200 dark:border-emerald-800 p-6 text-center shadow-sm">
          <div className="h-14 w-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-4 mx-auto"><CheckCircle className="h-7 w-7 text-emerald-500" /></div>
          <h3 className="font-semibold text-emerald-700 dark:text-emerald-300 text-lg">Payment successful</h3>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 font-mono">{getInvoiceNumber(doc)}</p>
          <p className="text-sm text-gray-700 dark:text-white mt-2 font-semibold">{fmtCurrency(getAmount(doc), String(doc.currency || 'PHP'))} • Paid {fmtDateTime(getPaidAt(doc))}</p>
          <div className="flex justify-center gap-2 mt-6 flex-wrap">
            <Link href="/billing/invoices" className="px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold transition">View subscription</Link>
            <Link href="/dashboard/overview" className="px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-white">Go to dashboard</Link>
          </div>
        </div>
      )}

      {phase === 'failed' && (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-red-200 dark:border-red-800 p-6 text-center shadow-sm">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 mx-auto"><XCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-red-700 dark:text-red-300 text-lg">Payment failed</h3>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1">{getFailureReason((doc ?? {}) as InvoiceDoc) || 'The payment was not completed.'}</p>
          {doc && <p className="text-xs text-gray-400 mt-2 font-mono">{getInvoiceNumber(doc)} • {fmtCurrency(getAmount(doc), String(doc.currency || 'PHP'))}</p>}
          <div className="flex justify-center gap-2 mt-6 flex-wrap">
            <button onClick={() => void handleRetry()} disabled={retrying} className="px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold transition inline-flex items-center gap-2 disabled:opacity-50">
              <CreditCard className="w-4 h-4" /> {retrying ? 'Starting…' : 'Retry payment'}
            </button>
            <Link href="/billing/invoices" className="px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-white">Back to invoices</Link>
          </div>
        </div>
      )}

      {phase === 'pending-timeout' && (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-amber-200 dark:border-amber-800 p-6 text-center shadow-sm">
          <div className="h-14 w-14 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4 mx-auto"><Clock className="h-7 w-7 text-amber-500" /></div>
          <h3 className="font-semibold text-amber-700 dark:text-amber-300 text-lg">Payment pending</h3>
          <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-1 max-w-md mx-auto">The webhook may be delayed. Your payment is still being confirmed — check your invoices again in a minute.</p>
          {doc && <p className="text-xs text-gray-400 mt-2 font-mono">{getInvoiceNumber(doc)}</p>}
          <div className="flex justify-center gap-2 mt-6 flex-wrap">
            <Link href="/billing/invoices" className="px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold transition">Check invoices</Link>
            <Link href="/dashboard/overview" className="px-4 py-2.5 bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-white">Go to dashboard</Link>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6 text-center shadow-sm">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 mx-auto"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{errorCode === 403 ? 'Access denied' : errorCode === 404 ? 'Invoice not found' : 'Could not verify payment'}</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            <Link href="/billing/invoices" className="inline-flex items-center gap-2 px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium"><Receipt className="h-4 w-4" /> View invoices</Link>
            <Link href="/dashboard/overview" className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-[#262626] rounded-lg text-sm font-medium text-gray-700 dark:text-white"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
          </div>
        </div>
      )}

      {phase !== 'loading' && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#a1a1aa]">
          <RefreshCw className="w-4 h-4" />
          <span>Pending means the webhook has not arrived yet — refresh the invoice to re-check.</span>
        </div>
      )}
    </div>
  )
}

export default function BillingSuccessPage() {
  return (
    <ClientOnly fallback={<SuccessSkeleton />}>
      <Suspense fallback={<SuccessSkeleton />}>
        <SuccessContent />
      </Suspense>
    </ClientOnly>
  )
}
