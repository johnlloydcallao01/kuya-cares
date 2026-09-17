'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter, notFound } from 'next/navigation'
import Link from 'next/link'
import { ClientOnly } from '@/components/ClientOnly'
import { Ticket, ArrowLeft, RefreshCw, AlertCircle, TrendingUp, DollarSign, Clock } from '@/components/ui/IconWrapper'
import type { CouponDoc } from '../_components/CouponForm'

function fmtMoney(n: number | null) {
  if (n == null) return '—'
  try {
    return `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  } catch {
    return `₱${Number(n).toFixed(2)}`
  }
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return String(iso).slice(0, 10)
  }
}
function statusBadge(s: string) {
  const v = (s || '').toLowerCase()
  if (v === 'published') return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
  if (v === 'scheduled') return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
  if (v === 'paused') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800'
  if (v === 'archived') return 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
  return 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-[#262626] dark:text-[#a1a1aa] dark:border-[#262626]'
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

function CouponDetailContent() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  if (['new', 'usage'].includes(id)) notFound()

  const [doc, setDoc] = useState<CouponDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back()
    else router.push('/coupons')
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={handleBack} className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back to coupons
      </button>

      {loading ? (
        <DetailSkeleton />
      ) : error ? (
        <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6 text-center">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4 mx-auto"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <p className="text-sm text-red-600">{error}</p>
          <div className="flex justify-center gap-2 mt-4">
            <button onClick={() => void load()} className="px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Retry</button>
            <Link href="/coupons" className="px-4 py-2 border border-gray-200 dark:border-[#262626] rounded-lg text-sm font-medium">Back</Link>
          </div>
        </div>
      ) : doc ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center"><Ticket className="w-6 h-6" /></span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-mono">{doc.code}</h1>
                <p className="text-sm text-gray-500 dark:text-[#a1a1aa] mt-0.5">
                  {doc.discount_type === 'percent' ? `${doc.amount}% off` : `${fmtMoney(doc.amount)} off`} · {doc.merchant_scope === 'selected_branches' ? `${Array.isArray(doc.merchants) ? doc.merchants.length : 0} branches` : 'All branches'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/coupons/${doc.id}/edit`} className="px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold transition">Edit</Link>
              <button onClick={handleBack} className="px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium">Close</button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
              <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Status</p>
              <p className="mt-2"><span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${statusBadge(doc.status)}`}>{doc.status}</span></p>
              <p className="text-xs text-gray-400 mt-1">Updated {fmtDate(doc.updatedAt ?? null)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
              <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Usage</p>
              <p className="mt-2 font-bold flex items-center gap-1 text-lg text-gray-900 dark:text-white"><TrendingUp className="w-5 h-5 text-[#eba236]" /> {doc.usage_count}{doc.usage_limit > 0 ? ` / ${doc.usage_limit}` : ''}</p>
              <p className="text-xs text-gray-400 mt-1">{doc.usage_limit_per_user > 0 ? `max ${doc.usage_limit_per_user} / customer` : 'no per-customer cap'}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
              <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Discount</p>
              <p className="mt-2 font-bold flex items-center gap-1 text-lg text-gray-900 dark:text-white"><DollarSign className="w-5 h-5 text-emerald-600" /> {doc.discount_type === 'percent' ? `${doc.amount}%` : fmtMoney(doc.amount)}</p>
              <p className="text-xs text-gray-400 mt-1">{doc.applies_to.replace('_', ' ')}{doc.free_delivery ? ' + free delivery' : ''}</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
              <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Validity</p>
              <p className="mt-2 font-semibold flex items-center gap-1 text-sm text-gray-900 dark:text-white"><Clock className="w-4 h-4 text-amber-500" /> {doc.starts_at ? fmtDate(doc.starts_at) : '—'} → {doc.expires_at ? fmtDate(doc.expires_at) : '—'}</p>
              <p className="text-xs text-gray-400 mt-1">{doc.minimum_basket != null ? `min basket ${fmtMoney(Number(doc.minimum_basket))}` : 'no min basket'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-5">
              <Section title="Discount rules">
                <Row label="Type" value={doc.discount_type} mono />
                <Row label="Amount" value={doc.discount_type === 'percent' ? `${doc.amount}%` : fmtMoney(doc.amount)} mono />
                <Row label="Max cap" value={doc.max_discount_amount != null ? fmtMoney(Number(doc.max_discount_amount)) : '—'} mono />
                <Row label="Applies to" value={doc.applies_to.replace('_', ' ')} />
                <Row label="Free delivery" value={doc.free_delivery ? `Yes${doc.delivery_discount_cap != null ? ` (cap ${fmtMoney(Number(doc.delivery_discount_cap))})` : ''}` : 'No'} />
                <Row label="One per order" value={doc.individual_use ? 'Yes' : `No (max ${doc.max_coupons_per_order})`} />
                <Row label="Skip promo items" value={doc.exclude_promo_items ? 'Yes' : 'No'} />
              </Section>
              <Section title="Branches & menu scope">
                <Row label="Scope" value={doc.merchant_scope === 'selected_branches' ? `Selected (${Array.isArray(doc.merchants) ? doc.merchants.length : 0})` : 'All my branches'} />
                <Row label="Menu items" value={Array.isArray(doc.menu_items) && doc.menu_items.length ? `${doc.menu_items.length} item(s)` : 'Whole menu'} />
                <Row label="Categories" value={Array.isArray(doc.menu_categories) && doc.menu_categories.length ? `${doc.menu_categories.length} categorie(s)` : 'All categories'} />
              </Section>
              <Section title="Funding">
                <Row label="Funded by" value="Platform" />
                <Row label="Note" value="Platform-funded discounts never reduce your payouts." />
              </Section>
            </div>
            <div className="space-y-5">
              <Section title="Schedule & limits">
                <Row label="Starts" value={fmtDate(doc.starts_at)} mono />
                <Row label="Expires" value={fmtDate(doc.expires_at)} mono />
                <Row label="First orders only" value={doc.first_order_only ? 'Yes' : 'No'} />
                <Row label="Payments" value={doc.allowed_payment_methods.length ? doc.allowed_payment_methods.join(', ') : 'All methods'} mono />
                <Row label="Emails" value={doc.email_restrictions.length ? doc.email_restrictions.join(', ') : '—'} mono />
                <Row label="Phones" value={doc.phone_restrictions.length ? doc.phone_restrictions.join(', ') : '—'} mono />
              </Section>
              <Section title="Timeline">
                <Row label="Created" value={fmtDate(doc.createdAt ?? null)} mono />
                <Row label="Updated" value={fmtDate(doc.updatedAt ?? null)} mono />
                <Row label="ID" value={`#${doc.id}`} mono />
              </Section>
              {doc.description && (
                <Section title="Internal notes">
                  <div className="px-4 py-2.5 text-sm text-gray-700 dark:text-[#a1a1aa]">{doc.description}</div>
                </Section>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

export default function CouponDetailPage() {
  return (
    <ClientOnly fallback={<DetailSkeleton />}>
      <CouponDetailContent />
    </ClientOnly>
  )
}
