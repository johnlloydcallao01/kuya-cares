'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import { Receipt, ArrowLeft, RefreshCw, AlertCircle, CheckCircle, Clock, XCircle, ShieldAlert, CreditCard, ExternalLink } from '@/components/ui/IconWrapper'

type InvoiceDoc = {
  id: string | number
  invoice_number?: string | null
  invoiceNumber?: string | null
  amount?: number | null
  currency?: string | null
  commission_due?: number | null
  commissionDue?: number | null
  status?: string | null
  billingReason?: string | null
  billing_reason?: string | null
  subscription?: string | number | { id?: string | number } | null
  subscription_id?: string | number | null
  subscriptionId?: string | number | null
  plan?: string | number | { id?: string | number } | null
  plan_id?: string | number | null
  planId?: string | number | null
  prorationDelta?: number | null
  proration_delta?: number | null
  discount_amount?: number | null
  discountAmount?: number | null
  couponCode?: string | null
  coupon_code?: string | null
  payment_provider?: string | null
  paymentProvider?: string | null
  payment_link_url?: string | null
  paymentLinkUrl?: string | null
  checkoutUrl?: string | null
  checkout_url?: string | null
  period_start?: string | null
  periodStart?: string | null
  period_end?: string | null
  periodEnd?: string | null
  due_at?: string | null
  dueAt?: string | null
  paid_at?: string | null
  paidAt?: string | null
  retry_count?: number | null
  retryCount?: number | null
  failure_reason?: string | null
  failureReason?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

function str(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'object') {
    const o = v as { id?: unknown }
    if (o.id != null) return String(o.id)
    return '—'
  }
  const s = String(v)
  return s === '' ? '—' : s
}
function getInvoiceNumber(inv: InvoiceDoc): string {
  return String(inv.invoice_number ?? inv.invoiceNumber ?? inv.id ?? '—')
}
function getAmount(inv: InvoiceDoc): number {
  return typeof inv.amount === 'number' ? inv.amount : Number(inv.amount ?? 0) || 0
}
function getCurrency(inv: InvoiceDoc): string {
  return String(inv.currency || 'PHP')
}
function getStatus(inv: InvoiceDoc): string {
  return String(inv.status || 'pending').toLowerCase()
}
function getBillingReason(inv: InvoiceDoc): string {
  return String(inv.billingReason ?? inv.billing_reason ?? '—')
}
function getDiscount(inv: InvoiceDoc): number | null {
  const v = inv.discount_amount ?? inv.discountAmount
  return v == null ? null : Number(v)
}
function getCoupon(inv: InvoiceDoc): string {
  return str(inv.couponCode ?? inv.coupon_code)
}
function getSubscription(inv: InvoiceDoc): string {
  return str(inv.subscription ?? inv.subscription_id ?? inv.subscriptionId)
}
function getPlan(inv: InvoiceDoc): string {
  const p = inv.plan ?? inv.plan_id ?? inv.planId
  return str(p)
}
function getProvider(inv: InvoiceDoc): string {
  return str(inv.payment_provider ?? inv.paymentProvider)
}
function getCheckoutUrl(inv: InvoiceDoc): string | null {
  const u = inv.payment_link_url ?? inv.paymentLinkUrl ?? inv.checkoutUrl ?? inv.checkout_url
  return u ? String(u) : null
}
function getPeriodStart(inv: InvoiceDoc): string | null {
  return (inv.period_start ?? inv.periodStart ?? null) as string | null
}
function getPeriodEnd(inv: InvoiceDoc): string | null {
  return (inv.period_end ?? inv.periodEnd ?? null) as string | null
}
function getDueAt(inv: InvoiceDoc): string | null {
  return (inv.due_at ?? inv.dueAt ?? null) as string | null
}
function getPaidAt(inv: InvoiceDoc): string | null {
  return (inv.paid_at ?? inv.paidAt ?? null) as string | null
}
function getRetryCount(inv: InvoiceDoc): string {
  const v = inv.retry_count ?? inv.retryCount
  return v == null ? '0' : String(v)
}
function getFailureReason(inv: InvoiceDoc): string | null {
  const v = inv.failure_reason ?? inv.failureReason
  return v ? String(v) : null
}
function getProrationDelta(inv: InvoiceDoc): number | null {
  const v = inv.prorationDelta ?? inv.proration_delta
  return v == null ? null : Number(v)
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' }) } catch { return String(iso).slice(0, 10) }
}
function fmtDateTime(iso: string | null) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return String(iso).slice(0, 16) }
}
function fmtCurrency(amount: number, currency = 'PHP') {
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch { return `₱${Number(amount || 0).toFixed(2)}` }
}
function invBadge(status: string) {
  const s = String(status || '').toLowerCase()
  if (s === 'paid') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (s === 'pending' || s === 'past_due') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (s === 'failed') return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
  if (s === 'void' || s === 'refunded') return 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      <div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] bg-white dark:bg-[#171717]">
        {children}
      </div>
    </div>
  )
}
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-xs font-medium text-gray-500 dark:text-[#a1a1aa] shrink-0">{label}</span>
      <span className={`text-right max-w-[60%] break-words text-gray-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="h-24 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
    </div>
  )
}

function InvoiceDetailContent() {
  const params = useParams()
  const router = useRouter()
  const id = String((params as { id?: string }).id ?? '')

  const [doc, setDoc] = useState<InvoiceDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<number | null>(null)
  const [paying, setPaying] = useState(false)

  const load = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    setErrorCode(null)
    try {
      const res = await fetch(`/api/membership/invoices/${encodeURIComponent(id)}?_t=${Date.now()}`, { cache: 'no-store' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorCode(res.status)
        throw new Error(j.error || j.message || (res.status === 403 ? 'Access denied for this invoice' : res.status === 404 ? 'Invoice not found' : 'Failed to load invoice'))
      }
      setDoc((j.doc ?? j.data ?? j.invoice ?? null) as InvoiceDoc | null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const handlePay = async () => {
    setPaying(true)
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
    } finally {
      setPaying(false)
    }
  }

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/billing/invoices')
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <Link href="/billing/invoices" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to invoices
      </Link>

      {loading ? (
        <DetailSkeleton />
      ) : error ? (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6 text-center">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 mx-auto"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">{errorCode === 403 ? 'Access denied' : errorCode === 404 ? 'Invoice not found' : 'Failed to load invoice'}</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => void load()} className="px-4 py-2 bg-[#239459] text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Retry</button>
            <Link href="/billing/invoices" className="px-4 py-2 border border-gray-200 dark:border-[#262626] rounded-lg text-sm font-medium text-gray-700 dark:text-white">Back</Link>
          </div>
        </div>
      ) : doc ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-white flex items-center justify-center"><Receipt className="w-6 h-6" /></span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-mono">{getInvoiceNumber(doc)}</h1>
                <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-0.5">
                  {fmtCurrency(getAmount(doc), getCurrency(doc))} • {getBillingReason(doc).replace('_', ' ')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${invBadge(getStatus(doc))}`}>
                {getStatus(doc) === 'paid' ? <CheckCircle className="w-3 h-3" /> : getStatus(doc) === 'pending' || getStatus(doc) === 'past_due' ? <Clock className="w-3 h-3" /> : getStatus(doc) === 'failed' ? <XCircle className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                {getStatus(doc).replace('_', ' ')}
              </span>
              {(getStatus(doc) === 'pending' || getStatus(doc) === 'past_due') && (
                getCheckoutUrl(doc) ? (
                  <a href={getCheckoutUrl(doc) as string} className="px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold transition inline-flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Pay now
                  </a>
                ) : (
                  <button onClick={() => void handlePay()} disabled={paying} className="px-4 py-2.5 bg-[#239459] hover:bg-[#215035] text-white rounded-xl text-sm font-semibold transition inline-flex items-center gap-2 disabled:opacity-50">
                    <CreditCard className="w-4 h-4" /> {paying ? 'Starting…' : 'Pay now'}
                  </button>
                )
              )}
              <button onClick={handleBack} className="px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-white">Close</button>
            </div>
          </div>

          {(getStatus(doc) === 'pending' || getStatus(doc) === 'past_due') && getCheckoutUrl(doc) && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
              <span>This invoice is awaiting payment. Complete checkout to restore full selling access.</span>
              <a href={getCheckoutUrl(doc) as string} className="inline-flex items-center gap-1 font-semibold underline shrink-0">Open checkout <ExternalLink className="w-3 h-3" /></a>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-5">
              <Section title="Invoice">
                <Row label="Invoice number" value={getInvoiceNumber(doc)} mono />
                <Row label="Status" value={<span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${invBadge(getStatus(doc))}`}>{getStatus(doc).replace('_', ' ')}</span>} />
                <Row label="Amount" value={fmtCurrency(getAmount(doc), getCurrency(doc))} mono />
                <Row label="Discount" value={getDiscount(doc) != null ? fmtCurrency(Number(getDiscount(doc)), getCurrency(doc)) : '—'} mono />
                <Row label="Coupon" value={getCoupon(doc)} mono />
                <Row label="Billing reason" value={getBillingReason(doc).replace('_', ' ')} />
                <Row label="Proration delta" value={getProrationDelta(doc) != null ? fmtCurrency(Number(getProrationDelta(doc)), getCurrency(doc)) : '—'} mono />
              </Section>
              <Section title="Subscription">
                <Row label="Subscription ID" value={getSubscription(doc)} mono />
                <Row label="Plan ID" value={getPlan(doc)} mono />
                <Row label="Period start" value={fmtDate(getPeriodStart(doc))} mono />
                <Row label="Period end" value={fmtDate(getPeriodEnd(doc))} mono />
              </Section>
            </div>
            <div className="space-y-5">
              <Section title="Payment">
                <Row label="Provider" value={getProvider(doc)} mono />
                <Row label="Due at" value={fmtDateTime(getDueAt(doc))} mono />
                <Row label="Paid at" value={fmtDateTime(getPaidAt(doc))} mono />
                <Row label="Retry count" value={getRetryCount(doc)} mono />
                {getFailureReason(doc) && <Row label="Failure reason" value={String(getFailureReason(doc))} />}
                <Row label="Checkout URL" value={getCheckoutUrl(doc) ? <a href={getCheckoutUrl(doc) as string} className="text-[#239459] underline break-all">{String(getCheckoutUrl(doc))}</a> : '—'} mono />
              </Section>
              <Section title="Timeline">
                <Row label="Created" value={fmtDateTime((doc.createdAt ?? null) as string | null)} mono />
                <Row label="Updated" value={fmtDateTime((doc.updatedAt ?? null) as string | null)} mono />
                <Row label="ID" value={`#${String(doc.id)}`} mono />
              </Section>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4 text-xs text-gray-500 dark:text-[#a1a1aa]">
            Membership invoices are read-only billing records. Refunds handled by platform; contact support if a settled invoice needs review.
          </div>
        </>
      ) : null}
    </div>
  )
}

export default function InvoiceDetailPage() {
  return (
    <ClientOnly fallback={<DetailSkeleton />}>
      <InvoiceDetailContent />
    </ClientOnly>
  )
}
