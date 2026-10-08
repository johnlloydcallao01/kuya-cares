'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  CreditCard,
  ExternalLink,
  Receipt,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { ClientOnly } from '@/app/seller/_components/ClientOnly'

type Invoice = {
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

function invoiceNumber(invoice: Invoice) {
  return String(invoice.invoice_number ?? invoice.invoiceNumber ?? invoice.id ?? '—')
}

function invoiceStatus(invoice: Invoice) {
  return String(invoice.status || 'pending').toLowerCase()
}

function displayRelation(value: unknown) {
  if (value == null) return '—'
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id == null ? '—' : String(id)
  }
  return String(value) || '—'
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(value).slice(0, 10)
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(value).slice(0, 16)
  }
}

function formatCurrency(value: unknown, currency = 'PHP') {
  const amount = typeof value === 'number' ? value : Number(value ?? 0) || 0
  try {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `₱${amount.toFixed(2)}`
  }
}

function statusClass(status: string) {
  if (status === 'paid') return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300'
  if (status === 'pending' || status === 'past_due') return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
  if (status === 'failed') return 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
  if (status === 'void' || status === 'refunded') return 'border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
  return 'border-gray-200 bg-gray-100 text-gray-700 dark:border-[#333] dark:bg-[#262626] dark:text-[#a1a1aa]'
}

function detailStatusIcon(status: string) {
  if (status === 'paid') return <CheckCircle className="h-3 w-3" />
  if (status === 'pending' || status === 'past_due') return <Clock className="h-3 w-3" />
  if (status === 'failed') return <XCircle className="h-3 w-3" />
  return <ShieldAlert className="h-3 w-3" />
}

async function parseResponse(response: Response) {
  try {
    return await response.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-[#a1a1aa]">{label}</span>
      <span className={`max-w-[60%] break-words text-right text-gray-900 dark:text-white ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-[#262626] dark:border-[#262626] dark:bg-[#171717]">{children}</div>
    </section>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 px-2.5 py-5">
      <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-[#262626]" />
      <div className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-[#171717]" />
      <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-[#171717]" />
    </div>
  )
}

function InvoiceDetailContent() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = String(params.id ?? '')
  const vendorId = searchParams.get('vendorId') || ''
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<number | null>(null)
  const [paying, setPaying] = useState(false)

  const load = useCallback(async () => {
    if (!id || !vendorId) {
      setError('Vendor profile is required to load this invoice')
      setErrorCode(400)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setErrorCode(null)
    try {
      const query = new URLSearchParams({ vendorId, _t: String(Date.now()) })
      const response = await fetch(`/api/seller-membership/invoices/${encodeURIComponent(id)}?${query}`, { cache: 'no-store' })
      const result = await parseResponse(response)
      if (!response.ok) {
        setErrorCode(response.status)
        const message = typeof result.error === 'string'
          ? result.error
          : response.status === 403 ? 'Access denied for this invoice'
            : response.status === 404 ? 'Invoice not found'
              : 'Failed to load invoice'
        throw new Error(message)
      }
      setInvoice((result.doc ?? result.data ?? result.invoice ?? null) as Invoice | null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [id, vendorId])

  useEffect(() => {
    void load()
  }, [load])

  const status = invoice ? invoiceStatus(invoice) : ''
  const checkoutUrl = invoice?.payment_link_url ?? invoice?.paymentLinkUrl ?? invoice?.checkoutUrl ?? invoice?.checkout_url ?? null
  const currency = invoice?.currency || 'PHP'

  async function startPayment() {
    if (!vendorId) return
    setPaying(true)
    setError(null)
    try {
      const response = await fetch('/api/seller-membership/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        }),
        cache: 'no-store',
      })
      const result = await parseResponse(response)
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create checkout')
      const url = String(result.checkoutUrl ?? result.checkout_url ?? result.payment_link_url ?? result.url ?? '')
      if (!url) throw new Error('No checkout URL returned')
      window.location.href = url
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to start payment')
    } finally {
      setPaying(false)
    }
  }

  const backHref = `/seller/billing/invoices?${new URLSearchParams(vendorId ? { vendorId } : {})}`
  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push(backHref)
  }

  return (
    <div className="space-y-6 px-2.5 py-5">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-[#a1a1aa] dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to invoices</Link>

      {loading ? <DetailSkeleton /> : error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-[#262626] dark:bg-[#171717]">
          <AlertCircle className="mx-auto mb-4 h-7 w-7 text-red-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">{errorCode === 403 ? 'Access denied' : errorCode === 404 ? 'Invoice not found' : 'Failed to load invoice'}</h2>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-medium text-white"><RefreshCw className="h-4 w-4" />Retry</button>
            <Link href={backHref} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-[#262626] dark:text-white">Back</Link>
          </div>
        </div>
      ) : invoice ? (
        <>
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#239459] to-[#215035] text-white"><Receipt className="h-6 w-6" /></span>
              <div>
                <h1 className="font-mono text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">{invoiceNumber(invoice)}</h1>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-[#a1a1aa]">{formatCurrency(invoice.amount, currency)} • {String(invoice.billingReason ?? invoice.billing_reason ?? '—').replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(status)}`}>{detailStatusIcon(status)}{status.replace(/_/g, ' ')}</span>
              {(status === 'pending' || status === 'past_due') && (checkoutUrl ? (
                <a href={String(checkoutUrl)} className="inline-flex items-center gap-2 rounded-xl bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#215035]"><CreditCard className="h-4 w-4" /> Pay now</a>
              ) : (
                <button onClick={() => void startPayment()} disabled={paying} className="inline-flex items-center gap-2 rounded-xl bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#215035] disabled:opacity-50"><CreditCard className="h-4 w-4" />{paying ? 'Starting…' : 'Pay now'}</button>
              ))}
              <button onClick={goBack} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-[#262626] dark:bg-[#171717] dark:text-white">Close</button>
            </div>
          </div>

          {(status === 'pending' || status === 'past_due') && checkoutUrl && <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"><span>This invoice is awaiting payment. Complete checkout to restore full selling access.</span><a href={String(checkoutUrl)} className="inline-flex shrink-0 items-center gap-1 font-semibold underline">Open checkout <ExternalLink className="h-3 w-3" /></a></div>}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <Section title="Invoice">
                <Row label="Invoice number" value={invoiceNumber(invoice)} mono />
                <Row label="Status" value={<span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(status)}`}>{status.replace(/_/g, ' ')}</span>} />
                <Row label="Amount" value={formatCurrency(invoice.amount, currency)} mono />
                <Row label="Discount" value={invoice.discount_amount ?? invoice.discountAmount != null ? formatCurrency(invoice.discount_amount ?? invoice.discountAmount, currency) : '—'} mono />
                <Row label="Coupon" value={String(invoice.couponCode ?? invoice.coupon_code ?? '—')} mono />
                <Row label="Billing reason" value={String(invoice.billingReason ?? invoice.billing_reason ?? '—').replace(/_/g, ' ')} />
                <Row label="Proration delta" value={invoice.prorationDelta ?? invoice.proration_delta != null ? formatCurrency(invoice.prorationDelta ?? invoice.proration_delta, currency) : '—'} mono />
              </Section>
              <Section title="Subscription">
                <Row label="Subscription ID" value={displayRelation(invoice.subscription ?? invoice.subscription_id ?? invoice.subscriptionId)} mono />
                <Row label="Plan ID" value={displayRelation(invoice.plan ?? invoice.plan_id ?? invoice.planId)} mono />
                <Row label="Period start" value={formatDate(invoice.period_start ?? invoice.periodStart ?? null)} mono />
                <Row label="Period end" value={formatDate(invoice.period_end ?? invoice.periodEnd ?? null)} mono />
              </Section>
            </div>
            <div className="space-y-5">
              <Section title="Payment">
                <Row label="Provider" value={String(invoice.payment_provider ?? invoice.paymentProvider ?? '—')} mono />
                <Row label="Due at" value={formatDateTime(invoice.due_at ?? invoice.dueAt ?? null)} mono />
                <Row label="Paid at" value={formatDateTime(invoice.paid_at ?? invoice.paidAt ?? null)} mono />
                <Row label="Retry count" value={String(invoice.retry_count ?? invoice.retryCount ?? 0)} mono />
                {(invoice.failure_reason ?? invoice.failureReason) && <Row label="Failure reason" value={String(invoice.failure_reason ?? invoice.failureReason)} />}
                <Row label="Checkout URL" value={checkoutUrl ? <a href={String(checkoutUrl)} className="break-all text-[#239459] underline">{String(checkoutUrl)}</a> : '—'} mono />
              </Section>
              <Section title="Timeline">
                <Row label="Created" value={formatDateTime(invoice.createdAt ?? null)} mono />
                <Row label="Updated" value={formatDateTime(invoice.updatedAt ?? null)} mono />
                <Row label="ID" value={`#${String(invoice.id)}`} mono />
              </Section>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-500 dark:border-[#262626] dark:bg-[#171717] dark:text-[#a1a1aa]">Membership invoices are read-only billing records. Paid amounts reflect PayMongo settlement only; contact support if a settled invoice needs review.</div>
        </>
      ) : null}
    </div>
  )
}

export default function SellerInvoiceDetailPage() {
  return <ClientOnly fallback={<DetailSkeleton />}><InvoiceDetailContent /></ClientOnly>
}
