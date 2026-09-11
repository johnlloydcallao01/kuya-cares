'use client'

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Ticket, AlertCircle, Pencil, CalendarDays, Store, TrendingUp,
  DollarSign, ShieldCheck, Clock, Users, Truck
} from '@/components/ui/IconWrapper'
import { statusBadge, discountSummary, fmtMoney, fmtDate, vendorName, type CouponDoc } from '../page'
import { ClientOnly } from '@/components/ClientOnly'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">{title}</h4>
      <div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden bg-white dark:bg-[#171717]">{children}</div>
    </div>
  )
}
function Row({ label, value, mono, icon }: { label: string; value: React.ReactNode; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="text-gray-500 dark:text-[#a1a1aa] text-xs font-medium shrink-0 flex items-center gap-1">{icon}{label}</span>
      <span className={`text-gray-900 dark:text-white text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</span>
    </div>
  )
}

type RedemptionDoc = {
  id: number
  code_snapshot: string
  total_discount: number
  food_discount: number
  delivery_discount: number
  funded_by: string
  vendor_share: number
  platform_share: number
  status: string
  order: unknown
  customer: unknown
  createdAt: string
}
function redemptionId(v: unknown) {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number') return `#${v}`
  if (typeof v === 'object' && v !== null && 'id' in (v as any)) return `#${(v as any).id}`
  return '—'
}

function CouponDetailSkeleton(){
  return <div className="space-y-6 py-5 px-2.5"><div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" /><div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" /></div>
}

function CouponDetailContent() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [doc, setDoc] = useState<CouponDoc | null>(null)
  const [redemptions, setRedemptions] = useState<RedemptionDoc[]>([])
  const [redemptionTotal, setRedemptionTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/coupons/${id}`, { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to load coupon')
      setDoc(j.doc)
      try {
        const rRes = await fetch(`/api/coupons/redemptions?couponId=${id}&limit=5`, { cache: 'no-store' })
        const rj = await rRes.json().catch(() => ({}))
        if (rRes.ok) {
          setRedemptions(rj.docs || [])
          setRedemptionTotal(typeof rj.pagination?.totalDocs === 'number' ? rj.pagination.totalDocs : (rj.docs || []).length)
        }
      } catch { /* redemptions preview is best-effort */ }
    } catch (e: any) { setError(e.message || 'Failed to load') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <div className="h-8 w-32 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
        <div className="h-64 bg-gray-100 dark:bg-[#171717] rounded-xl animate-pulse" />
      </div>
    )
  }
  if (error || !doc) {
    return (
      <div className="space-y-6 py-5 px-2.5">
        <Link href="/coupons" className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back to coupons</Link>
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626]">
          <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4"><AlertCircle className="h-7 w-7 text-red-500" /></div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Failed to load coupon</h3>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <Link href="/coupons" className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#eba236] text-white rounded-lg text-sm font-medium">Back</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <button onClick={() => (typeof window !== 'undefined' && window.history.length > 1 ? router.back() : router.push('/coupons'))} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-[#a1a1aa] hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#eba236] to-[#c88a20] text-white flex items-center justify-center shrink-0"><Ticket className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight font-mono">{doc.code}</h1>
            <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">{discountSummary(doc)} • {vendorName(doc.vendor)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/coupons/${doc.id}/edit`} className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#eba236] hover:bg-[#c88a20] text-white rounded-xl text-sm font-semibold shadow-sm transition"><Pencil className="w-4 h-4" /> Edit</Link>
          <Link href="/coupons" className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-xl text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626]">Close</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Status</p><p className={`mt-2 inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border capitalize ${statusBadge(doc.status)}`}>{doc.status}</p><p className="text-xs text-gray-500 mt-1">Updated {fmtDate(doc.updatedAt)}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Usage</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><TrendingUp className="w-5 h-5 text-[#eba236]" /> {doc.usage_count}{doc.usage_limit > 0 ? ` / ${doc.usage_limit}` : ''}</p><p className="text-xs text-gray-500">{doc.usage_limit_per_user > 0 ? `max ${doc.usage_limit_per_user} per customer` : 'no per-customer cap'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Discount</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><DollarSign className="w-5 h-5 text-emerald-600" /> {discountSummary(doc)}</p><p className="text-xs text-gray-500">{doc.free_delivery ? ' + free delivery' : doc.applies_to === 'both' ? 'food + delivery' : doc.applies_to === 'delivery_fee' ? 'delivery fee' : 'food subtotal'}</p></div>
        <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4"><p className="text-xs text-gray-500">Validity</p><p className="mt-2 font-bold flex items-center gap-1 text-lg"><Clock className="w-5 h-5 text-amber-500" /> {doc.expires_at ? fmtDate(doc.expires_at) : 'No expiry'}</p><p className="text-xs text-gray-500">{doc.minimum_basket ? `min ${fmtMoney(doc.minimum_basket)}` : 'no minimum basket'}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Section title="Discount Rules">
            <Row label="Type" value={doc.discount_type.replace(/_/g, ' ')} icon={<DollarSign className="w-3 h-3" />} />
            <Row label="Amount" value={doc.discount_type === 'percent' ? `${doc.amount}%` : fmtMoney(doc.amount)} mono />
            {doc.max_discount_amount != null && <Row label="Max cap" value={fmtMoney(doc.max_discount_amount)} mono />}
            <Row label="Applies to" value={doc.applies_to.replace(/_/g, ' ')} />
            <Row label="Free delivery" value={doc.free_delivery ? `Yes${doc.delivery_discount_cap ? ` (up to ${fmtMoney(doc.delivery_discount_cap)})` : ''}` : 'No'} icon={<Truck className="w-3 h-3" />} />
            <Row label="One per order" value={doc.individual_use ? 'Yes' : `Up to ${doc.max_coupons_per_order}`} icon={<ShieldCheck className="w-3 h-3" />} />
            <Row label="Skip promo items" value={doc.exclude_promo_items ? 'Yes' : 'No'} />
            {doc.limit_per_order_items != null && <Row label="Unit limit" value={String(doc.limit_per_order_items)} mono />}
          </Section>
          <Section title="Scope">
            <Row label="Vendor" value={vendorName(doc.vendor)} icon={<Store className="w-3 h-3" />} />
            <Row label="Branches" value={doc.merchant_scope === 'selected_branches' ? `${doc.merchants.length} selected` : 'All branches'} />
            <Row label="Menu items" value={doc.menu_items.length ? `${doc.menu_items.length} only` : 'Whole menu'} />
            <Row label="Excluded items" value={doc.excluded_menu_items.length ? String(doc.excluded_menu_items.length) : 'None'} />
            <Row label="Categories" value={doc.menu_categories.length ? `${doc.menu_categories.length} only` : 'All categories'} />
            <Row label="Excluded categories" value={doc.excluded_menu_categories.length ? String(doc.excluded_menu_categories.length) : 'None'} />
          </Section>
          <Section title="Funding (settlement)">
            <Row label="Funded by" value={doc.funded_by} icon={<Truck className="w-3 h-3" />} />
            {doc.funded_by === 'split' && <Row label="Vendor share" value={`${doc.vendor_share_pct}%`} mono />}
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Schedule & Limits">
            <Row label="Starts" value={fmtDate(doc.starts_at)} icon={<CalendarDays className="w-3 h-3" />} />
            <Row label="Expires" value={fmtDate(doc.expires_at)} />
            <Row label="Promo hours" value={doc.time_windows.length ? `${doc.time_windows.length} schedule(s)` : 'Always'} icon={<Clock className="w-3 h-3" />} />
            <Row label="Total cap" value={doc.usage_limit > 0 ? String(doc.usage_limit) : 'Unlimited'} mono />
            <Row label="Per customer" value={doc.usage_limit_per_user > 0 ? String(doc.usage_limit_per_user) : 'Unlimited'} mono icon={<Users className="w-3 h-3" />} />
            <Row label="First orders only" value={doc.first_order_only ? 'Yes' : 'No'} />
            <Row label="Payment methods" value={doc.allowed_payment_methods.length ? doc.allowed_payment_methods.join(', ') : 'All'} />
            <Row label="Emails" value={doc.email_restrictions.length ? doc.email_restrictions.join(', ') : '—'} mono />
            <Row label="Phones" value={doc.phone_restrictions.length ? doc.phone_restrictions.join(', ') : '—'} mono />
          </Section>
          <Section title={`Recent Redemptions (${redemptionTotal})`}>
            {redemptions.length ? (
              <div className="divide-y divide-gray-100 dark:divide-[#262626]">
                {redemptions.map((r) => (
                  <div key={r.id} className="flex items-center justify-between p-4">
                    <div><div className="font-medium text-sm text-gray-900 dark:text-white">Order {redemptionId(r.order)} • {fmtMoney(r.total_discount)} off</div><div className="text-xs text-gray-500">{fmtDate(r.createdAt)} • {r.funded_by} funded</div></div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${r.status === 'applied' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300' : r.status === 'held' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300' : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'}`}>{r.status}</span>
                  </div>
                ))}
              </div>
            ) : <div className="p-6 text-sm text-gray-500 text-center">No redemptions yet — share this code to start tracking usage.</div>}
            <div className="px-4 py-3"><Link href="/coupons/usage" className="text-xs font-semibold text-[#eba236] hover:underline">Open full usage report →</Link></div>
          </Section>
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-[#eba236]" /> Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Created</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.createdAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Updated</span><span className="font-mono text-xs text-gray-900 dark:text-white">{fmtDate(doc.updatedAt)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="font-mono text-xs text-gray-900 dark:text-white">#{doc.id}</span></div>
            </div>
          </div>
          {doc.description && (
            <div className="rounded-xl border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Internal notes</h4>
              <p className="text-sm text-gray-600 dark:text-[#a1a1aa]">{doc.description}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CouponDetailPage(){
  // Helpers (fmtMoney/fmtDate) are imported pinned from ../page; ClientOnly
  // defers first render to post-mount so SSR + hydration match.
  return (
    <ClientOnly fallback={<CouponDetailSkeleton />}>
      <CouponDetailContent />
    </ClientOnly>
  )
}
